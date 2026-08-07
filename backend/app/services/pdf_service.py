from pathlib import Path

import fitz
from fastapi import HTTPException


class PdfService:
    def extract_text(self, path: Path) -> tuple[str, int]:
        try:
            with fitz.open(path) as document:
                pages = [page.get_text("text").strip() for page in document]
                return "\n\n".join(text for text in pages if text), document.page_count
        except (fitz.FileDataError, RuntimeError) as exc:
            raise HTTPException(status_code=422, detail=f"PDF inválido ou ilegível: {path.name}") from exc

