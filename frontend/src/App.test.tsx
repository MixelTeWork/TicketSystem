import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("./utils/scrollToTop", () => ({ default: () => null }));

afterEach(() =>
{
	cleanup();
	vi.unstubAllGlobals();
});

test("redirects a signed-out visitor to the login page", async () =>
{
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ msg: "Unauthorized" }), { status: 401 })));
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	render(
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={["/"]}>
				<App />
			</MemoryRouter>
		</QueryClientProvider>,
	);

	expect(await screen.findByRole("button", { name: "Войти" }, { timeout: 4000 })).toBeTruthy();
	client.clear();
});
