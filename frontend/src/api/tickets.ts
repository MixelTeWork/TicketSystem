import { useMutation, useQuery, useQueryClient } from "react-query";
import { ResponseMsg, ResponseTicket, Ticket, TicketStats } from "./dataTypes";
import ApiError from "./apiError";
import fetchPost from "../utils/fetchPost";
import fetchDelete from "../utils/fetchDelete";

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

export function useMutationNewTicket(onSuccess?: (ticket: Ticket) => void)
{
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: postNewTicket,
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState(["tickets", `${data.eventId}`])?.status == "success")
				queryClient.setQueryData(["tickets", `${data.eventId}`], (tickets?: Ticket[]) => tickets ? [...tickets, data] : [data]);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postNewTicket(ticketData: NewTicketData)
{
	const res = await fetchPost("/api/ticket", ticketData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return parseTicketResponse(data as ResponseTicket);
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
		mutationFn: postUpdateTicket,
		onSuccess: (data) =>
		{
			if (queryClient.getQueryState(["tickets", `${data.eventId}`])?.status == "success")
				queryClient.setQueryData(["tickets", `${data.eventId}`], (tickets?: Ticket[]) => tickets?.map(v => v.id == data.id ? data : v) || []);
			onSuccess?.(data);
		},
	});
	return mutation;
}

async function postUpdateTicket(params: UpdateTicketParams)
{
	const res = await fetchPost("/api/ticket/" + params.ticketId, params.data);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return parseTicketResponse(data as ResponseTicket);
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
		mutationFn: postDeleteTicket,
		onSuccess: (ticketId) =>
		{
			if (queryClient.getQueryState(["tickets", `${eventId}`])?.status == "success")
				queryClient.setQueryData(["tickets", `${eventId}`], (tickets?: Ticket[]) => tickets?.filter(v => v.id != ticketId) || []);
			onSuccess?.();
		},
	});
	return mutation;
}

async function postDeleteTicket(ticketId: number | string)
{
	const res = await fetchDelete("/api/ticket/" + ticketId);
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
	return ticketId
}

export function useTicketStats(eventId: number | string)
{
	return useQuery(["ticket_stats", eventId], () => getTicketStats(eventId));
}

async function getTicketStats(eventId: number | string): Promise<TicketStats[]>
{
	const res = await fetch("/api/tickets_stats/" + eventId);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	return data as TicketStats[];
}