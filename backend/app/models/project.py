from pydantic import BaseModel, Field


class ProjectMetadata(BaseModel):
    name: str = Field(min_length=1)
    municipality: str = Field(min_length=1)
    contact_email: str | None = None
    project_type: str | None = None
    address: str | None = None
    lot_area: float | None = Field(default=None, gt=0)
    zoning: str | None = None


class StoredDocument(BaseModel):
    document_type: str
    original_name: str
    stored_name: str
    content_type: str
    size_bytes: int
    page_count: int
    extracted_text: str
