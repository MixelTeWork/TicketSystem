import { afterEach, expect, test, vi } from "vitest";
import { fetchDelete, fetchJsonGet, fetchJsonPost, fetchPost } from "./fetch";

afterEach(() => vi.unstubAllGlobals());

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

test("reports an error when the backend returns non-JSON", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Failure", { status: 502 })));
	await expect(fetchJsonGet("/api/events")).rejects.toThrow("Ошибка API (502)");
});
