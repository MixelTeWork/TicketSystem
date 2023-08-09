import { Link } from "react-router-dom";
import hasPermission from "../../api/operations";
import useUser from "../../api/user";
import Layout from "../../components/Layout";

export default function IndexPage()
{
	const user = useUser();

	return (
		<Layout centered gap="1em">
			{hasPermission(user, "page_scanner") && <Link to="/scanner" className="button">Сканер</Link>}
			{hasPermission(user, "page_events") && <Link to="/events" className="button">Мероприятия</Link>}
			{hasPermission(user, "page_staff") && <Link to="/staff" className="button">Сотрудники</Link>}
		</Layout>
	);
}
