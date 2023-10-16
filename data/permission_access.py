from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class PermissionAccess(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "PermissionAccess"

    userId   = Column(Integer, ForeignKey("User.id"), primary_key=True)
    eventId = Column(Integer, ForeignKey("Event.id"), primary_key=True)

    def __repr__(self):
        return f"<PermissionAccess> user: {self.userId} event: {self.objectId}"
