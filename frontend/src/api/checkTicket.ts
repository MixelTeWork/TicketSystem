import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./dataTypes";
import { parseEventResponse } from "./events";
import { parseTicketResponse, updateTicketCache, type CheckTicketResult, type ResponseCheckTicket } from "./tickets";
import { fetchJsonPost } from "../utils/fetch";


export default function useMutationCheckTicket(onSuccess?: (res: CheckTicketResult) => void, onError?: (msg: string) => void)
{
	const client = useQueryClient();
	const mutation = useMutation({
		mutationFn: async (ticketData: TicketData) =>
		{
			const apiResult = await fetchJsonPost<ResponseCheckTicket>("/api/check_ticket", ticketData);
			const result = parseCheckTicketResponse(apiResult);
			return result;
		},
		onSuccess: async result =>
		{
			if (result.ticket) await updateTicketCache(client, result.ticket);
			onSuccess?.(result);
		},
		onError: error =>
		{
			onError?.(error instanceof ApiError ? error.message : "Произошла ошибка");
			mutation.reset();
		},
	});
	return mutation;
}

interface TicketData
{
	code: string,
	eventId: number,
}

export function parseCheckTicketResponse(response: ResponseCheckTicket): CheckTicketResult
{
	if (response.errorCode == "notExist")
		return { success: false, errorCode: "notExist", ticket: null, event: null };
	if (!response.ticket) throw new ApiError("Некорректный ответ проверки билета");
	const ticket = parseTicketResponse(response.ticket);
	if (response.errorCode == "event" && response.event)
		return { success: false, errorCode: "event", ticket, event: parseEventResponse(response.event) };
	if ((response.success || response.errorCode == "scanned") && ticket.scanned && ticket.scannedDate)
	{
		const scannedTicket = { ...ticket, scanned: true as const, scannedDate: ticket.scannedDate };
		return response.success
			? { success: true, errorCode: null, ticket: scannedTicket, event: null }
			: { success: false, errorCode: "scanned", ticket: scannedTicket, event: null };
	}
	throw new ApiError("Некорректный ответ проверки билета");
}
