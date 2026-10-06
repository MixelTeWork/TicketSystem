import useStateObj from "../../utils/useStateObj";
import useStateBool from "../../utils/useStateBool";
import { useEffect } from "react";
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
	const values = useStateObj(ticketFormValues);
	const code = useStateObj("");
	const autocode = useStateBool(true);
	const mutation = useMutationNewTicket(ticket =>
	{
		setTicket(ticket);
		close?.();
	});
	const ticketTypes = useTicketTypes(eventId);

	const { reset } = mutation;

	useEffect(() =>
	{
		const setAutocode = autocode.set;
		const setValues = values.set;
		const setCode = code.set;
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
	}, [open, ticketTypes.data, reset, autocode.set, values.set, code.set]);

	return (
		<Popup open={open} close={close} title="Добавление билета">
			{displayError(mutation)}
			{ticketTypes.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				if (ticketTypes.data?.some(type => type.id == values.v.typeId) && values.v.personName && !mutation.isPending)
					mutation.mutate({
						eventId: parseInt(`${eventId}`, 10),
						...ticketFormData(values.v),
						code: autocode.v ? "" : code.v,
					});
			}}>
				<TicketFormFields values={values} ticketTypes={ticketTypes.data} resetPriceOnTypeChange pricePlaceholder="не указана" />
				<label>
					<input type="checkbox" checked={autocode.v} onChange={e => autocode.set(e.target.checked)} />
					<span style={{ color: autocode.v ? "darkgreen" : "darkred" }}>Авто-код билета</span>
				</label>
				{!autocode.v &&
					<FormField label="Код билета (ручной ввод)">
						<div style={{ color: "darkred", fontSize: "0.9rem" }}>Не используйте без необходимости!</div>
						<input value={code.v} onChange={e => code.set(e.target.value)} type="text" />
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
