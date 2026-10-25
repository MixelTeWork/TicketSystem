import { useEffect } from "react";
import { type UpdateTicketTypesData, useMutationUpdateTicketTypes, useTicketTypes } from "../../api/ticketTypes";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { Form } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
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

	const existing = ticketTypes.data?.filter(type => changes.v.get(type.id)?.action != "delete") || [];
	const added = newTypes.v.map((type, index) => ({ ...type, index })).filter(type => type.action == "add");
	const busy = mutation.isPending || !ticketTypes.isSuccess;
	return <Popup open={open} close={close} title="Изменение видов билетов">
		{displayError(ticketTypes)}{displayError(mutation)}
		{(ticketTypes.isLoading || mutation.isPending) && <Spinner />}
		<Form className={styles.typesForm} disabled={busy} onSubmit={() =>
		{
			if (changes.v.size > 0 || added.length > 0)
				mutation.mutate([...added.map(({ name, price }) => ({ name, price, action: "add" as const })), ...changes.v.values()]);
			else close?.();
		}}>
			<div className={styles.typeLabels} aria-hidden="true"><span>Название</span><span>Цена, ₽</span><span /></div>
			{existing.map((type, index) =>
			{
				const change = changes.v.get(type.id);
				return <TicketTypeRow key={type.id} number={index + 1} name={change?.name ?? type.name} price={(change ? change.price : type.price) ?? null} disabled={busy} onChange={patch =>
				{
					changes.set(previous => new Map(previous).set(type.id, { id: type.id, name: type.name, price: type.price, ...previous.get(type.id), ...patch, action: "update" }));
				}} onDelete={() => changes.set(previous => new Map(previous).set(type.id, { id: type.id, name: "", action: "delete" }))} />;
			})}
			{added.map((type, index) => <TicketTypeRow key={`new-${type.index}`} number={existing.length + index + 1} name={type.name} price={type.price ?? null} disabled={busy} onChange={patch =>
			{
				newTypes.set(previous => previous.map((item, i) => i == type.index ? { ...item, ...patch } : item));
			}} onDelete={() => newTypes.set(previous => previous.map((item, i) => i == type.index ? { ...item, action: "delete" } : item))} />)}
			{ticketTypes.isSuccess && existing.length + added.length == 0 && <p className="muted">Виды билетов ещё не добавлены</p>}
			<div className="actions"><button type="button" className="button button_small" disabled={busy} onClick={() => newTypes.set(previous => [...previous, { name: "", action: "add" }])}>＋ Добавить вид</button></div>
			<div className="form-actions"><button type="button" className="button" onClick={close}>Отмена</button><button type="submit" className="button button_primary" disabled={busy}>Сохранить</button></div>
		</Form>
	</Popup>;
}

function TicketTypeRow({ number, name, price, disabled, onChange, onDelete }: { number: number, name: string, price: number | null, disabled: boolean, onChange: (patch: Partial<UpdateTicketTypesData>) => void, onDelete: () => void })
{
	return <div className={styles.typeRow}>
		<input aria-label={`Название вида билета ${number}`} placeholder="Название" type="text" required value={name} disabled={disabled} onChange={e => onChange({ name: e.target.value })} />
		<input aria-label={`Цена вида билета ${number}`} type="number" min={0} step={1} placeholder="не указана" value={price ?? ""} disabled={disabled} onChange={e => onChange({ price: e.target.value === "" ? null : Number(e.target.value) })} />
		<button type="button" className={`button ${styles.removeButton}`} title="Удалить вид билета" aria-label={`Удалить вид билета ${number}`} disabled={disabled} onClick={onDelete}>×</button>
	</div>;
}

interface EditTicketTypesFormProps extends PopupProps
{
	eventId: number | string,
}
