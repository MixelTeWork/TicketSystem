import { UseQueryResult } from "react-query";
import { User } from "./dataTypes";
import useUser from "./user";

const Operations = {
	page_events: "page_events",
	page_staff: "page_staff",
	add_event: "add_event",
	add_ticket: "add_ticket",
	change_ticket_types: "change_ticket_types",
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
