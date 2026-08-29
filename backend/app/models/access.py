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
    password: str = Field(min_length=10, max_length=128)
    accepted_terms: bool


class AdminInviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    full_name: str | None = Field(default=None, max_length=160)


class TesterActivationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    invite_code: str = Field(min_length=20, max_length=200)
    accepted_terms: bool
    password: str = Field(min_length=10, max_length=128)
    full_name: str | None = Field(default=None, max_length=160)
    professional_role: str | None = Field(default=None, max_length=80)


class PartnerLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class TesterRecord(BaseModel):
    id: str
    email: str
    full_name: str | None = None
    professional_role: str | None = None
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
