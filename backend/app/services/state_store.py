import os
from pathlib import Path

from sqlalchemy import JSON, String, create_engine, delete, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


DEFAULT_DATA_ROOT = Path(os.getenv("CONFERE_MAIS_DATA_ROOT", Path(__file__).resolve().parents[3] / "runtime_data"))
DEFAULT_DATA_ROOT.mkdir(parents=True, exist_ok=True)
database_url = os.getenv("DATABASE_URL", f"sqlite:///{(DEFAULT_DATA_ROOT / 'confere.db').as_posix()}")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)


class Base(DeclarativeBase):
    pass


class StateRecord(Base):
    __tablename__ = "confere_state"
    namespace: Mapped[str] = mapped_column(String(40), primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


engine = create_engine(database_url, pool_pre_ping=True, connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {})
Base.metadata.create_all(engine)


class StateStore:
    def get(self, namespace: str, key: str) -> dict | None:
        with Session(engine) as session:
            record = session.get(StateRecord, (namespace, key))
            return dict(record.payload) if record else None

    def put(self, namespace: str, key: str, payload: dict) -> None:
        with Session(engine) as session:
            session.merge(StateRecord(namespace=namespace, key=key, payload=payload))
            session.commit()

    def remove(self, namespace: str, key: str) -> None:
        with Session(engine) as session:
            session.execute(delete(StateRecord).where(StateRecord.namespace == namespace, StateRecord.key == key))
            session.commit()

    def all(self, namespace: str) -> list[dict]:
        with Session(engine) as session:
            return [dict(record.payload) for record in session.scalars(select(StateRecord).where(StateRecord.namespace == namespace))]

    def replace_all(self, namespace: str, payloads: list[dict], key_field: str = "id") -> None:
        with Session(engine) as session:
            session.execute(delete(StateRecord).where(StateRecord.namespace == namespace))
            for payload in payloads:
                session.add(StateRecord(namespace=namespace, key=str(payload[key_field]), payload=payload))
            session.commit()
