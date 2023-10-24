import { useEffect, useRef, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import { useMutationDeleteTicket, useMutationUpdateTicket } from "../../api/tickets";
import Spinner from "../Spinner";
import { useTicketTypes } from "../../api/ticketTypes";
import { Ticket } from "../../api/dataTypes";
import displayError from "../../utils/displayError";
import { useHasPermission } from "../../api/operations";
import PopupConfirmDeletion from "../PopupConfirmDeletion";

export default function EditTicketForm({ ticket, eventId, close, setTicket }: CreateTicketFormProps)
{
	const [deletionOpen, setDeletionOpen] = useState(false);
	const inp_typeId = useRef<HTMLSelectElement>(null);
	const inp_personName = useRef<HTMLInputElement>(null);
	const inp_personLink = useRef<HTMLInputElement>(null);
	const inp_promocode = useRef<HTMLInputElement>(null);
	const inp_code = useRef<HTMLInputElement>(null);
	const mutation = useMutationUpdateTicket(ticket =>
	{
		setTicket(ticket);
		close();
	});
	const ticketTypes = useTicketTypes(eventId);
	const hasDeletePermission = useHasPermission("delete_ticket");

	const open = !!ticket;

	useEffect(() =>
	{
		if (open && inp_typeId.current && inp_personName.current && inp_personLink.current && inp_promocode.current && inp_code.current)
		{
			inp_typeId.current.value = `${ticketTypes.data?.find(v => v.name == ticket.type)?.id}` || "";
			inp_personName.current.value = ticket.personName || "";
			inp_personLink.current.value = ticket.personLink || "";
			inp_promocode.current.value = ticket.promocode || "";
			inp_code.current.value = ticket.code;
		}
		if (!open)
		{
			mutation.reset();
		}
	}, [open, ticket, inp_personName, inp_personLink, inp_promocode, inp_code]);

	return (
		<Popup open={open} close={close} title="Редактирование билета">
			{ticketTypes.isLoading && <Spinner />}
			{displayError(mutation)}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				const typeId = inp_typeId.current?.value;
				const personName = inp_personName.current?.value;
				const personLink = inp_personLink.current?.value || "";
				const promocode = inp_promocode.current?.value || "";
				const code = inp_code.current?.value || "";
				if (ticket && typeId && personName)
					mutation.mutate({
						ticketId: ticket.id,
						data: {
							typeId: parseInt(typeId, 10),
							personName,
							personLink,
							promocode,
							code,
						}
					});
			}}>
				<FormField label="Тип билета">
					<select ref={inp_typeId} disabled={ticketTypes.data?.length == 0} required>
						{ticketTypes.data?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
					</select>
					{ticketTypes.data?.length == 0 && <h4>Добавьте типы билетов</h4>}
				</FormField>
				<FormField label="Посетитель">
					<input ref={inp_personName} type="text" required />
				</FormField>
				<FormField label="Ссылка на посетителя">
					<input ref={inp_personLink} type="text" />
				</FormField>
				<FormField label="Промокод">
					<input ref={inp_promocode} type="text" />
				</FormField>
				<FormField label="code">
					<input ref={inp_code} type="text" />
				</FormField>
				<button type="submit" className="button button_small" disabled={mutation.isLoading || !ticketTypes.data || ticketTypes.data.length == 0}>Подтвердить</button>
			</Form>
			{hasDeletePermission && <button
				className="button button_danger button_small"
				onClick={() => setDeletionOpen(true)}
			>Удалить билет</button>}
			<PopupConfirmDeletion itemId={eventId} mutatateParams={ticket?.id || 0} title="Удаление билета" onSuccess={close} mutationFn={useMutationDeleteTicket} open={deletionOpen} close={() => setDeletionOpen(false)} />
		</Popup>
	);
}

interface CreateTicketFormProps
{
	eventId: string | number,
	ticket: Ticket | null,
	close: () => void,
	setTicket: (ticket: Ticket) => void,
}
