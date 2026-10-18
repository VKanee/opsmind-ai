from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, url: str) -> None:
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine: Engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
            class_=Session,
        )

    def create_schema(self) -> None:
        from app import models  # noqa: F401

        Base.metadata.create_all(self.engine)

    def close(self) -> None:
        self.engine.dispose()


def get_db(request: Request) -> Generator[Session, None, None]:
    session = request.app.state.db.session_factory()
    try:
        yield session
    finally:
        session.close()
