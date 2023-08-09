import fetchPost from "../utils/fetchPost"
import ApiError from "./apiError";
import { CheckTicketResult, ResponseCheckTicket, ResponseMsg } from "./dataTypes";

export default async function postCheckTicket(ticketData: TicketData): Promise<CheckTicketResult>
{
	const res = await fetchPost("/api/check_ticket", ticketData);
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);

	const apiResult = data as ResponseCheckTicket;
	const result = data as CheckTicketResult;
	if (result.ticket?.scannedDate && apiResult.ticket?.scannedDate)
		result.ticket.scannedDate = new Date(apiResult.ticket?.scannedDate);
	return result
}

interface TicketData
{
	code: string,
	eventId: number,
}
