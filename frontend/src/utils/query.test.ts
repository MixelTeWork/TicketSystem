import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { queryListAddItem, queryListDeleteItem, queryListUpdateItem } from "./query";

test("updates the same event list key for numeric and string IDs", () =>
{
	const client = new QueryClient();
	client.setQueryData(["tickets", "3"], [{ id: 1, code: "OLD" }]);

	queryListAddItem(client, ["tickets", 3], { id: 2, code: "NEW" });
	queryListUpdateItem(client, ["tickets", 3], { id: 1, code: "UPDATED" });
	queryListDeleteItem(client, ["tickets", 3], 2);

	expect(client.getQueryData(["tickets", "3"])).toEqual([{ id: 1, code: "UPDATED" }]);
});
