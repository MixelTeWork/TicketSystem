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
        "/api/events": "Event[]",
        "/api/events/<int:eventId>": "Event",
        "/api/scanner_event/<int:eventId>": {
            "__desc__": "Auth is not requred, returns only 'active' events",
            "response": "Event",
        },
        "/api/event Post": {
            "__desc__": "Add event",
            "request": {
                "name": "string",
                "date": "datetime",
            },
            "response": "Event",
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
                "event": "?Event (if errorCode == 'event')",
            },
        },
        "/api/ticket_types/<int:eventId>": "Ticket[]",
        "/api/tickets/<int:eventId>": [{
            "id": "number",
            "name": "string",
        }],
        "User": {
            "id": "number",
            "name": "string",
            "login": "string",
            "operations": "string[]",
        },
        "Event": {
            "id": "number",
            "name": "string",
            "date": "datetime",
        },
        "Ticket": {
            "id": "number",
            "eventId": "number",
            "type": "string",
            "code": "string",
            "createdDate": "datetime",
            "scanned": "bool",
            "scannedDate": "?datetime",
            "scannedById": "?number",
            "scannedBy": "?string",
            "personName": "?string",
            "personLink": "?string",
            "promocode": "?string",
        },
    }), 200
