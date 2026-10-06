import type { PopupProps } from "../Popup";
import { useMutationNewStaff } from "../../api/staff";
import CreateUserForm from "./CreateUserForm";

export default function CreateStaffForm(props: PopupProps)
{
	return <CreateUserForm {...props} title="Добавление сотрудника" credentialsTitle="Данные сотрудника" useCreate={useMutationNewStaff} />;
}
