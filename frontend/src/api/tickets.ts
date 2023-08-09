import { useQuery } from "react-query";
import { ResponseMsg, ResponseTicket, Ticket } from "./dataTypes";
import ApiError from "./apiError";

export default function useTickets(eventId: number)
{
	return useQuery(["tickets", eventId], () => getTickets(eventId));
}

async function getTickets(eventId: number): Promise<Ticket[]>
{
	const res = await fetch("/api/tickets/" + eventId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return (data as ResponseTicket[]).map(t => parseTicketResponse(t));
}

export function parseTicketResponse(responseTicket: ResponseTicket)
{
	const ticket = <Ticket><unknown>responseTicket;
	if (responseTicket.scannedDate)
		ticket.scannedDate = new Date(responseTicket.scannedDate);
	if (responseTicket.createdDate)
		ticket.createdDate = new Date(responseTicket.createdDate);
	return ticket;
}