from datetime import datetime

from bafser import IdMixin, SqlAlchemyBase
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from data._tables import Tables


class HelpAcknowledgement(SqlAlchemyBase, IdMixin):
    __tablename__ = Tables.HelpAcknowledgement
    __table_args__ = SqlAlchemyBase.extend_table_args(
        UniqueConstraint("userId", "noticeId", name="uq_help_acknowledgement_user_notice"),
    )

    userId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=False)
    noticeId: Mapped[str] = mapped_column(String(129), nullable=False)
    acknowledgedAt: Mapped[datetime] = mapped_column(DateTime, nullable=False)
