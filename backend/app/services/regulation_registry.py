import json
import unicodedata
from pathlib import Path
from typing import Any


REGULATIONS_PATH = Path(__file__).resolve().parents[1] / "data" / "regulations"


def normalize_municipality(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().casefold())
    return "".join(character for character in normalized if not unicodedata.combining(character))


class RegulationRegistry:
    aliases = {
        "barueri": "barueri-sp", "barueri - sp": "barueri-sp",
        "jundiai": "jundiai-sp", "jundiai - sp": "jundiai-sp",
        "campinas": "campinas-sp", "campinas - sp": "campinas-sp",
    }

    def municipality_id(self, municipality: str) -> str | None:
        return self.aliases.get(normalize_municipality(municipality))

    def has_builtin(self, municipality: str) -> bool:
        municipality_id = self.municipality_id(municipality)
        if municipality_id == "barueri-sp":
            return True
        return bool(municipality_id and (REGULATIONS_PATH / municipality_id / "manifest.json").is_file())

    def get_manifest(self, municipality: str) -> dict[str, Any] | None:
        municipality_id = self.municipality_id(municipality)
        if not municipality_id:
            return None
        manifest_path = REGULATIONS_PATH / municipality_id / "manifest.json"
        if not manifest_path.is_file():
            return None
        return json.loads(manifest_path.read_text(encoding="utf-8"))

    def list_municipalities(self) -> list[dict[str, Any]]:
        municipalities: list[dict[str, Any]] = [{"id": "barueri-sp", "name": "Barueri - SP", "status": "active", "automatic_regulation": True}]
        for manifest_path in sorted(REGULATIONS_PATH.glob("*/manifest.json")):
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            municipalities.append({**manifest["municipality"], "status": manifest["status"], "automatic_regulation": manifest["automatic_regulation"], "report_basis": manifest["report_basis"]})
        return municipalities
