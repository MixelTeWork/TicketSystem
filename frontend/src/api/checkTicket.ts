import { useMutation } from "react-query";
import fetchPost from "../utils/fetchPost"
import ApiError from "./apiError";
import { CheckTicketResult, ResponseCheckTicket, ResponseMsg } from "./dataTypes";
import { parseEventResponse } from "./events";
import { parseTicketResponse } from "./tickets";


export default function useMutationCheckTicket(onSuccess?: (res: CheckTicketResult) => void, onError?: (msg: string) => void)
{
	const mutation = useMutation({
		mutationFn: postCheckTicket,
		onSuccess: (data) =>
		{
			onSuccess?.(data);
		},
		onError: (error) =>
		{
			onError?.(error instanceof ApiError ? error.message : "Произошла ошибка")
			mutation.reset();
		}
	});
	return mutation;
}


async function postCheckTicket(ticketData: TicketData): Promise<CheckTicketResult>
{
	const res = await fetchPost("/api/check_ticket", ticketData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	const apiResult = data as ResponseCheckTicket;
	const result = data as CheckTicketResult;
	if (apiResult.ticket)
		result.ticket = parseTicketResponse(apiResult.ticket)
	if (apiResult.event)
		result.event = parseEventResponse(apiResult.event)
	return result
}

interface TicketData
{
	code: string,
	eventId: number,
}
