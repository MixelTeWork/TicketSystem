from flask import abort, current_app


def check_api_key(key: str):
    if key != current_app.config["API_SECRET_KEY"]:
        abort(403)
