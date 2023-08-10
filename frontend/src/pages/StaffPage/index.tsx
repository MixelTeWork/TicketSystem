import Layout from "../../components/Layout";
import { useTitle } from "../../utils/useTtile";
import styles from "./styles.module.css"

export default function StaffPage()
{
	useTitle("Сотрудники");
	
	return (
		<Layout centered>
			Тут будет страница настройки сотрудников
		</Layout>
	);
}
