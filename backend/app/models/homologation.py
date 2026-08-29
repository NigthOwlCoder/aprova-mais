from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ProjectStage(StrEnum):
    PRE_PROTOCOL = "pre_protocol"
    SUBMITTED = "submitted"
    MUNICIPAL_RETURN = "municipal_return"
    REVISION = "revision"


class FeedbackVerdict(StrEnum):
    CORRECT = "correct"
    PARTIAL = "partial"
    INCORRECT = "incorrect"
    UNABLE_TO_ASSESS = "unable_to_assess"


class PartnerSessionRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class PartnerSessionResponse(BaseModel):
    token: str
    email: str


class HomologationProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    municipality: str = Field(min_length=1, max_length=160)
    project_type: str | None = Field(default=None, max_length=120)


class VersionDocument(BaseModel):
    name: str
    content_type: str
    size_bytes: int


class ProjectVersion(BaseModel):
    id: str
    number: int
    label: str
    stage: ProjectStage
    created_at: datetime
    documents: list[VersionDocument]
    notes: str | None = None
    municipal_feedback: bool = False
    improvement_consent: bool = False
    accepted_terms_at: datetime | None = None
    terms_version: str | None = None
    training_consent_at: datetime | None = None
    training_consent_version: str | None = None


class PartnerFeedbackCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=200)
    verdict: FeedbackVerdict
    comment: str = Field(min_length=1, max_length=2000)


class PartnerFeedback(BaseModel):
    id: str
    created_at: datetime
    reference: str
    verdict: FeedbackVerdict
    comment: str


class HomologationProject(BaseModel):
    id: str
    name: str
    municipality: str
    project_type: str | None = None
    created_at: datetime
    updated_at: datetime
    versions: list[ProjectVersion] = Field(default_factory=list)
    feedback: list[PartnerFeedback] = Field(default_factory=list)
