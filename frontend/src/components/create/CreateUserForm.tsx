import { useEffect, useState } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { NewUserData, UserWithPwd } from "../../api/user";
import { Form, FormField } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";

export default function CreateUserForm({ open, close, title, credentialsTitle, useCreate }: CreateUserFormProps)
{
	const [newUser, setNewUser] = useState<UserWithPwd | null>(null);
	const [name, setName] = useState("");
	const [login, setLogin] = useState("");
	const mutation = useCreate(user =>
	{
		setNewUser(user);
		close?.();
	});
	const { reset } = mutation;

	useEffect(() =>
	{
		if (!open)
		{
			reset();
			setName("");
			setLogin("");
		}
	}, [open, reset]);

	return <>
		<Popup open={open} close={close} title={title}>
			{displayError(mutation)}
			<Form onSubmit={() =>
			{
				if (name && login && !mutation.isPending)
					mutation.mutate({ name, login });
			}}>
				<FormField label="Имя">
					<input value={name} onChange={e => setName(e.target.value)} type="text" required />
				</FormField>
				<FormField label="Логин">
					<input value={login} placeholder="Англ. буквы, цифры и _" type="text" required
						onChange={e => setLogin(e.target.value.replaceAll(/[^a-z_\d]/g, ""))}
					/>
				</FormField>
				<button type="submit" className="button button_small" disabled={mutation.isPending}>Добавить</button>
			</Form>
			{mutation.isPending && <Spinner />}
		</Popup>
		<Popup open={!!newUser} close={() => setNewUser(null)} title={credentialsTitle}>
			<div>Логин: {newUser?.login}</div>
			<div>Пароль: {newUser?.password}</div>
			<h4 style={{ marginTop: 8 }}>Пароль нельзя посмотреть заново</h4>
		</Popup>
	</>;
}

interface CreateUserFormProps extends PopupProps
{
	title: string;
	credentialsTitle: string;
	useCreate: (onSuccess: (user: UserWithPwd) => void) => UseMutationResult<UserWithPwd, Error, NewUserData>;
}
