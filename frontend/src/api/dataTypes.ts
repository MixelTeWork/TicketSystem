export interface ResponseMsg
{
	msg: string,
}

export interface User
{
	auth: boolean,
	id: number,
	name: string,
	login: string,
	operations: string[],
}

export interface ResponseEvent
{
	id: number,
	name: string,
	date: string,
}

export interface EventData
{
	id: number,
	name: string,
	date: Date,
}

export interface ResponseCheckTicket
{
	success: boolean,
	errorCode: null | "event" | "scanned" | "notExist",
	ticket: ResponseTicket | null,
}

export interface ResponseTicket
{
	id: number,
	code: string,
	type: string,
	eventId: number,
	createdDate: string,
	personName?: string,
	personLink?: string,
	promocode?: string,
	scanned: boolean,
	scannedBy?: string,
	scannedById?: number,
	scannedDate?: string,
}

export type CheckTicketResult = CheckTicketResult_success | CheckTicketResult_event | CheckTicketResult_scanned | CheckTicketResult_notExist;

interface CheckTicketResult_success
{
	success: true,
	errorCode: null,
	ticket: Ticket_scanned,
}

interface CheckTicketResult_event
{
	success: boolean,
	errorCode: "event",
	ticket: Ticket,
}

interface CheckTicketResult_scanned
{
	success: false,
	errorCode: "scanned",
	ticket: Ticket_scanned,
}

interface CheckTicketResult_notExist
{
	success: false,
	errorCode: "notExist",
	ticket: null,
}

export type Ticket = Ticket_common | Ticket_scanned;

interface Ticket_common
{
	id: number,
	code: string,
	type: string,
	eventId: number,
	createdDate: Date,
	personName?: string,
	personLink?: string,
	promocode?: string,
	scanned: boolean,
	scannedBy?: string,
	scannedById?: number,
	scannedDate?: Date,
}

interface Ticket_scanned
{
	id: number,
	code: string,
	type: string,
	eventId: number,
	createdDate: Date,
	personName?: string,
	personLink?: string,
	promocode?: string,
	scanned: boolean,
	scannedBy: string,
	scannedById: number,
	scannedDate: Date,
}

export interface TicketType
{
	id: number,
	name: string,
}
