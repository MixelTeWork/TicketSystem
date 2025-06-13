from bafser import OperationsBase


class Operations(OperationsBase):
    # pages
    page_events = ("page_events", "Страница мероприятия")
    page_staff = ("page_staff", "Страница сотрудников")
    page_debug = ("page_debug", "Страница отладки")
    page_debug_events = ("page_debug_events", "Страница отладки событий")
    page_debug_users = ("page_debug_users", "Страница отладки пользователей")
    page_fonts = ("page_fonts", "Страница шрифтов")
    page_managers = ("page_managers", "Страница организаторов")

    # get
    get_staff_event = ("get_staff_event", "Просмотр сотрудников на мероприятии")

    # add
    add_event = ("add_event", "Создание мероприятий")
    add_ticket = ("add_ticket", "Добавление билетов")
    add_staff = ("add_staff", "Добавление сотрудников")
    add_any_image = ("add_any_image", "Добавление любых картинок")
    add_font = ("add_font", "Добавление шрифтов")
    add_manager = ("add_manager", "Добавление организаторов")

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
    delete_manager = ("delete_manager", "Удаление организаторов")
