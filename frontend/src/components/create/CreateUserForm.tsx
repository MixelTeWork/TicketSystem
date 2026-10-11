import useStateObj from "../../utils/useStateObj";
import { useEffect, type ReactNode } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { NewUserData, UserWithPwd } from "../../api/user";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";

export default function CreateUserForm({ open, close, title, credentialsTitle, useCreate, additionalFields }: CreateUserFormProps)
{
	const newUser = useStateObj<UserWithPwd | null>(null);
	const name = useStateObj("");
	const login = useStateObj("");
	const mutation = useCreate(user =>
	{
		newUser.set(user);
		close?.();
	});
	const { reset } = mutation;

	useEffect(() =>
	{
		const setName = name.set;
		const setLogin = login.set;
		if (!open)
		{
			reset();
			setName("");
			setLogin("");
		}
	}, [open, reset, name.set, login.set]);

	return <>
		<Popup open={open} close={close} title={title}>
			{displayError(mutation)}
			<Form onSubmit={() =>
			{
				if (name.v && login.v && !mutation.isPending)
					mutation.mutate({ name: name.v, login: login.v });
			}}>
				<FormField label="Имя">
					<input value={name.v} onChange={e => name.set(e.target.value)} type="text" required />
				</FormField>
				<FormField label="Логин">
					<input value={login.v} placeholder="Англ. буквы, цифры и _" type="text" required
						onChange={e => login.set(e.target.value.replaceAll(/[^a-z_\d]/g, ""))}
					/>
				</FormField>
				{additionalFields}
				<button type="submit" className="button button_small" disabled={mutation.isPending}>Добавить</button>
			</Form>
			{mutation.isPending && <Spinner />}
		</Popup>
		<Popup open={!!newUser.v} close={() => newUser.set(null)} title={credentialsTitle}>
			<div>Логин: {newUser.v?.login}</div>
			<div>Пароль: {newUser.v?.password}</div>
			<h4 style={{ marginTop: 8 }}>Пароль нельзя посмотреть заново</h4>
		</Popup>
	</>;
}

interface CreateUserFormProps extends PopupProps
{
	title: string;
	credentialsTitle: string;
	additionalFields?: ReactNode;
	useCreate: (onSuccess: (user: UserWithPwd) => void) => UseMutationResult<UserWithPwd, Error, NewUserData>;
}
