from datetime import datetime
from typing import Any, TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase
from sqlalchemy import JSON, ForeignKey, Integer, String, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.event import Event
from data.img import Image
from data.user import User


class TicketTypeData(TypedDict):
    id: int
    name: str
    imageId: int | None
    pattern: dict[str, Any] | None
    price: int | None


class TicketType(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.TicketType

    eventId: Mapped[int] = mapped_column(Integer, ForeignKey("Event.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    imageId: Mapped[int | None] = mapped_column(Integer, ForeignKey("Image.id"), nullable=True, default=None)
    pattern: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=None)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    event: Mapped[Event] = orm.relationship("Event", back_populates="ticket_types", init=False)
    image: Mapped[Image | None] = orm.relationship("data.img.Image", init=False)

    def __repr__(self):
        return f"<TicketType> [{self.id}] {self.name}"

    @staticmethod
    def add(actor: User, event: Event, name: str, price: int | None, now: datetime):
        db_sess = Session.object_session(actor)

        ttype = TicketType(eventId=event.id, name=name, number=event.lastTypeNumber, price=price)
        db_sess.add(ttype)

        event.lastTypeNumber += 1

        log = Log.added(ttype, actor, now=now, commit=False)

        return ttype, log

    @staticmethod
    def all_for_event(eventId: int, *, db_sess: Session | None = None):
        return TicketType.query(db_sess=db_sess).filter(TicketType.eventId == eventId).all()

    def update(self, actor: User, name: str, price: int | None, commit=True, now: datetime | None = None):
        self.name = name
        self.price = price
        Log.updated(self, actor, now=now, commit=commit)

    def _on_delete(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        img = self.image
        if img is not None:
            img.delete(actor, commit=False, now=now, db_sess=db_sess)
        return True

    def get_dict(self):
        return self.to_dict(only=("id", "name", "imageId", "pattern", "price"))
