from flask import Request


def get_json(request: Request) -> tuple[object, bool]:
    if (not request.is_json):
        return None, False
    try:
        json = request.get_json()
        return json, True
    except Exception:
        return None, False
