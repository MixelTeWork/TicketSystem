import { UseMutationResult } from "react-query";
import displayError from "../../utils/displayError";
import { Form } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { useEffect } from "react";

export default function PopupConfirmDeletion<T>({ title, mutationFn, itemId, onSuccess, open, close }: PopupConfirmDeletionProps<T>)
{
	const mutation = mutationFn(itemId, (item) =>
	{
		close?.();
		onSuccess?.(item);
	});

	useEffect(() =>
	{
		if (!open)
			mutation.reset();
	}, [open]);

	return (
		<Popup open={open} close={close} title={title}>
			{displayError(mutation)}
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

interface PopupConfirmDeletionProps<T> extends PopupProps
{
	mutationFn: (itemId: number | string, onSuccess: (item: T) => void) => UseMutationResult<T, any, void, any>,
	itemId: number | string,
	title: string,
	onSuccess?: (item: T) => void,
}
