import { ReactNode } from "react";
import { UseMutationResult, UseQueryResult } from "react-query";
import { ApiError } from "../api/dataTypes";

export default function displayError(requestRes: UseMutationResult<any, any, any, any> | UseQueryResult<any, any>, render?: (error: string) => ReactNode, messageFormater?: (error: string) => string)
{
	if (!requestRes.isError) return null;

	const error = requestRes.error instanceof ApiError ? requestRes.error.message : "Ошибка";
	const msg = messageFormater ? messageFormater(error) : error;

	const renderer = render || defaultRender;
	return renderer(msg);
}

function defaultRender(error: string)
{
	return (
		<h3 style={{ color: "tomato", textAlign: "center" }}>{error}</h3>
	)
}
