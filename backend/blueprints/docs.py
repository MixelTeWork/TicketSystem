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
        "/api/event/staff/<int:eventId>": {
            "__desc__": "Get your staff at event",
            "response": "User[]",
        },
        "/api/event/staff/<int:eventId> POST": {
            "__desc__": "Set your staff at event by userId list",
            "request": "number[]",
            "response": "User[]",
        },
        "/api/scanner_event/<int:eventId>": {
            "__desc__": "Auth is not requred, returns only 'active' events",
            "response": "Event",
        },
        "/api/event POST": {
            "__desc__": "Add event",
            "request": {
                "name": "string",
                "date": "datetime",
            },
            "response": "Event",
        },
        "/api/event/<int:eventId> POST": {
            "__desc__": "Update event",
            "request": {
                "name": "string",
                "date": "datetime",
            },
            "response": "Event",
        },
        "/api/event/<int:eventId> DELETE": {
            "__desc__": "Delete event",
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
        "/api/ticket_types POST": {
            "__desc__": "Update ticket types",
            "request": [{
                "name": "string",
                "id": "?number",
                "action": "'add' | 'update' | 'delete'",
            }],
            "response": "TicketType[]",
        },
        "/api/ticket_type/<int:typeId>": "TicketType",
        "/api/ticket_type/<int:typeId> POST": {
            "__desc__": "Update ticket type",
            "request": {
                "pattern": "json",
                "img": "?Image",
            },
            "response": "TicketType",
        },
        "/api/tickets/<int:eventId>": {
            "__desc__": "Get tickets",
            "response": "Ticket[]",
        },
        "/api/ticket POST": {
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
        "/api/ticket/<int:ticketId> POST": {
            "__desc__": "Update ticket",
            "request": {
                "typeId": "number",
                "personName": "string",
                "personLink": "string",
                "promocode": "string",
                "code": "string",
            },
            "response": "Ticket",
        },
        "/api/ticket/<int:ticketId> DELETE": {
            "__desc__": "Delete ticket",
        },
        "/api/tickets_stats/<int:eventId>": {
            "__desc__": "Get tickets stats: count by type",
            "response": [
                {
                    "typeId": "number",
                    "count": "number",
                }
            ],
        },
        "/api/users": {
            "__desc__": "Get all users",
            "response": "UserFull[]",
        },
        "/api/user/change_password POST": {
            "__desc__": "Set new password",
            "request": {
                "password": "string",
            },
        },
        "/api/user/change_name POST": {
            "__desc__": "Set new name",
            "request": {
                "name": "string",
            },
        },
        "/api/staff": {
            "__desc__": "Get your staff",
            "response": "User[]",
        },
        "/api/staff POST": {
            "__desc__": "Add staff",
            "request": {
                "name": "string",
                "login": "string",
            },
            "response": {
                "...": "User",
                "password": "string",
            },
        },
        "/api/staff/<int:staffId> DELETE": {
            "__desc__": "Delete staff",
        },
        "/api/staff/reset_password/<int:staffId> POST": {
            "__desc__": "Reset staff password",
            "response": {
                "...": "User",
                "password": "string",
            },
        },
        "/api/img/<int:imageId>": {
            "__desc__": "Get image",
            "response": "binary image data",
        },
        "/api/img POST": {
            "__desc__": "Add image",
            "request": {
                "img": "Image",
            },
            "response": {
                "id": "number",
            },
        },
        "/api/fonts": {
            "__desc__": "Get font list",
            "response": "Font[]",
        },
        "/api/font/<int:fontId>": {
            "__desc__": "Get font",
            "response": "binary font data",
        },
        "/api/font POST": {
            "__desc__": "Add font",
            "request": {
                "__Content-Type__": "multipart/form-data",
                "name": "string",
                "type": "'ttf' | 'otf' | 'woff' | 'woff2'",
                "font": "application/octet-stream",
            },
            "response": "Font",
        },
        "User": {
            "id": "number",
            "name": "string",
            "login": "string",
            "roles": "string[]",
            "operations": "string[]",
        },
        "UserFull": {
            "id": "number",
            "name": "string",
            "login": "string",
            "roles": "string[]",
            "bossId": "number",
            "deleted": "bool",
            "access": "string[]",
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
            "typeId": "number",
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
            "imageId": "number",
            "pattern": "json",
        },
        "Image": {
            "data": "string",
            "name": "string",
            "accessEventId": "?string",
        },
        "Font": {
            "id": "number",
            "name": "string",
            "type": "'ttf' | 'otf' | 'woff' | 'woff2'",
        },
    }), 200
