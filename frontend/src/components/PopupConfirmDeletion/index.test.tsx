import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PopupConfirmDeletion from ".";
import { useMutationDeleteTicket } from "../../api/tickets";
import { useMutationDeleteEvent } from "../../api/events";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); });
test.each(["ticket", "event"])("submits the typed %s deletion and closes after success", async mode =>
{
	const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	clients.push(client);
	const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
	vi.stubGlobal("fetch", fetchMock);
	const close = vi.fn();
	const onSuccess = vi.fn();
	render(<QueryClientProvider client={client}>{mode == "ticket"
		? <PopupConfirmDeletion itemId={7} mutationParams={71} mutationFn={useMutationDeleteTicket} title="Удаление" open close={close} onSuccess={onSuccess} />
		: <PopupConfirmDeletion itemId={7} mutationParams={undefined} mutationFn={useMutationDeleteEvent} title="Удаление" open close={close} onSuccess={onSuccess} />}</QueryClientProvider>);
	fireEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
	await waitFor(() => expect(close).toHaveBeenCalledOnce());
	expect(fetchMock).toHaveBeenCalledWith(mode == "ticket" ? "/api/tickets/71" : "/api/events/7", expect.objectContaining({ method: "DELETE", body: undefined }));
	expect(onSuccess).toHaveBeenCalledWith(mode == "ticket" ? 71 : undefined);
});
