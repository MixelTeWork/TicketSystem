import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useEffect } from "react";
import useStateObj, { useStateObjNull } from "./useStateObj";
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


test("nullable wrapper retains its stable reset helper", () =>
{
	const { result, rerender } = renderHook(() => useStateObjNull<number>());
	const initial = result.current;
	rerender();
	expect(result.current).toBe(initial);
	act(() => result.current.set(3));
	expect(result.current.v).toBe(3);
	expect(result.current.setNull).toBe(initial.setNull);
	act(() => result.current.setNull());
	expect(result.current.v).toBeNull();
});
