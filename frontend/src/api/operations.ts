import { UseQueryResult } from "react-query";
import { User } from "./dataTypes";

const Operations = {
	page_events: "page_events",
	page_staff: "page_staff",
}

export type Operation = keyof typeof Operations;

export default function hasPermission(user: UseQueryResult<User, unknown>, operation: Operation)
{
	return !!(user.data?.auth && user.data?.operations.includes(operation));
}