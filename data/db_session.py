import sqlalchemy as sa
import sqlalchemy.orm as orm
from sqlalchemy.orm import Session
import sqlalchemy.ext.declarative as dec

convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}
SqlAlchemyBase = dec.declarative_base()
SqlAlchemyBase.metadata = sa.MetaData(naming_convention=convention)

__factory = None


def global_init(dev):
    global __factory

    if __factory:
        return

    if dev:
        conn_str = 'sqlite:///db/TicketSystem.db?check_same_thread=False'
    else:
        conn_str = 'mysql+pymysql://ticketsystem:UR2hqJDbSfQ@ticketsystem.mysql.pythonanywhere-services.com/ticketsystem$default?charset=UTF8mb4'
    print(f"Подключение к базе данных по адресу {conn_str}")

    engine = sa.create_engine(conn_str, echo=False, pool_pre_ping=True)
    __factory = orm.sessionmaker(bind=engine)

    from . import __all_models

    SqlAlchemyBase.metadata.create_all(engine)


def create_session() -> Session:
    return __factory()


# @sa.event.listens_for(sa.engine.Engine, 'connect')
# def sqlite_engine_connect(dbapi_conn, connection_record):
#     dbapi_conn.create_function('lower', 1, str.lower)
