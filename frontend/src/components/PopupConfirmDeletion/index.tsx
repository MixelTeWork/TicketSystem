import { UseMutationResult } from "react-query";
import displayError from "../../utils/displayError";
import { Form } from "../Form";
import Popup, { PopupProps } from "../Popup";
import Spinner from "../Spinner";
import { useEffect } from "react";

export default function PopupConfirmDeletion<T, K>({ title, mutationFn, mutatateParams, itemId, onSuccess, open, close }: PopupConfirmDeletionProps<T, K>)
{
	const mutation = mutationFn(itemId, (item: any) =>
	{
		close?.();
		onSuccess?.(item);
	});

	useEffect(() =>
	{
		if (!open)
			mutation.reset();
		// eslint-disable-next-line
	}, [open]);

	return (
		<Popup open={open} close={close} title={title}>
			{displayError(mutation)}
			{mutation.isLoading && <Spinner />}
			<Form onSubmit={() =>
			{
				mutation.mutate(mutatateParams!);
			}}>
				<h1>Вы уверены?</h1>
				<button type="submit" className="button button_small">Подтвердить</button>
			</Form>
		</Popup>
	);
}

interface PopupConfirmDeletionProps<T, K> extends PopupProps
{
	mutationFn: (itemId: number | string, onSuccess: (item: T | void) => void) => UseMutationResult<T, any, K, any>,
	mutatateParams?: K,
	itemId: number | string,
	title: string,
	onSuccess?: (item: T) => void,
}
