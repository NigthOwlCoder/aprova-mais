from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel

from app.models.project import ProjectMetadata, StoredDocument


DISCLAIMER = (
    "Esta análise é preliminar e tem caráter informativo. O resultado não substitui "
    "a avaliação de um arquiteto, engenheiro, responsável técnico, condomínio ou "
    "órgão público competente."
)


class AnalysisStatus(StrEnum):
    DOCUMENTS_READ = "documents_read"


class AnalysisResponse(BaseModel):
    id: str
    status: AnalysisStatus
    created_at: datetime
    project: ProjectMetadata
    documents: list[StoredDocument]
    disclaimer: str = DISCLAIMER

