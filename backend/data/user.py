from sqlalchemy import ForeignKey, orm, Column, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase
from werkzeug.security import generate_password_hash, check_password_hash


class User(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "User"

    id       = Column(Integer, primary_key=True, unique=True, autoincrement=True)
    deleted  = Column(Boolean, default=False, nullable=False)
    login    = Column(String, index=True, unique=True, nullable=False)
    name     = Column(String, nullable=False)
    password = Column(String, nullable=False)
    roleId   = Column(Integer, ForeignKey("Role.id"), nullable=False)

    role = orm.relationship("Role")

    def __repr__(self):
        return f"<User> [{self.id} {self.login}] {self.name}: {self.roleId}"

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def get_creation_changes(self):
        return [
            ("login", None, self.login),
            ("name", None, self.name),
            ("password", None, "***"),
            ("roleId", None, self.roleId),
        ]

    def get_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "login": self.login,
            "operations": list(map(lambda v: v.id, self.role.operations)),
        }
