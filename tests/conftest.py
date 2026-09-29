import os
import sys
from pathlib import Path

from flask.testing import FlaskClient
import pytest
from werkzeug.security import generate_password_hash


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_PASSWORD_HASH = generate_password_hash(
    "admin", method="pbkdf2:sha256:1", salt_length=8
)


@pytest.fixture(scope="session")
def app(tmp_path_factory):
    """Create an isolated Flask app for SQLite or TEST_MYSQL_DBPATH."""
    test_root = tmp_path_factory.mktemp("ticketsystem")
    storage = test_root / "storage"

    import bafser_config

    mysql_dbpath = os.environ.get("TEST_MYSQL_DBPATH")
    dev_mode = mysql_dbpath is None
    if dev_mode:
        bafser_config.db_dev_path = str(storage / "test.db")
    else:
        bafser_config.db_path = mysql_dbpath
        bafser_config.db_mysql = True
    bafser_config.log_info_path = str(storage / "logs" / "info.csv")
    bafser_config.log_requests_path = str(storage / "logs" / "requests.csv")
    bafser_config.log_errors_path = str(storage / "logs" / "errors.log")
    bafser_config.log_frontend_path = str(storage / "logs" / "frontend.log")
    bafser_config.jwt_key_file_path = str(storage / "jwt.key")
    # Bafser 1.4.4 treats these values as importable module paths rather than
    # arbitrary filesystem paths (absolute Windows paths are not supported).
    bafser_config.blueprints_folder = "blueprints"
    bafser_config.data_tables_folder = "data"

    from bafser import AppConfig, create_app

    config = AppConfig(
        DEV_MODE=dev_mode,
        FRONTEND_FOLDER=str(test_root / "frontend"),
        IMAGES_FOLDER=str(storage / "images"),
        MESSAGE_TO_FRONTEND="",
    )
    config.add_data_folder("FONTS_FOLDER", str(storage / "fonts"))
    config.add_secret_key_rnd("API_SECRET_KEY", str(storage / "api.key"))

    flask_app, run = create_app("ticketsystem_tests", config)
    flask_app.config.update(TESTING=True, TEST_DB_KIND="sqlite" if dev_mode else "mysql")
    run(False)

    # Normalize the initial account without production-strength password hashing;
    # password cost is not what these integration tests exercise.
    from bafser import Role, UserRole, db_session
    from bafser.data._roles import RolesBase
    from data.user import User

    session = db_session.create_session()
    Role.update_roles_permissions(session)
    admin = User.get_admin(session)
    if admin is None:
        admin = User(login="admin", password=TEST_PASSWORD_HASH, name="Админ")
        session.add(admin)
        session.flush()
        session.add(UserRole(userId=admin.id, roleId=RolesBase.admin))
    else:
        admin.password = TEST_PASSWORD_HASH
    session.commit()
    session.close()

    yield flask_app


@pytest.fixture(autouse=True)
def clean_database(app):
    """Reset mutable data while retaining the immutable roles/permissions."""
    from bafser import db_session
    from bafser.db_session import SqlAlchemyBase

    session = db_session.create_session()
    engine = session.get_bind()
    session.close()

    immutable_tables = {"Operation", "Role", "Permission"}
    with engine.begin() as connection:
        for table in reversed(SqlAlchemyBase.metadata.sorted_tables):
            if table.name in immutable_tables:
                continue
            if table.name == "UserRole":
                connection.execute(table.delete().where(table.c.userId != 1))
            elif table.name == "User":
                # MySQL enforces the self-referential boss FK during a bulk
                # delete even when both parent and child match the statement.
                connection.execute(
                    table.update().where(table.c.id != 1).values(bossId=None)
                )
                connection.execute(table.delete().where(table.c.id != 1))
                connection.execute(
                    table.update()
                    .where(table.c.id == 1)
                    .values(
                        deleted=False,
                        login="admin",
                        name="Админ",
                        password=TEST_PASSWORD_HASH,
                    )
                )
            else:
                connection.execute(table.delete())
        if engine.dialect.name == "mysql":
            for table in SqlAlchemyBase.metadata.sorted_tables:
                if table.name not in immutable_tables and table.name not in {"User", "UserRole"}:
                    connection.exec_driver_sql(
                        "ALTER TABLE `{}` AUTO_INCREMENT = 1".format(table.name)
                    )
    yield


@pytest.fixture
def client(app) -> FlaskClient:
    return app.test_client()


@pytest.fixture
def db_session():
    from bafser import db_session

    session = db_session.create_session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def admin(db_session):
    from data.user import User

    return User.get_admin(db_session)


@pytest.fixture
def logged_in_admin(client) -> FlaskClient:
    response = client.post("/api/auth", json={"login": "admin", "password": "admin"})
    assert response.status_code == 200
    return client


@pytest.fixture
def user_factory(db_session):
    from bafser import UserRole
    from data.user import User

    def create(login, name, role, boss_id=None, password="password"):
        user = User(
            login=login,
            name=name,
            bossId=boss_id,
            password=generate_password_hash(
                password, method="pbkdf2:sha256:1", salt_length=8
            ),
        )
        db_session.add(user)
        db_session.flush()
        db_session.add(UserRole(userId=user.id, roleId=role))
        db_session.commit()
        return user

    return create


@pytest.fixture
def login(client):
    def perform(username, password="password"):
        response = client.post(
            "/api/auth", json={"login": username, "password": password}
        )
        assert response.status_code == 200
        return client

    return perform
