import { EventData } from "../../../api/dataTypes";
import useEvents from "../../../api/events";

export default function EventSelection({ setEvent }: EventSelectionProps)
{
	const events = useEvents();

	return (
		<>
			<h2>Выбор мероприятия</h2>
			{events.isError && "Произошла ошибка"}
			{events.isLoading && "Загрузка мероприятий"}
			{events.isSuccess && <>
				{events.data.map((e, i) =>
					<button className="button" key={i} onClick={() => setEvent(e)}>{e.name}</button>
				)}
			</>}
		</>
	);
}

interface EventSelectionProps
{
	setEvent: (eventData: EventData) => void
}