from datetime import datetime

from bafser import IdMixin, SqlAlchemyBase
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, event
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Mapped, Mapper, mapped_column

from data._tables import Tables


class RequestOperation(SqlAlchemyBase, IdMixin):
    """An immutable committed result used to replay a request without issuing another ticket."""

    __tablename__ = Tables.RequestOperation
    __table_args__ = SqlAlchemyBase.extend_table_args(
        UniqueConstraint("actorId", "action", "requestId", name="uq_request_operation_key"),
    )

    actorId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    requestId: Mapped[str] = mapped_column(String(36), nullable=False)
    requestHash: Mapped[str] = mapped_column(String(64), nullable=False)
    ticketId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.Ticket}.id"), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False)


@event.listens_for(RequestOperation, "before_update")
@event.listens_for(RequestOperation, "before_delete")
def _immutable_operation(mapper: Mapper[RequestOperation], connection: Connection, target: RequestOperation):
    raise ValueError("Сохранённый результат операции неизменяем")
