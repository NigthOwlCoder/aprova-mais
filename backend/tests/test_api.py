import os
import tempfile

os.environ["CONFERE_ADMIN_KEY"] = "test-admin-key"
os.environ["CONFERE_MAIS_DATA_ROOT"] = tempfile.mkdtemp(prefix="confere-tests-")

import fitz
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_pdf() -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Area do terreno: 500 m2")
    content = document.tobytes()
    document.close()
    return content


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "application": "Confere+"}


def test_create_and_get_analysis() -> None:
    created = client.post(
        "/api/analyses",
        data={"project_name": "Residência Barueri", "municipality": "Barueri", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files={"project_pdf": ("projeto.pdf", make_pdf(), "application/pdf")},
    )

    assert created.status_code == 201
    payload = created.json()
    assert payload["status"] == "documents_read"
    assert payload["documents"][0]["page_count"] == 1
    assert "extracted_text" not in payload["documents"][0]

    fetched = client.get(f"/api/analyses/{payload['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == payload["id"]
    assert fetched.json()["accepted_terms_at"] is not None
    assert fetched.json()["terms_version"] == "1.2"
    assert fetched.json()["privacy_version"] == "1.2"
    assert "Area do terreno" in fetched.json()["documents"][0]["extracted_text"]


def test_get_unknown_analysis() -> None:
    response = client.get("/api/analyses/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_analysis_requires_express_acceptance() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa", "municipality": "Barueri - SP", "contact_email": "teste@example.com"},
        files={"project_pdf": ("projeto.pdf", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 400
    assert "aceitar os Termos de Uso" in response.json()["detail"]


def test_delete_analysis() -> None:
    created = client.post(
        "/api/analyses",
        data={"project_name": "Projeto descartável", "municipality": "Barueri", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files={"project_pdf": ("projeto.pdf", make_pdf(), "application/pdf")},
    )
    analysis_id = created.json()["id"]
    assert client.delete(f"/api/analyses/{analysis_id}").status_code == 204
    assert client.get(f"/api/analyses/{analysis_id}").status_code == 404


def test_demo_analysis_has_required_status_mix() -> None:
    response = client.get("/api/analyses/demo")
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {
        "score": 69,
        "confidence": 78,
        "compliant": 4,
        "warnings": 2,
        "non_compliant": 2,
        "not_identified": 1,
    }
    assert len(payload["items"]) == 9


def test_create_analysis_with_multiple_project_documents() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa MA", "municipality": "Barueri", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files=[
            ("project_pdf", ("prancha-01.pdf", make_pdf(), "application/pdf")),
            ("project_pdf", ("rrt-projeto.pdf", make_pdf(), "application/pdf")),
        ],
    )
    assert response.status_code == 201
    assert len(response.json()["documents"]) == 2


def test_invalid_pdf_identifies_the_file() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa MA", "municipality": "Barueri - SP", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files={"project_pdf": ("prancha-problematica.pdf", b"not-a-pdf", "application/pdf")},
    )
    assert response.status_code == 422
    assert "prancha-problematica" in response.json()["detail"]


def test_empty_optional_file_fields_are_ignored() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa MA", "municipality": "Barueri - SP", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files=[
            ("project_pdf", ("projeto.pdf", make_pdf(), "application/pdf")),
            ("regulation_pdf", ("", b"", "application/octet-stream")),
            ("condominium_pdf", ("", b"", "application/octet-stream")),
            ("descriptive_memorial_pdf", ("", b"", "application/octet-stream")),
        ],
    )
    assert response.status_code == 201
    assert [document["original_name"] for document in response.json()["documents"]] == [
        "projeto.pdf"
    ]


def test_other_municipality_requires_local_regulation() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa", "municipality": "Osasco - SP", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files={"project_pdf": ("projeto.pdf", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 400
    assert "legislação local é obrigatória" in response.json()["detail"]


def test_other_municipality_accepts_local_regulation() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa", "municipality": "Osasco - SP", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files=[
            ("project_pdf", ("projeto.pdf", make_pdf(), "application/pdf")),
            ("regulation_pdf", ("legislacao-local.pdf", make_pdf(), "application/pdf")),
        ],
    )
    assert response.status_code == 201
    assert len(response.json()["documents"]) == 2


def test_jundiai_uses_registered_municipal_basis() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa Jundiaí", "municipality": "Jundiaí - SP", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files={"project_pdf": ("projeto.pdf", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 201
    assert [document["original_name"] for document in response.json()["documents"]] == [
        "projeto.pdf"
    ]


def test_campinas_uses_registered_municipal_basis() -> None:
    response = client.post(
        "/api/analyses",
        data={"project_name": "Casa Campinas", "municipality": "Campinas - SP", "contact_email": "teste@example.com", "accepted_terms": "true"},
        files={"project_pdf": ("projeto.pdf", make_pdf(), "application/pdf")},
    )
    assert response.status_code == 201
    assert [document["original_name"] for document in response.json()["documents"]] == [
        "projeto.pdf"
    ]


