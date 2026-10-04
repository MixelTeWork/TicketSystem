from bafser import get_app_config, protected_route, render_dashboard_page, render_docs_page
from flask import Blueprint, abort

from data._operations import Operations

bp = Blueprint("docs", __name__)


@bp.route("/api")
def docs():
    if not get_app_config().DEV_MODE:
        abort(404)
    return render_docs_page()


@bp.route("/api/dashboard")
@protected_route(perms=Operations.page_debug)
def dashboard():
    return render_dashboard_page()
