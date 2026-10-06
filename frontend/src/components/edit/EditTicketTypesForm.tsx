import useStateObj from "../../utils/useStateObj";
import { useEffect } from "react";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { type UpdateTicketTypesData, useMutationUpdateTicketTypes, useTicketTypes } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import styles from "./styles.module.css";

export default function EditTicketTypesForm({ eventId, open, close }: EditTicketTypesFormProps)
{
	const changes = useStateObj<Map<number, UpdateTicketTypesData>>(new Map());
	const newTypes = useStateObj<UpdateTicketTypesData[]>([]);
	const ticketTypes = useTicketTypes(eventId);
	const mutation = useMutationUpdateTicketTypes(eventId, close);

	useEffect(() =>
	{
		const setChanges = changes.set;
		const setNewTypes = newTypes.set;
		setChanges(new Map());
		setNewTypes([]);
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open, changes.set, newTypes.set]);

	return (
		<Popup open={open} close={close} title="Изменение видов билетов">
			{displayError(mutation)}
			{ticketTypes.isLoading && <Spinner />}
			{mutation.isPending && <Spinner />}
			<Form onSubmit={() =>
			{
				if (changes.v.size > 0 || newTypes.v.length > 0)
					mutation.mutate([...newTypes.v.filter(v => v.action == "add"), ...Array.from(changes.v.values())]);
				else close?.();
			}}>
				{ticketTypes.data?.filter(v => changes.v.get(v.id)?.action != "delete")?.map(v =>
					<FormField key={v.id}>
						<label className={styles.label_with_input}>
							<span>Имя:</span>
							<input type="text" required value={changes.v.get(v.id)?.name ?? v.name} onChange={e =>
							{
								const name = e.target.value;
								changes.set(previous => new Map(previous).set(v.id, { id: v.id, price: v.price, ...previous.get(v.id), name, action: "update" }));
							}} />
						</label>
						<label className={styles.label_with_input}>
							<span>Цена:</span>
							<input type="number" min={0} step={1} placeholder="не указана" value={(changes.v.get(v.id) ? changes.v.get(v.id)?.price : v.price) ?? ""} onChange={e =>
							{
								const price = e.target.value === "" ? null : Number(e.target.value);
								changes.set(previous => new Map(previous).set(v.id, { id: v.id, name: v.name, ...previous.get(v.id), price, action: "update" }));
							}} />
						</label>
						<button type="button" className="button button_small button_danger" onClick={() =>
						{
							changes.set(previous => new Map(previous).set(v.id, { id: v.id, name: "", action: "delete" }));
						}}>Удалить</button>
					</FormField>,
				)}
				{newTypes.v.map((v, i) => ({ ...v, i })).filter(v => v.action == "add").map(v =>
					<FormField key={"new" + v.i}>
						<label className={styles.label_with_input}>
							<span>Имя:</span>
							<input type="text" required value={v.name} onChange={e =>
							{
								const name = e.target.value;
								newTypes.set(previous => previous.map((item, index) => index == v.i ? { ...item, name } : item));
							}} />
						</label>
						<label className={styles.label_with_input}>
							<span>Цена:</span>
							<input type="number" min={0} step={1} placeholder="не указана" value={v.price ?? ""} onChange={e =>
							{
								const price = e.target.value === "" ? null : Number(e.target.value);
								newTypes.set(previous => previous.map((item, index) => index == v.i ? { ...item, price } : item));
							}} />
						</label>
						<button type="button" className="button button_small button_danger" onClick={() =>
						{
							newTypes.set(previous => previous.map((item, index) => index == v.i ? { ...item, action: "delete" } : item));
						}}>Удалить</button>
					</FormField>,
				)}
				<button type="button" className="button button_small" onClick={() =>
				{
					newTypes.set(previous => [...previous, { name: "", action: "add" }]);
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
