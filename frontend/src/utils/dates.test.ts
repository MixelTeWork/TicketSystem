import { expect, test } from "vitest";
import { dateToString, datetimeToInput, datetimeToString, inputToUtc, parseUtcDate } from "./dates";
import getTicketPrefix from "./getTicketPrefix";

test("UTC timestamps without an offset are independent of the browser timezone", () =>
{
	expect(parseUtcDate("2026-10-12 15:30:00").toISOString()).toBe("2026-10-12T15:30:00.000Z");
	expect(parseUtcDate("2026-10-12T18:30:00+03:00").toISOString()).toBe("2026-10-12T15:30:00.000Z");
	expect(parseUtcDate("Mon, 12 Oct 2026 15:30:00 GMT").toISOString()).toBe("2026-10-12T15:30:00.000Z");
});

test("event inputs and displayed dates always use Moscow time across midnight", () =>
{
	const date = new Date("2026-12-31T22:15:17Z");
	expect(datetimeToString(date, true)).toBe("01.01.2027 01:15:17");
	expect(dateToString(date, true)).toBe("2027.01.01");
	expect(datetimeToInput(date)).toBe("2027-01-01T01:15:17");
	expect(inputToUtc(datetimeToInput(date))).toBe(date.toISOString());
	expect(inputToUtc("2027-01-01T01:15")).toBe("2026-12-31T22:15:00.000Z");
	expect(getTicketPrefix(7, date)).toBe("007-70101-");
});
