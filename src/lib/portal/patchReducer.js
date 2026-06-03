"use client";

import { useReducer, useState } from "react";

function resolveInitial(initialStateOrFactory) {
  return typeof initialStateOrFactory === "function"
    ? initialStateOrFactory()
    : initialStateOrFactory;
}

export function usePatchReducer(initialStateOrFactory) {
  const [initialState] = useState(() => resolveInitial(initialStateOrFactory));
  const [state, dispatch] = useReducer((current, action) => {
    switch (action.type) {
      case "patch":
        return { ...current, ...action.patch };
      case "reset":
        return typeof action.next === "function" ? action.next() : { ...initialState };
      default:
        return current;
    }
  }, initialState);

  const patch = (patchValue) => dispatch({ type: "patch", patch: patchValue });
  const reset = (next) =>
    dispatch({
      type: "reset",
      next: next ? () => resolveInitial(next) : undefined,
    });

  return [state, patch, reset, dispatch];
}
