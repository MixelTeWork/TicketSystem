import { useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "../utils/useSessionMutation";
import { getSessionVersion } from "./session";
import { ApiError } from "./dataTypes";
import { parseEventResponse, queryKeyScanner } from "./events";
import { parseTicketResponse, parseCheckinResponse, updateTicketCache, type CheckTicketResult, type ResponseCheckTicket } from "./tickets";
import { fetchJsonPost } from "../utils/fetch";


export default function useMutationCheckTicket(onSuccess?: (res: CheckTicketResult) => void, onError?: (msg: string) => void, operation: "entry" | "merch" = "entry")
{
	const client = useQueryClient();
	const mutation = useSessionMutation({
		mutationFn: async (ticketData: TicketData) =>
		{
			const apiResult = await fetchJsonPost<ResponseCheckTicket>(operation == "merch" ? "/api/issue_merch" : "/api/check_ticket", ticketData);
			const result = parseCheckTicketResponse(apiResult, operation);
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

export function parseCheckTicketResponse(response: ResponseCheckTicket, expectedOperation?: "entry" | "merch"): CheckTicketResult
{
	const invalid = () => new ApiError("Некорректный ответ проверки билета");
	if (!response || (response.operation != "entry" && response.operation != "merch") || (expectedOperation && response.operation != expectedOperation) || typeof response.success != "boolean" || response.checkin === undefined) throw invalid();
	const operation = response.operation;
	if (response.errorCode == "notExist")
	{
		if (response.success || response.ticket !== null || response.event !== null || response.checkin !== null) throw invalid();
		return { ...response, ticket: null, event: null, checkin: null };
	}
	if (!response.ticket) throw invalid();
	const ticket = parseTicketResponse(response.ticket);
	if (response.errorCode == "event")
	{
		if (response.success || !response.event || response.checkin !== null) throw invalid();
		return { operation, success: false, errorCode: "event", ticket, event: parseEventResponse(response.event), checkin: null };
	}
	if (response.event !== null) throw invalid();
	if (operation == "merch")
	{
		if (response.checkin !== null || !ticket.merchIssuedAt || !((response.success && response.errorCode === null) || (!response.success && response.errorCode == "merchIssued"))) throw invalid();
		return response.success
			? { operation, success: true, errorCode: null, ticket, event: null, checkin: null }
			: { operation, success: false, errorCode: "merchIssued", ticket, event: null, checkin: null };
	}
	if (!response.success && response.errorCode == "date" && response.checkin === null) return { operation, success: false, errorCode: "date", ticket, event: null, checkin: null };
	if (!response.checkin) throw invalid();
	const checkin = parseCheckinResponse(response.checkin);
	if (!response.success && response.errorCode == "scanned") return { operation, success: false, errorCode: "scanned", ticket, event: null, checkin };
	if (!response.success || response.errorCode !== null || !checkin.checkedAt) throw invalid();
	return { operation, success: true, errorCode: null, ticket, event: null, checkin: { ...checkin, checkedAt: checkin.checkedAt } };
}
