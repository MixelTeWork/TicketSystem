from flask import Blueprint


blueprint = Blueprint("docs", __name__)


@blueprint.route("/api")
def docs():
    return {
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
        "/api/events_full": "EventFull[]",
        "/api/events/<int:eventId>/add_access POST": "",
        "/api/events/<int:eventId>": "Event",
        "/api/events/<int:eventId>/staff": {
            "__desc__": "Get your staff at event",
            "response": "User[]",
        },
        "/api/events/<int:eventId>/staff POST": {
            "__desc__": "Set your staff at event by userId list",
            "request": "number[]",
            "response": "User[]",
        },
        "/api/scanner_events/<int:eventId>": {
            "__desc__": "Auth is not requred, returns only 'active' events",
            "response": "Event",
        },
        "/api/events POST": {
            "__desc__": "Add event",
            "request": {
                "name": "string",
                "date": "datetime",
            },
            "response": "Event",
        },
        "/api/events/<int:eventId> POST": {
            "__desc__": "Update event",
            "request": {
                "name": "string",
                "date": "datetime",
            },
            "response": "Event",
        },
        "/api/events/<int:eventId> DELETE": {
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
        "/api/events/<int:eventId>/ticket_types": "TicketType[]",
        "/api/events/<int:eventId>/ticket_types POST": {
            "__desc__": "Update ticket types",
            "request": [{
                "name": "string",
                "id": "?number",
                "action": "'add' | 'update' | 'delete'",
            }],
            "response": "TicketType[]",
        },
        "/api/ticket_types/<int:typeId>": "TicketType",
        "/api/ticket_types/<int:typeId> POST": {
            "__desc__": "Update ticket type",
            "request": {
                "pattern": "json",
                "img": "?Image",
            },
            "response": "TicketType",
        },
        "/api/events/<int:eventId>/tickets": {
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
            },
            "response": "Ticket",
        },
        "/api/ticket/<int:ticketId> DELETE": {
            "__desc__": "Delete ticket",
        },
        "/api/events/<int:eventId>/tickets_stats": {
            "__desc__": "Get tickets stats: count by type",
            "response": [
                {
                    "typeId": "number",
                    "count": "number",
                    "scanned": "number",
                    "authOnPltf": "number",
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
        "/api/debug/log": {
            "__desc__": "Get log",
            "response": "Log[]",
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
        "/api/fonts/<int:fontId>": {
            "__desc__": "Get font",
            "response": "binary font data",
        },
        "/api/fonts POST": {
            "__desc__": "Add font",
            "request": {
                "__Content-Type__": "multipart/form-data",
                "name": "string",
                "type": "'ttf' | 'otf' | 'woff' | 'woff2'",
                "font": "application/octet-stream",
            },
            "response": "Font",
        },
        "/api/managers": {
            "__desc__": "Get all managers",
            "response": "User[]",
        },
        "/api/managers POST": {
            "__desc__": "Add manager",
            "request": {
                "name": "string",
                "login": "string",
            },
            "response": {
                "...": "User",
                "password": "string",
            },
        },
        "/api/managers/<int:managerId> DELETE": {
            "__desc__": "Delete manager",
        },
        "/api/event_platform/user_info_by_ticket": {
            "__desc__": "Get user info for auth on event platform",
            "request": {
                "apikey": "string",
                "eventId": "number",
                "code": "string",
            },
            "response": {
                "res": "'ok' | 'not found' | 'wrong event'",
                "data": {
                    "typeId": "number",
                    "typeName": "string",
                    "personName": "?string",
                },
            },
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
        "Log": {
            "id": "number",
            "date": "datetime",
            "actionCode": "string",
            "userId": "number",
            "userName": "number",
            "tableName": "string",
            "recordId": "number",
            "changes": "string",
        },
        "Event": {
            "id": "number",
            "name": "string",
            "date": "datetime",
        },
        "EventFull": {
            "id": "number",
            "deleted": "bool",
            "name": "string",
            "date": "datetime",
            "active": "bool",
            "access": "User[]",
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
            "authOnPltf": "bool",
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
    }
