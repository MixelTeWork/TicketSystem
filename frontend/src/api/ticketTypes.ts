import { useQuery } from "react-query";
import { ResponseMsg, TicketType } from "./dataTypes";
import ApiError from "./apiError";

export default function useTicketTypes(eventId: number)
{
	return useQuery(["ticket_types", eventId], () => getTicketTypes(eventId));
}

async function getTicketTypes(eventId: number): Promise<TicketType[]>
{
	const res = await fetch("/api/ticket_types/" + eventId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as TicketType[];
}
