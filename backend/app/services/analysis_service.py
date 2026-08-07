import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import UploadFile

from app.models.analysis import AnalysisResponse, AnalysisStatus
from app.models.project import ProjectMetadata, StoredDocument
from app.services.file_service import FileService
from app.services.pdf_service import PdfService

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_DIR = BACKEND_DIR.parent
UPLOAD_ROOT = PROJECT_DIR / "uploads"
ANALYSIS_ROOT = BACKEND_DIR / "app" / "data" / "analyses"


class AnalysisService:
    def __init__(self) -> None:
        self.files = FileService(UPLOAD_ROOT)
        self.pdf = PdfService()
        ANALYSIS_ROOT.mkdir(parents=True, exist_ok=True)

    async def create(
        self,
        metadata: ProjectMetadata,
        files: dict[str, UploadFile | list[UploadFile] | None],
    ) -> AnalysisResponse:
        analysis_id = str(uuid4())
        destination = UPLOAD_ROOT / analysis_id
        documents: list[StoredDocument] = []

        for document_type, uploads in files.items():
            if uploads is None:
                continue
            upload_list = uploads if isinstance(uploads, list) else [uploads]
            for upload in upload_list:
                path, size = await self.files.save_pdf(upload, destination)
                text, page_count = self.pdf.extract_text(path)
                documents.append(
                    StoredDocument(
                        document_type=document_type,
                        original_name=upload.filename or path.name,
                        stored_name=path.name,
                        content_type=upload.content_type or "application/pdf",
                        size_bytes=size,
                        page_count=page_count,
                        extracted_text=text,
                    )
                )

        analysis = AnalysisResponse(
            id=analysis_id,
            status=AnalysisStatus.DOCUMENTS_READ,
            created_at=datetime.now(UTC),
            project=metadata,
            documents=documents,
        )
        self._analysis_path(analysis_id).write_text(
            analysis.model_dump_json(indent=2), encoding="utf-8"
        )
        return analysis

    def get(self, analysis_id: str) -> AnalysisResponse | None:
        path = self._analysis_path(analysis_id)
        if not path.is_file():
            return None
        return AnalysisResponse.model_validate(json.loads(path.read_text(encoding="utf-8")))

    @staticmethod
    def _analysis_path(analysis_id: str) -> Path:
        try:
            normalized = str(UUID(analysis_id))
        except ValueError:
            normalized = "invalid"
        return ANALYSIS_ROOT / f"{normalized}.json"
