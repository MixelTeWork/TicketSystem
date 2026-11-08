import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import App from "../../App";
import { createQueryClient } from "../../api/queryClient";
import { setSessionUser } from "../../api/session";
import type { User } from "../../api/user";

vi.mock("../../utils/scrollToTop", () => ({ default: () => null }));
vi.mock("../../utils/useSound", () => ({ default: () => [vi.fn()] }));

const clients: QueryClient[] = [];
const organizer: User = { auth: true, id: 1, name: "Manager", login: "manager", roles: ["Организатор"], operations: [] };
const staff = { ...organizer, id: 2, roles: ["Билетёр"], operations: ["scan_tickets"] };
const article = { id: "entry-rules", title: "Как проверить билет на входе", audience: "staff", section: "scanner", order: 1 };
const catalog = { audiences: ["staff"], sections: [{ id: "scanner", title: "Проверка билетов" }], articles: [article] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function setup(path = "/help")
{
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], organizer);
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>);
	return client;
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test("search waits for submission, blocks duplicate pending submissions and does not search on focus", async () =>
{
	let finish: (value: Response) => void = () => {};
	const fetch = vi.fn().mockImplementation((url: string) =>
	{
		if (url.startsWith("/api/help/search")) return new Promise<Response>(resolve => { finish = resolve; });
		return Promise.resolve(response(url == "/api/user" ? organizer : catalog));
	});
	vi.stubGlobal("fetch", fetch);
	setup();
	await screen.findByRole("link", { name: article.title });
	const input = screen.getByRole("searchbox", { name: "Поиск по инструкции" });
	fireEvent.change(input, { target: { value: "  ручной ввод  " } });
	await act(async () => { window.dispatchEvent(new Event("focus")); });
	const searchCalls = () => fetch.mock.calls.filter(([url]) => url.startsWith("/api/help/search"));
	expect(searchCalls()).toHaveLength(0);
	fireEvent.submit(input.closest("form")!);
	await waitFor(() => expect(searchCalls()).toHaveLength(1));
	fireEvent.submit(input.closest("form")!);
	fireEvent.click(screen.getByRole("button", { name: "Найти" }));
	expect(searchCalls()).toHaveLength(1);
	expect(searchCalls()[0][0]).toBe("/api/help/search?q=" + encodeURIComponent("ручной ввод"));
	await act(async () => { finish(response({ items: [{ ...article, snippet: "Введите полный код с билета." }], total: 1 })); });
	expect(await screen.findByRole("heading", { name: "Результаты по запросу «ручной ввод»" })).toBeTruthy();
	await act(async () => { window.dispatchEvent(new Event("focus")); });
	expect(searchCalls()).toHaveLength(1);
	fireEvent.click(screen.getByRole("button", { name: "Все статьи" }));
	expect(await screen.findByRole("link", { name: article.title })).toBeTruthy();
	expect((input as HTMLInputElement).value).toBe("");
});

test("opens an article directly and focuses its heading for keyboard navigation", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(response(url == "/api/user" ? organizer : { ...article, markdown: "> [!NOTE]\n> Сообщение `Вход разрешён`." }))));
	setup("/help/entry-rules");
	const heading = await screen.findByRole("heading", { name: article.title });
	await waitFor(() => expect(document.activeElement).toBe(heading));
	expect((await screen.findByRole("note")).textContent).toContain("Сообщение Вход разрешён.");
	expect(screen.getByRole("link", { name: "К списку статей" }).getAttribute("href")).toBe("/help");
});

test("a denied direct article displays only a generic unavailable message", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url == "/api/user" ? response(staff) : response({ msg: "Not found" }, 404))));
	setup("/help/staff-scanner-access");
	expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Статья не найдена или недоступна вашей учётной записи.");
	expect(screen.queryByRole("article")).toBeNull();
});

test("switching accounts discards a late organizer article response", async () =>
{
	let finish: (value: Response) => void = () => {};
	let currentUser = organizer;
	const fetch = vi.fn().mockImplementation((url: string) =>
	{
		if (url == "/api/user") return Promise.resolve(response(currentUser));
		if (currentUser.id == organizer.id) return new Promise<Response>(resolve => { finish = resolve; });
		return Promise.resolve(response({ msg: "Not found" }, 404));
	});
	vi.stubGlobal("fetch", fetch);
	const client = setup("/help/staff-scanner-access");
	await waitFor(() => expect(fetch.mock.calls.some(([url]) => url == "/api/help/articles/staff-scanner-access")).toBe(true));
	currentUser = staff;
	await act(() => setSessionUser(client, staff));
	await screen.findByRole("alert");
	await act(async () => { finish(response({ ...article, title: "Закрытая статья организатора", markdown: "Закрытое содержимое" })); });
	expect(screen.queryByText("Закрытое содержимое")).toBeNull();
	expect(screen.queryByText("Закрытая статья организатора")).toBeNull();
	expect(client.getQueryCache().findAll({ queryKey: ["help"] }).every(query => !(JSON.stringify(query.state.data) || "").includes("Закрытое"))).toBe(true);
});

test("a release direct link preserves upcoming status without an invented date or version", async () =>
{
	const release = { id: "upcoming", title: "Ближайшее обновление", version: null, date: null, approximateDate: false, status: "upcoming", items: [{ id: "access", audience: "staff", title: "Вход в сканер", text: "Войдите в свою учётную запись.", articleId: "entry-rules" }] };
	vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(response(url == "/api/user" ? organizer : [release]))));
	setup("/whats-new/upcoming");
	expect(await screen.findByText("Готовится к выпуску · дата ещё не назначена")).toBeTruthy();
	expect(screen.getByRole("link", { name: "Ближайшее обновление" }).getAttribute("href")).toBe("/whats-new/upcoming");
	expect(screen.getByRole("link", { name: "Как это работает" }).getAttribute("href")).toBe("/help/entry-rules");
});
