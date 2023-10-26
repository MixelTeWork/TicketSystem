import { useEffect, useRef, useState } from "react";
import { Form, FormField } from "../Form";
import Popup from "../Popup";
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
	const [hideCode, setHideCode] = useState(true);
	const [typeId, setTypeId] = useState(-1);
	const [personName, setPersonName] = useState("");
	const [personLink, setPersonLink] = useState("");
	const [promocode, setPromocode] = useState("");
	const [code, setCode] = useState("");
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
		if (open)
		{
			setTypeId(ticketTypes.data?.find(v => v.name == ticket.type)?.id || -1);
			setPersonName(ticket.personName || "");
			setPersonLink(ticket.personLink || "");
			setPromocode(ticket.promocode || "");
			setCode(ticket.code || "");
		}
		if (!open)
		{
			mutation.reset();
			setHideCode(true);
		}
	}, [open, ticket, ticketTypes.data]);

	return (
		<Popup open={open} close={close} title="Редактирование билета">
			{ticketTypes.isLoading && <Spinner />}
			{displayError(mutation)}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				if (ticket && typeId >= 0 && personName)
					mutation.mutate({
						ticketId: ticket.id,
						data: {
							typeId,
							personName,
							personLink,
							promocode,
							code: hideCode ? ticket.code : code,
						}
					});
			}}>
				<FormField label="Тип билета">
					<select value={typeId} onChange={e => setTypeId(ticketTypes.data?.[e.target.selectedIndex].id || -1)} disabled={ticketTypes.data?.length == 0} required>
						{ticketTypes.data?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
					</select>
					{ticketTypes.data?.length == 0 && <h4>Добавьте типы билетов</h4>}
				</FormField>
				<FormField label="Посетитель">
					<input value={personName} onChange={e => setPersonName(e.target.value)} type="text" required />
				</FormField>
				<FormField label="Ссылка на посетителя">
					<input value={personLink} onChange={e => setPersonLink(e.target.value)} type="text" />
				</FormField>
				<FormField label="Промокод">
					<input value={promocode} onChange={e => setPromocode(e.target.value)} type="text" />
				</FormField>
				<label>
					<input type="checkbox" checked={!hideCode} onChange={e => setHideCode(!e.target.checked)} />
					<span style={{ color: hideCode ? "gray" : "darkred" }}>Изменить код</span>
				</label>
				{!hideCode &&
					<FormField label="Код билета (ручной ввод)">
						<div style={{ color: "darkred", fontSize: "0.9rem" }}>Не используйте без необходимости!</div>
						<input value={code} onChange={e => setCode(e.target.value)} type="text" />
					</FormField>
				}
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
