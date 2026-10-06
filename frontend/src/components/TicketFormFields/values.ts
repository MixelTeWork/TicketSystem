import type { Ticket, UpdateTicketData } from "../../api/tickets";

export interface TicketFormValues
{
	typeId: number;
	personName: string;
	personLink: string;
	promocode: string;
	price: string;
}

export function ticketFormValues(ticket?: Ticket | null): TicketFormValues
{
	return {
		typeId: ticket?.typeId ?? -1,
		personName: ticket?.personName ?? "",
		personLink: ticket?.personLink ?? "",
		promocode: ticket?.promocode ?? "",
		price: `${ticket?.price ?? ""}`,
	};
}

export function ticketFormData(values: TicketFormValues): UpdateTicketData
{
	return { ...values, price: values.price == "" ? null : parseInt(values.price, 10) };
}
