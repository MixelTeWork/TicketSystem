import useStateObj from "../../utils/useStateObj";
import { useEffect } from "react";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationUpdateStaff, useStaff, useStaffEvent } from "../../api/staff";


export default function EditStaffForm({ eventId, open, close }: EditTicketTypesFormProps)
{
	const staffCurrent = useStaffEvent(eventId);
	const staffAll = useStaff();
	const staff = useStateObj<number[]>([]);
	const selectedStaff = useStateObj(-1);
	const mutation = useMutationUpdateStaff(eventId, close);

	useEffect(() =>
	{
		const setStaff = staff.set;
		if (staffCurrent.isSuccess)
			setStaff(staffCurrent.data.map(v => v.id));
	}, [staffCurrent.isSuccess, staffCurrent.data, staff.set]);

	useEffect(() =>
	{
		const setStaff = staff.set;
		const setSelectedStaff = selectedStaff.set;
		if (open && staffCurrent.isSuccess)
			setStaff(staffCurrent.data.map(v => v.id));
		if (open)
			setSelectedStaff(-1);
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open, staffCurrent.isSuccess, staffCurrent.data, staff.set, selectedStaff.set]);

	return (
		<Popup open={open} close={close} title="Изменение доступа сотрудников">
			{displayError(staffCurrent)}
			{displayError(staffAll)}
			{displayError(mutation)}
			{staffCurrent.isLoading && <Spinner />}
			{staffAll.isLoading && <Spinner />}
			{mutation.isPending && <Spinner />}
			<Form onSubmit={() =>
			{
				mutation.mutate(staff.v);
			}}>
				{staff.v.map(id =>
				{
					const v = staffAll.data?.find(v => v.id == id);
					return <FormField key={id}>
						<div>
							<span>{v?.name} — {v?.roles.join(", ")}</span>
							<span style={{ marginLeft: "1em", color: "gray" }}>({v?.login})</span>
						</div>
						<button type="button" className="button button_small" onClick={() =>
						{
							staff.set(staff => staff.filter(v => v != id));
						}}>Закрыть доступ</button>
					</FormField>;
				})}
				<select value={selectedStaff.v} onChange={e => selectedStaff.set(parseInt(e.target.value))}>
					<option value="-1">Выберите сотрудника</option>
					{staffAll.data?.filter(v => !staff.v.includes(v.id)).map(v => <option value={v.id} key={v.id}>{v.name} — {v.roles.join(", ")}</option>)}
				</select>
				<button type="button" className="button button_small" disabled={staffAll.data?.filter(v => !staff.v.includes(v.id)).length == 0} onClick={() =>
				{
					if (selectedStaff.v >= 0)
					{
						staff.set(staff => [...staff, selectedStaff.v]);
						selectedStaff.set(-1);
					}
				}}>Добавить доступ</button>
				<button type="button" className="button button_small" disabled={staffAll.data?.filter(v => !staff.v.includes(v.id)).length == 0}  onClick={() =>
				{
					staff.set(staff => staffAll.data?.map(v => v.id) || staff);
				}}>Добавить всех</button>
				<button type="submit" className="button button_small">Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface EditTicketTypesFormProps extends PopupProps
{
	eventId: number | string,
}
