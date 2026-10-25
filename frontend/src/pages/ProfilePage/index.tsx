import useUser, { useMutationChangeName } from "../../api/user";
import ChangePasswordForm from "../../components/edit/ChangePasswordForm";
import Layout from "../../components/Layout";
import { PageHeading } from "../../components/Page";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";

export default function ProfilePage()
{
	useTitle("Профиль");
	const user = useUser();
	const name = useStateObj("");
	const userNameEditing = useStateBool(false);
	const passwordEditing = useStateBool(false);
	const nameMutation = useMutationChangeName(userNameEditing.setF);

	return (
		<Layout backLink="/" centeredPage>
			<PageHeading title="Профиль" />
			<div className={styles.root}>
				{displayError(nameMutation)}
				{nameMutation.isPending && <Spinner />}
				<div>
					<h3>Имя</h3>
					<div>
						<input type="text" value={userNameEditing.v ? name.v : user.data?.name ?? ""} onChange={e => name.set(e.target.value)} disabled={!userNameEditing.v || nameMutation.isPending} className={styles.input} />
					</div>
					<div>
						{!userNameEditing.v && <button onClick={() =>
						{
							name.set(user.data?.name ?? "");
							nameMutation.reset();
							userNameEditing.setT();
						}} className="button button_small">Изменить</button>}
						{userNameEditing.v && <button onClick={() =>
						{
							userNameEditing.setF();
							name.set("");
							nameMutation.reset();
						}}
						disabled={nameMutation.isPending}
						className="button button_small"
						>
							Отмена
						</button>}
						{userNameEditing.v && <button
							onClick={() =>
							{
								nameMutation.mutate({ name: name.v });
							}}
							disabled={nameMutation.isPending}
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
					{user.data?.roles.map(name => <div key={name}>{name}</div>)}
				</div>
				<div>
					<button className="button" onClick={passwordEditing.setT}>Сменить пароль</button>
				</div>
			</div>
			<ChangePasswordForm open={passwordEditing.v} close={passwordEditing.setF} />
		</Layout>
	);
}
