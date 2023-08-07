import { FormEvent, useRef, useState } from "react";
import styles from "./styles.module.css"
import { QueryClient, useMutation } from "react-query";
import postAuth from "../../api/auth";
import ApiError from "../../api/apiError";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";

export default function AuthPage()
{
	const queryClient = new QueryClient();
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

	function onSubmit(e: FormEvent)
	{
		e.preventDefault();
		const login = inp_login.current?.value || "";
		const password = inp_password.current?.value || "";
		mutation.mutate({ login, password });
	}

	return (
		<Layout header={null} centered gap="2em">
			<h1>Билетная Система</h1>
			{error && <h3>{error}</h3>}
			<form className={styles.form} onSubmit={onSubmit}>
				<label className={styles.field}>
					<span>Логин</span>
					<input ref={inp_login} type="text" name="login" required />
				</label>
				<label className={styles.field}>
					<span>Пароль</span>
					<input ref={inp_password} type="password" name="password" required />
				</label>
				<button type="submit" disabled={mutation.status == "loading"}>Войти</button>
			</form>
		</Layout>
	);
}
