from typing import TypedDict

from bafser import TJson, doc_api, get_json_values_from_req, protected_route, response_msg
from flask import Blueprint, jsonify, request

from data._operations import Operations
from data.bug_report import BugReport, BugReportListData
from data.user import User


class NewBugReportData(TypedDict):
    description: str
    page: str


bp = Blueprint("bug_reports", __name__)


@bp.post("/api/bug_reports")
@doc_api(req=NewBugReportData, res=TJson["id", int], desc="Сообщить об ошибке на текущей странице")
@protected_route()
def report_bug():
    description, page = get_json_values_from_req(("description", str), ("page", str))
    report = BugReport.new(User.current, description, page, request.headers.get("User-Agent", ""))
    return jsonify({"id": report.id})


@bp.get("/api/bug_reports")
@doc_api(res=BugReportListData, desc="Сообщения об ошибках, новые первыми; p — страница с нуля")
@protected_route(perms=Operations.page_debug)
def bug_reports():
    raw_page = request.args.get("p", "0")
    if not raw_page.isascii() or not raw_page.isdecimal() or len(raw_page) > 9:
        return response_msg("Некорректный номер страницы", 400)
    return jsonify(BugReport.get_page(int(raw_page)))
