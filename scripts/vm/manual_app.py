from pathlib import Path

import bafser_config
from main import app
from bafser import db_session
from data.event import Event
from data.user import User
from scripts.init_dev_values import init_dev_values


app.config["JWT_COOKIE_SECURE"] = False


def prepare_manual_database() -> None:
    """Seed the disposable manual stand explicitly before starting its workers."""
    marker = Path(bafser_config.storage_path) / ".manual-seeded"
    with app.app_context():
        with db_session.create_session() as session:
            if not marker.exists():
                if session.query(Event).first() is None:
                    admin = User.get_admin(db_sess=session)
                    if admin is None:
                        raise RuntimeError("Run database setup before seeding the manual stand")
                    admin.set_password("TicketTest2026!")
                    session.commit()
                    init_dev_values(session)
                marker.touch()


if __name__ == "__main__":
    prepare_manual_database()
