from sqlalchemy import Column, String
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Operation(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Operation"

    id   = Column(String(32), primary_key=True, unique=True)
    name = Column(String(32), nullable=False)

    def __repr__(self):
        return f"<Operation> {self.id} {self.name}"

    # def get_dict(self):
    #     return self.to_dict(only=("id", "name"))


class Operations:
    # pages
    page_events = ("page_events", "Страница мероприятия")
    page_staff = ("page_staff", "Страница сотрудников")
    page_debug = ("page_debug", "Страница отладки")
    page_users = ("page_users", "Страница пользователей")

    # get
    get_staff_event = ("get_staff_event", "Просмотр сотрудников на мероприятии")

    # add
    add_event = ("add_event", "Создание мероприятий")
    add_ticket = ("add_ticket", "Добавление билетов")
    add_staff = ("add_staff", "Добавление сотрудников")

    # change
    change_ticket_types = ("change_ticket_types", "Изменение типов билетов")
    change_ticket = ("change_ticket", "Изменение билетов")
    change_event = ("change_event", "Изменение мероприятий")
    change_staff = ("change_staff", "Изменение сотрудников")
    change_staff_event = ("change_staff_event", "Изменение сотрудников на мероприятии")

    # delete
    delete_event = ("delete_event", "Удаление мероприятий")
    delete_ticket = ("delete_ticket", "Удаление билетов")
    delete_staff = ("delete_staff", "Удаление сотрудников")

    @staticmethod
    def get_all():
        obj = Operations()
        members = [attr for attr in dir(obj) if not callable(getattr(obj, attr)) and not attr.startswith("__")]
        return map(lambda x: getattr(obj, x), members)
