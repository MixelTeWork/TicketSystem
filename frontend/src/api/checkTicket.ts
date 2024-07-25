import { useMutation } from "react-query";
import { ApiError, CheckTicketResult, ResponseCheckTicket } from "./dataTypes";
import { parseEventResponse } from "./events";
import { parseTicketResponse } from "./tickets";
import { fetchJsonPost } from "../utils/fetch";


export default function useMutationCheckTicket(onSuccess?: (res: CheckTicketResult) => void, onError?: (msg: string) => void)
{
	const mutation = useMutation({
		mutationFn: async (ticketData: TicketData) =>
		{
			const apiResult = await fetchJsonPost<ResponseCheckTicket>("/api/check_ticket", ticketData)
			const result = apiResult as CheckTicketResult;
			if (apiResult.ticket)
				result.ticket = parseTicketResponse(apiResult.ticket)
			if (apiResult.event)
				result.event = parseEventResponse(apiResult.event)
			return result
		},
		onSuccess: onSuccess,
		onError: (error) =>
		{
			onError?.(error instanceof ApiError ? error.message : "Произошла ошибка")
			mutation.reset();
		}
	});
	return mutation;
}

interface TicketData
{
	code: string,
	eventId: number,
}
