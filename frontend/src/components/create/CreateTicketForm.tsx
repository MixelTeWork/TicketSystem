import { useRef } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import { useMutationNewTicket } from "../../api/tickets";
import Spinner from "../Spinner";
import { useTicketTypes } from "../../api/ticketTypes";
import { Ticket } from "../../api/dataTypes";

export default function CreateTicketForm({ open, eventId, close, setTicet }: CreateTicketFormProps)
{
	const inp_typeId = useRef<HTMLSelectElement>(null);
	const inp_personName = useRef<HTMLInputElement>(null);
	const inp_personLink = useRef<HTMLInputElement>(null);
	const inp_promocode = useRef<HTMLInputElement>(null);
	const inp_code = useRef<HTMLInputElement>(null);
	const mutation = useMutationNewTicket(ticket =>
	{
		setTicet(ticket);
		close?.();
	});
	const ticketTypes = useTicketTypes(eventId);

	return (
		<Popup open={open} close={close} title="Добавление билета">
			{mutation.isError && <h3 style={{ color: "tomato", textAlign: "center" }}>Ошибка</h3>}
			{ticketTypes.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				const typeId = inp_typeId.current?.value;
				const personName = inp_personName.current?.value;
				const personLink = inp_personLink.current?.value || "";
				const promocode = inp_promocode.current?.value || "";
				const code = inp_code.current?.value || "";
				if (typeId && personName)
					mutation.mutate({
						eventId: parseInt(`${eventId}`, 10),
						typeId: parseInt(typeId, 10),
						personName,
						personLink,
						promocode,
						code,
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
				{/* <FormField label="code">
					<input ref={inp_code} type="text" />
				</FormField> */}
				<button type="submit" disabled={!ticketTypes.data || ticketTypes.data.length == 0}>Создать</button>
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
