from hmac import compare_digest

from flask import abort, current_app


def check_api_key(key: str) -> None:
    if not compare_digest(key.encode("utf-8"), current_app.config["API_SECRET_KEY"].encode("utf-8")):
        abort(403)
