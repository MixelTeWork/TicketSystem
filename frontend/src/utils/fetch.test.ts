import { afterEach, expect, test, vi } from "vitest";
import { fetchDelete, fetchJsonGet, fetchJsonPost, fetchPost, fetchPostForm } from "./fetch";
import { ApiError } from "../api/dataTypes";

afterEach(() =>
{
	document.cookie = "csrf_access_token=; Max-Age=0; path=/";
	vi.unstubAllGlobals();
});

test("bodyless API requests retain their JSON content type", async () =>
{
	const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
	vi.stubGlobal("fetch", fetchMock);
	await fetchPost("/api/logout");
	await fetchDelete("/api/tickets/7");
	for (const [, options] of fetchMock.mock.calls)
	{
		expect(options.headers).toEqual({ "Content-Type": "application/json" });
		expect(options.body).toBeUndefined();
	}
});

test("sends JSON and returns the API response", async () =>
{
	const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 7 }), { status: 200 }));
	vi.stubGlobal("fetch", fetchMock);

	await expect(fetchJsonPost<{ id: number }>("/api/tickets", { code: "ABC" })).resolves.toEqual({ id: 7 });
	expect(fetchMock).toHaveBeenCalledWith("/api/tickets", expect.objectContaining({
		method: "POST",
		body: JSON.stringify({ code: "ABC" }),
	}));
});

test("uses the backend message for an API error", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "No permission" }), { status: 403 })));
	await expect(fetchJsonGet("/api/events")).rejects.toThrow("No permission");
});

test("retains the stable error code independently of its display message", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Мероприятие неактивно", code: "event_inactive" }), { status: 403 })));
	await expect(fetchJsonGet("/api/scanner_events/7")).rejects.toMatchObject({ status: 403, code: "event_inactive" });
});

test("reports an error when the backend returns non-JSON", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Failure", { status: 502 })));
	await expect(fetchJsonGet("/api/events")).rejects.toThrow("Ошибка API (502)");
});

test("reads the current CSRF cookie for JSON and multipart writes, but not GET", async () =>
{
	const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}")));
	vi.stubGlobal("fetch", fetchMock);
	document.cookie = "csrf_access_token=first; path=/";
	await fetchJsonGet("/api/events");
	await fetchPost("/api/events", { name: "Event" });
	document.cookie = "csrf_access_token=second; path=/";
	await fetchDelete("/api/events/7");
	const form = new FormData();
	form.set("font", new Blob(["font"]));
	await fetchPostForm("/api/fonts", form);
	expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("X-CSRF-TOKEN");
	expect(fetchMock.mock.calls[1][1].headers["X-CSRF-TOKEN"]).toBe("first");
	expect(fetchMock.mock.calls[2][1].headers["X-CSRF-TOKEN"]).toBe("second");
	expect(fetchMock.mock.calls[3][1]).toMatchObject({ headers: { "X-CSRF-TOKEN": "second" }, body: form });
	expect(fetchMock.mock.calls[3][1].headers).not.toHaveProperty("Content-Type");
});

test("multipart errors retain HTTP status even when the response is not JSON", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
	await expect(fetchPostForm("/api/fonts", new FormData())).rejects.toEqual(new ApiError("Ошибка API (503)", 503));
});
