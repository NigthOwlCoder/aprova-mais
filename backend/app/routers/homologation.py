from typing import Annotated

from fastapi import APIRouter, File, Form, Header, UploadFile, status

from app.models.access import (
    AdminInviteCreate,
    InviteResult,
    TesterActivationRequest,
    TesterApplicationCreate,
    TesterApplicationReceipt,
    TesterRecord,
    TesterStatus,
)

from app.models.homologation import (
    HomologationProject,
    HomologationProjectCreate,
    PartnerFeedbackCreate,
    PartnerSessionResponse,
    ProjectStage,
)
from app.services.homologation_service import HomologationService
from app.services.access_service import AccessService

router = APIRouter(prefix="/api/homologation", tags=["homologation"])
service = HomologationService()
access_service = AccessService()


@router.post("/access-requests", response_model=TesterApplicationReceipt, status_code=status.HTTP_201_CREATED)
def request_access(data: TesterApplicationCreate) -> TesterApplicationReceipt:
    return access_service.request_access(data)


@router.post("/activate", response_model=PartnerSessionResponse, status_code=status.HTTP_201_CREATED)
def activate(data: TesterActivationRequest) -> PartnerSessionResponse:
    tester = access_service.activate(data)
    return service.create_authorized_session(tester.email)


@router.get("/admin/testers", response_model=list[TesterRecord])
def list_testers(x_admin_key: Annotated[str, Header()]) -> list[TesterRecord]:
    return access_service.list_testers(x_admin_key)


@router.post("/admin/invites", response_model=InviteResult, status_code=status.HTTP_201_CREATED)
def preapprove(data: AdminInviteCreate, x_admin_key: Annotated[str, Header()]) -> InviteResult:
    return access_service.preapprove(x_admin_key, data)


@router.post("/admin/testers/{tester_id}/approve", response_model=InviteResult)
def approve(tester_id: str, x_admin_key: Annotated[str, Header()]) -> InviteResult:
    return access_service.approve(x_admin_key, tester_id)


@router.post("/admin/testers/{tester_id}/status", response_model=TesterRecord)
def set_status(
    tester_id: str,
    new_status: TesterStatus,
    x_admin_key: Annotated[str, Header()],
) -> TesterRecord:
    return access_service.set_status(x_admin_key, tester_id, new_status)


@router.get("/projects", response_model=list[HomologationProject])
def list_projects(x_partner_token: Annotated[str, Header()]) -> list[HomologationProject]:
    return service.list_projects(x_partner_token)


@router.post("/projects", response_model=HomologationProject, status_code=status.HTTP_201_CREATED)
def create_project(
    data: HomologationProjectCreate,
    x_partner_token: Annotated[str, Header()],
) -> HomologationProject:
    return service.create_project(x_partner_token, data)


@router.get("/projects/{project_id}", response_model=HomologationProject)
def get_project(project_id: str, x_partner_token: Annotated[str, Header()]) -> HomologationProject:
    return service.get_project(x_partner_token, project_id)


@router.post("/projects/{project_id}/versions", response_model=HomologationProject)
async def add_version(
    project_id: str,
    x_partner_token: Annotated[str, Header()],
    label: Annotated[str, Form(min_length=1)],
    stage: Annotated[ProjectStage, Form()],
    municipal_feedback: Annotated[bool, Form()] = False,
    improvement_consent: Annotated[bool, Form()] = False,
    notes: Annotated[str | None, Form()] = None,
    documents: list[UploadFile] = File(...),
) -> HomologationProject:
    return await service.add_version(
        x_partner_token,
        project_id,
        label,
        stage,
        notes,
        municipal_feedback,
        improvement_consent,
        documents,
    )


@router.post("/projects/{project_id}/feedback", response_model=HomologationProject)
def add_feedback(
    project_id: str,
    data: PartnerFeedbackCreate,
    x_partner_token: Annotated[str, Header()],
) -> HomologationProject:
    return service.add_feedback(x_partner_token, project_id, data)
