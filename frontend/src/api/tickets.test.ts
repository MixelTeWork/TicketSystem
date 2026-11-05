import { expect, test } from "vitest";
import { parseTicketResponse, parseTicketStats } from "./tickets";
import { ticketResponseFixture, statsFixture } from "../test/fixtures";

test("parses timestamps without mutating the required ticket DTO", () =>
{
	const response = ticketResponseFixture({ checkins: [{ eventDayId: 1, dayOffset: 0, dayDate: "2026-10-26", checkedAt: "2026-10-26T13:00:00Z", checkedById: null, checkedBy: null }] });
	const ticket = parseTicketResponse(response);
	expect(ticket.createdDate).toBeInstanceOf(Date);
	expect(ticket.checkins[0].checkedAt).toEqual(new Date("2026-10-26T13:00:00Z"));
	expect(response.checkins[0].checkedAt).toBe("2026-10-26T13:00:00Z");
});
test("retains historical unknown times and actors", () =>
{
	const ticket = parseTicketResponse(ticketResponseFixture({ checkins: [{ eventDayId: 1, dayOffset: 0, dayDate: "2026-10-26", checkedAt: null, checkedById: null, checkedBy: null }] }));
	expect(ticket.checkins[0].checkedAt).toBeNull();
	expect(ticket.checkins[0].checkedBy).toBeNull();
});
test.each(["typeDeleted", "checkins", "dayOffsets", "validDates", "merchIssuedAt", "merchIssuedById", "merchIssuedBy"])("rejects a missing required %s instead of inventing a value", field =>
{
	const response = ticketResponseFixture();
	Reflect.deleteProperty(response, field);
	expect(() => parseTicketResponse(response)).toThrow("Некорректный ответ билета");
});
test("rejects malformed known timestamps", () =>
{
	expect(() => parseTicketResponse(ticketResponseFixture({ createdDate: "invalid" }))).toThrow();
});

test.each(["byDay", "checkinCount", "merchIssued", "name"])("rejects missing statistics %s", field =>
{
	const row = statsFixture();
	Reflect.deleteProperty(row, field);
	expect(() => parseTicketStats([row])).toThrow("Некорректный ответ статистики");
});
