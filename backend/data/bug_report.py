from __future__ import annotations

from datetime import datetime
from typing import ClassVar, TypedDict

from bafser import IdMixin, PublicError, SqlAlchemyBase, get_datetime_utc
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.user import User
from utils.dates import as_utc_naive


class BugReportData(TypedDict):
    id: int
    userId: int
    userName: str
    userLogin: str
    description: str
    page: str
    userAgent: str
    createdAt: str


class BugReportListData(TypedDict):
    items: list[BugReportData]
    total: int
    pages: int


class BugReport(SqlAlchemyBase, IdMixin):
    __tablename__ = Tables.BugReport
    PAGE_SIZE: ClassVar[int] = 25

    userId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    page: Mapped[str] = mapped_column(String(2048), nullable=False)
    userAgent: Mapped[str] = mapped_column(String(512), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    author: Mapped[User] = orm.relationship("User", init=False)

    @staticmethod
    def new(author: User, description: str, page: str, userAgent: str) -> BugReport:
        description = description.strip()
        if not 1 <= len(description) <= 5000:
            raise PublicError("Опишите ошибку: от 1 до 5000 символов")
        # Only the SPA path is needed; query strings can contain private data.
        if not page.startswith("/") or page.startswith("//") or len(page) > 2048 or any(char in page for char in "?#\\\r\n"):
            raise PublicError("Некорректный адрес страницы")
        report = BugReport(
            userId=author.id,
            description=description,
            page=page,
            userAgent=userAgent[:512],
            createdAt=as_utc_naive(get_datetime_utc()).replace(microsecond=0),
        )
        session = author.db_sess
        session.add(report)
        session.commit()
        return report

    @staticmethod
    def get_page(page: int, *, db_sess: Session | None = None) -> BugReportListData:
        query = BugReport.query(db_sess=db_sess)
        total = query.count()
        # Load authors in the same query, including soft-deleted accounts.
        reports = (
            query.options(orm.joinedload(BugReport.author))
            .order_by(BugReport.id.desc())
            .limit(BugReport.PAGE_SIZE).offset(page * BugReport.PAGE_SIZE).all()
        ) if page * BugReport.PAGE_SIZE < total else []
        return {
            "items": [report.get_dict() for report in reports],
            "total": total,
            "pages": max(1, (total + BugReport.PAGE_SIZE - 1) // BugReport.PAGE_SIZE),
        }

    def get_dict(self) -> BugReportData:
        return {
            "id": self.id,
            "userId": self.userId,
            "userName": self.author.name,
            "userLogin": self.author.login,
            "description": self.description,
            "page": self.page,
            "userAgent": self.userAgent,
            "createdAt": self.createdAt.isoformat() + "Z",
        }
