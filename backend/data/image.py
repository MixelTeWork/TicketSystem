from sqlalchemy import Column, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Image(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Image"

    id            = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    name          = Column(String(128), nullable=False)
    type          = Column(String(16), nullable=False)
    creationDate  = Column(DateTime, nullable=False)
    createdById   = Column(Integer, ForeignKey("User.id"), nullable=False)
    accessEventId = Column(Integer, ForeignKey("Event.id"), nullable=True)

    creator = orm.relationship("User")

    def __repr__(self):
        return f"<Image> [{self.id}]"
