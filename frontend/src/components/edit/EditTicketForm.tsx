import { useEffect, useState } from "react";
import { Form } from "../Form";
import Popup from "../Popup";
import { useMutationDeleteTicket, useMutationUpdateTicket } from "../../api/tickets";
import Spinner from "../Spinner";
import { useTicketTypes } from "../../api/ticketTypes";
import { type Ticket } from "../../api/dataTypes";
import displayError from "../../utils/displayError";
import { useHasPermission } from "../../api/operations";
import PopupConfirmDeletion from "../PopupConfirmDeletion";
import TicketFormFields from "../TicketFormFields";
import { ticketFormData, ticketFormValues } from "../TicketFormFields/values";

export default function EditTicketForm({ ticket, eventId, close, setTicket }: EditTicketFormProps)
{
	const [deletionOpen, setDeletionOpen] = useState(false);
	const [values, setValues] = useState(ticketFormValues);
	const mutation = useMutationUpdateTicket(ticket =>
	{
		setTicket(ticket);
		close();
	});
	const ticketTypes = useTicketTypes(eventId);
	const hasDeletePermission = useHasPermission("delete_ticket");

	const open = !!ticket;
	const { reset } = mutation;

	useEffect(() =>
	{
		if (ticket)
			setValues(ticketFormValues(ticket));
		else
		{
			reset();
			setDeletionOpen(false);
		}
	}, [ticket, reset]);

	return (
		<Popup open={open} close={close} title="Редактирование билета">
			{ticketTypes.isLoading && <Spinner />}
			{displayError(mutation)}
			{mutation.isPending && <Spinner />}
			<Form onSubmit={() =>
			{
				if (ticket && ticketTypes.data?.some(type => type.id == values.typeId) && values.personName && !mutation.isPending)
					mutation.mutate({
						ticketId: ticket.id,
						data: ticketFormData(values),
					});
			}}>
				<TicketFormFields values={values} setValues={setValues} ticketTypes={ticketTypes.data} />
				<button type="submit" className="button button_small" disabled={mutation.isPending || !ticketTypes.data || ticketTypes.data.length == 0}>Подтвердить</button>
			</Form>
			{hasDeletePermission && <button
				className="button button_danger button_small"
				onClick={() => setDeletionOpen(true)}
			>Удалить билет</button>}
			<PopupConfirmDeletion itemId={eventId} mutatateParams={ticket?.id || 0} title="Удаление билета" onSuccess={close} mutationFn={useMutationDeleteTicket} open={deletionOpen} close={() => setDeletionOpen(false)} />
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
