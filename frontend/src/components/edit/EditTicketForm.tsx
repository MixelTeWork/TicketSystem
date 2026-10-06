import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useEffect } from "react";
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
	const deletionOpen = useStateBool(false);
	const values = useStateObj(ticketFormValues);
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
		const setValues = values.set;
		const setDeletionOpen = deletionOpen.set;
		if (ticket)
			setValues(ticketFormValues(ticket));
		else
		{
			reset();
			setDeletionOpen(false);
		}
	}, [ticket, reset, values.set, deletionOpen.set]);

	return (
		<Popup open={open} close={close} title="Редактирование билета">
			{ticketTypes.isLoading && <Spinner />}
			{displayError(mutation)}
			{mutation.isPending && <Spinner />}
			<Form onSubmit={() =>
			{
				if (ticket && ticketTypes.data?.some(type => type.id == values.v.typeId) && values.v.personName && !mutation.isPending)
					mutation.mutate({
						ticketId: ticket.id,
						data: ticketFormData(values.v),
					});
			}}>
				<TicketFormFields values={values} ticketTypes={ticketTypes.data} />
				<button type="submit" className="button button_small" disabled={mutation.isPending || !ticketTypes.data || ticketTypes.data.length == 0}>Подтвердить</button>
			</Form>
			{hasDeletePermission && <button
				className="button button_danger button_small"
				onClick={deletionOpen.setT}
			>Удалить билет</button>}
			<PopupConfirmDeletion itemId={eventId} mutatateParams={ticket?.id || 0} title="Удаление билета" onSuccess={close} mutationFn={useMutationDeleteTicket} open={deletionOpen.v} close={deletionOpen.setF} />
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
