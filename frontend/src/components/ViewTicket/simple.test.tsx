import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Ticket } from "../../api/tickets";
import ViewTicketSimple from "./simple";

const mocks = vi.hoisted(() => ({ render: vi.fn(), qr: vi.fn() }));
vi.mock("html2canvas", () => ({ default: mocks.render }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.qr } }));
const decodeDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "decode");
const event = { id: 7, name: "Event", date: new Date("2026-10-12"), active: true };
const ticket: Ticket = { id: 1, eventId: 7, typeId: 9, type: "Standard", code: "A", personName: "Anna", createdDate: new Date(), scanned: false, authOnPltf: false };
const canvas = (value: string) => ({ toDataURL: () => `data:image/png;base64,${value}` } as HTMLCanvasElement);

beforeEach(() =>
{
	Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
	vi.stubGlobal("document", document);
	Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
	mocks.render.mockReset();
	mocks.qr.mockReset();
	mocks.qr.mockImplementation((_code, _options, callback) => callback(null, "data:image/png;base64,QR"));
});
afterEach(() =>
{
	cleanup();
	vi.unstubAllGlobals();
	if (decodeDescriptor) Object.defineProperty(HTMLImageElement.prototype, "decode", decodeDescriptor);
	else Reflect.deleteProperty(HTMLImageElement.prototype, "decode");
	Reflect.deleteProperty(document, "fonts");
});

test("a late rendered image cannot replace the currently displayed ticket", async () =>
{
	let first!: (value: HTMLCanvasElement) => void;
	let second!: (value: HTMLCanvasElement) => void;
	mocks.render.mockImplementationOnce(() => new Promise<HTMLCanvasElement>(resolve => { first = resolve; })).mockImplementationOnce(() => new Promise<HTMLCanvasElement>(resolve => { second = resolve; }));
	const form = (value: Ticket) => <ViewTicketSimple event={event} ticket={value} close={vi.fn()} />;
	const view = render(form(ticket));
	await waitFor(() => expect(mocks.render).toHaveBeenCalledTimes(1));
	view.rerender(form({ ...ticket, id: 2, code: "B" }));
	await waitFor(() => expect(mocks.render).toHaveBeenCalledTimes(2));
	await act(async () => { second(canvas("BBBB")); });
	expect(screen.getByAltText("Билет B").getAttribute("src")).toBe("data:image/png;base64,BBBB");
	await act(async () => { first(canvas("AAAA")); });
	expect(screen.getByAltText("Билет B").getAttribute("src")).toBe("data:image/png;base64,BBBB");
});

test("a failed image generation reports an error instead of an unhandled rejection", async () =>
{
	mocks.render.mockRejectedValue(new Error("Rendering failed"));
	render(<ViewTicketSimple event={event} ticket={ticket} close={vi.fn()} />);
	expect((await screen.findByRole("alert")).textContent).toContain("Не удалось подготовить изображение билета");
	expect(screen.queryByRole("button", { name: "Сохранить PNG" })).toBeNull();
});
