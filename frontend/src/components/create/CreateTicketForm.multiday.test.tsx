import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ticketResponseFixture, ticketTypeFixture } from "../../test/fixtures";
import CreateTicketForm from "./CreateTicketForm";
import { pendingTicketKey, readPendingTicket } from "../../utils/pendingTicket";

const clients: QueryClient[] = [];
const ticket = ticketResponseFixture({ id: 5, typeId: 9, type: "Оба дня", code: "OLD-DATE-5", price: 0, dayOffsets: [0, 1], validDates: ["2026-10-31", "2026-11-01"] });
function setup(userId = 1)
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	client.setQueryData(["user"], { auth: true, id: userId, operations: [] });
	client.setQueryData(["ticket_types", "7"], [{ id: 9, categoryId: 3, name: "Оба дня", price: 0, quantity: 0, imageId: null, pattern: null, dayOffsets: [0, 1], validDates: ticket.validDates }]);
	client.setQueryData(["tickets", "7"], []);
	const close = vi.fn();
	const element = <QueryClientProvider client={client}><CreateTicketForm open eventId={7} close={close} setTicket={vi.fn()} /></QueryClientProvider>;
	return { client, close, element };
}
function submit()
{
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Гость" } });
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
}
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); sessionStorage.clear(); vi.unstubAllGlobals(); });

test("ordinary sending shows progress while saving the frozen request before HTTP", async () =>
{
	let finish!: (response: Response) => void;
	const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { element, close } = setup();
	render(element); submit();
	await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
	expect(screen.getByRole("status").textContent).toBe("Создаём билет…");
	expect(screen.queryByText(/Результат создания неизвестен/)).toBeNull();
	expect(screen.queryByRole("button", { name: "Повторить исходное действие" })).toBeNull();
	expect(screen.getByLabelText("Посетитель").matches(":disabled")).toBe(true);
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload).toEqual(JSON.parse(fetchMock.mock.calls[0][1].body));
	await act(async () => { finish(new Response(JSON.stringify(ticket))); });
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(readPendingTicket(pendingTicketKey(1, 7))).toBeNull();
});

test("replays the frozen request after lost response and remount, upserting the returned ID", async () =>
{
	const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("lost response")).mockResolvedValueOnce(new Response(JSON.stringify(ticket)));
	vi.stubGlobal("fetch", fetchMock);
	const { element, client, close } = setup();
	const first = render(element);
	submit();
	await screen.findByRole("button", { name: "Повторить исходное действие" });
	await waitFor(() => expect(screen.getByRole("button", { name: "Повторить исходное действие" })).toHaveProperty("disabled", false));
	const frozen = JSON.parse(fetchMock.mock.calls[0][1].body);
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload).toEqual(frozen);
	expect(screen.getByLabelText("Посетитель").matches(":disabled")).toBe(true);
	first.unmount();
	client.setQueryData(["tickets", "7"], [{ ...ticket, createdDate: new Date(ticket.createdDate) }]);
	client.setQueryData(["ticket_types", "7"], [ticketTypeFixture({ id: 9, name: "Изменился", price: 900 })]);
	render(element);
	expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("0");
	fireEvent.click(screen.getByRole("button", { name: "Повторить исходное действие" }));
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(frozen);
	expect(client.getQueryData<unknown[]>(["tickets", "7"])).toHaveLength(1);
	expect(readPendingTicket(pendingTicketKey(1, 7))).toBeNull();
});

test("quota confirmation uses the same requestId and payload, zero price and zero limit", async () =>
{
	let finish!: (response: Response) => void;
	const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Лимит", code: "ticket_limit_confirmation_required", details: { typeId: 9, quantity: 0, issuedCount: 0, remaining: 0 } }), { status: 409 })).mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { element, close } = setup();
	render(element); submit();
	await screen.findByText(/Лимит: 0 · Выдано: 0/);
	expect(screen.queryByText("Лимит", { exact: true })).toBeNull();
	expect(screen.getAllByRole("alert")).toHaveLength(1);
	expect(screen.getByText("Гость", { exact: true })).toBeTruthy();
	expect(screen.getByText("Оба дня", { exact: true })).toBeTruthy();
	expect(screen.queryByLabelText("Посетитель")).toBeNull();
	expect(screen.queryByRole("button", { name: "Создать" })).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Добавить сверх лимита" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	expect(screen.getByRole("status").textContent).toBe("Создаём билет сверх лимита…");
	expect(screen.queryByText(/Результат создания неизвестен/)).toBeNull();
	expect(screen.queryByRole("button", { name: "Создать" })).toBeNull();
	expect(screen.queryByRole("button", { name: "Добавить сверх лимита" })).toBeNull();
	expect(screen.queryByText(/Билет ещё не создан/)).toBeNull();
	const first = JSON.parse(fetchMock.mock.calls[0][1].body);
	expect(first.price).toBe(0);
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...first, allowOverLimit: true });
	await act(async () => { finish(new Response(JSON.stringify(ticket))); });
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

