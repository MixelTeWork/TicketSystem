import pytest
from bafser import PublicError


@pytest.mark.parametrize("description,page", [
    (" \n ", "/"), ("я" * 5001, "/"),
    ("Problem", "/auth?token=secret"), ("Problem", "//example.com"),
])
def test_model_rejects_invalid_reports_without_an_http_request(admin, db_session, description, page):
    from data.bug_report import BugReport

    with pytest.raises(PublicError):
        BugReport.new(admin, description, page, "Browser")
    assert db_session.query(BugReport).count() == 0


def test_model_creates_and_reads_reports_with_the_explicit_author_session(admin, db_session):
    from data.bug_report import BugReport

    report = BugReport.new(admin, "  Ошибка печати\nШаги для повторения  ", "/events/42/tickets", "a" * 600)
    db_session.expire_all()
    assert report.description == "Ошибка печати\nШаги для повторения"
    assert report.userId == admin.id
    assert report.userAgent == "a" * 512
    result = BugReport.get_page(0, db_sess=db_session)
    assert result["total"] == result["pages"] == 1
    assert result["items"][0]["id"] == report.id
    assert result["items"][0]["userName"] == admin.name
    assert result["items"][0]["userLogin"] == admin.login
