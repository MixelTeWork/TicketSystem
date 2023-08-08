import { Link } from "react-router-dom";
import hasPermission from "../../api/operations";
import useUser from "../../api/user";
import Layout from "../../components/Layout";
import styles from "./styles.module.css"

export default function IndexPage()
{
	const user = useUser();

	return (
		<Layout centered gap="1em">
			{hasPermission(user, "page_scanner") && <Link to="/scanner" className={styles.link}>Сканер</Link>}
			{hasPermission(user, "page_events") && <Link to="/events" className={styles.link}>Мероприятия</Link>}
		</Layout>
	);
}
