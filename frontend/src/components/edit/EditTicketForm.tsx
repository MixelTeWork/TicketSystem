import { useEffect, useRef } from "react";
import { ApiError } from "../../api/dataTypes";
import type { Ticket } from "../../api/tickets";
import { useHasPermission } from "../../api/operations";
import { useMutationDeleteTicket, useMutationUpdateTicket } from "../../api/tickets";
import { useTicketTypes } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { Form, FormField } from "../Form";
import Popup from "../Popup";
import PopupConfirmDeletion from "../PopupConfirmDeletion";
import Spinner from "../Spinner";
import TicketFormFields from "../TicketFormFields";
import { ticketFormData, ticketFormValues } from "../TicketFormFields/values";
import { QuotaDetails } from "../create/CreateTicketForm";

export default function EditTicketForm({ ticket, eventId, close, setTicket }: EditTicketFormProps)
{
	const deletionOpen = useStateBool(false);
	const values = useStateObj(ticketFormValues);
	const currentTicket = useRef(ticket?.id);
	currentTicket.current = ticket?.id;
	const initialized = useRef<number | null>(null);
	const mutation = useMutationUpdateTicket(ticket =>
	{
		if (ticket.id != currentTicket.current) return;
		setTicket(ticket);
		close();
	});
	const ticketTypes = useTicketTypes(eventId);
	const availableTypes = ticketTypes.data && ticket && !ticketTypes.data.some(type => type.id == ticket.typeId)
		? [{ id: ticket.typeId, name: ticket.type, price: ticket.price, imageId: null, pattern: null, categoryId: -1, dayOffsets: ticket.dayOffsets, validDates: ticket.validDates, quantity: null }, ...ticketTypes.data]
		: ticketTypes.data;
	const hasDeletePermission = useHasPermission("delete_ticket");

	const open = !!ticket;
	const { reset } = mutation;
	const quotaError = mutation.error instanceof ApiError && mutation.error.code == "ticket_limit_confirmation_required" ? mutation.error : null;
	const quota = quotaError !== null;

	useEffect(() =>
	{
		const setValues = values.set;
		const setDeletionOpen = deletionOpen.set;
		if (ticket && initialized.current != ticket.id)
		{
			setValues(ticketFormValues(ticket));
			initialized.current = ticket.id;
			reset();
		}
		else if (!ticket)
		{
			initialized.current = null;
			reset();
			setDeletionOpen(false);
		}
	}, [ticket, reset, values.set, deletionOpen.set]);

	return (
		<Popup open={open} close={close} title="Редактирование билета">
			{ticketTypes.isLoading && <Spinner />}
			{displayError(mutation)}
			{quota && <div role="alert"><QuotaDetails details={quotaError?.details} /><div className="actions"><button type="button" className="button button_primary" onClick={() => { if (mutation.variables) mutation.mutate({ ...mutation.variables, data: { ...mutation.variables.data, allowOverLimit: true } }); }}>Перевести сверх лимита</button><button type="button" className="button" onClick={reset}>Отмена</button></div></div>}
			{mutation.isPending && <Spinner />}
			<Form disabled={mutation.isPending || quota} onSubmit={() =>
			{
				if (ticket && availableTypes?.some(type => type.id == values.v.typeId) && values.v.personName && !mutation.isPending)
					mutation.mutate({
						ticketId: ticket.id,
						data: ticketFormData(values.v),
					});
			}}>
				<FormField label="Код билета"><input value={ticket?.code || ""} readOnly /></FormField>
				<fieldset disabled={mutation.isPending || quota} style={{ display: "contents" }}><TicketFormFields values={values} ticketTypes={availableTypes} /></fieldset>
				<button type="submit" className="button button_small" disabled={mutation.isPending || !availableTypes?.length}>Подтвердить</button>
			</Form>
			{hasDeletePermission && <button
				className="button button_danger button_small"
				onClick={deletionOpen.setT}
			>Удалить билет</button>}
			<PopupConfirmDeletion itemId={eventId} mutationParams={ticket?.id || 0} title="Удаление билета" onSuccess={close} mutationFn={useMutationDeleteTicket} open={deletionOpen.v} close={deletionOpen.setF} />
		</Popup>
	);
}

interface EditTicketFormProps
{
	eventId: string | number,
	ticket: Ticket | null,
	close: () => void,
	setTicket: (ticket: Ticket) => void,
}
