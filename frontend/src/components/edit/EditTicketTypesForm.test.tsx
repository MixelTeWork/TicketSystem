import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { eventFixture } from "../../test/fixtures";
import EditTicketTypesForm from "./EditTicketTypesForm";
import type { EventData } from "../../api/events";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test("restores the original deleted days variant without changing its saved settings", async () =>
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	const variant = { id: 9, categoryId: 4, name: "Ручное имя", price: 0, quantity: 25, dayOffsets: [0, 1], validDates: ["2026-10-31", "2026-11-01"], imageId: 12, pattern: null, deleted: true, available: false };
	const catalog = { eventId: 7, categories: [{ id: 4, name: "Обычный", variants: [variant] }] };
	client.setQueryData(["ticket_catalog", "7"], catalog);
	client.setQueryData(["ticket_types", "7"], []);
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...catalog, categories: [{ ...catalog.categories[0], variants: [{ ...variant, deleted: false, available: true }] }] })));
	vi.stubGlobal("fetch", fetchMock);
	const event: EventData = { id: 7, name: "Два", date: "2026-10-31", active: true, endDate: "2026-11-01", dayCount: 2, days: [{ id: 1, dayOffset: 0, date: "2026-10-31" }, { id: 2, dayOffset: 1, date: "2026-11-01" }] };
	render(<QueryClientProvider client={client}><EditTicketTypesForm eventId={7} event={event} open /></QueryClientProvider>);
	fireEvent.click(screen.getByLabelText("Оба дня"));
	expect((screen.getByLabelText("Название вида билета 1") as HTMLInputElement).value).toBe("Ручное имя");
	expect((screen.getByLabelText("Цена вида билета 1") as HTMLInputElement).value).toBe("0");
	expect((screen.getByLabelText("Количество вида билета 1") as HTMLInputElement).value).toBe("25");
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ categoryChanges: [], typeChanges: [{ action: "add", categoryRef: { id: 4 }, dayOffsets: [0, 1], name: "Ручное имя", price: 0, quantity: 25 }] });
	expect(client.getQueryData(["ticket_types", "7"])).toEqual([]);
});

test("saving the one-day editor preserves hidden second-day variants and their quota", async () =>
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	const base = { categoryId: 4, price: 100, quantity: 20, imageId: null, pattern: null, deleted: false };
	const catalog = { eventId: 7, categories: [{ id: 4, name: "Обычный", variants: [{ ...base, id: 9, name: "Первый", dayOffsets: [0], validDates: ["2026-10-31"], available: true }, { ...base, id: 10, name: "Оба", dayOffsets: [0, 1], validDates: ["2026-10-31", "2026-11-01"], available: false }] }] };
	client.setQueryData(["ticket_catalog", "7"], catalog);
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog)));
	vi.stubGlobal("fetch", fetchMock);
	render(<QueryClientProvider client={client}><EditTicketTypesForm eventId={7} event={eventFixture()} open /></QueryClientProvider>);
	expect(screen.queryByDisplayValue("Оба")).toBeNull();
	fireEvent.change(screen.getByLabelText("Название вида билета 1"), { target: { value: "Новое имя" } });
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ categoryChanges: [], typeChanges: [{ action: "update", id: 9, name: "Новое имя" }] });
});

test.each(["name first", "price first"])("keeps both ticket type changes when editing %s", async order =>
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	const type = { id: 9, name: "Standard", price: 100, imageId: null, pattern: null };
	const category = { id: 4, name: "Standard", variants: [{ ...type, categoryId: 4, dayOffsets: [0], validDates: ["2026-10-26"], quantity: null, deleted: false, available: true }] };
	client.setQueryData(["ticket_catalog", "7"], { eventId: 7, categories: [category] });
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ eventId: 7, categories: [category] })));
	vi.stubGlobal("fetch", fetchMock);
	render(<QueryClientProvider client={client}><EditTicketTypesForm eventId={7} event={eventFixture()} open /></QueryClientProvider>);
	const name = screen.getByDisplayValue("Standard");
	const price = screen.getByDisplayValue("100");
	const changeName = () => fireEvent.change(name, { target: { value: "Free" } });
	const changePrice = () => fireEvent.change(price, { target: { value: "0" } });
	if (order == "name first") { changeName(); changePrice(); }
	else { changePrice(); changeName(); }
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ categoryChanges: [], typeChanges: [{ id: 9, name: "Free", price: 0, action: "update" }] });
});
