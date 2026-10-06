import { useEffect, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { type UpdateTicketTypesData, useMutationUpdateTicketTypes, useTicketTypes } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import styles from "./styles.module.css";

export default function EditTicketTypesForm({ eventId, open, close }: EditTicketTypesFormProps)
{
	const [changes, setChanges] = useState<Map<number, UpdateTicketTypesData>>(new Map());
	const [newTypes, setNewTypes] = useState<UpdateTicketTypesData[]>([]);
	const ticketTypes = useTicketTypes(eventId);
	const mutation = useMutationUpdateTicketTypes(eventId, close);

	useEffect(() =>
	{
		setChanges(new Map());
		setNewTypes([]);
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open]);

	return (
		<Popup open={open} close={close} title="Изменение видов билетов">
			{displayError(mutation)}
			{ticketTypes.isLoading && <Spinner />}
			{mutation.isPending && <Spinner />}
			<Form onSubmit={() =>
			{
				if (changes.size > 0 || newTypes.length > 0)
					mutation.mutate([...newTypes.filter(v => v.action == "add"), ...Array.from(changes.values())]);
				else close?.();
			}}>
				{ticketTypes.data?.filter(v => changes.get(v.id)?.action != "delete")?.map(v =>
					<FormField key={v.id}>
						<label className={styles.label_with_input}>
							<span>Имя:</span>
							<input type="text" required value={changes.get(v.id)?.name ?? v.name} onChange={e =>
							{
								const name = e.target.value;
								setChanges(previous => new Map(previous).set(v.id, { id: v.id, price: v.price, ...previous.get(v.id), name, action: "update" }));
							}} />
						</label>
						<label className={styles.label_with_input}>
							<span>Цена:</span>
							<input type="number" min={0} step={1} placeholder="не указана" value={(changes.get(v.id) ? changes.get(v.id)?.price : v.price) ?? ""} onChange={e =>
							{
								const price = e.target.value === "" ? null : Number(e.target.value);
								setChanges(previous => new Map(previous).set(v.id, { id: v.id, name: v.name, ...previous.get(v.id), price, action: "update" }));
							}} />
						</label>
						<button type="button" className="button button_small button_danger" onClick={() =>
						{
							setChanges(previous => new Map(previous).set(v.id, { id: v.id, name: "", action: "delete" }));
						}}>Удалить</button>
					</FormField>,
				)}
				{newTypes.map((v, i) => ({ ...v, i })).filter(v => v.action == "add").map(v =>
					<FormField key={"new" + v.i}>
						<label className={styles.label_with_input}>
							<span>Имя:</span>
							<input type="text" required value={v.name} onChange={e =>
							{
								const name = e.target.value;
								setNewTypes(previous => previous.map((item, index) => index == v.i ? { ...item, name } : item));
							}} />
						</label>
						<label className={styles.label_with_input}>
							<span>Цена:</span>
							<input type="number" min={0} step={1} placeholder="не указана" value={v.price ?? ""} onChange={e =>
							{
								const price = e.target.value === "" ? null : Number(e.target.value);
								setNewTypes(previous => previous.map((item, index) => index == v.i ? { ...item, price } : item));
							}} />
						</label>
						<button type="button" className="button button_small button_danger" onClick={() =>
						{
							setNewTypes(previous => previous.map((item, index) => index == v.i ? { ...item, action: "delete" } : item));
						}}>Удалить</button>
					</FormField>,
				)}
				<button type="button" className="button button_small" onClick={() =>
				{
					setNewTypes(previous => [...previous, { name: "", action: "add" }]);
				}}>Добавить</button>
				<button type="submit" className="button button_small button_success">Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface EditTicketTypesFormProps extends PopupProps
{
	eventId: number | string,
}
