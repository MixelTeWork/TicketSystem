import { useEffect } from "react";
import { type Ticket } from "../../api/dataTypes";
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
	const availableTypes = ticketTypes.data && ticket && !ticketTypes.data.some(type => type.id == ticket.typeId)
		? [{ id: ticket.typeId, name: ticket.type, price: ticket.price, imageId: null, pattern: null }, ...ticketTypes.data]
		: ticketTypes.data;
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
				if (ticket && availableTypes?.some(type => type.id == values.v.typeId) && values.v.personName && !mutation.isPending)
					mutation.mutate({
						ticketId: ticket.id,
						data: ticketFormData(values.v),
					});
			}}>
				<FormField label="Код билета"><input value={ticket?.code || ""} readOnly /></FormField>
				<TicketFormFields values={values} ticketTypes={availableTypes} />
				<button type="submit" className="button button_small" disabled={mutation.isPending || !availableTypes?.length}>Подтвердить</button>
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
