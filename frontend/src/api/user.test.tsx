import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import useUser from "./user";
import { createQueryClient } from "./queryClient";

afterEach(() => vi.unstubAllGlobals());

test("treats an unauthorized response as a signed-out user", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Unauthorized" }), { status: 401 })));
	const client = createQueryClient({ queries: { retry: false } });
	const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
	const { result } = renderHook(() => useUser(), { wrapper });

	await waitFor(() => expect(result.current.isSuccess).toBe(true));
	expect(result.current.data?.auth).toBe(false);
});
