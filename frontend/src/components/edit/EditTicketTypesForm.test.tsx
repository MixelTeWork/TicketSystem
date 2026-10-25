import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import EditTicketTypesForm from "./EditTicketTypesForm";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test.each(["name first", "price first"])("keeps both ticket type changes when editing %s", async order =>
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	const type = { id: 9, name: "Standard", price: 100, imageId: null, pattern: null };
	client.setQueryData(["ticket_types", "7"], [type]);
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...type, name: "Free", price: 0 }])));
	vi.stubGlobal("fetch", fetchMock);
	render(<QueryClientProvider client={client}><EditTicketTypesForm eventId={7} open /></QueryClientProvider>);
	const name = screen.getByDisplayValue("Standard");
	const price = screen.getByDisplayValue("100");
	const changeName = () => fireEvent.change(name, { target: { value: "Free" } });
	const changePrice = () => fireEvent.change(price, { target: { value: "0" } });
	if (order == "name first") { changeName(); changePrice(); }
	else { changePrice(); changeName(); }
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([{ id: 9, name: "Free", price: 0, action: "update" }]);
});
