import { useEffect, useRef, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { UserWithPwd } from "../../api/dataTypes";
import { useMutationNewManager } from "../../api/managers";

export default function CreateManagerForm({ open, close }: PopupProps)
{
	const [newManager, setNewManager] = useState<UserWithPwd | null>(null);
	const inp_name = useRef<HTMLInputElement>(null);
	const inp_login = useRef<HTMLInputElement>(null);
	const mutation = useMutationNewManager(manager =>
	{
		setNewManager(manager);
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
		// eslint-disable-next-line
	}, [open, inp_name, inp_login]);

	return <>
		<Popup open={open} close={close} title="Добавление организатора">
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
				<button type="submit" className="button button_small">Добавить</button>
			</Form>
			{mutation.isLoading && <Spinner />}
		</Popup>
		<Popup open={!!newManager} close={() => setNewManager(null)} title="Данные организатора">
			<div>Логин: {newManager?.login}</div>
			<div>Пароль: {newManager?.password}</div>
			<h4 style={{ marginTop: 8 }}>Пароль нельзя посмотреть заново</h4>
		</Popup>
	</>
}
