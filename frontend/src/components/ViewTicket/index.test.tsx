import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Ticket } from "../../api/tickets";
import { eventFixture, ticketFixture, ticketTypeFixture } from "../../test/fixtures";
import ViewTicket from ".";

const mocks = vi.hoisted(() => ({ render: vi.fn(), qr: vi.fn(), viewer: vi.fn(), save: vi.fn() }));
vi.mock("html2canvas", () => ({ default: mocks.render }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qr } }));
vi.mock("../../utils/saveCanvasAsPng", () => ({ saveCanvasAsPng: mocks.save }));
vi.mock("../TicketEditor/viewer", () => ({ default: ({ ticket }: { ticket: Ticket }) => { mocks.viewer(ticket); return <p>Макет {ticket.code}</p>; } }));
const decodeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "decode");
const clients: QueryClient[] = [];
const ticket = ticketFixture({ code: "QR-1", typeId: 9, personName: "Гость", validDates: ["2026-11-04", "2026-11-05"], dayOffsets: [0, 1] });
const event = eventFixture({ name: "Фестиваль", dayCount: 2, date: "2026-11-04", endDate: "2026-11-05", days: [{ id: 1, dayOffset: 0, date: "2026-11-04" }, { id: 2, dayOffset: 1, date: "2026-11-05" }] });
const canvas = { toDataURL: () => "data:image/png;base64,TICKET" } as HTMLCanvasElement;

beforeEach(() =>
{
	Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
	Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
	Object.values(mocks).forEach(mock => mock.mockReset());
	mocks.qr.mockImplementation((_code, _options, callback) => callback(null, "data:image/png;base64,QR"));
	mocks.render.mockResolvedValue(canvas);
});
afterEach(() =>
{
	cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals();
	if (decodeDescriptor) Object.defineProperty(HTMLImageElement.prototype, "decode", decodeDescriptor);
	else Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
	Reflect.deleteProperty(document, "fonts");
});
function setup(imageId: number | null | undefined)
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	if (imageId !== undefined) client.setQueryData(["ticket_type", "9"], ticketTypeFixture({ id: 9, imageId }));
	const close = vi.fn();
	const form = (value: Ticket | null = ticket) => <QueryClientProvider client={client}><ViewTicket ticket={value} event={event} close={close} /></QueryClientProvider>;
	return { client, close, form, view: render(form()) };
}

test("opens the QR ticket without a design immediately and keeps its PNG free of the organizer notice", async () =>
{
	const { close } = setup(null);
	expect(mocks.viewer).not.toHaveBeenCalled();
	expect(screen.queryByRole("button", { name: "Сгенерировать qr код" })).toBeNull();
	expect(screen.getByText(/Для этого вида билета макет не задан/)).toBeTruthy();
	expect(screen.getByText("Посетитель: Гость")).toBeTruthy();
	expect(screen.getByText("Дата: 04.11.2026, 05.11.2026")).toBeTruthy();
	fireEvent.click(await screen.findByRole("button", { name: "Сохранить PNG" }));
	expect(mocks.save).toHaveBeenCalledWith(canvas, "ticket_QR-1.png");
	expect(mocks.render.mock.calls[0][0].textContent).not.toContain("макет не задан");
	fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
	expect(close).toHaveBeenCalledOnce();
});

test("waits for the type before choosing a viewer instead of mounting a grey canvas", async () =>
{
	let finish!: (response: Response) => void;
	vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
	setup(undefined);
	expect(mocks.viewer).not.toHaveBeenCalled();
	expect(mocks.qr).not.toHaveBeenCalled();
	await act(async () => { finish(new Response(JSON.stringify(ticketTypeFixture({ id: 9 })))); });
	expect(await screen.findByRole("button", { name: "Сохранить PNG" })).toBeTruthy();
	expect(mocks.viewer).not.toHaveBeenCalled();
});

test("keeps the designed viewer and switches away from a previous plain ticket", async () =>
{
	const { client, view, form } = setup(null);
	await screen.findByRole("button", { name: "Сохранить PNG" });
	client.setQueryData(["ticket_type", "10"], ticketTypeFixture({ id: 10, imageId: 42 }));
	view.rerender(form({ ...ticket, id: 2, typeId: 10, code: "DESIGN-2" }));
	expect(await screen.findByText("Макет DESIGN-2")).toBeTruthy();
	expect(screen.queryByText(/макет не задан/)).toBeNull();
	expect(screen.queryByAltText("Билет QR-1")).toBeNull();
	view.rerender(form(null));
	await waitFor(() => expect(document.querySelectorAll('[data-popup-open="true"]')).toHaveLength(0));
});
