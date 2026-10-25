from pathlib import Path

from main import app
from bafser import db_session
from data.event import Event
from data.user import User
from scripts.init_dev_values import init_dev_values


app.config["JWT_COOKIE_SECURE"] = False
marker = Path("storage/.manual-seeded")
with app.app_context():
    with db_session.create_session() as session:
        if not marker.exists():
            if session.query(Event).first() is None:
                admin = User.get_admin(db_sess=session)
                admin.set_password("TicketTest2026!")
                session.commit()
                init_dev_values(session)
            marker.touch()
