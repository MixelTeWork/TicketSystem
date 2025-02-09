from bfs import RolesBase
from data._operations import Operations


class Roles(RolesBase):
    manager = 2
    clerk = 3
    owner = 4


Roles.ROLES = {
    Roles.manager: {
        "name": "Организатор",
        "operations": [
            Operations.page_events,
            Operations.page_staff,
            Operations.page_fonts,
            Operations.get_staff_event,
            Operations.add_event,
            Operations.add_ticket,
            Operations.add_staff,
            Operations.add_font,
            Operations.change_event,
            Operations.change_ticket,
            Operations.change_ticket_types,
            Operations.change_staff,
            Operations.change_staff_event,
            Operations.delete_event,
            Operations.delete_ticket,
            Operations.delete_staff,
        ]
    },
    Roles.clerk: {
        "name": "Клерк",
        "operations": [
            Operations.page_events,
            Operations.add_ticket,
            Operations.change_ticket,
            Operations.delete_ticket,
        ]
    },
    Roles.owner: {
        "name": "Владыка",
        "operations": [
            Operations.page_managers,
            Operations.add_manager,
            Operations.delete_manager,
        ]
    },
}
