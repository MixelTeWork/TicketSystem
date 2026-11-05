import { expect, test } from "vitest";
import { parseTicketCatalog, parseTicketType } from "./ticketTypes";
import { ticketTypeFixture } from "../test/fixtures";

test.each(["dayOffsets", "validDates", "categoryId", "price", "quantity"])("rejects missing variant %s", field =>
{
	const type = ticketTypeFixture();
	Reflect.deleteProperty(type, field);
	expect(() => parseTicketType(type)).toThrow("Некорректный ответ вида билета");
});
test("accepts explicit zero and null limits without changing the DTO", () =>
{
	for (const quantity of [0, null])
	{
		const type = ticketTypeFixture({ quantity, price: 0 });
		expect(parseTicketType(type)).toBe(type);
	}
});
test("rejects a catalog variant without availability flags", () =>
{
	const variant = { ...ticketTypeFixture(), deleted: false, available: true };
	Reflect.deleteProperty(variant, "available");
	expect(() => parseTicketCatalog({ eventId: 7, categories: [{ id: 1, name: "Standard", variants: [variant] }] })).toThrow();
});
