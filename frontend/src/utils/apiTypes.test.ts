import { expectTypeOf, test } from "vitest";
import { itemQuery, stdQuery } from "./query";
import { itemMutation, stdMutation } from "./mutations";
import type { Ticket } from "../api/tickets";

test("API factories require a mapper when response and result types differ", () =>
{
	const _useDate = stdQuery<string, Date>(["date"], "/date", value => new Date(value));
	expectTypeOf<ReturnType<typeof _useDate>["data"]>().toEqualTypeOf<Date | undefined>();
	// @ts-expect-error A wire string cannot become a Date without a mapper.
	stdQuery<string, Date>(["date"], "/date");
	// @ts-expect-error Item queries have the same mapper requirement.
	itemQuery<string, Date>(id => ["date", id], "/date");
	// @ts-expect-error Mutations cannot skip the response mapper either.
	stdMutation<void, string, Date>("/date");
	// @ts-expect-error Bound mutations also require a mapper.
	itemMutation<void, string, Date>("/date");
	expectTypeOf<Extract<Ticket, { scanned: true }>["scannedDate"]>().toEqualTypeOf<Date>();
});
