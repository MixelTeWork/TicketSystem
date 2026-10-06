import { useEffect, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import { useMutationNewTicket } from "../../api/tickets";
import Spinner from "../Spinner";
import { useTicketTypes } from "../../api/ticketTypes";
import { type Ticket } from "../../api/dataTypes";
import displayError from "../../utils/displayError";
import TicketFormFields from "../TicketFormFields";
import { ticketFormData, ticketFormValues } from "../TicketFormFields/values";

export default function CreateTicketForm({ open, eventId, close, setTicket }: CreateTicketFormProps)
{
	const [values, setValues] = useState(ticketFormValues);
	const [code, setCode] = useState("");
	const [autocode, setAutocode] = useState(true);
	const mutation = useMutationNewTicket(ticket =>
	{
		setTicket(ticket);
		close?.();
	});
	const ticketTypes = useTicketTypes(eventId);

	const { reset } = mutation;

	useEffect(() =>
	{
		const type = ticketTypes.data?.[0];
		if (!open)
		{
			setAutocode(true);
			setValues({ ...ticketFormValues(), typeId: type?.id ?? -1, price: `${type?.price ?? ""}` });
			setCode("");
			reset();
		}
		else if (type)
			setValues(previous => previous.typeId < 0 ? { ...previous, typeId: type.id, price: `${type.price ?? ""}` } : previous);
	}, [open, ticketTypes.data, reset]);

	return (
		<Popup open={open} close={close} title="Добавление билета">
			{displayError(mutation)}
			{ticketTypes.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				if (ticketTypes.data?.some(type => type.id == values.typeId) && values.personName && !mutation.isPending)
					mutation.mutate({
						eventId: parseInt(`${eventId}`, 10),
						...ticketFormData(values),
						code: autocode ? "" : code,
					});
			}}>
				<TicketFormFields values={values} setValues={setValues} ticketTypes={ticketTypes.data} resetPriceOnTypeChange pricePlaceholder="не указана" />
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
				<button type="submit" className="button button_small" disabled={mutation.isPending || !ticketTypes.data || ticketTypes.data.length == 0}>Создать</button>
			</Form>
			{mutation.isPending && <Spinner />}
		</Popup>
	);
}

interface CreateTicketFormProps extends PopupProps
{
	eventId: number | string,
	setTicket: (ticket: Ticket) => void,
}
