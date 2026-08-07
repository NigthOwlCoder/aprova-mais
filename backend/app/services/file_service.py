import re
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


class FileService:
    def __init__(self, upload_root: Path) -> None:
        self.upload_root = upload_root

    async def save_pdf(self, upload: UploadFile, destination: Path) -> tuple[Path, int]:
        if not upload.filename:
            raise HTTPException(status_code=400, detail="Arquivo sem nome")
        if upload.content_type not in PDF_CONTENT_TYPES and not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=415, detail=f"{upload.filename}: somente arquivos PDF são aceitos")

        safe_stem = re.sub(r"[^a-zA-Z0-9._-]+", "_", Path(upload.filename).stem).strip("._") or "document"
        stored_name = f"{safe_stem}-{uuid4().hex[:8]}.pdf"
        target = destination / stored_name
        destination.mkdir(parents=True, exist_ok=True)

        size = 0
        with target.open("wb") as output:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                output.write(chunk)
        await upload.close()

        if size == 0:
            target.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail=f"{upload.filename}: arquivo vazio")
        return target, size