def test_registered_municipalities_are_traceable() -> None:
    response = client.get("/api/analyses/municipalities")
    assert response.status_code == 200
    jundiai = next(item for item in response.json() if item["id"] == "jundiai-sp")
    assert jundiai["automatic_regulation"] is True
    assert "LC 606/2021" in jundiai["report_basis"]["version"]
    campinas = next(item for item in response.json() if item["id"] == "campinas-sp")
    assert campinas["automatic_regulation"] is True
    assert "LC 208/2018" in campinas["report_basis"]["version"]


def test_production_frontend_is_served_by_backend() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Confere+" in response.text


def test_partner_homologation_flow() -> None:
    request = client.post("/api/homologation/access-requests", json={
        "email": "arquiteta@example.com", "full_name": "Arquiteta Teste", "professional_role": "Arquiteta",
        "city_state": "Barueri - SP", "municipalities": ["Barueri"], "project_types": ["Obra nova"],
        "has_project": True, "has_municipal_feedback": True, "accepted_terms": True,
    })
    assert request.status_code == 201
    approved = client.post(f"/api/homologation/admin/testers/{request.json()['id']}/approve", headers={"X-Admin-Key": "test-admin-key"})
    assert approved.status_code == 200
    session = client.post("/api/homologation/activate", json={
        "email": "arquiteta@example.com", "invite_code": approved.json()["invite_code"], "accepted_terms": True,
        "full_name": "Arquiteta Teste", "professional_role": "Arquiteta", "city_state": "Barueri - SP",
    })
    assert session.status_code == 201
    token = session.json()["token"]
    headers = {"X-Partner-Token": token}

    created = client.post(
        "/api/homologation/projects",
        headers=headers,
        json={"name": "Casa piloto", "municipality": "Barueri - SP", "project_type": "Residencial unifamiliar"},
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    version = client.post(
        f"/api/homologation/projects/{project_id}/versions",
        headers=headers,
        data={"label": "Envio inicial", "stage": "submitted", "municipal_feedback": "false"},
        files=[("documents", ("planta-r01.pdf", make_pdf(), "application/pdf"))],
    )
    assert version.status_code == 200
    assert version.json()["versions"][0]["documents"][0]["name"] == "planta-r01.pdf"

    feedback = client.post(
        f"/api/homologation/projects/{project_id}/feedback",
        headers=headers,
        json={"reference": "Relatório 01 · A3", "verdict": "partial", "comment": "A regra está correta, mas a medida precisa ser revista."},
    )
    assert feedback.status_code == 200
    assert feedback.json()["feedback"][0]["verdict"] == "partial"
    assert client.get("/api/homologation/projects", headers=headers).json()[0]["id"] == project_id


def test_admin_can_preapprove_email_and_activation_must_match() -> None:
    invite = client.post("/api/homologation/admin/invites", headers={"X-Admin-Key": "test-admin-key"}, json={"email": "convidado@example.com"})
    assert invite.status_code == 201
    wrong = client.post("/api/homologation/activate", json={"email": "outro@example.com", "invite_code": invite.json()["invite_code"], "accepted_terms": True, "full_name": "Outro", "professional_role": "Arquiteto", "city_state": "Osasco - SP"})
    assert wrong.status_code == 403
    activated = client.post("/api/homologation/activate", json={"email": "convidado@example.com", "invite_code": invite.json()["invite_code"], "accepted_terms": True, "full_name": "Convidado", "professional_role": "Arquiteto", "city_state": "Osasco - SP"})
    assert activated.status_code == 201


def test_suspension_invalidates_existing_partner_session() -> None:
    invite = client.post("/api/homologation/admin/invites", headers={"X-Admin-Key": "test-admin-key"}, json={"email": "suspenso@example.com", "full_name": "Teste Suspenso"}).json()
    activated = client.post("/api/homologation/activate", json={"email": "suspenso@example.com", "invite_code": invite["invite_code"], "accepted_terms": True, "full_name": "Teste Suspenso", "professional_role": "Arquiteto", "city_state": "Barueri - SP"}).json()
    changed = client.post(f"/api/homologation/admin/testers/{invite['tester']['id']}/status?new_status=suspended", headers={"X-Admin-Key": "test-admin-key"})
    assert changed.status_code == 200
    denied = client.get("/api/homologation/projects", headers={"X-Partner-Token": activated["token"]})
    assert denied.status_code == 403


def test_partner_projects_require_session() -> None:
    response = client.get("/api/homologation/projects", headers={"X-Partner-Token": "invalid"})
    assert response.status_code == 401
