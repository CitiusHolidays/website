"use client";

import { useReducer, useState } from "react";
import { isRuntimeFunction } from "../runtimeValues";

function resolveInitial(initialStateOrFactory) {
  return isRuntimeFunction(initialStateOrFactory) ? initialStateOrFactory() : initialStateOrFactory;
}

export function usePatchReducer(initialStateOrFactory) {
  const [initialState] = useState(() => resolveInitial(initialStateOrFactory));
  const [state, dispatch] = useReducer((current, action) => {
    const reducers = new Map([
      ["patch", () => ({ ...current, ...action.patch })],
      ["reset", () => (isRuntimeFunction(action.next) ? action.next() : { ...initialState })],
    ]);
    const reduce = reducers.get(action.type);
    return reduce ? reduce() : current;
  }, initialState);

  const patch = (patchValue) => dispatch({ patch: patchValue, type: "patch" });
  const reset = (next) =>
    dispatch({
      next: next ? () => resolveInitial(next) : undefined,
      type: "reset",
    });

  return [state, patch, reset, dispatch];
}
