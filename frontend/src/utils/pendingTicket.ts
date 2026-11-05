import type { NewTicketData } from "../api/tickets";

export interface PendingTicket { payload: NewTicketData; status: "unknown" | "quota"; details?: unknown; }
export function newRequestId()
{
	if (typeof crypto.randomUUID == "function") return crypto.randomUUID();
	// getRandomValues also works on HTTP test stands, where randomUUID requires HTTPS.
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 15) | 64;
	bytes[8] = (bytes[8] & 63) | 128;
	const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function pendingTicketKey(userId: number, eventId: number | string)
{
	return `ticket-create:${userId}:${eventId}`;
}
export function readPendingTicket(key: string): PendingTicket | null
{
	try
	{
		const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as PendingTicket | null;
		if (!value || !value.payload?.requestId || !["unknown", "quota"].includes(value.status)) return null;
		return value;
	}
	catch { return null; }
}
export function writePendingTicket(key: string, pending: PendingTicket | null)
{
	// Persist before HTTP: a storage failure must prevent an unprotected submission.
	if (pending) sessionStorage.setItem(key, JSON.stringify(pending));
	else sessionStorage.removeItem(key);
}
