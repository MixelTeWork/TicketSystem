import { useRef, useState } from "react";
import styles from "./styles.module.css"
import { useMutation, useQueryClient } from "react-query";
import postAuth from "../../api/auth";
import ApiError from "../../api/apiError";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import { useTitle } from "../../utils/useTtile";
import { Form, FormField } from "../../components/Form";

export default function AuthPage()
{
	useTitle("Авторизация");
	const queryClient = useQueryClient();
	const navigate = useNavigate()

	const [error, setError] = useState("");
	const inp_login = useRef<HTMLInputElement>(null);
	const inp_password = useRef<HTMLInputElement>(null);

	const mutation = useMutation({
		mutationFn: postAuth,
		onSuccess: (data) =>
		{
			queryClient.setQueryData("user", () => data);
			navigate("/");
		},
		onError: (error) =>
		{
			if (error instanceof ApiError)
				setError(error.message);
			else
				setError("Произошла ошибка, попробуйте ещё раз");
		}
	});

	function onSubmit()
	{
		const login = inp_login.current?.value || "";
		const password = inp_password.current?.value || "";
		mutation.mutate({ login, password });
	}

	return (
		<Layout header={null} centered gap="2em">
			<h1>Билетная Система</h1>
			{error && <h3>{error}</h3>}
			<Form className={styles.form} onSubmit={onSubmit}>
				<FormField label="Логин">
					<input ref={inp_login} type="text" name="login" required />
				</FormField>
				<FormField label="Пароль">
					<input ref={inp_password} type="password" name="password" required />
				</FormField>
				<button type="submit" disabled={mutation.status == "loading"}>Войти</button>
			</Form>
			<div>
				<div>Для сканирования билетов получите ссылку у управляющего.</div>
				<div>Если вы попали сюда, перейдите по полученной ссылке ещё раз.</div>
			</div>
		</Layout>
	);
}
