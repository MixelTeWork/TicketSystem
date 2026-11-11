import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import BugReportButton from ".";
import { setSessionUser } from "../../api/session";
import { createEmptyUser } from "../../api/user";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

function setup()
{
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } } });
	clients.push(client);
	client.setQueryData(["user"], { ...createEmptyUser(), auth: true, id: 4 });
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/events/42/tickets?token=private#draft"]}><BugReportButton /></MemoryRouter></QueryClientProvider>);
	fireEvent.click(screen.getByRole("button", { name: "Сообщить об ошибке" }));
	return { client, input: screen.getByLabelText("Описание ошибки") as HTMLTextAreaElement };
}

test("failed sending keeps the draft, retry blocks duplicates and succeeds with only the page path", async () =>
{
	let respond!: (response: Response) => void;
	const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Network failed"))
		.mockImplementationOnce(() => new Promise<Response>(resolve => { respond = resolve; }));
	vi.stubGlobal("fetch", fetchMock);
	const { input } = setup();
	fireEvent.change(input, { target: { value: "  Не работает\nПечать билета  " } });
	fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
	await screen.findByRole("alert");
	expect(input.value).toBe("  Не работает\nПечать билета  ");
	expect(input.disabled).toBe(false);
	fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	expect(input.disabled).toBe(true);
	expect((screen.getByRole("button", { name: "Отправка…" }) as HTMLButtonElement).disabled).toBe(true);
	expect((screen.getByRole("button", { name: "Закрыть" }) as HTMLButtonElement).disabled).toBe(true);
	fireEvent.submit(input.closest("form")!);
	expect(fetchMock).toHaveBeenCalledTimes(2);
	expect(fetchMock.mock.calls[1][0]).toBe("/api/bug_reports");
	expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ description: "Не работает\nПечать билета", page: "/events/42/tickets" });
	await act(async () => { respond(new Response(JSON.stringify({ id: 71 }))); });
	expect(await screen.findByText("Сообщение №71 отправлено. Спасибо!")).toBeTruthy();
	fireEvent.click(screen.getAllByRole("button", { name: "Закрыть" }).at(-1)!);
	fireEvent.click(screen.getByRole("button", { name: "Сообщить об ошибке" }));
	expect((screen.getByLabelText("Описание ошибки") as HTMLTextAreaElement).value).toBe("");
});

test("closing without sending preserves the draft and whitespace cannot be sent", () =>
{
	const fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	const { input } = setup();
	fireEvent.change(input, { target: { value: " \n " } });
	fireEvent.submit(input.closest("form")!);
	expect(fetchMock).not.toHaveBeenCalled();
	fireEvent.change(input, { target: { value: "Черновик" } });
	fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
	expect(screen.queryByRole("dialog")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Сообщить об ошибке" }));
	expect((screen.getByLabelText("Описание ошибки") as HTMLTextAreaElement).value).toBe("Черновик");
});

test("a late response from an old session cannot show success or invalidate the new account's list", async () =>
{
	let respond!: (response: Response) => void;
	vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
	const { client, input } = setup();
	fireEvent.change(input, { target: { value: "Old draft" } });
	fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
	await waitFor(() => expect(respond).toBeTypeOf("function"));
	await act(async () => { await setSessionUser(client, { ...createEmptyUser(), auth: true, id: 9 }); });
	client.setQueryData(["bugReports", 0], { items: [], total: 0, pages: 1 });
	await act(async () => { respond(new Response(JSON.stringify({ id: 71 }))); });
	await waitFor(() => expect(input.disabled).toBe(false));
	expect(screen.queryByText(/№71 отправлено/)).toBeNull();
	expect(client.getQueryState(["bugReports", 0])?.isInvalidated).toBe(false);
});
