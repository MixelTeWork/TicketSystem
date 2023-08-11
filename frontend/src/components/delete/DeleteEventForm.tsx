import { Form } from "../Form";
import Popup, { PopupProps } from "../Popup";
import { useMutationDeleteEvent } from "../../api/events";
import Spinner from "../Spinner";
import { useNavigate } from "react-router-dom";

export default function DeleteEventForm({ eventId, open, close }: EditEventFormProps)
{
	const navigate = useNavigate()
	const mutation = useMutationDeleteEvent(eventId, () =>
	{
		close?.();
		navigate("/events");
	});

	return (
		<Popup open={open} close={close} title="Удаление меропрятия">
			{mutation.isError && <h3 style={{ color: "tomato", textAlign: "center" }}>Ошибка</h3>}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				mutation.mutate();
			}}>
				<h1>Вы уверены?</h1>
				<button type="submit">Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface EditEventFormProps extends PopupProps
{
	eventId: number | string,
}
