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
    assert response.json() == {"status": "ok", "application": "Aprova+"}


def test_create_and_get_analysis() -> None:
    created = client.post(
        "/api/analyses",
        data={"project_name": "Residência Barueri", "municipality": "Barueri"},
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
    assert "Area do terreno" in fetched.json()["documents"][0]["extracted_text"]


def test_get_unknown_analysis() -> None:
    response = client.get("/api/analyses/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


def test_delete_analysis() -> None:
    created = client.post(
        "/api/analyses",
        data={"project_name": "Projeto descartável", "municipality": "Barueri"},
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
        data={"project_name": "Casa MA", "municipality": "Barueri"},
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
        data={"project_name": "Casa MA", "municipality": "Barueri - SP"},
        files={"project_pdf": ("prancha-problematica.pdf", b"not-a-pdf", "application/pdf")},
    )
    assert response.status_code == 422
    assert "prancha-problematica" in response.json()["detail"]


def test_production_frontend_is_served_by_backend() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Aprova+" in response.text
