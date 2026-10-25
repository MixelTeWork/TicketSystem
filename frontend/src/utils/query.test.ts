import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { queryInvalidate, queryListAddItem, queryListDeleteItem, queryListUpdateItem } from "./query";
import { queryKey } from "../api/tickets";

test("updates the same event list key for numeric and string IDs", () =>
{
	const client = new QueryClient();
	client.setQueryData(["tickets", "3"], [{ id: 1, code: "OLD" }]);

	queryListAddItem(client, queryKey(3), { id: 2, code: "NEW" });
	queryListUpdateItem(client, queryKey("3"), { id: 1, code: "UPDATED" });
	queryListDeleteItem(client, queryKey(3), 2);

	expect(client.getQueryData(["tickets", "3"])).toEqual([{ id: 1, code: "UPDATED" }]);
});

test("structured query keys retain filter objects and numeric elements without collisions", async () =>
{
	const client = new QueryClient();
	const key = ["tickets", { eventId: 3, search: "Ann" }, 1] as const;
	const other = ["tickets", { eventId: 3, search: "Bob" }, 1] as const;
	client.setQueryData(key, [{ id: 1 }]);
	client.setQueryData(other, [{ id: 9 }]);
	queryListAddItem(client, key, { id: 2 });
	queryListUpdateItem(client, key, { id: 1, name: "Ann" });
	queryListDeleteItem(client, key, 2);
	await queryInvalidate(client, key);
	expect(client.getQueryData(key)).toEqual([{ id: 1, name: "Ann" }]);
	expect(client.getQueryData(other)).toEqual([{ id: 9 }]);
	expect(client.getQueryState(key)?.isInvalidated).toBe(true);
	expect(client.getQueryState(other)?.isInvalidated).toBe(false);
	expect(client.getQueryData(["tickets", "[object Object]", "1"])).toBeUndefined();
	client.clear();
});
