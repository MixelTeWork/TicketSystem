import type { EventData, ResponseEvent } from "./events";
import { type QueryClient } from "@tanstack/react-query";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, stdMutationNoRes } from "../utils/mutations";

const url = "/api/tickets";
export const queryKey = (id: ItemId) => ["tickets", `${id}`];
export const queryKeyStats = (id: ItemId) => ["ticket_stats", `${id}`];

export function parseTicketResponse(responseTicket: ResponseTicket): Ticket
{
	const ticket = {
		...responseTicket,
		createdDate: new Date(responseTicket.createdDate),
		scannedDate: responseTicket.scannedDate ? new Date(responseTicket.scannedDate) : undefined,
	};
	return ticket;
}

const useTickets = itemQuery<ResponseTicket[], Ticket[]>(queryKey, id => `/api/events/${id}/tickets`, tickets => tickets.map(parseTicketResponse));
export default useTickets;
export const useTicketStats = itemQuery<TicketStats[]>(queryKeyStats, id => `/api/events/${id}/tickets_stats`);

export function updateTicketCache(client: QueryClient, ticket: Ticket)
{
	queryListUpdateItem(client, queryKey(ticket.eventId), ticket);
	return queryInvalidate(client, queryKeyStats(ticket.eventId));
}
export const useMutationNewTicket = stdMutation<NewTicketData, ResponseTicket, Ticket>(url, (client, data) =>
{
	queryListAddItem(client, queryKey(data.eventId), data);
	return queryInvalidate(client, queryKeyStats(data.eventId));
}, undefined, parseTicketResponse);
export const useMutationUpdateTicket = stdMutation<UpdateTicketParams, ResponseTicket, Ticket>(params => `${url}/${params.ticketId}`,
	updateTicketCache, params => params.data, parseTicketResponse);
export function useMutationDeleteTicket(eventId: ItemId, onSuccess?: () => void)
{
	const useDelete = stdMutationNoRes<ItemId>(id => `${url}/${id}`, (client, id) =>
	{
		queryListDeleteItem(client, queryKey(eventId), id);
		return queryInvalidate(client, queryKeyStats(eventId));
	}, () => undefined, "DELETE");
	return useDelete(onSuccess);
}

interface UpdateTicketData
{
	typeId: number;
	personName: string;
	personLink: string;
	promocode: string;
	price?: number | null;
}
interface NewTicketData extends UpdateTicketData { eventId: number; code: string; }
interface UpdateTicketParams { ticketId: ItemId; data: UpdateTicketData; }

export interface ResponseCheckTicket
{
	success: boolean,
	errorCode: null | "event" | "scanned" | "notExist",
	ticket: ResponseTicket | null,
	event: ResponseEvent | null,
}

export interface ResponseTicket
{
	id: number,
	code: string,
	type: string,
	typeId: number,
	eventId: number,
	createdDate: string,
	personName?: string | null,
	personLink?: string | null,
	promocode?: string | null,
	scanned: boolean,
	scannedBy?: string | null,
	scannedById?: number | null,
	scannedDate?: string | null,
	authOnPltf: boolean,
	price?: number | null,
}

export type CheckTicketResult = CheckTicketResult_success | CheckTicketResult_event | CheckTicketResult_scanned | CheckTicketResult_notExist;

interface CheckTicketResult_success
{
	success: true,
	errorCode: null,
	ticket: Ticket_scanned,
	event: null,
}

interface CheckTicketResult_event
{
	success: boolean,
	errorCode: "event",
	ticket: Ticket,
	event: EventData,
}

interface CheckTicketResult_scanned
{
	success: false,
	errorCode: "scanned",
	ticket: Ticket_scanned,
	event: null,
}

interface CheckTicketResult_notExist
{
	success: false,
	errorCode: "notExist",
	ticket: null,
	event: null,
}

export type Ticket = Ticket_common | Ticket_scanned;

interface Ticket_common
{
	id: number,
	code: string,
	type: string,
	typeId: number,
	eventId: number,
	createdDate: Date,
	personName?: string | null,
	personLink?: string | null,
	promocode?: string | null,
	scanned: boolean,
	scannedBy?: string | null,
	scannedById?: number | null,
	scannedDate?: Date,
	authOnPltf: boolean,
	price?: number | null,
}

interface Ticket_scanned extends Ticket_common
{
	scanned: true;
	scannedDate: Date;
}

export interface TicketStats
{
	typeId: number,
	count: number,
	scanned: number,
	authOnPltf: number,
}