test("an uncertain over-limit response replays the confirmed request without another quota decision", async () =>
{
	const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Лимит", code: "ticket_limit_confirmation_required", details: { quantity: 0, issuedCount: 0, remaining: 0 } }), { status: 409 })).mockRejectedValueOnce(new TypeError("lost response")).mockResolvedValueOnce(new Response(JSON.stringify(ticket)));
	vi.stubGlobal("fetch", fetchMock);
	const { element, close } = setup();
	render(element); submit();
	fireEvent.click(await screen.findByRole("button", { name: "Добавить сверх лимита" }));
	fireEvent.click(await screen.findByRole("button", { name: "Повторить исходное действие" }));
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	const confirmed = JSON.parse(fetchMock.mock.calls[1][1].body);
	expect(confirmed.allowOverLimit).toBe(true);
	expect(confirmed.requestId).toBe(JSON.parse(fetchMock.mock.calls[0][1].body).requestId);
	expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(confirmed);
});

test("cancelling the compact quota restores every draft field before a new intent", async () =>
{
	const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Лимит", code: "ticket_limit_confirmation_required", details: { quantity: 0, issuedCount: 0, remaining: 0 } }), { status: 409 })).mockResolvedValueOnce(new Response(JSON.stringify(ticket)));
	vi.stubGlobal("fetch", fetchMock);
	const { element, close } = setup();
	render(element);
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Черновик" } });
	fireEvent.change(screen.getByLabelText("Ссылка на посетителя"), { target: { value: "example.com/guest" } });
	fireEvent.change(screen.getByLabelText("Промокод"), { target: { value: "PROMO" } });
	fireEvent.change(screen.getByLabelText("Цена (в рублях)"), { target: { value: "35" } });
	fireEvent.click(screen.getByLabelText("Авто-код билета"));
	fireEvent.change(screen.getByLabelText(/Код билета \(ручной ввод\)/), { target: { value: "MANUAL" } });
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	await screen.findByRole("button", { name: "Добавить сверх лимита" });
	const first = JSON.parse(fetchMock.mock.calls[0][1].body);
	fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
	expect(readPendingTicket(pendingTicketKey(1, 7))).toBeNull();
	expect(screen.getByLabelText("Посетитель")).toHaveProperty("value", "Черновик");
	expect(screen.getByLabelText("Ссылка на посетителя")).toHaveProperty("value", "example.com/guest");
	expect(screen.getByLabelText("Промокод")).toHaveProperty("value", "PROMO");
	expect(screen.getByLabelText("Цена (в рублях)")).toHaveProperty("value", "35");
	expect(screen.getByLabelText(/Код билета \(ручной ввод\)/)).toHaveProperty("value", "MANUAL");
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...first, requestId: expect.any(String) });
	expect(JSON.parse(fetchMock.mock.calls[1][1].body).requestId).not.toBe(first.requestId);
});

test.each([403, 409, 500])("preserves unknown outcome through HTTP %s and isolates another account", async status =>
{
	const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("lost response")).mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Отказ", code: "request_id_conflict" }), { status }));
	vi.stubGlobal("fetch", fetchMock);
	const { element, client } = setup();
	const view = render(element); submit();
	await waitFor(() => expect(screen.getByRole("button", { name: "Повторить исходное действие" })).toHaveProperty("disabled", false));
	const original = readPendingTicket(pendingTicketKey(1, 7));
	fireEvent.click(screen.getByRole("button", { name: "Повторить исходное действие" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	await waitFor(() => expect(screen.getByRole("button", { name: "Повторить исходное действие" })).toHaveProperty("disabled", false));
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload.requestId).toBe(original?.payload.requestId);
	view.unmount();
	await act(async () => { client.setQueryData(["user"], { auth: true, id: 2, operations: [] }); });
	render(element);
	expect(screen.queryByRole("button", { name: "Повторить исходное действие" })).toBeNull();
	expect((screen.getByLabelText("Посетитель") as HTMLInputElement).value).toBe("");
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload.requestId).toBe(original?.payload.requestId);
});

