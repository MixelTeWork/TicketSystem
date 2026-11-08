from typing import TypedDict

from bafser import (
    TJson,
    create_file_response,
    doc_api,
    get_datetime_utc,
    get_json_values_from_req,
    protected_route,
    response_msg,
)
from flask import Blueprint, abort, jsonify, request
from flask_jwt_extended import get_jwt

from data.help_acknowledgement import HelpAcknowledgement
from data.help_content import repository
from data.user import User


class HelpSectionData(TypedDict):
    id: str
    title: str


class HelpArticleSummaryData(TypedDict):
    id: str
    title: str
    audience: str
    section: str
    order: int


class HelpArticleData(HelpArticleSummaryData):
    markdown: str


class HelpCatalogData(TypedDict):
    sections: list[HelpSectionData]
    articles: list[HelpArticleSummaryData]
    audiences: list[str]


class HelpSearchItemData(HelpArticleSummaryData):
    snippet: str


class HelpSearchData(TypedDict):
    items: list[HelpSearchItemData]
    total: int


class HelpReleaseItemData(TypedDict):
    id: str
    audience: str
    title: str
    text: str
    articleId: str | None


class HelpReleaseData(TypedDict):
    id: str
    title: str
    version: str | None
    date: str | None
    approximateDate: bool
    status: str
    items: list[HelpReleaseItemData]


class HelpNoticeData(HelpReleaseItemData):
    releaseId: str


class HelpNoticesData(TypedDict):
    sessionId: str
    items: list[HelpNoticeData]


blueprint = Blueprint("help", __name__)


@blueprint.get("/api/help")
@doc_api(res=HelpCatalogData, desc="Доступные разделы и статьи инструкции")
@protected_route()
def help_catalog():
    return jsonify(repository().catalog(User.current))


@blueprint.get("/api/help/articles/<articleId>")
@doc_api(res=HelpArticleData, desc="Статья инструкции по постоянному идентификатору")
@protected_route()
def help_article(articleId: str):
    article = repository().article(articleId, User.current)
    return jsonify(article.summary() | {"markdown": article.markdown})


@blueprint.get("/api/help/articles/<articleId>/assets/<path:filename>")
@doc_api(res=bytes, desc="Иллюстрация доступной статьи")
@protected_route()
def help_asset(articleId: str, filename: str):
    path, mimetype = repository().asset(articleId, filename, User.current)
    return create_file_response(str(path), mimetype, path.name)


@blueprint.get("/api/help/search")
@doc_api(res=HelpSearchData, desc="Поиск по доступным актуальным статьям; строка q, до 160 символов")
@protected_route()
def help_search():
    query = request.args.get("q", "").strip()
    if len(query) > 160:
        return response_msg("Поисковый запрос слишком длинный", 400)
    return jsonify(repository().search(query, User.current))


@blueprint.get("/api/help/releases")
@doc_api(res=list[HelpReleaseData], desc="Выпуски с разрешёнными пользователю изменениями")
@protected_route()
def help_releases():
    return jsonify(repository().release_list(User.current))


@blueprint.get("/api/help/notices")
@doc_api(res=HelpNoticesData, desc="Неподтверждённые актуальные важные изменения для текущей учётной записи")
@protected_route()
def help_notices():
    user = User.current
    notices = repository().notices(user)
    session_id = get_jwt()["jti"]
    if not notices:
        return jsonify({"items": [], "sessionId": session_id})
    acknowledged = {row.noticeId for row in HelpAcknowledgement.query().filter_by(userId=user.id)}
    return jsonify({"items": [item for item in notices if item["id"] not in acknowledged], "sessionId": session_id})


@blueprint.post("/api/help/notices/acknowledge")
@doc_api(req=TJson["noticeIds", list[str]], res=TJson["msg", str], desc="Подтвердить показанные важные уведомления")
@protected_route()
def acknowledge_help_notices():
    if not User.current.is_organizer():
        abort(403)
    ids = get_json_values_from_req(("noticeIds", list[str]))
    if not 1 <= len(ids) <= 30 or set(request.json) != {"noticeIds"}:
        return response_msg("Нужен список уведомлений", 400)
    # Serialize acknowledgements for one account, including simultaneous devices.
    user_id = User.current.id
    session = User.current.db_sess
    # End the authorization read snapshot before waiting for another device.
    # Otherwise MySQL REPEATABLE READ may miss its committed acknowledgement.
    session.rollback()
    user = User.get(user_id, for_update=True, db_sess=session)
    if user is None or not user.is_organizer():
        abort(403)
    valid = {item["id"] for item in repository().notices(user)}
    if not set(ids).issubset(valid):
        abort(404)
    previous = {row.noticeId for row in HelpAcknowledgement.query().filter_by(userId=user.id)}
    now = get_datetime_utc()
    for notice_id in set(ids) - previous:
        user.db_sess.add(HelpAcknowledgement(userId=user.id, noticeId=notice_id, acknowledgedAt=now))
    user.db_sess.commit()
    return response_msg("ok")
