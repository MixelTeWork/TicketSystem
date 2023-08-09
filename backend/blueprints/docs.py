from flask import Blueprint, jsonify


blueprint = Blueprint("docs", __name__)


@blueprint.route("/api")
def docs():
    return jsonify({
        "/api/auth POST": {
            "__desc__": "Get auth cookie",
            "request": {
                "login": "string",
                "password": "string",
            },
            "response": "User",
        },
        "/api/logout POST": {
            "__desc__": "Remove auth cookie",
        },
        "/api/user": {
            "__desc__": "Get current user",
            "response": "User",
        },
        "/api/events": {
            "id": "number",
            "name": "string",
            "date": "datetime",
        },
        "/api/check_ticket POST": {
            "request": {
                "code": "string",
                "eventId": "number",
            },
            "response": {
                "success": "bool",
                "errorCode": "'notExist' | 'event' | 'scanned' ('event' - ticket to another event)",
                "ticket": "?Ticket",
            },
        },
        "User": {
            "id": "number",
            "name": "string",
            "login": "string",
            "operations": "string[]",
        },
        "Ticket": {
            "id": "number",
            "eventId": "number",
            "type": "string",
            "code": "string",
            "scanned": "bool",
            "scannedDate": "?datetime",
            "scannedById": "?number",
            "scannedBy": "?string",
            "personName": "?string",
            "personLink": "?string",
            "promocode": "?string",
        },
    }), 200
