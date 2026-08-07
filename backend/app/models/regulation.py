from pydantic import BaseModel


class RegulationRule(BaseModel):
    id: str
    topic: str
    requirement: str
    source_excerpt: str
    page: int | None = None

