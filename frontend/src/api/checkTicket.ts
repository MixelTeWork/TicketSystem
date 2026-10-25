import { useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "../utils/useSessionMutation";
import { getSessionVersion } from "./session";
import { ApiError } from "./dataTypes";
import { parseEventResponse, queryKeyScanner } from "./events";
import { parseTicketResponse, updateTicketCache, type CheckTicketResult, type ResponseCheckTicket } from "./tickets";
import { fetchJsonPost } from "../utils/fetch";


export default function useMutationCheckTicket(onSuccess?: (res: CheckTicketResult) => void, onError?: (msg: string) => void)
{
	const client = useQueryClient();
	const mutation = useSessionMutation({
		mutationFn: async (ticketData: TicketData) =>
		{
			const apiResult = await fetchJsonPost<ResponseCheckTicket>("/api/check_ticket", ticketData);
			const result = parseCheckTicketResponse(apiResult);
			return result;
		},
		onSuccess: async (result, _variables, version) =>
		{
			if (result.ticket) await updateTicketCache(client, result.ticket);
			if (version == getSessionVersion(client)) onSuccess?.(result);
		},
		onError: async (error, variables) =>
		{
			onError?.(error instanceof ApiError ? error.message : "Произошла ошибка");
			if (error instanceof ApiError && error.status == 403)
				await client.invalidateQueries({ queryKey: queryKeyScanner(variables.eventId), exact: true });
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
	if ((response.success || response.errorCode == "scanned") && ticket.scanned)
	{
		return response.success
			? { success: true, errorCode: null, ticket, event: null }
			: { success: false, errorCode: "scanned", ticket, event: null };
	}
	throw new ApiError("Некорректный ответ проверки билета");
}
