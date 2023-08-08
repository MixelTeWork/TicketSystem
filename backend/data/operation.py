from sqlalchemy import Column, String
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Operation(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Operation"

    id   = Column(String, primary_key=True, unique=True)
    name = Column(String, nullable=False)

    def __repr__(self):
        return f"<Operation> {self.roleId} {self.operationId}"

    # def get_dict(self):
    #     return self.to_dict(only=("id", "name"))


class Operations:
    page_scanner = ("page_scanner", "Страница сканер")
    page_events = ("page_events", "Страница мероприятия")

    def get_all():
        obj = Operations()
        members = [attr for attr in dir(obj) if not callable(getattr(obj, attr)) and not attr.startswith("__")]
        return map(lambda x: getattr(obj, x), members)
