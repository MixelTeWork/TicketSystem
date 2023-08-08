import { UseQueryResult } from "react-query";
import { ResponseUser } from "./dataTypes";

const Operations = {
	page_scanner: "page_scanner",
	page_events: "page_events",
}

export type Operation = keyof typeof Operations;

export default function hasPermission(user: UseQueryResult<ResponseUser, unknown>, operation: Operation)
{
	return !!user.data?.operations.includes(operation);
}