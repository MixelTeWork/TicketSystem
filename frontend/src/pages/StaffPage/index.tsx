import useStateBool from "../../utils/useStateBool";
import useStateObj from "../../utils/useStateObj";
import { useHasPermission } from "../../api/operations";
import { useMutationDeleteStaff, useMutationResetStaffPassword, useStaff } from "../../api/staff";
import Layout from "../../components/Layout";
import { useTitle } from "../../utils/useTitle";
import styles from "./styles.module.css";
import CreateStaffForm from "../../components/create/CreateStaffForm";
import PopupConfirmDeletion from "../../components/PopupConfirmDeletion";
import Spinner from "../../components/Spinner";
import displayError from "../../utils/displayError";

export default function StaffPage()
{
	useTitle("Сотрудники");
	const createFormOpen = useStateBool(false);
	const deletionStaff = useStateObj(-1);
	const resetPasswordStaff = useStateObj(-1);
	const staff = useStaff();

	return (
		<Layout centeredPage gap={8}>
			<h1>Сотрудники</h1>
			{staff.isLoading && <Spinner/>}
			{displayError(staff)}
			{staff.data?.length == 0 && <h2>У вас нет сотрудников</h2>}
			{staff.data?.map(v => <div className={styles.user} key={v.id}>
				<input type="checkbox" className={styles.toggleInp} id={`user${v.id}`} />
				<label className={styles.title} htmlFor={`user${v.id}`}>
					<div>{v.name}</div>
					<div>
						<span>{v.roles.join(", ")}</span>
						<div className={styles.toggle}></div>
					</div>
				</label>
				<div className={styles.userInfo}>
					<div>Логин: {v.login}</div>
					<div>
						<span>Пароль: </span>
						{v.password || <button className="button button_light button_small" onClick={() => resetPasswordStaff.set(v.id)}>Сбросить пароль</button>}
					</div>
					<div className="space_between">
						<span></span>
						<button className="button button_danger button_small" onClick={() => deletionStaff.set(v.id)}>Уволить</button>
					</div>
				</div>
			</div>)}
			{useHasPermission("add_staff") &&
				<div className="space_between">
					<span></span>
					<button className="button" onClick={createFormOpen.setT}>Добавить</button>
				</div>
			}
			<CreateStaffForm open={createFormOpen.v} close={createFormOpen.setF} />
			<PopupConfirmDeletion itemId={deletionStaff.v} title="Увольнение сотрудника" mutationFn={useMutationDeleteStaff} open={deletionStaff.v >= 0} close={() => deletionStaff.set(-1)} />
			<PopupConfirmDeletion itemId={resetPasswordStaff.v} title="Сброс пароля сотрудника" mutationFn={useMutationResetStaffPassword} open={resetPasswordStaff.v >= 0} close={() => resetPasswordStaff.set(-1)} />
		</Layout>
	);
}
