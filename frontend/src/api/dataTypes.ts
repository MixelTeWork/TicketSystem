export class ApiError extends Error
{
	constructor(message: string, public readonly status?: number, public readonly code?: string, public readonly details?: unknown)
	{
		super(message);
		this.name = "ApiError";
	}
}

export type Modify<T, R> = Omit<T, keyof R> & R;
export interface ResponseMsg
{
	msg: string,
	code?: string,
	details?: unknown,
}
