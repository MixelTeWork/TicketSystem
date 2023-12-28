import { UseQueryResult } from "react-query";
import { User } from "./dataTypes";
import useUser from "./user";

const Operations = {
	page_events: "page_events",
	page_staff: "page_staff",
	page_debug: "page_debug",
	page_users: "page_users",
	page_fonts: "page_fonts",
	page_managers: "page_managers",

	get_staff_event: "get_staff_event",

	add_event: "add_event",
	add_ticket: "add_ticket",
	add_staff: "add_staff",
	add_font: "add_font",
	add_manager: "add_manager",

	change_ticket_types: "change_ticket_types",
	change_ticket: "change_ticket",
	change_event: "change_event",
	change_staff_event: "change_staff_event",
	change_staff: "change_staff",

	delete_event: "delete_event",
	delete_ticket: "delete_ticket",
	delete_staff: "delete_staff",
	delete_manager: "delete_manager",
}

export type Operation = keyof typeof Operations;

export default function hasPermission(user: UseQueryResult<User, unknown>, operation: Operation)
{
	return !!(user.data?.auth && user.data?.operations.includes(operation));
}

export function useHasPermission(operation: Operation)
{
	const user = useUser();
	return !!(user.data?.auth && user.data?.operations.includes(operation));
}
