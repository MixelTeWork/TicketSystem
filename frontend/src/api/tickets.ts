import { useMutation, useQuery, useQueryClient } from "react-query";
import { ResponseMsg, ResponseTicket, Ticket } from "./dataTypes";
import ApiError from "./apiError";
import fetchPost from "../utils/fetchPost";

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

async function postNewTicket(eventData: NewTicketData)
{
	const res = await fetchPost("/api/ticket", eventData);
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
