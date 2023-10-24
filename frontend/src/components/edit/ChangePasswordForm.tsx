import { useEffect, useRef, useState } from "react";
import { Form, FormField } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import displayError from "../../utils/displayError";
import { useMutationChangePassword } from "../../api/user";

export default function ChangePasswordForm({ open, close }: PopupProps)
{
	const [error, setError] = useState("");
	const passwordRef = useRef<HTMLInputElement>(null);
	const password2Ref = useRef<HTMLInputElement>(null);
	const mutation = useMutationChangePassword(close);

	useEffect(() =>
	{
		if (!open && passwordRef.current && password2Ref.current)
		{
			mutation.reset();
			setError("");
			passwordRef.current.value = "";
			password2Ref.current.value = "";
		}
		// eslint-disable-next-line
	}, [open, passwordRef, password2Ref]);

	return (
		<Popup open={open} close={close} title="Изменение пароля">
			{displayError(mutation)}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				const password = passwordRef.current?.value;
				const password2 = password2Ref.current?.value;

				if (!password || password.length <= 4) return setError("Короткий пароль");
				if (password != password2) return setError("Пароли не совпадают");

				mutation.mutate({ password });
			}}>
				<FormField label="Новый пароль">
					<input ref={passwordRef} type="password" required />
				</FormField>
				<FormField label="Ещё раз">
					<input ref={password2Ref} type="password" required />
				</FormField>
				{error != "" && <h4 style={{ color: "tomato" }}>{error}</h4>}
				<button type="submit" className="button button_small">Подтвердить</button>
			</Form>
		</Popup>
	);
}
