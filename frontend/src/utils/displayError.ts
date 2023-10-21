import { ReactNode } from "react";
import { UseMutationResult } from "react-query";
import ApiError from "../api/apiError";

export default function displayError(mutation: UseMutationResult<any, any, any, any>, render: (error: string) => ReactNode)
{
	if (!mutation.isError) return null;

	const error = mutation.error instanceof ApiError ? mutation.error.message : "Ошибка";

	return render(error);
}