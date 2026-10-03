import pytest


def test_dev_seed_uses_bafser_2_models(db_session):
    from data.event import Event
    from data.img import Image
    from data.ticket import Ticket
    from scripts.init_dev_values import init_dev_values

    init_dev_values(db_session)

    db_session.expire_all()
    assert db_session.query(Event).count() == 3
    assert db_session.query(Ticket).count() == 384
    assert db_session.get(Image, 1) is not None

    with pytest.raises(RuntimeError, match="empty events table"):
        init_dev_values(db_session)

    assert db_session.query(Event).count() == 3
