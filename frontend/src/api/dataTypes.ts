export class ApiError extends Error
{
	constructor(message: string, public readonly status?: number, public readonly code?: string)
	{
		super(message);
		this.name = "ApiError";
	}
}

export type Modify<T, R> = Omit<T, keyof R> & R;
export interface ResponseMsg
{
	msg: string,
	code?: string,
}

export type { User, UserData, UserFull, UserWithPwd, UserRole } from "./user";
export type { ResponseEvent, ResponseEventFull, EventData, EventListData, EventDataFull } from "./events";
export type { ResponseTicket, Ticket, ResponseCheckTicket, CheckTicketResult, TicketStats } from "./tickets";
export type { ImgData, TicketType } from "./ticketTypes";
export type { Font } from "./fonts";
