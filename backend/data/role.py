from sqlalchemy import Column, orm, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Role(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Role"

    id      = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted = Column(Boolean, default=False, nullable=False)
    name    = Column(String, nullable=False)

    operations = orm.relationship("Operation", secondary="Permission")

    def __repr__(self):
        return f"<Role> [{self.id}] {self.code}"

    def get_dict(self):
        return self.to_dict(only=("name"))
