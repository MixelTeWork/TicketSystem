import { useEffect, useRef } from "react";
import { useMutationUpdateStaff, useStaff, useStaffEvent } from "../../api/staff";
import displayError from "../../utils/displayError";
import useStateObj from "../../utils/useStateObj";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import styles from "./styles.module.css";

export default function EditStaffForm({ eventId, open, close }: EditStaffFormProps)
{
	const staffCurrent = useStaffEvent(eventId);
	const staffAll = useStaff();
	const staff = useStateObj<number[]>([]);
	const selectedStaff = useStateObj(-1);
	const mutation = useMutationUpdateStaff(eventId, close);
	const initializedFor = useRef<string | null>(null);
	const { reset } = mutation;

	useEffect(() =>
	{
		const setStaff = staff.set;
		const setSelectedStaff = selectedStaff.set;
		if (!open)
		{
			initializedFor.current = null;
			setSelectedStaff(-1);
			reset();
		}
		else if (staffCurrent.isSuccess && initializedFor.current != String(eventId))
		{
			setStaff(staffCurrent.data.map(member => member.id));
			setSelectedStaff(-1);
			initializedFor.current = String(eventId);
		}
	}, [open, eventId, staffCurrent.isSuccess, staffCurrent.data, staff.set, selectedStaff.set, reset]);

	const available = staffAll.data?.filter(member => !staff.v.includes(member.id)) || [];
	const selected = available.some(member => member.id == selectedStaff.v) ? selectedStaff.v : available[0]?.id ?? -1;
	const busy = mutation.isPending || !staffCurrent.isSuccess || !staffAll.isSuccess;
	return <Popup open={open} close={close} title="Изменение доступа сотрудников">
		{displayError(staffCurrent)}{displayError(staffAll)}{displayError(mutation)}
		{(staffCurrent.isLoading || staffAll.isLoading || mutation.isPending) && <Spinner />}
		<Form disabled={busy} onSubmit={() => mutation.mutate(staff.v)}>
			<div>
				{staff.v.map(id =>
				{
					const member = staffAll.data?.find(member => member.id == id) || staffCurrent.data?.find(member => member.id == id);
					return <div className={styles.accessRow} key={id}>
						<span>{member?.name ?? `Сотрудник #${id}`}<small className="muted">{member?.roles.join(", ")}{member?.login && ` · ${member.login}`}</small></span>
						<button type="button" className={`button ${styles.removeButton}`} aria-label={`Закрыть доступ: ${member?.name ?? id}`} title="Закрыть доступ" disabled={busy} onClick={() => staff.set(previous => previous.filter(value => value != id))}>×</button>
					</div>;
				})}
				{staffCurrent.isSuccess && staff.v.length == 0 && <p className="muted">Нет назначенных сотрудников</p>}
			</div>
			<FormField label="Сотрудник">
				<select value={selected} disabled={busy || !available.length} onChange={e => selectedStaff.set(Number(e.target.value))}>
					{!available.length && <option value="-1">Все сотрудники уже добавлены</option>}
					{available.map(member => <option value={member.id} key={member.id}>{member.name} · {member.roles.join(", ")}</option>)}
				</select>
			</FormField>
			<div className="actions">
				<button type="button" className="button" disabled={busy || selected < 0} onClick={() =>
				{
					staff.set(previous => [...previous, selected]);
					selectedStaff.set(-1);
				}}>Добавить доступ</button>
				<button type="button" className="button" disabled={busy || !available.length} onClick={() => staff.set(previous => [...new Set([...previous, ...available.map(member => member.id)])])}>Добавить всех</button>
			</div>
			<div className="form-actions"><button type="button" className="button" onClick={close}>Отмена</button><button type="submit" className="button button_primary" disabled={busy}>Подтвердить</button></div>
		</Form>
	</Popup>;
}

interface EditStaffFormProps extends PopupProps
{
	eventId: number | string,
}
