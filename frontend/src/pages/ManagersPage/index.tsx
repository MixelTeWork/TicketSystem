import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useHasPermission } from "../../api/operations";
import Layout from "../../components/Layout";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import { useManagers, useMutationDeleteManager } from "../../api/managers";
import CreateManagerForm from "../../components/create/CreateManagerForm";
import useUser from "../../api/user";

export default function ManagersPage()
{
	useTitle("Организаторы");
	const createFormOpen = useStateBool(false);
	const deletionManager = useStateObj(-1);
	const user = useUser();
	const managers = useManagers();

	return (
		<Layout centeredPage gap={8}>
			<h1>Организаторы</h1>
			{managers.isLoading && <Spinner />}
			{displayError(managers)}
			{managers.data?.length == 0 && <h2>Организаторы отсутствуют</h2>}
			{managers.data?.map(v => <div className={styles.user + " space_between"} key={v.id}>
				<div>
					<span>{v.name}</span>
					<span className={styles.login}>{v.login}</span>
				</div>
				<div>
					<span>{v.roles.join(", ")}</span>
					{v.id != user.data?.id &&
						<button className="button button_danger button_small" onClick={() => deletionManager.set(v.id)}>Удалить</button>
					}
					{v.id == user.data?.id &&
						<span className={styles.userTag}>Вы</span>
					}
				</div>
			</div>)}
			{useHasPermission("add_manager") &&
				<div className="space_between">
					<span></span>
					<button className="button" onClick={createFormOpen.setT}>Добавить</button>
				</div>
			}
			<CreateManagerForm open={createFormOpen.v} close={createFormOpen.setF} />
			<PopupConfirmDeletion itemId={deletionManager.v} title="Удаление организатора" mutationFn={useMutationDeleteManager} open={deletionManager.v >= 0} close={() => deletionManager.set(-1)} />
		</Layout>
	);
}
