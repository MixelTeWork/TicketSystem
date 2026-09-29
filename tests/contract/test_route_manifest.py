import pytest


EXPECTED_API_ROUTES = {
    ("GET", "/api"),
    ("GET", "/api/debug/log"),
    ("GET", "/api/debug/log_errors"),
    ("GET", "/api/debug/log_frontend"),
    ("GET", "/api/debug/log_info"),
    ("GET", "/api/debug/log_len"),
    ("GET", "/api/debug/log_requests"),
    ("GET", "/api/events"),
    ("POST", "/api/events"),
    ("GET", "/api/events/<int:eventId>"),
    ("POST", "/api/events/<int:eventId>"),
    ("DELETE", "/api/events/<int:eventId>"),
    ("POST", "/api/events/<int:eventId>/add_access"),
    ("GET", "/api/events/<int:eventId>/staff"),
    ("POST", "/api/events/<int:eventId>/staff"),
    ("GET", "/api/events/<int:eventId>/ticket_types"),
    ("POST", "/api/events/<int:eventId>/ticket_types"),
    ("GET", "/api/events/<int:eventId>/tickets"),
    ("GET", "/api/events/<int:eventId>/tickets_stats"),
    ("GET", "/api/events_full"),
    ("GET", "/api/fonts"),
    ("POST", "/api/fonts"),
    ("GET", "/api/fonts/<int:fontId>"),
    ("POST", "/api/frontend_error"),
    ("GET", "/api/img/<int:imgId>"),
    ("POST", "/api/img"),
    ("GET", "/api/managers"),
    ("POST", "/api/managers"),
    ("DELETE", "/api/managers/<int:managerId>"),
    ("GET", "/api/scanner_events/<int:eventId>"),
    ("GET", "/api/staff"),
    ("POST", "/api/staff"),
    ("DELETE", "/api/staff/<int:staffId>"),
    ("POST", "/api/staff/<int:staffId>/reset_password"),
    ("GET", "/api/ticket_types/<int:typeId>"),
    ("POST", "/api/ticket_types/<int:typeId>"),
    ("POST", "/api/tickets"),
    ("POST", "/api/tickets/<int:ticketId>"),
    ("DELETE", "/api/tickets/<int:ticketId>"),
    ("POST", "/api/check_ticket"),
    ("POST", "/api/auth"),
    ("POST", "/api/logout"),
    ("GET", "/api/user"),
    ("POST", "/api/user/change_name"),
    ("POST", "/api/user/change_password"),
    ("GET", "/api/users"),
    ("GET", "/api/v1/user_info_by_ticket"),
}


@pytest.mark.contract
def test_registered_api_surface_is_unchanged(app):
    actual = {
        (method, rule.rule)
        for rule in app.url_map.iter_rules()
        if rule.rule.startswith("/api")
        for method in rule.methods
        if method not in {"HEAD", "OPTIONS"}
    }

    assert actual == EXPECTED_API_ROUTES