test("a late response for A cannot clear or close a consciously started B after remount", async () =>
{
	let resolveA!: (value: Response) => void;
	let resolveB!: (value: Response) => void;
	const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveA = resolve; })).mockImplementationOnce(() => new Promise<Response>(resolve => { resolveB = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { element, close } = setup();
	const first = render(element); submit();
	await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
	const a = readPendingTicket(pendingTicketKey(1, 7));
	first.unmount();
	render(element);
	fireEvent.click(screen.getByRole("button", { name: "Начать другой билет" }));
	expect(screen.getByText(/Билет мог уже создаться/)).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Начать новое действие" }));
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Другой гость" } });
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	const b = readPendingTicket(pendingTicketKey(1, 7));
	expect(b?.payload.requestId).not.toBe(a?.payload.requestId);
	await act(async () => { resolveA(new Response(JSON.stringify(ticket))); });
	expect(close).not.toHaveBeenCalled();
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload.requestId).toBe(b?.payload.requestId);
	expect((screen.getByLabelText("Посетитель") as HTMLInputElement).value).toBe("Другой гость");
	await act(async () => { resolveB(new Response(JSON.stringify({ ...ticket, id: 6 }))); });
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

test("a confirmed 400 refusal permits correction and a new intent", async () =>
{
	const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ msg: "Проверьте данные" }), { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify(ticket)));
	vi.stubGlobal("fetch", fetchMock);
	const { element, close } = setup();
	render(element); submit();
	await screen.findByText("Проверьте данные");
	await waitFor(() => expect(screen.getByLabelText("Посетитель").matches(":disabled")).toBe(false));
	expect(readPendingTicket(pendingTicketKey(1, 7))).toBeNull();
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Исправленный гость" } });
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(JSON.parse(fetchMock.mock.calls[1][1].body).requestId).not.toBe(JSON.parse(fetchMock.mock.calls[0][1].body).requestId);
});

test("a resumed quota draft survives cancellation and a background catalog refresh", async () =>
{
	const { client, close } = setup();
	sessionStorage.setItem(pendingTicketKey(1, 7), JSON.stringify({ status: "quota", payload: {
		eventId: 7, typeId: 9, personName: "Сохранённый гость", personLink: "", promocode: "", price: 0, code: "", requestId: "ba5863d3-f5fc-490f-9d4a-cc4e78df2716",
	} }));
	render(<QueryClientProvider client={client}><CreateTicketForm open={false} eventId={7} close={close} setTicket={vi.fn()} /></QueryClientProvider>);
	fireEvent.click(await screen.findByRole("button", { name: "Продолжить незавершённое создание билета" }));
	fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Исправленный черновик" } });
	await act(async () => { client.setQueryData(["ticket_types", "7"], [{ id: 9, categoryId: 3, name: "Обновлённый вид", price: 900, quantity: 10, imageId: null, pattern: null, dayOffsets: [0, 1], validDates: ticket.validDates }]); });
	await screen.findByRole("option", { name: /Обновлённый вид/ });
	expect((screen.getByLabelText("Посетитель") as HTMLInputElement).value).toBe("Исправленный черновик");
	expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("0");
});

test("an event change while A is pending lets B submit and A cannot finish B's request", async () =>
{
	let resolveA!: (value: Response) => void;
	let resolveB!: (value: Response) => void;
	const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveA = resolve; })).mockImplementationOnce(() => new Promise<Response>(resolve => { resolveB = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { client, close } = setup();
	client.setQueryData(["ticket_types", "8"], [ticketTypeFixture({ id: 10, name: "Другое мероприятие" })]);
	client.setQueryData(["tickets", "8"], []);
	const showTicket = vi.fn();
	const form = (eventId: number) => <QueryClientProvider client={client}><CreateTicketForm open eventId={eventId} close={close} setTicket={showTicket} /></QueryClientProvider>;
	const view = render(form(7)); submit();
	await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
	const a = readPendingTicket(pendingTicketKey(1, 7));
	view.rerender(form(8));
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Другой гость" } });
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	const b = readPendingTicket(pendingTicketKey(1, 8));
	expect(b?.payload.eventId).toBe(8);
	expect(b?.payload.requestId).not.toBe(a?.payload.requestId);
	await act(async () => { resolveA(new Response(JSON.stringify(ticket))); });
	expect(close).not.toHaveBeenCalled();
	expect(showTicket).not.toHaveBeenCalled();
	expect(screen.getByRole("status").textContent).toBe("Создаём билет…");
	expect(screen.getByLabelText("Посетитель").matches(":disabled")).toBe(true);
	expect(readPendingTicket(pendingTicketKey(1, 8))?.payload.requestId).toBe(b?.payload.requestId);
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload.requestId).toBe(a?.payload.requestId);
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	expect(fetchMock).toHaveBeenCalledTimes(2);
	await act(async () => { resolveB(new Response(JSON.stringify({ ...ticket, id: 6, eventId: 8, typeId: 10 }))); });
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(showTicket).toHaveBeenCalledOnce();
	expect(readPendingTicket(pendingTicketKey(1, 8))).toBeNull();
	expect(readPendingTicket(pendingTicketKey(1, 7))?.payload.requestId).toBe(a?.payload.requestId);
});
