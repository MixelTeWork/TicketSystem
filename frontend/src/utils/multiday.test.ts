import { expect, test } from "vitest";
import { calendarDayLabel, eventEndDate } from "./multiday";

test("compact interactive dates name the month without changing the calendar day", () =>
{
	expect(calendarDayLabel("2026-11-05")).toBe("5 ноя");
	expect(calendarDayLabel("2026-05-11")).toBe("11 мая");
});

test.each([
	["2026-12-31", true, "2027-01-01"],
	["2028-02-28", true, "2028-02-29"],
	["2026-02-28", true, "2026-03-01"],
	["9999-12-31", true, null],
	["9999-12-31", false, "9999-12-31"],
	["2026-02-29", true, null],
	["", false, null],
] as const)("previews the calendar end for %s, twoDays=%s", (date, twoDays, expected) =>
{
	expect(eventEndDate(date, twoDays)).toBe(expected);
});
