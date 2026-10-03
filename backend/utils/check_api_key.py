from hmac import compare_digest

from flask import abort, current_app


def check_api_key(key: str):
    if not compare_digest(key, current_app.config["API_SECRET_KEY"]):
        abort(403)
