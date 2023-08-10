import { useQuery } from "react-query";
import { ResponseMsg, ResponseTicket, Ticket } from "./dataTypes";
import ApiError from "./apiError";

export default function useTickets(eventId: number | string)
{
	return useQuery(["tickets", eventId], () => getTickets(eventId));
}

async function getTickets(eventId: number | string): Promise<Ticket[]>
{
	const res = await fetch("/api/tickets/" + eventId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return (data as ResponseTicket[]).map(parseTicketResponse);
}

export function parseTicketResponse(responseTicket: ResponseTicket)
{
	const ticket = responseTicket as unknown as Ticket;
	if (responseTicket.scannedDate)
		ticket.scannedDate = new Date(responseTicket.scannedDate);
	if (responseTicket.createdDate)
		ticket.createdDate = new Date(responseTicket.createdDate);
	return ticket;
}