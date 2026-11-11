import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import BugReportsPage from ".";
import { createEmptyUser } from "../../api/user";

const clients: QueryClient[] = [];
afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	vi.unstubAllGlobals();
});

test("admin can read full descriptions as text, page through reports and refresh", async () =>
{
	const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify({
		items: url.endsWith("p=1") ? [] : [{ id: 7, userId: 4, userName: "Автор", userLogin: "reporter", description: "Не работает\n<script>alert(1)</script>", page: "/scanner/42", userAgent: "Test browser", createdAt: "2026-11-08T12:00:00Z" }], total: 26, pages: 2,
	}))));
	vi.stubGlobal("fetch", fetchMock);
	const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
	clients.push(client);
	client.setQueryData(["user"], { ...createEmptyUser(), auth: true, id: 1, name: "Admin" });
	render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/d/bug-reports"]}><BugReportsPage /></MemoryRouter></QueryClientProvider>);
	await screen.findByText("№7 · Автор");
	expect(screen.getByText("/scanner/42")).toBeTruthy();
	fireEvent.click(screen.getByText(/Не работает/, { selector: "summary" }));
	expect(screen.getByText("Аккаунт: reporter [ID 4]")).toBeTruthy();
	expect(screen.getByText("Браузер: Test browser")).toBeTruthy();
	expect(document.querySelector("script")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Следующая страница" }));
	await screen.findByText("Сообщений пока нет");
	expect(fetchMock.mock.calls.some(([url]) => url == "/api/bug_reports?p=1")).toBe(true);
	await waitFor(() => expect((screen.getByRole("button", { name: "Обновить" }) as HTMLButtonElement).disabled).toBe(false));
	fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
	await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url == "/api/bug_reports?p=1").length).toBe(2));
});
