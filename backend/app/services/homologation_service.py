import hashlib
import re
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.models.homologation import (
    HomologationProject,
    HomologationProjectCreate,
    PartnerFeedback,
    PartnerFeedbackCreate,
    PartnerSessionResponse,
    ProjectStage,
    ProjectVersion,
    VersionDocument,
)
from app.services.state_store import StateStore


ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png"}
NAMESPACE = "partner_sessions"


class HomologationService:
    def __init__(self) -> None:
        self.store = StateStore()

    def create_authorized_session(self, email: str) -> PartnerSessionResponse:
        normalized = email.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise HTTPException(status_code=400, detail="Informe um e-mail válido.")
        token = token_urlsafe(32)
        payload = {
            "email": normalized,
            "expires_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
            "projects": [],
        }
        self._write(token, payload)
        return PartnerSessionResponse(token=token, email=normalized)

    def list_projects(self, token: str) -> list[HomologationProject]:
        payload = self._read(token)
        return [HomologationProject.model_validate(item) for item in payload["projects"]]

    def create_project(self, token: str, data: HomologationProjectCreate) -> HomologationProject:
        payload = self._read(token)
        now = datetime.now(UTC)
        project = HomologationProject(
            id=str(uuid4()),
            name=data.name.strip(),
            municipality=data.municipality.strip(),
            project_type=data.project_type.strip() if data.project_type else None,
            created_at=now,
            updated_at=now,
        )
        payload["projects"].append(project.model_dump(mode="json"))
        self._write(token, payload)
        return project

    def get_project(self, token: str, project_id: str) -> HomologationProject:
        payload = self._read(token)
        return HomologationProject.model_validate(self._find(payload, project_id))

    async def add_version(
        self,
        token: str,
        project_id: str,
        label: str,
        stage: ProjectStage,
        notes: str | None,
        municipal_feedback: bool,
        improvement_consent: bool,
        files: list[UploadFile],
    ) -> HomologationProject:
        payload = self._read(token)
        project = self._find(payload, project_id)
        receipts: list[VersionDocument] = []
        for upload in files:
            if not upload.filename:
                continue
            content_type = upload.content_type or "application/octet-stream"
            if content_type not in ALLOWED_TYPES:
                raise HTTPException(status_code=415, detail=f"Formato não aceito: {upload.filename}")
            size = 0
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > 25 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail=f"O arquivo {upload.filename} excede 25 MB.")
            await upload.close()
            receipts.append(VersionDocument(name=upload.filename, content_type=content_type, size_bytes=size))
        if not receipts:
            raise HTTPException(status_code=400, detail="Selecione ao menos um PDF ou uma imagem.")
        versions = project.setdefault("versions", [])
        version = ProjectVersion(
            id=str(uuid4()),
            number=len(versions) + 1,
            label=label.strip() or f"Versão {len(versions) + 1}",
            stage=stage,
            created_at=datetime.now(UTC),
            documents=receipts,
            notes=notes.strip() if notes else None,
            municipal_feedback=municipal_feedback,
            improvement_consent=improvement_consent if municipal_feedback else False,
        )
        versions.append(version.model_dump(mode="json"))
        project["updated_at"] = datetime.now(UTC).isoformat()
        self._write(token, payload)
        return HomologationProject.model_validate(project)

    def add_feedback(self, token: str, project_id: str, data: PartnerFeedbackCreate) -> HomologationProject:
        payload = self._read(token)
        project = self._find(payload, project_id)
        feedback = PartnerFeedback(
            id=str(uuid4()),
            created_at=datetime.now(UTC),
            reference=data.reference.strip(),
            verdict=data.verdict,
            comment=data.comment.strip(),
        )
        project.setdefault("feedback", []).append(feedback.model_dump(mode="json"))
        project["updated_at"] = datetime.now(UTC).isoformat()
        self._write(token, payload)
        return HomologationProject.model_validate(project)

    @staticmethod
    def _find(payload: dict, project_id: str) -> dict:
        for project in payload["projects"]:
            if project["id"] == project_id:
                return project
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    @staticmethod
    def _key(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _read(self, token: str) -> dict:
        if not token:
            raise HTTPException(status_code=401, detail="Sessão de parceiro não informada.")
        key = self._key(token)
        payload = self.store.get(NAMESPACE, key)
        if not payload:
            raise HTTPException(status_code=401, detail="Sessão inválida ou expirada.")
        expires_at = payload.get("expires_at")
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(UTC):
            self.store.remove(NAMESPACE, key)
            raise HTTPException(status_code=401, detail="Sessão expirada.")
        from app.services.access_service import AccessService
        if not AccessService().is_active(payload["email"]):
            raise HTTPException(status_code=403, detail="Acesso suspenso ou revogado.")
        return payload

    def _write(self, token: str, payload: dict) -> None:
        self.store.put(NAMESPACE, self._key(token), payload)
