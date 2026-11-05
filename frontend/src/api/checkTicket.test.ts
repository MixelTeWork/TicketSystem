import { expect, test } from "vitest";
import { parseCheckTicketResponse } from "./checkTicket";
import { eventFixture, ticketResponseFixture } from "../test/fixtures";
import type { ResponseCheckTicket } from "./tickets";

const ticket = ticketResponseFixture({ price: 0 });
const checkin = { eventDayId: 1, dayOffset: 0, dayDate: "2026-10-26", checkedAt: "2026-10-26T13:00:00Z", checkedById: null, checkedBy: null };
test("parses first and repeated entry without inventing a system actor", () =>
{
	const first = parseCheckTicketResponse({ operation: "entry", success: true, errorCode: null, ticket, event: null, checkin });
	const repeat = parseCheckTicketResponse({ operation: "entry", success: false, errorCode: "scanned", ticket, event: null, checkin });
	for (const result of [first, repeat])
	{
		expect(result.checkin?.checkedAt).toEqual(new Date(checkin.checkedAt));
		expect(result.checkin?.checkedById).toBeNull();
		expect(result.ticket?.price).toBe(0);
	}
});
test("uses the selected historical day even when another checkin is more recent", () =>
{
	const result = parseCheckTicketResponse({ operation: "entry", success: false, errorCode: "scanned", ticket: { ...ticket, checkins: [checkin, { ...checkin, eventDayId: 2, dayOffset: 1, checkedAt: "2026-10-27T13:00:00Z" }] }, event: null, checkin: { ...checkin, checkedAt: null } });
	expect(result.checkin?.checkedAt).toBeNull();
	expect(result.ticket?.checkins[1].checkedAt).toEqual(new Date("2026-10-27T13:00:00Z"));
});
test("merch needs no entry and retains its original issuer on repeat", () =>
{
	for (const success of [true, false])
	{
		const result = parseCheckTicketResponse({ operation: "merch", ...(success ? { success: true, errorCode: null } as const : { success: false, errorCode: "merchIssued" } as const), event: null, checkin: null, ticket: { ...ticket, merchIssuedAt: "2026-10-01T01:00:00Z", merchIssuedById: 3, merchIssuedBy: "Сотрудник" } });
		expect(result.ticket?.checkins).toEqual([]);
		expect(result.ticket?.merchIssuedBy).toBe("Сотрудник");
		expect(result.checkin).toBeNull();
	}
});
test("wrong-event response preserves calendar dates", () =>
{
	const result = parseCheckTicketResponse({ operation: "entry", success: false, errorCode: "event", ticket, event: eventFixture(), checkin: null });
	expect(result.event?.date).toBe("2026-10-26");
});
test("rejects missing fields and impossible success combinations", () =>
{
	const response: ResponseCheckTicket = { operation: "entry", success: true, errorCode: null, ticket, event: null, checkin };
	for (const field of ["operation", "checkin"])
	{
		const malformed = { ...response };
		Reflect.deleteProperty(malformed, field);
		expect(() => parseCheckTicketResponse(malformed)).toThrow();
	}
	expect(() => parseCheckTicketResponse(response, "merch")).toThrow();
	expect(() => parseCheckTicketResponse({ ...response, checkin: { ...checkin, checkedAt: "" } })).toThrow();
});
