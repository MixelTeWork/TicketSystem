import { useRef } from "react";
import { useMutationAuth } from "../../api/auth";
import { Form, FormField } from "../../components/Form";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

export default function AuthPage()
{
	useTitle("Вход");
	const error = useStateObj("");
	const loginRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const mutation = useMutationAuth(error.set);
	return <Layout header={null} centered>
		<section className={styles.form}>
			<p className={styles.brand}>TicketSystem</p><h1>Вход в систему</h1>
			<Form onSubmit={() => mutation.mutate({ login: loginRef.current?.value || "", password: passwordRef.current?.value || "" })}>
				<FormField label="Логин"><input ref={loginRef} type="text" name="login" autoComplete="username" required autoFocus /></FormField>
				<FormField label="Пароль"><input ref={passwordRef} type="password" name="password" autoComplete="current-password" required /></FormField>
				{error.v && <p className="danger-text" role="alert">{error.v}</p>}
				{mutation.isPending && <Spinner />}
				<button type="submit" className="button button_primary" disabled={mutation.isPending}>Войти</button>
			</Form>
		</section>
	</Layout>;
}
