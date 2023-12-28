import { useState } from "react";
import { useHasPermission } from "../../api/operations";
import { useMutationDeleteStaff, useMutationResetStaffPassword, useStaff } from "../../api/staff";
import Layout from "../../components/Layout";
import { useTitle } from "../../utils/useTtile";
import styles from "./styles.module.css"
import CreateStaffForm from "../../components/create/CreateStaffForm";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";
import { useManagers, useMutationDeleteManager } from "../../api/managers";
import CreateManagerForm from "../../components/create/CreateManagerForm";

export default function ManagersPage()
{
	useTitle("Организаторы");
	const [createFormOpen, setCreateFormOpen] = useState(false);
	const [deletionManager, setDeletionManager] = useState(-1);
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
					<button className="button button_danger button_small" onClick={() => setDeletionManager(v.id)}>Удалить</button>
				</div>
			</div>)}
			{useHasPermission("add_manager") &&
				<div className="space_between">
					<span></span>
					<button className="button" onClick={() => setCreateFormOpen(true)}>Добавить</button>
				</div>
			}
			<CreateManagerForm open={createFormOpen} close={() => setCreateFormOpen(false)} />
			<PopupConfirmDeletion itemId={deletionManager} title="Удаление организатора" mutationFn={useMutationDeleteManager} open={deletionManager >= 0} close={() => setDeletionManager(-1)} />
		</Layout>
	);
}
