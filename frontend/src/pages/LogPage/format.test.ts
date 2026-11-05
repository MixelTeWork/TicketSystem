import { expect, test } from "vitest";
import { changeValue } from ".";

test("formats calendar dates separately from UTC instants", () =>
{
	expect(changeValue("date", "2026-10-31")).toBe("31.10.2026");
	expect(changeValue("createdDate", "2026-10-31T22:00:00Z")).toBe("01.11.2026 01:00:00");
});
test("keeps unknown historical payloads visible without guessing their timezone", () =>
{
	for (const value of ["2026-10-31 22:00:00", "unknown", { raw: 1 }, null])
		expect(changeValue("date", value)).toBe(JSON.stringify(value));
});
