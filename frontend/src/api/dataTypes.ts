import type { TicketPattern } from "../components/TicketEditor/editor";

export class ApiError extends Error { }

export type Modify<T, R> = Omit<T, keyof R> & R;
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
	roles: string[],
	operations: string[],
}

export interface UserFull
{
	id: number,
	name: string,
	login: string,
	roles: string[],
	bossId: number | null,
	deleted: boolean,
	access: string[],
	operations: string[],
}

export interface UserWithPwd extends User
{
	password: string,
}

export interface ImgData
{
	data: string,
	name: string,
	accessEventId: number,
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
export interface EventDataFull
{
	id: number,
	deleted: boolean,
	name: string,
	date: Date,
	active: boolean,
	access: User[],
}

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
	eventId: number,
	createdDate: string,
	personName?: string,
	personLink?: string,
	promocode?: string,
	scanned: boolean,
	scannedBy?: string,
	scannedById?: number,
	scannedDate?: string,
	authOnPltf: boolean,
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
	personName?: string,
	personLink?: string,
	promocode?: string,
	scanned: boolean,
	scannedBy?: string,
	scannedById?: number,
	scannedDate?: Date,
	authOnPltf: boolean,
}

interface Ticket_scanned
{
	id: number,
	code: string,
	type: string,
	typeId: number,
	eventId: number,
	createdDate: Date,
	personName?: string,
	personLink?: string,
	promocode?: string,
	scanned: boolean,
	scannedBy: string,
	scannedById: number,
	scannedDate: Date,
	authOnPltf: boolean,
}

export interface TicketType
{
	id: number,
	name: string,
	imageId: number | null,
	pattern: TicketPattern,
}

export interface TicketStats
{
	typeId: number,
	count: number,
}

export interface Font
{
	id: number,
	name: string,
	type: "ttf" | "otf" | "woff" | "woff2",
}
