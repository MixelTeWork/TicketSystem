import { useEffect, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import { useMutationNewTicket } from "../../api/tickets";
import Spinner from "../Spinner";
import { useTicketTypes } from "../../api/ticketTypes";
import { Ticket } from "../../api/dataTypes";
import displayError from "../../utils/displayError";

export default function CreateTicketForm({ open, eventId, close, setTicet }: CreateTicketFormProps)
{
	const [typeId, setTypeId] = useState(-1);
	const [personName, setPersonName] = useState("");
	const [personLink, setPersonLink] = useState("");
	const [promocode, setPromocode] = useState("");
	const [code, setCode] = useState("");
	const [autocode, setAutocode] = useState(true);
	const mutation = useMutationNewTicket(ticket =>
	{
		setTicet(ticket);
		close?.();
	});
	const ticketTypes = useTicketTypes(eventId);

	useEffect(() =>
	{
		if (!open)
		{
			setAutocode(true);
			setTypeId(ticketTypes.data?.[0].id || -1);
			setPersonName("");
			setPersonLink("");
			setPromocode("");
			setCode("");
			mutation.reset();
		}
		// eslint-disable-next-line
	}, [open, ticketTypes.data]);

	return (
		<Popup open={open} close={close} title="Добавление билета">
			{displayError(mutation)}
			{ticketTypes.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				if (typeId >= 0 && personName)
					mutation.mutate({
						eventId: parseInt(`${eventId}`, 10),
						typeId: typeId,
						personName,
						personLink,
						promocode,
						code: autocode ? "" : code,
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
					<input type="checkbox" checked={autocode} onChange={e => setAutocode(e.target.checked)} />
					<span style={{ color: autocode ? "darkgreen" : "darkred" }}>Авто-код билета</span>
				</label>
				{!autocode &&
					<FormField label="Код билета (ручной ввод)">
						<div style={{ color: "darkred", fontSize: "0.9rem" }}>Не используйте без необходимости!</div>
						<input value={code} onChange={e => setCode(e.target.value)} type="text" />
					</FormField>
				}
				<button type="submit" className="button button_small" disabled={!ticketTypes.data || ticketTypes.data.length == 0}>Создать</button>
			</Form>
			{mutation.isLoading && <Spinner />}
		</Popup>
	);
}

interface CreateTicketFormProps extends PopupProps
{
	eventId: number | string,
	setTicet: (ticket: Ticket) => void,
}
