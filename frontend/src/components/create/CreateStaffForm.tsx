import { useEffect, useRef, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { useMutationNewStaff } from "../../api/user";
import displayError from "../../utils/displayError";
import { Staff } from "../../api/dataTypes";

export default function CreateStaffForm({ open, close }: PopupProps)
{
	const [newStaff, setNewStaff] = useState<Staff | null>(null);
	const inp_name = useRef<HTMLInputElement>(null);
	const inp_login = useRef<HTMLInputElement>(null);
	const mutation = useMutationNewStaff(staff =>
	{
		setNewStaff(staff);
		close?.()
	});

	useEffect(() =>
	{
		if (!open && inp_name.current && inp_login.current)
		{
			mutation.reset();
			inp_name.current.value = "";
			inp_login.current.value = "";
		}
	}, [open, inp_name, inp_login]);

	return <>
		<Popup open={open} close={close} title="Добавление сотрудника">
			{displayError(mutation)}
			<Form onSubmit={() =>
			{
				const name = inp_name.current?.value;
				const login = inp_login.current?.value;
				if (name && login)
					mutation.mutate({ name, login });
			}}>
				<FormField label="Имя">
					<input ref={inp_name} type="text" required />
				</FormField>
				<FormField label="Логин">
					<input ref={inp_login} placeholder="Англ. буквы, цифры и _" type="text" required
						onInput={e =>
						{
							if (inp_login.current)
								inp_login.current.value = inp_login.current.value.replaceAll(/[^a-z_\d]/g, "");
						}}
					/>
				</FormField>
				<button type="submit">Добавить</button>
			</Form>
			{mutation.isLoading && <Spinner />}
		</Popup>
		<Popup open={!!newStaff} close={() => setNewStaff(null)} title="Данные сотрудника">
			<div>Логин: {newStaff?.login}</div>
			<div>Пароль: {newStaff?.password}</div>
			<h4 style={{ marginTop: 8 }}>Пароль нельзя посмотреть заново</h4>
		</Popup>
	</>
}
