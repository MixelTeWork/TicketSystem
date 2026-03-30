from datetime import datetime
from typing import Union

from bafser import Log, ObjMixin, SqlAlchemyBase
from sqlalchemy import JSON, Column, ForeignKey, Integer, String, orm
from sqlalchemy.orm import Session

from data._tables import Tables
from data.event import Event
from data.img import Image
from data.user import User


class TicketType(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.TicketType

    eventId = Column(Integer, ForeignKey("Event.id"), nullable=False)
    name = Column(String(64), nullable=False)
    number = Column(Integer, nullable=False)
    imageId = Column(Integer, ForeignKey("Image.id"), nullable=True)
    pattern = Column(JSON, nullable=True)
    price = Column(Integer)

    event = orm.relationship("Event", back_populates="ticket_types")
    image = orm.relationship("data.img.Image")

    def __repr__(self):
        return f"<TicketType> [{self.id}] {self.name}"

    @staticmethod
    def add(actor: User, event: Event, name: str, price: Union[int, None], now: datetime):
        db_sess = Session.object_session(actor)

        ttype = TicketType(eventId=event.id, name=name, number=event.lastTypeNumber, price=price)
        db_sess.add(ttype)

        event.lastTypeNumber += 1

        log = Log.added(ttype, actor, [
            ("name", ttype.name),
            ("eventId", ttype.eventId),
            ("price", ttype.price)
        ], now=now, commit=False)

        return ttype, log

    @staticmethod
    def all_for_event(db_sess: Session, eventId: int):
        return TicketType.query(db_sess).filter(TicketType.eventId == eventId).all()

    def update(self, actor: User, name: str, price: Union[int, None], commit=True, now: datetime = None):
        oldname = self.name
        self.name = name
        oldprice = self.price
        self.price = price
        Log.updated(self, actor, [("name", oldname, name), ("price", oldprice, price)], now=now, commit=commit)

    def delete(self, actor: User, commit=True, now: datetime = None, db_sess: Session = None):
        super().delete(actor, commit, now, db_sess)

        img: Image = self.image
        if img is not None:
            img.delete(actor, commit=commit)

    def get_dict(self):
        return self.to_dict(only=("id", "name", "imageId", "pattern", "price"))
