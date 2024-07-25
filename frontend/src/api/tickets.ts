import { useMutation, useQuery, useQueryClient } from "react-query";
import { ResponseTicket, Ticket, TicketStats } from "./dataTypes";
import { fetchDelete, fetchJsonGet, fetchJsonPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem } from "../utils/query";

export function parseTicketResponse(responseTicket: ResponseTicket)
{
	const ticket = responseTicket as unknown as Ticket;
	if (responseTicket.scannedDate)
		ticket.scannedDate = new Date(responseTicket.scannedDate);
	if (responseTicket.createdDate)
		ticket.createdDate = new Date(responseTicket.createdDate);
	return ticket;
}

export default function useTickets(eventId: number | string)
{
	return useQuery(["tickets", `${eventId}`], async () =>
	{
		const tickets = await fetchJsonGet<ResponseTicket[]>(`/api/events/${eventId}/tickets`);
		return tickets.map(parseTicketResponse);
	});
}


export function useMutationNewTicket(onSuccess?: (ticket: Ticket) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (ticketData: NewTicketData) =>
		{
			const ticket = await fetchJsonPost<ResponseTicket>("/api/tickets", ticketData);
			return parseTicketResponse(ticket);
		},
		onSuccess: (data) =>
		{
			queryListAddItem(queryClient, ["tickets", data.eventId], data);
			onSuccess?.(data);
		},
	});
	return mutation;
}

interface NewTicketData
{
	typeId: number,
	eventId: number,
	personName: string,
	personLink: string,
	promocode: string,
	code: string,
}

export function useMutationUpdateTicket(onSuccess?: (ticket: Ticket) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async function postUpdateTicket(params: UpdateTicketParams)
		{
			const ticket = await fetchJsonPost<ResponseTicket>("/api/tickets/" + params.ticketId, params.data);
			return parseTicketResponse(ticket);
		},
		onSuccess: (data) =>
		{
			queryListUpdateItem(queryClient, ["tickets", data.eventId], data);
			onSuccess?.(data);
		},
	});
	return mutation;
}

interface UpdateTicketParams
{
	ticketId: number | string,
	data: UpdateTicketData,
}
interface UpdateTicketData
{
	typeId: number,
	personName: string,
	personLink: string,
	promocode: string,
}

export function useMutationDeleteTicket(eventId: number | string, onSuccess?: () => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (ticketId: number | string) =>
			await fetchDelete("/api/tickets/" + ticketId),
		onSuccess: (_, ticketId) =>
		{
			queryListDeleteItem(queryClient, ["tickets", eventId], ticketId);
			onSuccess?.();
		},
	});
	return mutation;
}

export function useTicketStats(eventId: number | string)
{
	return useQuery(["ticket_stats", `${eventId}`], async () =>
		await fetchJsonGet<TicketStats[]>(`/api/events/${eventId}/tickets_stats`),
	);
}
