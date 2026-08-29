from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class TesterStatus(StrEnum):
    REQUESTED = "requested"
    PREAPPROVED = "preapproved"
    ACTIVE = "active"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    INVITE_EXPIRED = "invite_expired"


class TesterSource(StrEnum):
    PUBLIC_REQUEST = "public_request"
    ADMIN_INVITE = "admin_invite"


class TesterApplicationCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    full_name: str = Field(min_length=2, max_length=160)
    professional_role: str = Field(min_length=2, max_length=80)
    city_state: str = Field(min_length=2, max_length=120)
    municipalities: list[str] = Field(min_length=1, max_length=10)
    project_types: list[str] = Field(min_length=1, max_length=8)
    has_project: bool
    has_municipal_feedback: bool
    interest: str | None = Field(default=None, max_length=500)
    accepted_terms: bool


class AdminInviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    full_name: str | None = Field(default=None, max_length=160)


class TesterActivationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    invite_code: str = Field(min_length=20, max_length=200)
    accepted_terms: bool
    full_name: str | None = Field(default=None, max_length=160)
    professional_role: str | None = Field(default=None, max_length=80)
    city_state: str | None = Field(default=None, max_length=120)
    municipalities: list[str] = Field(default_factory=list, max_length=10)
    project_types: list[str] = Field(default_factory=list, max_length=8)
    has_project: bool | None = None
    has_municipal_feedback: bool | None = None


class TesterRecord(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    professional_role: str | None = None
    city_state: str | None = None
    municipalities: list[str] = Field(default_factory=list)
    project_types: list[str] = Field(default_factory=list)
    has_project: bool | None = None
    has_municipal_feedback: bool | None = None
    interest: str | None = None
    source: TesterSource
    status: TesterStatus
    created_at: datetime
    updated_at: datetime
    accepted_terms_at: datetime | None = None
    terms_version: str | None = None
    invite_expires_at: datetime | None = None


class InviteResult(BaseModel):
    tester: TesterRecord
    invite_code: str
    expires_at: datetime


class TesterApplicationReceipt(BaseModel):
    id: str
    status: TesterStatus
    email: str
