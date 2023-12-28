import { useRef, useState } from "react";
import useUser, { useMutationChangeName } from "../../api/user";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"
import ChangePasswordForm from "../../components/edit/ChangePasswordForm";
import displayError from "../../utils/displayError";
import Spinner from "../../components/Spinner";

export default function ProfilePage()
{
	const user = useUser();
	const nameRef = useRef<HTMLInputElement>(null);
	const [userNameEditing, setUserNameEditing] = useState(false);
	const [passwordEditing, setPasswordEditing] = useState(false);
	const nameMutation = useMutationChangeName();

	return (
		<Layout centered gap="1rem">
			<div className={styles.root}>
				{displayError(nameMutation)}
				{nameMutation.isLoading && <Spinner />}
				<div>
					<h3>Имя</h3>
					<div>
						<input type="text" ref={nameRef} defaultValue={user.data?.name} disabled={!userNameEditing} className={styles.input} />
					</div>
					<div>
						{!userNameEditing && <button onClick={() => setUserNameEditing(true)} className="button button_small">Изменить</button>}
						{userNameEditing && <button onClick={() =>
						{
							setUserNameEditing(false);
							if (nameRef.current)
								nameRef.current.value = user.data?.name || "";
						}}
							className="button button_small"
						>
							Отмена
						</button>}
						{userNameEditing && <button
							onClick={() =>
							{
								setUserNameEditing(false);
								if (nameRef.current)
									nameMutation.mutate({ name: nameRef.current.value });
							}}
							className="button button_small"
						>
							Сохранить
						</button>}
					</div>
				</div>
				<div>
					<h3>Логин</h3>
					{user.data?.login}
				</div>
				<div>
					<h3>Роли</h3>
					{user.data?.roles.map((v, i) => <div key={i}>{v}</div>)}
				</div>
				<div>
					<button className="button" onClick={() => setPasswordEditing(true)}>Сменить пароль</button>
				</div>
			</div>
			<ChangePasswordForm open={passwordEditing} close={() => setPasswordEditing(false)} />
		</Layout>
	);
}
