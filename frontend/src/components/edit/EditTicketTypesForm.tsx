import { useEffect, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { UpdateTicketTypesData, useMutationUpdateTicketTypes, useTicketTypes } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";

export default function EditTicketTypesForm({ eventId, open, close }: EditTicketTypesFormProps)
{
	const [, setUpdate] = useState(0);
	const [changes, setChanges] = useState<Map<number, UpdateTicketTypesData>>(new Map());
	const [newTypes, setNewTypes] = useState<UpdateTicketTypesData[]>([]);
	const ticketTypes = useTicketTypes(eventId);
	const mutation = useMutationUpdateTicketTypes(eventId, close);

	useEffect(() =>
	{
		setChanges(new Map())
		setNewTypes([]);
		setUpdate(0);
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open]);

	return (
		<Popup open={open} close={close} title="Изменение видов билетов">
			{displayError(mutation)}
			{ticketTypes.isLoading && <Spinner />}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				if (changes.size > 0 || newTypes.length > 0)
					mutation.mutate([...newTypes.filter(v => v.action == "add"), ...Array.from(changes.values())]);
			}}>
				{ticketTypes.data?.filter(v => changes.get(v.id)?.action != "delete")?.map(v =>
					<FormField key={v.id}>
						<input type="text" required value={changes.get(v.id)?.name || v.name} onChange={e =>
						{
							changes.set(v.id, { id: v.id, name: e.target.value, action: "update" });
							setUpdate(v => v + 1);
						}} />
						<button type="button" className="button button_small" onClick={() =>
						{
							changes.set(v.id, { id: v.id, name: "", action: "delete" });
							setUpdate(v => v + 1);
						}}>Удалить</button>
					</FormField>
				)}
				{newTypes.filter(v => v.action == "add").map((v, i) =>
					<FormField key={"new" + i}>
						<input type="text" required onChange={e =>
						{
							newTypes[i].name = e.target.value;
							setUpdate(v => v + 1);
						}} />
						<button type="button" className="button button_small" onClick={() =>
						{
							newTypes[i].action = "delete";
							setUpdate(v => v + 1);
						}}>Удалить</button>
					</FormField>
				)}
				<button type="button" className="button button_small" onClick={() =>
				{
					newTypes.push({ name: "", action: "add" });
					setUpdate(v => v + 1);
				}}>Добавить</button>
				<button type="submit" className="button button_small">Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface EditTicketTypesFormProps extends PopupProps
{
	eventId: number | string,
}
