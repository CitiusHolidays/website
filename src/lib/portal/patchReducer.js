"use client";

import { useReducer, useState } from "react";
import { isRuntimeFunction } from "../runtimeValues";

function resolveInitial(initialStateOrFactory) {
  return isRuntimeFunction(initialStateOrFactory) ? initialStateOrFactory() : initialStateOrFactory;
}

export function usePatchReducer(initialStateOrFactory) {
  const [initialState] = useState(() => resolveInitial(initialStateOrFactory));
  const [state, dispatch] = useReducer((current, action) => {
    switch (action.type) {
      case "patch":
        return { ...current, ...action.patch };
      case "reset":
        return isRuntimeFunction(action.next) ? action.next() : { ...initialState };
      default:
        return current;
    }
  }, initialState);

  const patch = (patchValue) => dispatch({ patch: patchValue, type: "patch" });
  const reset = (next) =>
    dispatch({
      next: next ? () => resolveInitial(next) : undefined,
      type: "reset",
    });

  return [state, patch, reset, dispatch];
}
