import json
import shutil
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
RETENTION_SECONDS = 24 * 60 * 60


class AnalysisService:
    def __init__(self) -> None:
        self.files = FileService(UPLOAD_ROOT)
        self.pdf = PdfService()
        ANALYSIS_ROOT.mkdir(parents=True, exist_ok=True)
        self._purge_expired()

    async def create(
        self,
        metadata: ProjectMetadata,
        files: dict[str, UploadFile | list[UploadFile] | None],
    ) -> AnalysisResponse:
        analysis_id = str(uuid4())
        destination = UPLOAD_ROOT / analysis_id
        documents: list[StoredDocument] = []

        try:
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
        finally:
            # The original PDFs are removed even when one document cannot be read.
            shutil.rmtree(destination, ignore_errors=True)

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
        self._purge_expired()
        path = self._analysis_path(analysis_id)
        if not path.is_file():
            return None
        return AnalysisResponse.model_validate(json.loads(path.read_text(encoding="utf-8")))

    def delete(self, analysis_id: str) -> bool:
        path = self._analysis_path(analysis_id)
        if not path.is_file():
            return False
        path.unlink()
        shutil.rmtree(UPLOAD_ROOT / analysis_id, ignore_errors=True)
        return True

    @staticmethod
    def _purge_expired() -> None:
        now = datetime.now(UTC).timestamp()
        for path in ANALYSIS_ROOT.glob("*.json"):
            if now - path.stat().st_mtime > RETENTION_SECONDS:
                path.unlink(missing_ok=True)

    @staticmethod
    def _analysis_path(analysis_id: str) -> Path:
        try:
            normalized = str(UUID(analysis_id))
        except ValueError:
            normalized = "invalid"
        return ANALYSIS_ROOT / f"{normalized}.json"
