import hashlib
import os
import re
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from uuid import uuid4

from fastapi import HTTPException

from app.models.access import (
    AdminInviteCreate,
    InviteResult,
    TesterActivationRequest,
    TesterApplicationCreate,
    TesterApplicationReceipt,
    TesterRecord,
    TesterSource,
    TesterStatus,
)
from app.services.state_store import StateStore


TERMS_VERSION = "1.2-beta"
INVITE_HOURS = 72
NAMESPACE = "testers"


class AccessService:
    def __init__(self) -> None:
        self.store = StateStore()

    def request_access(self, data: TesterApplicationCreate) -> TesterApplicationReceipt:
        if not data.accepted_terms:
            raise HTTPException(status_code=400, detail="É necessário aceitar os Termos e o Aviso de Privacidade.")
        email = self._email(data.email)
        payload = self._read()
        existing = self._by_email(payload, email)
        if existing and existing["status"] not in {TesterStatus.REJECTED, TesterStatus.INVITE_EXPIRED}:
            raise HTTPException(status_code=409, detail="Já existe uma solicitação ou convite para este e-mail.")
        now = datetime.now(UTC)
        record = TesterRecord(
            id=str(uuid4()), email=email, full_name=data.full_name.strip(),
            professional_role=data.professional_role.strip(), city_state=data.city_state.strip(),
            municipalities=[item.strip() for item in data.municipalities if item.strip()],
            project_types=[item.strip() for item in data.project_types if item.strip()],
            has_project=data.has_project, has_municipal_feedback=data.has_municipal_feedback,
            interest=data.interest.strip() if data.interest else None,
            source=TesterSource.PUBLIC_REQUEST, status=TesterStatus.REQUESTED,
            created_at=now, updated_at=now, accepted_terms_at=now, terms_version=TERMS_VERSION,
        )
        if existing:
            payload["testers"].remove(existing)
        payload["testers"].append(record.model_dump(mode="json"))
        self._write(payload)
        return TesterApplicationReceipt(id=record.id, status=record.status, email=record.email)

    def preapprove(self, admin_key: str, data: AdminInviteCreate) -> InviteResult:
        self.check_admin(admin_key)
        email = self._email(data.email)
        payload = self._read()
        existing = self._by_email(payload, email)
        now = datetime.now(UTC)
        if existing:
            existing["full_name"] = data.full_name or existing.get("full_name")
            existing["source"] = TesterSource.ADMIN_INVITE
            existing["status"] = TesterStatus.PREAPPROVED
            existing["updated_at"] = now.isoformat()
            record = existing
        else:
            record = TesterRecord(
                id=str(uuid4()), email=email, full_name=data.full_name,
                source=TesterSource.ADMIN_INVITE, status=TesterStatus.PREAPPROVED,
                created_at=now, updated_at=now,
            ).model_dump(mode="json")
            payload["testers"].append(record)
        result = self._issue_invite(record)
        self._write(payload)
        return result

    def approve(self, admin_key: str, tester_id: str) -> InviteResult:
        self.check_admin(admin_key)
        payload = self._read()
        record = self._by_id(payload, tester_id)
        if record["status"] not in {TesterStatus.REQUESTED, TesterStatus.INVITE_EXPIRED}:
            raise HTTPException(status_code=400, detail="Este cadastro não está aguardando aprovação.")
        record["status"] = TesterStatus.PREAPPROVED
        record["updated_at"] = datetime.now(UTC).isoformat()
        result = self._issue_invite(record)
        self._write(payload)
        return result

    def activate(self, data: TesterActivationRequest) -> TesterRecord:
        if not data.accepted_terms:
            raise HTTPException(status_code=400, detail="É necessário aceitar os Termos e o Aviso de Privacidade.")
        payload = self._read()
        record = self._by_email(payload, self._email(data.email))
        if not record or record["status"] != TesterStatus.PREAPPROVED:
            raise HTTPException(status_code=403, detail="Este e-mail não possui um convite ativo.")
        expires = datetime.fromisoformat(record["invite_expires_at"])
        if expires < datetime.now(UTC):
            record["status"] = TesterStatus.INVITE_EXPIRED
            self._write(payload)
            raise HTTPException(status_code=410, detail="O convite expirou. Solicite um novo convite.")
        if not self._matches(data.invite_code, record.get("invite_hash", "")):
            raise HTTPException(status_code=403, detail="Código de convite inválido.")
        record["full_name"] = data.full_name or record.get("full_name")
        record["professional_role"] = data.professional_role or record.get("professional_role")
        record["city_state"] = data.city_state or record.get("city_state")
        record["municipalities"] = data.municipalities or record.get("municipalities", [])
        record["project_types"] = data.project_types or record.get("project_types", [])
        record["has_project"] = data.has_project if data.has_project is not None else record.get("has_project")
        record["has_municipal_feedback"] = data.has_municipal_feedback if data.has_municipal_feedback is not None else record.get("has_municipal_feedback")
        if not record.get("full_name") or not record.get("professional_role") or not record.get("city_state"):
            raise HTTPException(status_code=400, detail="Complete nome, perfil profissional e cidade/estado.")
        now = datetime.now(UTC)
        record.update(status=TesterStatus.ACTIVE, updated_at=now.isoformat(), accepted_terms_at=now.isoformat(), terms_version=TERMS_VERSION)
        record.pop("invite_hash", None)
        record["invite_expires_at"] = None
        self._write(payload)
        return TesterRecord.model_validate(record)

    def list_testers(self, admin_key: str) -> list[TesterRecord]:
        self.check_admin(admin_key)
        return [TesterRecord.model_validate(item) for item in self._read()["testers"]]

    def set_status(self, admin_key: str, tester_id: str, status: TesterStatus) -> TesterRecord:
        self.check_admin(admin_key)
        if status not in {TesterStatus.REJECTED, TesterStatus.SUSPENDED, TesterStatus.ACTIVE}:
            raise HTTPException(status_code=400, detail="Status administrativo inválido.")
        payload = self._read()
        record = self._by_id(payload, tester_id)
        record["status"] = status
        record["updated_at"] = datetime.now(UTC).isoformat()
        self._write(payload)
        return TesterRecord.model_validate(record)

    def is_active(self, email: str) -> bool:
        record = self._by_email(self._read(), self._email(email))
        return bool(record and record["status"] == TesterStatus.ACTIVE)

    @staticmethod
    def check_admin(admin_key: str) -> None:
        configured = os.getenv("CONFERE_ADMIN_KEY")
        if not configured:
            raise HTTPException(status_code=503, detail="Configure CONFERE_ADMIN_KEY para habilitar a administração.")
        if not admin_key or not hashlib.sha256(admin_key.encode()).digest() == hashlib.sha256(configured.encode()).digest():
            raise HTTPException(status_code=401, detail="Chave administrativa inválida.")

    @staticmethod
    def _issue_invite(record: dict) -> InviteResult:
        code = token_urlsafe(32)
        expires = datetime.now(UTC) + timedelta(hours=INVITE_HOURS)
        record["invite_hash"] = hashlib.sha256(code.encode()).hexdigest()
        record["invite_expires_at"] = expires.isoformat()
        return InviteResult(tester=TesterRecord.model_validate(record), invite_code=code, expires_at=expires)

    @staticmethod
    def _matches(code: str, expected: str) -> bool:
        return hashlib.sha256(code.encode()).hexdigest() == expected

    @staticmethod
    def _email(value: str) -> str:
        email = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise HTTPException(status_code=400, detail="Informe um e-mail válido.")
        return email

    @staticmethod
    def _by_email(payload: dict, email: str) -> dict | None:
        return next((item for item in payload["testers"] if item["email"] == email), None)

    @staticmethod
    def _by_id(payload: dict, tester_id: str) -> dict:
        record = next((item for item in payload["testers"] if item["id"] == tester_id), None)
        if not record:
            raise HTTPException(status_code=404, detail="Testador não encontrado.")
        return record

    def _read(self) -> dict:
        return {"testers": self.store.all(NAMESPACE)}

    def _write(self, payload: dict) -> None:
        self.store.replace_all(NAMESPACE, payload["testers"])
