import { ReactNode } from "react";
import { UseMutationResult, UseQueryResult } from "react-query";
import ApiError from "../api/apiError";

export default function displayError(requestRes: UseMutationResult<any, any, any, any> | UseQueryResult<any, any>, render?: (error: string) => ReactNode)
{
	if (!requestRes.isError) return null;

	const error = requestRes.error instanceof ApiError ? requestRes.error.message : "Ошибка";

	const renderer = render || defaultRender;
	return renderer(error);
}

function defaultRender(error: string)
{
	return (
		<h3 style={{ color: "tomato", textAlign: "center" }}>{error}</h3>
	)
}
