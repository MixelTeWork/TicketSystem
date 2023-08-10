from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Permission(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Permission"

    roleId      = Column(Integer, ForeignKey("Role.id"), primary_key=True)
    operationId = Column(String, ForeignKey("Operation.id"), primary_key=True)

    def __repr__(self):
        return f"<Permission> {self.roleId} {self.operationId}"
