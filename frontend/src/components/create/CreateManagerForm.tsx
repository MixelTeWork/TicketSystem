import type { PopupProps } from "../Popup";
import { useMutationNewManager } from "../../api/managers";
import CreateUserForm from "./CreateUserForm";

export default function CreateManagerForm(props: PopupProps)
{
	return <CreateUserForm {...props} title="Добавление организатора" credentialsTitle="Данные организатора" useCreate={useMutationNewManager} />;
}
