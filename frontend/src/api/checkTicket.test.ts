import { expect, test } from "vitest";
import { parseCheckTicketResponse } from "./checkTicket";
import type { ResponseTicket } from "./tickets";

const ticket: ResponseTicket = {
	id: 1, code: "ABC", eventId: 7, typeId: 2, type: "Standard", authOnPltf: false,
	createdDate: "2026-10-05T12:00:00", scanned: true, scannedDate: "2026-10-05T13:00:00",
	scannedBy: null, scannedById: null, price: 0,
};

test.each([true, false])("parses first and repeated scans with a system actor (success=%s)", success =>
{
	const response = { success, errorCode: success ? null : "scanned" as const, ticket, event: null };
	const result = parseCheckTicketResponse(response);
	expect(result.ticket?.scannedDate).toEqual(new Date(ticket.scannedDate!));
	expect(result.ticket?.scannedById).toBeNull();
	expect(result.ticket?.price).toBe(0);
	expect(ticket.scannedDate).toBe("2026-10-05T13:00:00");
});

test("parses the event of a ticket scanned at the wrong event", () =>
{
	const result = parseCheckTicketResponse({ success: false, errorCode: "event", ticket,
		event: { id: 7, name: "Other", date: "2026-10-05T12:00:00" } });
	expect(result.event?.date).toBeInstanceOf(Date);
	expect(result.success).toBe(false);
});

test("rejects an incomplete successful scan response", () =>
{
	expect(() => parseCheckTicketResponse({ success: true, errorCode: null, ticket: { ...ticket, scannedDate: null }, event: null })).toThrow("Некорректный ответ");
});
