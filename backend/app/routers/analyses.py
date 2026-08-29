import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status

from app.models.analysis import AnalysisReceipt, AnalysisResponse
from app.models.project import ProjectMetadata
from app.services.analysis_service import AnalysisService
from app.services.homologation_service import HomologationService
from app.services.regulation_registry import RegulationRegistry

router = APIRouter(prefix="/api/analyses", tags=["analyses"])
service = AnalysisService()
regulation_registry = RegulationRegistry()
homologation_service = HomologationService()
DEMO_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_analysis.json"


@router.post("", response_model=AnalysisReceipt, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    project_name: Annotated[str, Form(min_length=1)],
    municipality: Annotated[str, Form(min_length=1)],
    contact_email: Annotated[str, Form(min_length=3)],
    accepted_terms: Annotated[bool, Form()] = False,
    training_consent: Annotated[bool, Form()] = False,
    x_partner_token: Annotated[str, Header()] = "",
    project_type: Annotated[str | None, Form()] = None,
    address: Annotated[str | None, Form()] = None,
    lot_area: Annotated[float | None, Form(gt=0)] = None,
    zoning: Annotated[str | None, Form()] = None,
    project_pdf: list[UploadFile] = File(...),
    regulation_pdf: UploadFile | str | None = File(None),
    condominium_pdf: UploadFile | str | None = File(None),
    descriptive_memorial_pdf: UploadFile | str | None = File(None),
) -> AnalysisReceipt:
    partner_email = homologation_service.validate_session(x_partner_token)
    if not accepted_terms:
        raise HTTPException(
            status_code=400,
            detail="É necessário aceitar os Termos de Uso e o Aviso de Privacidade antes do envio.",
        )
    if not training_consent:
        raise HTTPException(
            status_code=400,
            detail="Nesta versão Beta, autorize separadamente o uso dos documentos para desenvolvimento e treinamento.",
        )
    if contact_email.strip().lower() != partner_email:
        raise HTTPException(status_code=403, detail="O e-mail da análise deve corresponder à Área de teste autenticada.")
    if "@" not in contact_email or contact_email.startswith("@") or contact_email.endswith("@"):
        raise HTTPException(status_code=400, detail="Informe um e-mail válido.")
    regulation_upload = None if isinstance(regulation_pdf, str) else regulation_pdf
    condominium_upload = None if isinstance(condominium_pdf, str) else condominium_pdf
    memorial_upload = None if isinstance(descriptive_memorial_pdf, str) else descriptive_memorial_pdf
    has_local_regulation = bool(regulation_upload and regulation_upload.filename)
    if not regulation_registry.has_builtin(municipality) and not has_local_regulation:
        raise HTTPException(
            status_code=400,
            detail="A legislação local é obrigatória para outros municípios.",
        )

    metadata = ProjectMetadata(
        name=project_name,
        municipality=municipality,
        contact_email=contact_email,
        project_type=project_type,
        address=address,
        lot_area=lot_area,
        zoning=zoning,
    )
    analysis = await service.create(
        metadata=metadata,
        files={
            "project": project_pdf,
            "regulation": regulation_upload,
            "condominium": condominium_upload,
            "descriptive_memorial": memorial_upload,
        },
        training_consent=training_consent,
    )
    return AnalysisReceipt.model_validate(analysis.model_dump())


@router.get("/municipalities", response_model=list[dict[str, Any]])
def get_municipalities() -> list[dict[str, Any]]:
    return regulation_registry.list_municipalities()


@router.get("/demo", response_model=dict[str, Any])
def get_demo_analysis() -> dict[str, Any]:
    return json.loads(DEMO_PATH.read_text(encoding="utf-8"))


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: str, x_partner_token: Annotated[str, Header()] = "") -> AnalysisResponse:
    partner_email = homologation_service.validate_session(x_partner_token)
    analysis = service.get(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    if analysis.project.contact_email.strip().lower() != partner_email:
        raise HTTPException(status_code=403, detail="Esta análise pertence a outra Área de teste.")
    return analysis


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: str, x_partner_token: Annotated[str, Header()] = "") -> None:
    partner_email = homologation_service.validate_session(x_partner_token)
    analysis = service.get(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    if analysis.project.contact_email.strip().lower() != partner_email:
        raise HTTPException(status_code=403, detail="Esta análise pertence a outra Área de teste.")
    if not service.delete(analysis_id):
        raise HTTPException(status_code=404, detail="Análise não encontrada")
