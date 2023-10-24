import { useEffect, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationUpdateStaff, useStaff, useStaffEvent } from "../../api/staff";


export default function EditStaffForm({ eventId, open, close }: EditTicketTypesFormProps)
{
	const staffCurrent = useStaffEvent(eventId);
	const staffAll = useStaff();
	const [staff, setStaff] = useState<number[]>([]);
	const [selectedStaff, setSelectedStaff] = useState(-1);
	const mutation = useMutationUpdateStaff(eventId, close);

	useEffect(() =>
	{
		if (staffCurrent.isSuccess)
			setStaff(staffCurrent.data.map(v => v.id));
	}, [staffCurrent.isSuccess, staffCurrent.data]);

	useEffect(() =>
	{
		if (open && staffCurrent.isSuccess)
			setStaff(staffCurrent.data.map(v => v.id));
		if (open)
			setSelectedStaff(-1);
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open, staffCurrent.isSuccess, staffCurrent.data]);

	return (
		<Popup open={open} close={close} title="Изменение доступа клерков">
			{displayError(staffCurrent)}
			{displayError(staffAll)}
			{displayError(mutation)}
			{staffCurrent.isLoading && <Spinner />}
			{staffAll.isLoading && <Spinner />}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				mutation.mutate(staff);
			}}>
				{staff.map(id =>
				{
					const v = staffAll.data?.find(v => v.id == id);
					return <FormField key={id}>
						<div>
							<span>{v?.name}</span>
							<span style={{ marginLeft: "1em", color: "gray" }}>({v?.login})</span>
						</div>
						<button type="button" className="button button_small" onClick={() =>
						{
							setStaff(staff => staff.filter(v => v != id));
						}}>Закрыть доступ</button>
					</FormField>
				})}
				<select onChange={e => setSelectedStaff(parseInt(e.target.value))}>
					<option value="-1">Выберите клерка</option>
					{staffAll.data?.filter(v => !staff.includes(v.id)).map(v => <option value={v.id} key={v.id}>{v.name}</option>)}
				</select>
				<button type="button" className="button button_small" disabled={staffAll.data?.filter(v => !staff.includes(v.id)).length == 0} onClick={() =>
				{
					if (selectedStaff >= 0)
					{
						setStaff(staff => [...staff, selectedStaff]);
						setSelectedStaff(-1);
					}
				}}>Добавить доступ</button>
				<button type="button" className="button button_small" disabled={staffAll.data?.filter(v => !staff.includes(v.id)).length == 0}  onClick={() =>
				{
					setStaff(staff => staffAll.data?.map(v => v.id) || staff);
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
