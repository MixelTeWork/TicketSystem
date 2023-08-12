from sqlalchemy import Column, DefaultClause, orm, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Role(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Role"
    __table_args__ = {
        "mysql_default_charset": "utf16",
        "mysql_collate": "utf16_icelandic_ci",
    }

    id      = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted = Column(Boolean, DefaultClause("0"), nullable=False)
    name    = Column(String(32), nullable=False)

    operations = orm.relationship("Operation", secondary="Permission")

    def __repr__(self):
        return f"<Role> [{self.id}] {self.name}"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
        ]

    # def get_dict(self):
    #     return self.to_dict(only=("name"))
