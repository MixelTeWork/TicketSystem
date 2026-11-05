import { eventFixture, ticketResponseFixture } from "../../test/fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import TicketsPage from ".";

vi.mock("../../components/ViewTicket", () => ({ default: () => null }));
vi.mock("../../components/create/CreateTicketForm", () => ({ default: () => null }));
vi.mock("../../components/edit/EditTicketForm", () => ({ default: () => null }));
vi.mock("../../utils/scrollToTop", () => ({ default: () => null }));

const clients: QueryClient[] = [];
const items = Array.from({ length: 51 }, (_, index) => ticketResponseFixture({ id: index + 1, typeId: 9, code: `CODE-${index + 1}`, personName: `Visitor ${index + 1}`, createdDate: "2026-10-12T12:00:00Z" }));
function response(page = 1, pageSize = 25)
{
	return new Response(JSON.stringify({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pages: Math.ceil(items.length / pageSize), count: items.length, total: items.length, hasAuth: false, types: [], promocodes: [] }));
}

function setup(event = eventFixture({ date: "2026-10-12" }))
{
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
	clients.push(client);
	client.setQueryData(["event", "7"], event);
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

test("uses the deletion flag and checkins rather than a name prefix or summary scan", async () =>
{
	const used = ticketResponseFixture({ id: 71, type: "<Удалён> Буквальное имя", typeDeleted: false, checkins: [{ eventDayId: 1, dayOffset: 0, dayDate: "2026-10-12", checkedAt: null, checkedById: null, checkedBy: null }] });
	const deleted = ticketResponseFixture({ id: 72, code: "DELETED", type: "Удалённый вид", typeDeleted: true });
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [used, deleted], page: 1, pages: 1, count: 2, total: 2, hasAuth: false, types: [{ id: 2, name: "Удалённый вид", deleted: true }], promocodes: [] }))));
	setup();
	const activeCell = await screen.findByRole("cell", { name: "<Удалён> Буквальное имя" });
	expect(activeCell.classList.contains("muted")).toBe(false);
	expect(screen.getByRole("cell", { name: "Удалённый вид" }).classList.contains("muted")).toBe(true);
	expect(screen.getByLabelText("Использован")).toBeTruthy();
	expect(screen.getByLabelText("Не использован")).toBeTruthy();
	expect(screen.getByRole("option", { name: "Удалённый вид (удалён)" })).toBeTruthy();
});

test("shows a compact creation date with full Moscow time and keeps ticket rows simple", async () =>
{
	const ticket = ticketResponseFixture({ code: "DETAILS", personName: "With details", promocode: "FRIEND", price: 12345, createdDate: "2026-10-12T23:30:05Z", authOnPltf: true, dayOffsets: [0, 1], validDates: ["2026-10-12", "2026-10-13"] });
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [ticket], page: 1, pages: 1, count: 1, total: 1, hasAuth: true, types: [], promocodes: ["FRIEND"] }))));
	setup(eventFixture({ date: "2026-10-12", endDate: "2026-10-13", dayCount: 2, days: [{ id: 1, dayOffset: 0, date: "2026-10-12" }, { id: 2, dayOffset: 1, date: "2026-10-13" }] }));
	const row = (await screen.findByText("With details", { exact: true })).closest("tr")!;
	expect(row.querySelector("details")).toBeNull();
	expect(within(row).getByText("FRIEND")).toBeTruthy();
	expect(within(row).getByText("13.10").getAttribute("title")).toBe("13.10.2026 02:30:05 МСК");
	expect(screen.getByRole("columnheader", { name: "Дата добавления" })).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Промокод" })).toBeTruthy();
	expect(screen.queryByRole("combobox", { name: "В игре" })).toBeNull();
	expect(screen.getByRole("columnheader", { name: "Вошёл в игру" })).toBeTruthy();
	expect(within(row).queryByRole("button", { name: "12 окт, 13 окт" })).toBeNull();
	expect(screen.getByText(/12\s345 ₽/)).toBeTruthy();
	expect(row.closest(".table-scroll")).toBeNull();
});

test("explains an empty search and provides a working filter reset", async () =>
{
	const fetchMock = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, pages: 1, count: 0, total: 51, hasAuth: false, types: [], promocodes: [] }))).mockResolvedValue(response());
	vi.stubGlobal("fetch", fetchMock);
	setup();
	await screen.findByText("Visitor 1", { exact: true });
	fireEvent.change(screen.getByPlaceholderText("Имя, код билета или промокод"), { target: { value: "Missing" } });
	fireEvent.click(screen.getByRole("button", { name: "Применить" }));
	await screen.findByText("По этим условиям билеты не найдены. Измените поиск или сбросьте фильтры.");
	fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
	expect((screen.getByPlaceholderText("Имя, код билета или промокод") as HTMLInputElement).value).toBe("");
	await screen.findByText("Visitor 1", { exact: true });
});

test("distinguishes an event without tickets from an empty search", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pages: 1, count: 0, total: 0, hasAuth: false, types: [], promocodes: [] }))));
	setup();
	await screen.findByText("Билетов пока нет. После выдачи они появятся в этом списке.");
	expect(screen.queryByRole("button", { name: "Сбросить фильтры" })).toBeNull();
});

test("shows real standard code suffixes with their shared prefix and restores full codes when wide", async () =>
{
	const tickets = ["003-61008-81-02-0128", "003-61008-12-03-10000"].map((code, index) => ticketResponseFixture({ id: index + 1, code }));
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: tickets, page: 1, pages: 1, count: 2, total: 2, hasAuth: false, types: [], promocodes: [] }))));
	setup();
	const shortCode = await screen.findByRole("cell", { name: "81-02-0128" });
	expect(shortCode.getAttribute("title")).toBe("003-61008-81-02-0128");
	expect(screen.getByRole("cell", { name: "12-03-10000" })).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Код 003-61008-" })).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Дата добавления" }).querySelector("svg")).not.toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "На всю ширину" }));
	expect(screen.getByRole("cell", { name: "003-61008-81-02-0128" })).toBeTruthy();
	expect(screen.getByRole("cell", { name: "003-61008-12-03-10000" })).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Код" })).toBeTruthy();
});

test.each(["MANUAL-CODE", "003-61009-12-03-0129", "003-61008-invalid"])("keeps full codes when the page also contains %s", async otherCode =>
{
	const tickets = ["003-61008-81-02-0128", otherCode].map((code, index) => ticketResponseFixture({ id: index + 1, code }));
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: tickets, page: 1, pages: 1, count: 2, total: 2, hasAuth: false, types: [], promocodes: [] }))));
	setup();
	expect(await screen.findByRole("cell", { name: "003-61008-81-02-0128" })).toBeTruthy();
	expect(screen.getByRole("cell", { name: otherCode })).toBeTruthy();
	expect(screen.getByRole("columnheader", { name: "Код" })).toBeTruthy();
});
