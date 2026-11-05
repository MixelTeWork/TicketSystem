import { expect, test } from "vitest";
import { dateToString, datetimeToString, isCalendarDate, parseUtcDate } from "./dates";
import getTicketPrefix from "./getTicketPrefix";
import { parseEventResponse } from "../api/events";
import { eventFixture } from "../test/fixtures";
import { calendarDate } from "./multiday";

test("timestamps require an explicit timezone", () =>
{
	expect(parseUtcDate("2026-10-12T18:30:00+03:00").toISOString()).toBe("2026-10-12T15:30:00.000Z");
	for (const value of ["2026-10-12", "2026-10-12 15:30:00", "2026-10-12T15:30:00", "invalid"])
		expect(() => parseUtcDate(value)).toThrow();
});
test("event dates preserve the calendar day and ticket prefix", () =>
{
	for (const date of ["1000-01-01", "2026-12-31", "9999-12-31"])
		expect(parseEventResponse(eventFixture({ date })).date).toBe(date);
	expect(getTicketPrefix(7, "2027-01-01")).toBe("007-70101-");
	expect(calendarDate("2026-10-31")).toBe("10.31");
	expect(calendarDate("2026-10-31", true)).toBe("31.10.2026");
	expect(isCalendarDate("2026-02-29")).toBe(false);
});
test("UTC instants display in Moscow time across midnight", () =>
{
	const date = new Date("2026-12-31T22:15:17Z");
	expect(datetimeToString(date, true)).toBe("01.01.2027 01:15:17");
	expect(dateToString(date, true)).toBe("2027.01.01");
});

test.each(["endDate", "dayCount", "days"])("rejects missing event %s", field =>
{
	const event = eventFixture();
	Reflect.deleteProperty(event, field);
	expect(() => parseEventResponse(event)).toThrow("Некорректный ответ мероприятия");
});
