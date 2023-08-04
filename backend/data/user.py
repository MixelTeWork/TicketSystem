from sqlalchemy import orm, Column, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase
from werkzeug.security import generate_password_hash, check_password_hash


class User(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "User"

    id =       Column(Integer, primary_key=True, autoincrement=True)
    deleted =  Column(Boolean, default=False)
    login =    Column(String, index=True, unique=True)
    name =     Column(String)
    password = Column(String)
    # role =   orm.relation("Role")


    def __repr__(self):
        # return f"<User> [{self.id} {self.login}] {self.name}: {self.role}"
        return f"<User> [{self.id} {self.login}] {self.name}"

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)
