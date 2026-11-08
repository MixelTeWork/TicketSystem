import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import HelpNotices from ".";
import Popup from "../Popup";

const clients: QueryClient[] = [];
const notice = { id: "upcoming:scanner-access", releaseId: "upcoming", audience: "organizers", title: "Подготовьте сотрудников", text: "Проверьте доступ на телефонах.", articleId: "staff-scanner-access" };
const response = (sessionId = "session-one") => new Response(JSON.stringify({ sessionId, items: [notice] }));

function setup(path = "/", popup = false)
{
	const client = createQueryClient({ queries: { retry: false } });
	clients.push(client);
	client.setQueryData(["user"], { auth: true, id: 1, name: "Manager", login: "manager", roles: ["Организатор"], operations: [] });
	function tree(open: boolean)
	{
		return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Popup open={open} title="Рабочая форма"><input aria-label="Ввод данных" /></Popup><HelpNotices /></MemoryRouter></QueryClientProvider>;
	}
	const view = render(tree(popup));
	return { ...view, closeForm: () => view.rerender(tree(false)) };
}

afterEach(() =>
{
	cleanup();
	clients.splice(0).forEach(client => client.clear());
	localStorage.clear();
	vi.unstubAllGlobals();
});

test("defers a notice while a work popup is open", async () =>
{
	const fetch = vi.fn().mockImplementation(() => Promise.resolve(response()));
	vi.stubGlobal("fetch", fetch);
	const view = setup("/", true);
	await act(async () => {});
	expect(fetch).not.toHaveBeenCalled();
	expect(screen.queryByRole("dialog", { name: "Важные изменения" })).toBeNull();
	view.closeForm();
	expect(await screen.findByRole("dialog", { name: "Важные изменения" })).toBeTruthy();
});

test("does not request or show notices in the scanner", async () =>
{
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	setup("/scanner/7");
	await act(async () => {});
	expect(fetch).not.toHaveBeenCalled();
	expect(screen.queryByRole("dialog", { name: "Важные изменения" })).toBeNull();
});

test("Escape defers until the next login without acknowledging", async () =>
{
	const fetch = vi.fn().mockImplementation(() => Promise.resolve(response()));
	vi.stubGlobal("fetch", fetch);
	const view = setup();
	await screen.findByRole("dialog", { name: "Важные изменения" });
	fireEvent.keyDown(document, { key: "Escape" });
	await waitFor(() => expect(screen.queryByRole("dialog", { name: "Важные изменения" })).toBeNull());
	expect(fetch.mock.calls.some(([url]) => url.includes("acknowledge"))).toBe(false);
	view.unmount();
	const sameSession = setup();
	await act(async () => {});
	expect(screen.queryByRole("dialog", { name: "Важные изменения" })).toBeNull();
	sameSession.unmount();
	fetch.mockImplementation(() => Promise.resolve(response("session-two")));
	setup();
	expect(await screen.findByRole("dialog", { name: "Важные изменения" })).toBeTruthy();
});

test("acknowledges the displayed notice IDs", async () =>
{
	const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("acknowledge") ? new Response(JSON.stringify({ msg: "ok" })) : response()));
	vi.stubGlobal("fetch", fetch);
	setup();
	fireEvent.click(await screen.findByRole("button", { name: "Понятно" }));
	await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith("acknowledge"))).toBe(true));
	const call = fetch.mock.calls.find(([url]) => url.endsWith("acknowledge"));
	expect(JSON.parse(call?.[1].body)).toEqual({ noticeIds: [notice.id] });
	await waitFor(() => expect(screen.queryByRole("dialog", { name: "Важные изменения" })).toBeNull());
});

test("combines unread changes from different releases in one acknowledgement", async () =>
{
	const next = { ...notice, id: "next:date-rules", releaseId: "next", title: "Проверьте дни билета" };
	const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("acknowledge") ? new Response(JSON.stringify({ msg: "ok" })) : new Response(JSON.stringify({ sessionId: "one", items: [notice, next] }))));
	vi.stubGlobal("fetch", fetch);
	setup();
	await screen.findByText(next.title);
	expect(screen.getAllByRole("dialog", { name: "Важные изменения" })).toHaveLength(1);
	expect(screen.getByText(notice.title)).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Понятно" }));
	await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith("acknowledge"))).toBe(true));
	const call = fetch.mock.calls.find(([url]) => url.endsWith("acknowledge"));
	expect(JSON.parse(call?.[1].body)).toEqual({ noticeIds: [notice.id, next.id] });
});

test("failed acknowledgement keeps the notice open and does not defer it", async () =>
{
	const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("acknowledge") ? new Response(JSON.stringify({ msg: "Не удалось сохранить" }), { status: 500 }) : response()));
	vi.stubGlobal("fetch", fetch);
	setup();
	fireEvent.click(await screen.findByRole("button", { name: "Понятно" }));
	await screen.findByText("Не удалось сохранить");
	expect(screen.getByRole("dialog", { name: "Важные изменения" })).toBeTruthy();
	expect(localStorage.getItem("help-notice-deferred:1")).toBeNull();
});
