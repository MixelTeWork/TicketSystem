import { Link } from "react-router-dom";
import { useEvents } from "../../api/events";
import Layout from "../../components/Layout";
import Spinner from "../../components/Spinner";
import { dateToString } from "../../utils/dates";
import displayError from "../../utils/displayError";
import { useTitle } from "../../utils/useTitle";

export default function ScannerEventsPage()
{
	useTitle("Сканер билетов");
	const events = useEvents({ staleTime: 0 });
	return <Layout backLink="/" centeredPage gap="1rem">
		<h1>Сканер билетов</h1>
		{events.isLoading && <Spinner />}
		{displayError(events)}
		{!events.isError && events.data?.length == 0 && <div>Нет назначенных мероприятий для сканирования. Обратитесь к организатору.</div>}
		{!events.isError && events.data?.slice().sort((a, b) => b.date.getTime() - a.date.getTime()).map(event =>
			<Link to={`/scanner/${event.id}`} className="button button_large space_between" key={event.id}>
				<span>{event.name}</span>
				<span>{dateToString(event.date)}</span>
			</Link>,
		)}
	</Layout>;
}
