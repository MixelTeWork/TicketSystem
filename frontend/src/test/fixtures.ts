import type { EventData } from "../api/events";
import type { Ticket, ResponseTicket, TicketStats } from "../api/tickets";
import type { TicketType } from "../api/ticketTypes";

export function eventFixture(overrides: Partial<EventData> = {}): EventData
{
	const date = overrides.date ?? "2026-10-26";
	return { id: 7, name: "Event", active: true, date, endDate: date, dayCount: 1, days: [{ id: 1, dayOffset: 0, date }], ...overrides };
}
export function ticketTypeFixture(overrides: Partial<TicketType> = {}): TicketType
{
	return { id: 2, name: "Standard", categoryId: 1, price: null, quantity: null, dayOffsets: [0], validDates: ["2026-10-26"], imageId: null, pattern: null, ...overrides };
}
export function ticketFixture(overrides: Partial<Ticket> = {}): Ticket
{
	return { id: 1, code: "ABC", eventId: 7, typeId: 2, type: "Standard", typeDeleted: false, createdDate: new Date("2026-10-26T12:00:00Z"), personName: null, personLink: null, promocode: null, price: null, authOnPltf: false, dayOffsets: [0], validDates: ["2026-10-26"], checkins: [], merchIssuedAt: null, merchIssuedById: null, merchIssuedBy: null, ...overrides };
}
export function ticketResponseFixture(overrides: Partial<ResponseTicket> = {}): ResponseTicket
{
	const ticket = ticketFixture();
	return { ...ticket, createdDate: ticket.createdDate.toISOString(), merchIssuedAt: null, checkins: [], ...overrides };
}
export function statsFixture(overrides: Partial<TicketStats> = {}): TicketStats
{
	return { typeId: 2, name: "Standard", categoryId: 1, categoryName: "Standard category", price: null, deleted: false, categoryDeleted: false, dayOffsets: [0], validDates: ["2026-10-26"], count: 0, scanned: 0, authOnPltf: 0, merchIssued: 0, checkinCount: 0, byDay: [{ eventDayId: 1, dayOffset: 0, date: "2026-10-26", checkedIn: 0, eligible: 0 }], ...overrides };
}
