from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel

from app.models.project import ProjectMetadata, StoredDocument


DISCLAIMER = (
    "Ferramenta privada e independente. O resultado é preliminar, não constitui "
    "aprovação, laudo ou parecer técnico e não substitui a avaliação do responsável "
    "técnico nem a decisão do órgão competente."
)


class AnalysisStatus(StrEnum):
    DOCUMENTS_READ = "documents_read"


class AnalysisResponse(BaseModel):
    id: str
    status: AnalysisStatus
    created_at: datetime
    project: ProjectMetadata
    documents: list[StoredDocument]
    accepted_terms_at: datetime | None = None
    terms_version: str | None = None
    privacy_version: str | None = None
    disclaimer: str = DISCLAIMER


class DocumentReceipt(BaseModel):
    document_type: str
    original_name: str
    size_bytes: int
    page_count: int


class AnalysisReceipt(BaseModel):
    id: str
    status: AnalysisStatus
    created_at: datetime
    project: ProjectMetadata
    documents: list[DocumentReceipt]
