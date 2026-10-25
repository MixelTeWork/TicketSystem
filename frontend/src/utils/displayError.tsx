import { type ReactNode } from "react";
import { ApiError } from "../api/dataTypes";

export default function displayError(requestRes: { isError: boolean; error: unknown }, render?: (error: string) => ReactNode, messageFormater?: (error: string) => string)
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
		<p className="danger-text" role="alert">{error}</p>
	);
}
