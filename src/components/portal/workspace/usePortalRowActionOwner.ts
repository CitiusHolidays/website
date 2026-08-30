"use client";

import { useEffect, useRef, useState } from "react";

interface RunPortalRowActionInput {
  action: () => Promise<void>;
  actionKey: string;
  rowId: string;
  trigger: HTMLButtonElement;
}

export function usePortalRowActionOwner() {
  const ownedRowsRef = useRef(new Map<string, string>());
  const mountedRef = useRef(true);
  const [pendingByRow, setPendingByRow] = useState<Record<string, string>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ownedRowsRef.current.clear();
    };
  }, []);

  const pendingActionForRow = (rowId: string) => pendingByRow[rowId] ?? null;

  const runAction = ({ action, actionKey, rowId, trigger }: RunPortalRowActionInput) => {
    if (ownedRowsRef.current.has(rowId)) {
      return Promise.resolve(false);
    }
    ownedRowsRef.current.set(rowId, actionKey);
    setPendingByRow((current) => ({ ...current, [rowId]: actionKey }));

    const finish = (failed: boolean) => {
      if (ownedRowsRef.current.get(rowId) !== actionKey) {
        return false;
      }
      ownedRowsRef.current.delete(rowId);
      if (!mountedRef.current) {
        return false;
      }
      setPendingByRow((current) => {
        const next = { ...current };
        delete next[rowId];
        return next;
      });
      if (failed) {
        requestAnimationFrame(() => {
          if (trigger.isConnected && !trigger.disabled) {
            trigger.focus({ preventScroll: true });
          }
        });
      }
      return !failed;
    };

    return Promise.resolve()
      .then(action)
      .then(
        () => finish(false),
        () => finish(true)
      );
  };

  return { pendingActionForRow, runAction };
}
