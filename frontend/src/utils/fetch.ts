import { ApiError, ResponseMsg } from "../api/dataTypes";

async function fetchWithJson(method: "GET" | "POST" | "DELETE", input: RequestInfo | URL, body?: any)
{
	const res = await fetch(input, {
		method,
		headers: {
			"Content-Type": "application/json"
		},
		body: body === undefined ? null : JSON.stringify(body),
	});
	if (!res.ok) throw new ApiError((await res.json() as ResponseMsg).msg);
	return res;
}

export function fetchGet(input: RequestInfo | URL, body?: any)
{
	return fetchWithJson("GET", input, body);
}

export function fetchPost(input: RequestInfo | URL, body?: any)
{
	return fetchWithJson("POST", input, body);
}

export function fetchDelete(input: RequestInfo | URL, body?: any)
{
	return fetchWithJson("DELETE", input, body);
}

async function fetchJson<T>(method: "GET" | "POST" | "DELETE", input: RequestInfo | URL, body?: any)
{
	const res = await fetchWithJson(method, input, body);
	const data = await res.json();
	return data as T;
}

export function fetchJsonGet<T>(input: RequestInfo | URL, body?: any)
{
	return fetchJson<T>("GET", input, body);
}

export function fetchJsonPost<T>(input: RequestInfo | URL, body?: any)
{
	return fetchJson<T>("POST", input, body);
}

export function fetchJsonDelete<T>(input: RequestInfo | URL, body?: any)
{
	return fetchJson<T>("DELETE", input, body);
}

export async function fetchPostForm<T>(input: RequestInfo | URL, body: FormData)
{
	const res = await fetch(input, {
		method: "POST",
		body,
	});
	const data = await res.json();
	if (!res.ok) throw new ApiError((data as ResponseMsg).msg);
	return data as T;
}
