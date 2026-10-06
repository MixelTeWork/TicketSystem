import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEffect } from "react";
import useStateObj, { useStateList, useStateObjNull } from "./useStateObj";
import useStateBool from "./useStateBool";

afterEach(cleanup);

test("keeps the lazy initializer and setter stable while batching functional updates", () =>
{
	const initial = vi.fn(() => 0);
	const { result, rerender } = renderHook(() => useStateObj(initial));
	const initialState = result.current;
	rerender();
	expect(result.current).toBe(initialState);
	const set = result.current.set;
	act(() =>
	{
		set(previous => previous + 1);
		set(previous => previous + 1);
	});
	rerender();
	expect(result.current.v).toBe(2);
	expect(result.current).not.toBe(initialState);
	expect(result.current.set).toBe(set);
	expect(initial).toHaveBeenCalledOnce();
});

test("reports previous and next values while allowing silent updates", () =>
{
	const onSet = vi.fn();
	const { result } = renderHook(() => useStateObj<number>(0, onSet));
	act(() => result.current.setSilent(previous => previous + 2));
	expect(result.current.v).toBe(2);
	expect(onSet).not.toHaveBeenCalled();
	act(() => result.current.set(previous => previous + 1));
	expect(result.current.v).toBe(3);
	expect(onSet).toHaveBeenCalledWith(3, 2);
});

test("boolean helpers support toggling multiple times in a batch", () =>
{
	const { result, rerender } = renderHook(() => useStateBool(false));
	const initialState = result.current;
	rerender();
	expect(result.current).toBe(initialState);
	act(() => result.current.setT());
	expect(result.current.v).toBe(true);
	expect(result.current).not.toBe(initialState);
	expect(result.current.setT).toBe(initialState.setT);
	expect(result.current.setF).toBe(initialState.setF);
	expect(result.current.toggle).toBe(initialState.toggle);
	act(() =>
	{
		result.current.toggle();
		result.current.toggle();
	});
	expect(result.current.v).toBe(true);
	act(() => result.current.setF());
	expect(result.current.v).toBe(false);
});

test("an effect depending on the wrapper runs when the value changes, not on unrelated renders", () =>
{
	const effect = vi.fn();
	const { result, rerender } = renderHook(() =>
	{
		const state = useStateObj(0);
		useEffect(() => { effect(state.v); }, [state]);
		return state;
	});
	rerender();
	expect(effect).toHaveBeenCalledTimes(1);
	act(() => result.current.set(1));
	expect(effect).toHaveBeenCalledTimes(2);
	expect(effect).toHaveBeenLastCalledWith(1);
	act(() => result.current.set(1));
	rerender();
	expect(effect).toHaveBeenCalledTimes(2);
});

test("memoized setters use the latest onSet callback and keep silent updates silent", () =>
{
	const first = vi.fn();
	const second = vi.fn();
	const { result, rerender } = renderHook(({ onSet }) => useStateObj<number>(0, onSet), { initialProps: { onSet: first } });
	const initialState = result.current;
	rerender({ onSet: first });
	expect(result.current).toBe(initialState);
	rerender({ onSet: second });
	expect(result.current.set).not.toBe(initialState.set);
	expect(result.current.setSilent).toBe(initialState.setSilent);
	act(() => result.current.set(1));
	expect(first).not.toHaveBeenCalled();
	expect(second).toHaveBeenCalledWith(1, 0);
	second.mockClear();
	act(() => result.current.setSilent(2));
	expect(result.current.v).toBe(2);
	expect(second).not.toHaveBeenCalled();
});

test("nullable and list wrappers keep their helpers stable across value changes", () =>
{
	const { result, rerender } = renderHook(() => ({ nullable: useStateObjNull<number>(), list: useStateList<number>() }));
	const initial = result.current;
	rerender();
	expect(result.current.nullable).toBe(initial.nullable);
	expect(result.current.list).toBe(initial.list);
	act(() =>
	{
		result.current.nullable.set(3);
		result.current.list.push(1);
		result.current.list.push(2);
		result.current.list.setI(0, 3);
	});
	expect(result.current.nullable.v).toBe(3);
	expect(result.current.list.v).toEqual([3, 2]);
	expect(result.current.nullable.setNull).toBe(initial.nullable.setNull);
	expect(result.current.list.push).toBe(initial.list.push);
	expect(result.current.list.pop).toBe(initial.list.pop);
	expect(result.current.list.setI).toBe(initial.list.setI);
	act(() =>
	{
		result.current.nullable.setNull();
		result.current.list.pop();
	});
	expect(result.current.nullable.v).toBeNull();
	expect(result.current.list.v).toEqual([3]);
});
