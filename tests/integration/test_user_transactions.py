from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from data.user import User


def test_user_new_rolls_back_user_memberships_and_audit(db_session: Session, admin: User):
    from bafser import Log, UserRole

    from data._roles import Roles
    from data.user import User

    previous_log_count = db_session.query(Log).count()
    actor_id = admin.id
    user = User.new(
        admin,
        "transactional-clerk",
        "password",
        "Transactional clerk",
        [Roles.clerk],
        bossId=actor_id,
        db_sess=db_session,
        commit=False,
    )
    user_id = user.id
    assert user.bossId == actor_id
    assert db_session.query(UserRole).filter_by(userId=user_id, roleId=Roles.clerk).one() is not None
    created_log = db_session.query(Log).filter_by(tableName="User", recordId=user_id, actionCode="added").one()
    assert created_log.userId == actor_id

    db_session.rollback()

    assert User.get_by_login("transactional-clerk", db_sess=db_session) is None
    assert db_session.query(UserRole).filter_by(userId=user_id).count() == 0
    assert db_session.query(Log).count() == previous_log_count


def test_user_new_default_commit_preserves_manual_author_and_manager(db_session: Session, admin: User):
    from bafser import Log

    from data._roles import Roles
    from data.user import User

    actor_id = admin.id
    # The existing positional manager argument is used by staff creation and dev seed.
    user = User.new(admin, "committed-clerk", "password", "Committed clerk", [Roles.clerk], actor_id)
    user_id = user.id
    db_session.rollback()

    stored = User.get_by_login("committed-clerk", db_sess=db_session)
    assert stored is not None and stored.id == user_id
    assert stored.bossId == actor_id
    assert stored.has_role(Roles.clerk)
    assert stored.check_password("password")
    created_log = db_session.query(Log).filter_by(tableName="User", recordId=user_id, actionCode="added").one()
    assert created_log.userId == actor_id


def test_inherited_create_admin_uses_system_actor_and_outer_transaction(db_session: Session, admin: User):
    from bafser import Log, UserRole
    from bafser.data._roles import RolesBase

    from data.user import User

    previous_log_count = db_session.query(Log).count()
    original_admin_id = admin.id
    admin.login = "existing-admin"

    created = User.create_admin(db_session, commit=False)
    created_id = created.id

    assert created.bossId is None
    assert User.get_by_login("admin", db_sess=db_session) is created
    assert db_session.query(UserRole).filter_by(userId=created_id, roleId=RolesBase.admin).one() is not None
    created_log = db_session.query(Log).filter_by(tableName="User", recordId=created_id, actionCode="added").one()
    assert created_log.userId is None
    assert created_log.userName == "System"

    db_session.rollback()

    restored = User.get_by_login("admin", db_sess=db_session)
    assert restored is not None and restored.id == original_admin_id
    assert User.get_by_login("existing-admin", db_sess=db_session) is None
    assert User.get(created_id, db_sess=db_session) is None
    assert db_session.query(UserRole).filter_by(userId=created_id).count() == 0
    assert db_session.query(Log).count() == previous_log_count
