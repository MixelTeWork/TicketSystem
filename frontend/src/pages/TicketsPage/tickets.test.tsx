import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import TicketsPage from ".";

vi.mock("../../components/ViewTicket", () => ({ default: () => null }));
vi.mock("../../components/create/CreateTicketForm", () => ({ default: () => null }));
vi.mock("../../components/edit/EditTicketForm", () => ({ default: () => null }));
vi.mock("../../utils/scrollToTop", () => ({ default: () => null }));

const clients: QueryClient[] = [];
const items = Array.from({ length: 51 }, (_, index) => ({ id: index + 1, eventId: 7, typeId: 9, type: "Standard", code: `CODE-${index + 1}`, personName: `Visitor ${index + 1}`, createdDate: "2026-10-12", scanned: false, authOnPltf: false }));
function response(page = 1, pageSize = 25)
{
	return new Response(JSON.stringify({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pages: Math.ceil(items.length / pageSize), count: items.length, total: items.length, hasAuth: false, types: [], promocodes: [] }));
}

function setup()
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	client.setQueryData(["event", "7"], { id: 7, name: "Event", date: new Date("2026-10-12") });
	client.setQueryData(["user"], { auth: true, name: "Manager", operations: [] });
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/events/7/tickets"]}><Routes><Route path="/events/:eventId/tickets" element={<TicketsPage />} /></Routes></MemoryRouter></QueryClientProvider>);
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test("a failed next page keeps the last rows and can retry the requested page", async () =>
{
	const fetchMock = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Temporarily unavailable" }), { status: 503 })).mockResolvedValueOnce(response(2));
	vi.stubGlobal("fetch", fetchMock);
	setup();
	await screen.findByText("Visitor 1", { exact: true });
	fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
	await screen.findByRole("alert");
	expect(screen.getByText("Visitor 1", { exact: true })).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
	await screen.findByText("Visitor 26", { exact: true });
	expect(screen.queryByText("Visitor 1", { exact: true })).toBeNull();
	expect(fetchMock.mock.calls[2][0]).toBe("/api/events/7/tickets/page");
	expect(fetchMock.mock.calls[2][1].method).toBe("POST");
	expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ page: 2, pageSize: 25 });
});

test("filters are applied through a typed JSON body and all rows keeps its sentinel", async () =>
{
	const fetchMock = vi.fn().mockImplementation(async () => response());
	vi.stubGlobal("fetch", fetchMock);
	setup();
	await screen.findByText("Visitor 1", { exact: true });
	fireEvent.change(screen.getByPlaceholderText("Имя, код билета или промокод"), { target: { value: " Иван " } });
	fireEvent.change(screen.getByLabelText("Промокод"), { target: { value: "none" } });
	fireEvent.change(screen.getByLabelText("Добавлен с"), { target: { value: "2026-10-12" } });
	expect(fetchMock).toHaveBeenCalledTimes(1);
	fireEvent.click(screen.getByRole("button", { name: "Применить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	const options = fetchMock.mock.calls[1][1];
	expect(JSON.parse(options.body)).toEqual({ page: 1, pageSize: 25, search: "Иван", typeId: null, promocode: null, noPromocode: true, auth: "all", dateFrom: "2026-10-12", dateTo: "" });
	expect(options.signal).toBeInstanceOf(AbortSignal);
	await waitFor(() => expect((screen.getByLabelText("Строк:") as HTMLSelectElement).disabled).toBe(false));
	fireEvent.change(screen.getByLabelText("Строк:"), { target: { value: "all" } });
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
	expect(JSON.parse(fetchMock.mock.calls[2][1].body).pageSize).toBe("all");
});

test("retained rows keep their original range while the page size changes", async () =>
{
	let finish!: (result: Response) => void;
	vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response(2)).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; })));
	setup();
	await screen.findByText("Visitor 1", { exact: true });
	fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
	await screen.findByText("Visitor 26", { exact: true });
	fireEvent.change(screen.getByLabelText("Строк:"), { target: { value: "50" } });
	await waitFor(() => expect(finish).toBeTypeOf("function"));
	expect(screen.getByText("26–50 из 51 · Всего 51")).toBeTruthy();
	finish(response(1, 50));
	await screen.findByText("1–50 из 51 · Всего 51");
});

test("revoked access does not keep previously visible rows", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Forbidden" }), { status: 403 })));
	setup();
	await screen.findByText("Visitor 1", { exact: true });
	fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
	await screen.findByRole("alert");
	expect(screen.queryByText("Visitor 1", { exact: true })).toBeNull();
});
