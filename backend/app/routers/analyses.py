import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.models.analysis import AnalysisResponse
from app.models.project import ProjectMetadata
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/api/analyses", tags=["analyses"])
service = AnalysisService()
DEMO_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_analysis.json"


@router.post("", response_model=AnalysisResponse, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    project_name: Annotated[str, Form(min_length=1)],
    municipality: Annotated[str, Form(min_length=1)],
    project_type: Annotated[str | None, Form()] = None,
    address: Annotated[str | None, Form()] = None,
    lot_area: Annotated[float | None, Form(gt=0)] = None,
    zoning: Annotated[str | None, Form()] = None,
    project_pdf: list[UploadFile] = File(...),
    regulation_pdf: UploadFile | None = File(None),
    condominium_pdf: UploadFile | None = File(None),
    descriptive_memorial_pdf: UploadFile | None = File(None),
) -> AnalysisResponse:
    metadata = ProjectMetadata(
        name=project_name,
        municipality=municipality,
        project_type=project_type,
        address=address,
        lot_area=lot_area,
        zoning=zoning,
    )
    return await service.create(
        metadata=metadata,
        files={
            "project": project_pdf,
            "regulation": regulation_pdf,
            "condominium": condominium_pdf,
            "descriptive_memorial": descriptive_memorial_pdf,
        },
    )


@router.get("/demo", response_model=dict[str, Any])
def get_demo_analysis() -> dict[str, Any]:
    return json.loads(DEMO_PATH.read_text(encoding="utf-8"))


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: str) -> AnalysisResponse:
    analysis = service.get(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    return analysis
