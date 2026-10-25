import { ApiError, type ResponseMsg } from "../api/dataTypes";
import getCookie from "./getCookies";

function csrfHeaders(method: string): Record<string, string>
{
	const token = typeof document == "undefined" ? undefined : getCookie("csrf_access_token");
	return method != "GET" && token ? { "X-CSRF-TOKEN": token } : {};
}

async function fetchWithJson(method: "GET" | "POST" | "DELETE", input: RequestInfo | URL, body?: unknown, signal?: AbortSignal)
{
	const res = await fetch(input, {
		method,
		headers: { "Content-Type": "application/json", ...csrfHeaders(method) },
		body: body === undefined ? undefined : JSON.stringify(body),
		signal,
	});
	if (!res.ok) throw await responseError(res);
	return res;
}

async function responseError(res: Response)
{
	const data = await res.json().catch(() => null) as ResponseMsg | null;
	return new ApiError(
		typeof data?.msg == "string" && data.msg ? data.msg : `Ошибка API (${res.status})`,
		res.status,
		typeof data?.code == "string" ? data.code : undefined,
	);
}

export function fetchGet(input: RequestInfo | URL, signal?: AbortSignal)
{
	return fetchWithJson("GET", input, undefined, signal);
}

export function fetchPost(input: RequestInfo | URL, body?: unknown)
{
	return fetchWithJson("POST", input, body);
}

export function fetchDelete(input: RequestInfo | URL, body?: unknown)
{
	return fetchWithJson("DELETE", input, body);
}

async function fetchJson<T>(method: "GET" | "POST" | "DELETE", input: RequestInfo | URL, body?: unknown, signal?: AbortSignal)
{
	const res = await fetchWithJson(method, input, body, signal);
	const data = await res.json();
	return data as T;
}

export function fetchJsonGet<T>(input: RequestInfo | URL, signal?: AbortSignal)
{
	return fetchJson<T>("GET", input, undefined, signal);
}

export function fetchJsonPost<T>(input: RequestInfo | URL, body?: unknown, signal?: AbortSignal)
{
	return fetchJson<T>("POST", input, body, signal);
}

export function fetchJsonDelete<T>(input: RequestInfo | URL, body?: unknown)
{
	return fetchJson<T>("DELETE", input, body);
}

export async function fetchPostForm<T>(input: RequestInfo | URL, body: FormData)
{
	const res = await fetch(input, {
		method: "POST",
		headers: csrfHeaders("POST"),
		body,
	});
	if (!res.ok) throw await responseError(res);
	const data = await res.json();
	return data as T;
}
