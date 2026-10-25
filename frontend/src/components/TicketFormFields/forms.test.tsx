import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Ticket } from "../../api/tickets";
import CreateTicketForm from "../create/CreateTicketForm";
import EditTicketForm from "../edit/EditTicketForm";

const types = [
	{ id: 9, name: "Standard", price: 100, imageId: null, pattern: null },
	{ id: 10, name: "Standard", price: 0, imageId: null, pattern: null },
];
const ticket: Ticket = {
	id: 5, eventId: 7, code: "ABC", type: "Standard", typeId: 10,
	personName: "Visitor", createdDate: new Date(), scanned: false, authOnPltf: false, price: 75,
};
const clients: QueryClient[] = [];

function createClient()
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	client.setQueryData(["ticket_types", "7"], types);
	client.setQueryData(["user"], { auth: true, operations: [] });
	return client;
}

function mockSave()
{
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ticket)));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test.each([true, false])("creates a ticket with automatic code: %s and an explicit empty price", async automatic =>
{
	const client = createClient();
	const fetchMock = mockSave();
	const setTicket = vi.fn();
	const close = vi.fn();
	render(<QueryClientProvider client={client}><CreateTicketForm eventId="7" open setTicket={setTicket} close={close} /></QueryClientProvider>);
	expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("100");
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Guest" } });
	fireEvent.change(screen.getByLabelText("Тип билета"), { target: { value: "10" } });
	expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("0");
	fireEvent.change(screen.getByLabelText("Цена (в рублях)"), { target: { value: "" } });
	if (!automatic)
	{
		fireEvent.click(screen.getByLabelText("Авто-код билета"));
		fireEvent.change(screen.getByLabelText(/Код билета \(ручной ввод\)/), { target: { value: "MANUAL" } });
	}
	fireEvent.click(screen.getByRole("button", { name: "Создать" }));
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(fetchMock).toHaveBeenCalledOnce();
	expect(fetchMock.mock.calls[0][0]).toBe("/api/tickets");
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
		eventId: 7, typeId: 10, personName: "Guest", personLink: "", promocode: "", price: null, code: automatic ? "" : "MANUAL",
	});
	expect(setTicket.mock.calls[0][0].createdDate).toBeInstanceOf(Date);
});

test("edits by type ID and keeps the draft and custom price when ticket types refresh", async () =>
{
	const client = createClient();
	const fetchMock = mockSave();
	const close = vi.fn();
	render(<QueryClientProvider client={client}><EditTicketForm eventId={7} ticket={ticket} close={close} setTicket={vi.fn()} /></QueryClientProvider>);
	expect((screen.getByLabelText("Тип билета") as HTMLSelectElement).value).toBe("10");
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Draft" } });
	await act(async () => { client.setQueryData(["ticket_types", "7"], types.map(type => ({ ...type, name: "Renamed" }))); });
	expect((screen.getByLabelText("Посетитель") as HTMLInputElement).value).toBe("Draft");
	fireEvent.change(screen.getByLabelText("Тип билета"), { target: { value: "9" } });
	expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("75");
	fireEvent.click(screen.getAllByRole("button", { name: "Подтвердить" })[0]);
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(fetchMock.mock.calls[0][0]).toBe("/api/tickets/5");
	expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ typeId: 9, personName: "Draft", personLink: "", promocode: "", price: 75 });
});

test("resets the creation draft and manual code when reopening", () =>
{
	const client = createClient();
	const setTicket = vi.fn();
	const form = (open: boolean) => <QueryClientProvider client={client}><CreateTicketForm eventId={7} open={open} setTicket={setTicket} /></QueryClientProvider>;
	const view = render(form(true));
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Draft" } });
	fireEvent.click(screen.getByLabelText("Авто-код билета"));
	fireEvent.change(screen.getByLabelText(/Код билета \(ручной ввод\)/), { target: { value: "MANUAL" } });
	view.rerender(form(false));
	view.rerender(form(true));
	expect((screen.getByLabelText("Посетитель") as HTMLInputElement).value).toBe("");
	expect((screen.getByLabelText("Авто-код билета") as HTMLInputElement).checked).toBe(true);
	expect((screen.getByLabelText("Тип билета") as HTMLSelectElement).value).toBe("9");
	expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("100");
});

test("initializes the type when its response arrives after the form opens", async () =>
{
	const client = createClient();
	client.removeQueries({ queryKey: ["ticket_types", "7"] });
	let respond!: (response: Response) => void;
	vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
	render(<QueryClientProvider client={client}><CreateTicketForm eventId={7} open setTicket={vi.fn()} /></QueryClientProvider>);
	fireEvent.change(screen.getByLabelText("Посетитель"), { target: { value: "Draft" } });
	await act(async () => { respond(new Response(JSON.stringify(types))); });
	await waitFor(() =>
	{
		expect((screen.getByLabelText("Тип билета") as HTMLSelectElement).value).toBe("9");
		expect((screen.getByLabelText("Цена (в рублях)") as HTMLInputElement).value).toBe("100");
	});
	expect((screen.getByLabelText("Посетитель") as HTMLInputElement).value).toBe("Draft");
});
