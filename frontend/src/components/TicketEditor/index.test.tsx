import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import TicketTypeEditor from "./index";
import { TicketEditor } from "./editor";
import type { UpdateTicketTypeData } from "../../api/ticketTypes";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup(qrError = false, strict = false)
{
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
	const qr = vi.spyOn(TicketEditor, "renderQRCode");
	if (qrError) qr.mockRejectedValue(new Error("QR failed"));
	else qr.mockImplementation(() => new Promise(() => {}));
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } } });
	clients.push(client);
	client.setQueryData(["fonts"], []);
	client.setQueryData(["ticket_type", "9"], { id: 9, name: "Type", imageId: null, pattern: null });
	const close = vi.fn();
	const form = (open = true, typeId = 9) =>
	{
		const content = <QueryClientProvider client={client}><TicketTypeEditor typeId={typeId} eventId={7} open={open} close={close} /></QueryClientProvider>;
		return strict ? <StrictMode>{content}</StrictMode> : content;
	};
	const view = render(form());
	return { close, client, view, form };
}

const data: UpdateTicketTypeData = { img: null, pattern: { width: 111, height: 222, objects: [] } };

function tryClosing()
{
	for (const name of ["Закрыть", "Отмена"])
	{
		const button = screen.getByRole("button", { name });
		expect((button as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(button);
	}
	fireEvent.keyDown(document, { key: "Escape" });
}

test("closing and repeated saves are blocked throughout preparation and sending", async () =>
{
	let finishPreparation!: (value: UpdateTicketTypeData) => void;
	let finishRequest!: (value: Response) => void;
	const getData = vi.spyOn(TicketEditor.prototype, "getData").mockImplementation(() => new Promise(resolve => { finishPreparation = resolve; }));
	const fetchMock = vi.fn((_url: RequestInfo | URL) => new Promise<Response>(resolve => { finishRequest = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { close } = setup();
	const save = screen.getByRole("button", { name: "Сохранить" });
	fireEvent.click(save);
	tryClosing();
	fireEvent.click(save);
	expect(getData).toHaveBeenCalledOnce();
	expect(fetchMock).not.toHaveBeenCalled();
	expect(close).not.toHaveBeenCalled();
	await act(async () => { finishPreparation(data); });
	await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
	expect(fetchMock.mock.calls[0][0]).toBe("/api/ticket_types/9");
	tryClosing();
	fireEvent.click(save);
	expect(close).not.toHaveBeenCalled();
	expect(fetchMock).toHaveBeenCalledOnce();
	await act(async () => { finishRequest(new Response(JSON.stringify({ id: 9, name: "Type", imageId: null, pattern: null }))); });
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
});

test.each(["preparation", "request"])("a %s failure unlocks closing and allows retry", async stage =>
{
	const getData = vi.spyOn(TicketEditor.prototype, "getData").mockResolvedValue(data);
	if (stage == "preparation") getData.mockRejectedValueOnce(new Error("File error"));
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
	const { close } = setup();
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
	expect((screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement).disabled).toBe(false);
	expect((screen.getByRole("button", { name: "Закрыть" }) as HTMLButtonElement).disabled).toBe(false);
	fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
	await waitFor(() => expect(getData).toHaveBeenCalledTimes(2));
	await waitFor(() => expect((screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement).disabled).toBe(false));
	fireEvent.keyDown(document, { key: "Escape" });
	expect(close).toHaveBeenCalledOnce();
});

test("background cache updates preserve the draft until reopening or changing the ticket type", async () =>
{
	const setData = vi.spyOn(TicketEditor.prototype, "setData");
	const { client, view, form } = setup();
	expect(setData).toHaveBeenCalledOnce();
	const editor = setData.mock.contexts[0];
	if (!(editor instanceof TicketEditor)) throw new Error("Editor was not initialized");
	const draft = await editor.getData("draft", 7);
	const updated = { id: 9, name: "Updated", imageId: null, pattern: { ...data.pattern, width: 333 } };
	await act(async () => { client.setQueryData(["ticket_type", "9"], updated); });
	expect(setData).toHaveBeenCalledOnce();
	expect((await editor.getData("draft", 7)).pattern).toEqual(draft.pattern);
	view.rerender(form(false));
	view.rerender(form());
	expect((await editor.getData("draft", 7)).pattern.width).toBe(333);
	client.setQueryData(["ticket_type", "10"], { ...updated, id: 10, pattern: { ...data.pattern, width: 444 } });
	view.rerender(form(true, 10));
	expect((await editor.getData("draft", 7)).pattern.width).toBe(444);
});

test("QR generation errors are visible in the editor", async () =>
{
	setup(true);
	expect((await screen.findByRole("alert")).textContent).toContain("Не удалось создать QR-код билета");
});

test("StrictMode restores editor resources after effect cleanup", async () =>
{
	const setData = vi.spyOn(TicketEditor.prototype, "setData");
	setup(false, true);
	expect(setData).toHaveBeenCalledTimes(2);
	const editor = setData.mock.contexts[1];
	if (!(editor instanceof TicketEditor)) throw new Error("Editor was not initialized");
	expect((await editor.getData("draft", 7)).pattern.objects).toHaveLength(5);
	expect(TicketEditor.renderQRCode).toHaveBeenCalledTimes(2);
});
