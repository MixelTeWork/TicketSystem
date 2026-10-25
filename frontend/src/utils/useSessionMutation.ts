import { useMutation, useQueryClient, type MutateOptions, type UseMutationOptions } from "@tanstack/react-query";
import { useCallback } from "react";
import { getSessionVersion } from "../api/session";

export class SessionChangedError extends Error
{
	constructor()
	{
		super("Сессия изменилась");
		this.name = "SessionChangedError";
	}
}

interface SessionVariables<TData>
{
	data: TData;
	version: number;
}

type SessionMutationOptions<TResult, TData> = Omit<UseMutationOptions<TResult, Error, TData, number>, "onMutate"> & {
	mutationFn: NonNullable<UseMutationOptions<TResult, Error, TData>["mutationFn"]>;
};

export function useSessionMutation<TResult, TData>(options: SessionMutationOptions<TResult, TData>)
{
	const client = useQueryClient();
	const isCurrent = (version: number) => version == getSessionVersion(client);
	const mutation = useMutation<TResult, Error, SessionVariables<TData>, number>({
		...options,
		meta: { ...options.meta, sessionGuarded: true },
		onMutate: variables => variables.version,
		mutationFn: async ({ data, version }, context) =>
		{
			if (!isCurrent(version)) throw new SessionChangedError();
			try
			{
				const result = await options.mutationFn(data, context);
				if (!isCurrent(version)) throw new SessionChangedError();
				return result;
			}
			catch (error)
			{
				if (!isCurrent(version)) throw new SessionChangedError();
				throw error;
			}
		},
		onSuccess: (result, { data, version }, _onMutateResult, context) =>
		{
			if (isCurrent(version)) return options.onSuccess?.(result, data, version, context);
		},
		onError: (error, { data, version }, _onMutateResult, context) =>
		{
			if (isCurrent(version) && !(error instanceof SessionChangedError))
				return options.onError?.(error, data, version, context);
		},
		onSettled: (result, error, { data, version }, _onMutateResult, context) =>
		{
			if (isCurrent(version)) return options.onSettled?.(result, error, data, version, context);
		},
	});
	const { mutate: run, mutateAsync: runAsync } = mutation;

	const bindOptions = useCallback((version: number, callbacks?: MutateOptions<TResult, Error, TData, number>): MutateOptions<TResult, Error, SessionVariables<TData>, number> => ({
		onSuccess: (result, variables, onMutateResult, context) =>
		{
			if (version == getSessionVersion(client)) callbacks?.onSuccess?.(result, variables.data, onMutateResult, context);
		},
		onError: (error, variables, onMutateResult, context) =>
		{
			if (version == getSessionVersion(client) && !(error instanceof SessionChangedError))
				callbacks?.onError?.(error, variables.data, onMutateResult, context);
		},
		onSettled: (result, error, variables, onMutateResult, context) =>
		{
			if (version == getSessionVersion(client)) callbacks?.onSettled?.(result, error, variables.data, onMutateResult, context);
		},
	}), [client]);
	const mutate = useCallback((data: TData, callbacks?: MutateOptions<TResult, Error, TData, number>) =>
	{
		const version = getSessionVersion(client);
		run({ data, version }, bindOptions(version, callbacks));
	}, [client, run, bindOptions]);
	const mutateAsync = useCallback((data: TData, callbacks?: MutateOptions<TResult, Error, TData, number>) =>
	{
		const version = getSessionVersion(client);
		return runAsync({ data, version }, bindOptions(version, callbacks));
	}, [client, runAsync, bindOptions]);

	if (mutation.isIdle) return { ...mutation, variables: undefined, mutate, mutateAsync };
	return { ...mutation, variables: mutation.variables.data, mutate, mutateAsync };
}
