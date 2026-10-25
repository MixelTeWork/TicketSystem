import { parseUtcDate } from "../utils/dates";
import type { EventData, ResponseEvent } from "./events";
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchJsonPost } from "../utils/fetch";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem, queryInvalidate, itemQuery, type ItemId } from "../utils/query";
import { stdMutation, stdMutationNoRes } from "../utils/mutations";
import { ApiError } from "./dataTypes";

const url = "/api/tickets";
export const queryKey = (id: ItemId) => ["tickets", `${id}`];
export const queryKeyStats = (id: ItemId) => ["ticket_stats", `${id}`];
export const queryKeyPages = (id: ItemId) => ["ticket_pages", `${id}`];

export interface TicketFilters
{
	search: string;
	typeId: string;
	promocode: string;
	noPromocode: boolean;
	auth: string;
	dateFrom: string;
	dateTo: string;
}
export const emptyTicketFilters: TicketFilters = { search: "", typeId: "", promocode: "", noPromocode: false, auth: "all", dateFrom: "", dateTo: "" };
export interface TicketPage
{
	items: Ticket[];
	total: number;
	count: number;
	page: number;
	pages: number;
	hasAuth: boolean;
	types: { id: number, name: string }[];
	promocodes: string[];
}

export function useTicketPage(eventId: ItemId, filters: TicketFilters, page: number, pageSize: string)
{
	return useQuery({
		queryKey: [...queryKeyPages(eventId), filters, page, pageSize],
		queryFn: async ({ signal }) =>
		{
			const body = {
				...filters,
				page,
				pageSize: pageSize == "all" ? "all" : Number(pageSize),
				typeId: filters.typeId ? Number(filters.typeId) : null,
				promocode: filters.promocode || null,
			};
			const data = await fetchJsonPost<Omit<TicketPage, "items"> & { items: ResponseTicket[] }>(`/api/events/${eventId}/tickets/page`, body, signal);
			return { ...data, pageSize, items: data.items.map(parseTicketResponse) };
		},
		enabled: Number.isInteger(Number(eventId)) && Number(eventId) > 0,
		gcTime: 5 * 60 * 1000,
		staleTime: 0,
		refetchOnWindowFocus: false,
		placeholderData: keepPreviousData,
	});
}

export function parseTicketResponse(responseTicket: ResponseTicket): Ticket
{
	const ticket = {
		...responseTicket,
		createdDate: parseUtcDate(responseTicket.createdDate),
	};
	if (!responseTicket.scanned) return { ...ticket, scanned: false, scannedDate: undefined };
	const scannedDate = responseTicket.scannedDate ? parseUtcDate(responseTicket.scannedDate) : undefined;
	if (!scannedDate || !Number.isFinite(scannedDate.getTime()))
		throw new ApiError("Некорректный ответ: у использованного билета нет даты прохода");
	return { ...ticket, scanned: true, scannedDate };
}

const useTickets = itemQuery<ResponseTicket[], Ticket[]>(queryKey, id => `/api/events/${id}/tickets`, tickets => tickets.map(parseTicketResponse));
export default useTickets;
export const useTicketStats = itemQuery<TicketStats[]>(queryKeyStats, id => `/api/events/${id}/tickets_stats`);

export function updateTicketCache(client: QueryClient, ticket: Ticket)
{
	queryListUpdateItem(client, queryKey(ticket.eventId), ticket);
	return Promise.all([queryInvalidate(client, queryKeyStats(ticket.eventId)), queryInvalidate(client, queryKeyPages(ticket.eventId), false)]);
}
export const useMutationNewTicket = stdMutation<NewTicketData, ResponseTicket, Ticket>(url, (client, data) =>
{
	queryListAddItem(client, queryKey(data.eventId), data);
	return Promise.all([queryInvalidate(client, queryKeyStats(data.eventId)), queryInvalidate(client, queryKeyPages(data.eventId), false), queryInvalidate(client, ["events"])]);
}, undefined, parseTicketResponse);
export const useMutationUpdateTicket = stdMutation<UpdateTicketParams, ResponseTicket, Ticket>(params => `${url}/${params.ticketId}`,
	updateTicketCache, params => params.data, parseTicketResponse);
export function useMutationDeleteTicket(eventId: ItemId, onSuccess?: () => void)
{
	const useDelete = stdMutationNoRes<ItemId>(id => `${url}/${id}`, (client, id) =>
	{
		queryListDeleteItem(client, queryKey(eventId), id);
		return Promise.all([queryInvalidate(client, queryKeyStats(eventId)), queryInvalidate(client, queryKeyPages(eventId), false), queryInvalidate(client, ["events"])]);
	}, () => undefined, "DELETE");
	return useDelete(onSuccess);
}

export interface UpdateTicketData
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

export interface ResponseTicket extends Omit<Ticket_common, "createdDate">
{
	createdDate: string,
	scanned: boolean,
	scannedDate?: string | null,
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
	success: false,
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

export type Ticket = Ticket_unscanned | Ticket_scanned;

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
	scannedBy?: string | null,
	scannedById?: number | null,
	authOnPltf: boolean,
	price?: number | null,
}

interface Ticket_unscanned extends Ticket_common
{
	scanned: false;
	scannedDate?: undefined;
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
