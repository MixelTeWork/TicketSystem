import { expect, test } from "vitest";
import { type ResponseTicket } from "./dataTypes";
import { parseTicketResponse } from "./tickets";

test("parses ticket dates without changing the API response", () =>
{
	const response = {
		id: 1,
		code: "ABC",
		type: "Standard",
		typeId: 2,
		eventId: 3,
		createdDate: "2026-09-26T18:30:00",
		scannedDate: "2026-09-26T19:00:00",
		scanned: true,
		authOnPltf: false,
	} satisfies ResponseTicket;

	const ticket = parseTicketResponse(response);
	expect(ticket.createdDate).toBeInstanceOf(Date);
	expect(ticket.scannedDate).toBeInstanceOf(Date);
	expect(response.createdDate).toBe("2026-09-26T18:30:00");
});

test.each([null, undefined, "invalid"])("rejects a scanned ticket without a valid scan date (%s)", scannedDate =>
{
	expect(() => parseTicketResponse({ id: 1, code: "ABC", type: "Standard", typeId: 2, eventId: 3,
		createdDate: "2026-10-21T12:00:00Z", scanned: true, scannedDate, authOnPltf: false })).toThrow("нет даты прохода");
});
