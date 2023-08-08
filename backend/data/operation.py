from sqlalchemy import Column, String
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase
from typing import TypedDict


class Operation(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Operation"

    id   = Column(String, primary_key=True, unique=True)
    name = Column(String, nullable=False)

    def __repr__(self):
        return f"<Operation> {self.roleId} {self.operationId}"

    def get_dict(self):
        return self.to_dict(only=("id", "name"))


class Operations(TypedDict):
    page_scanner: tuple[str, str]
    page_events: tuple[str, str]


OPERATIONS: Operations = {
    "page_scanner": ("page_scanner", "Страница сканер"),
    "page_events": ("page_events", "Страница мероприятия"),
}
