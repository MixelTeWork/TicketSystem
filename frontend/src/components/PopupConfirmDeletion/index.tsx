import { type UseMutationResult } from "@tanstack/react-query";
import { useEffect } from "react";
import displayError from "../../utils/displayError";
import { Form } from "../Form";
import Popup, { type PopupProps } from "../Popup";
import Spinner from "../Spinner";

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
			{mutation.isPending && <Spinner />}
			<Form disabled={mutation.isPending} onSubmit={() =>
			{
				mutation.mutate(mutatateParams!);
			}}>
				<h1>Вы уверены?</h1>
				<button type="submit" className="button button_small" disabled={mutation.isPending}>Подтвердить</button>
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
