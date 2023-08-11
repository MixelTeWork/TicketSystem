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
        "/api/event/<int:eventId> Post": {
            "__desc__": "Update event",
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
        "/api/ticket_types/<int:eventId>": "TicketType[]",
        "/api/ticket_types Post": {
            "__desc__": "Update ticket types",
            "request": [{
                "name": "string",
                "id": "?number",
                "action": "'add' | 'update' | 'delete'",
            }],
            "response": "TicketType[]",
        },
        "/api/tickets/<int:eventId>": [{
            "id": "number",
            "name": "string",
        }],
        "/api/ticket Post": {
            "__desc__": "Add ticket",
            "request": {
                "typeId": "number",
                "eventId": "number",
                "personName": "string",
                "personLink": "string",
                "promocode": "string",
                "code": "?string",
            },
            "response": "Ticket",
        },
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
        "TicketType": {
            "id": "number",
            "name": "string",
        },
    }), 200
