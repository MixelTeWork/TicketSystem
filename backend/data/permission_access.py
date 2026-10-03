from bafser import Log, SqlAlchemyBase, UserBase
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables


class PermissionAccess(SqlAlchemyBase):
    __tablename__ = Tables.PermissionAccess

    userId: Mapped[int] = mapped_column(Integer, ForeignKey("User.id"), primary_key=True)
    eventId: Mapped[int] = mapped_column(Integer, ForeignKey("Event.id"), primary_key=True)

    def __repr__(self):
        return f"<PermissionAccess> user: {self.userId} event: {self.eventId}"

    @staticmethod
    def new(creator: UserBase, userId: int, eventId: int, commit=True):
        db_sess = Session.object_session(creator)

        access = PermissionAccess(userId=userId, eventId=eventId)
        db_sess.add(access)

        Log.added(access, creator, commit=commit)
        return access

    def delete(self, actor: UserBase, commit=True):
        db_sess = Session.object_session(self)
        db_sess.delete(self)
        Log.deleted(
            self,
            actor,
            [("userId", self.userId), ("eventId", self.eventId)],
            commit=commit
        )
