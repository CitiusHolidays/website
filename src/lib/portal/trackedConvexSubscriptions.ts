import type {
  OptionalRestArgsOrSkip,
  PaginatedQueryArgs,
  PaginatedQueryReference,
  UsePaginatedQueryReturnType,
} from "convex/react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { type FunctionReference, getFunctionName } from "convex/server";
import { convexToJson } from "convex/values";
import { useEffect, useId, useSyncExternalStore } from "react";

const SAFE_FUNCTION_NAME = /^[A-Za-z0-9_/-]+:[A-Za-z0-9_-]+$/;
const EMPTY_SUMMARY = Object.freeze({
  duplicateSubscriptions: 0,
  logicalSubscriptions: 0,
  subscriptions: Object.freeze([]),
});

interface SubscriptionRecord {
  name: string;
  signature: string;
}

export interface PortalSubscriptionSummary {
  duplicateSubscriptions: number;
  logicalSubscriptions: number;
  subscriptions: readonly string[];
}

const activeSubscriptions = new Map<string, SubscriptionRecord>();
const listeners = new Set<() => void>();
let summary: PortalSubscriptionSummary = EMPTY_SUMMARY;

function publish() {
  const records = [...activeSubscriptions.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const exactSubscriptions = new Set(records.map((record) => `${record.name}:${record.signature}`));
  summary = Object.freeze({
    duplicateSubscriptions: records.length - exactSubscriptions.size,
    logicalSubscriptions: records.length,
    subscriptions: Object.freeze(records.map((record) => record.name)),
  });
  for (const listener of listeners) {
    listener();
  }
}

function normalizePortalSubscriptionName(reference: FunctionReference<"query">) {
  const functionName = getFunctionName(reference);
  if (!SAFE_FUNCTION_NAME.test(functionName)) {
    throw new Error("Portal subscription instrumentation requires a static Convex function name");
  }
  return functionName.replace(/[/:]/g, ".");
}

export function registerPortalSubscription(
  instanceId: string,
  record: SubscriptionRecord
): () => void {
  const current = activeSubscriptions.get(instanceId);
  if (current?.name === record.name && current.signature === record.signature) {
    return () => unregisterPortalSubscription(instanceId);
  }
  activeSubscriptions.set(instanceId, record);
  publish();
  return () => unregisterPortalSubscription(instanceId);
}

function unregisterPortalSubscription(instanceId: string) {
  if (activeSubscriptions.delete(instanceId)) {
    publish();
  }
}

export function resetPortalSubscriptionRegistry() {
  activeSubscriptions.clear();
  publish();
}

export function getPortalSubscriptionSummary(): PortalSubscriptionSummary {
  return summary;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePortalSubscriptionSummary() {
  return useSyncExternalStore(subscribe, getPortalSubscriptionSummary, () => EMPTY_SUMMARY);
}

async function digestSubscriptionArguments(serializedArgs: string) {
  const bytes = new TextEncoder().encode(serializedArgs);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function useSubscriptionRegistration<Query extends FunctionReference<"query">, Arguments>(
  query: Query,
  args: Arguments
) {
  const instanceId = useId();
  let name: null | string = null;
  try {
    name = normalizePortalSubscriptionName(query);
  } catch {
    // Instrumentation never changes query execution; the source inventory owns fail-closed coverage.
  }
  const active = args !== "skip";
  let serializedArgs: null | string = null;
  if (active && name) {
    try {
      serializedArgs = JSON.stringify(
        // SAFETY: Convex query arguments are validator-accepted Convex values before serialization.
        convexToJson((args ?? {}) as Parameters<typeof convexToJson>[0])
      );
    } catch {
      // Instrumentation cannot block a query even if a test double supplies invalid arguments.
    }
  }

  useEffect(() => {
    if (!(active && name && serializedArgs !== null)) {
      return;
    }
    let mounted = true;
    let unregister: () => void = () => undefined;
    void digestSubscriptionArguments(`${name}\0${serializedArgs}`)
      .then((signature) => {
        if (mounted) {
          unregister = registerPortalSubscription(instanceId, { name, signature });
        }
      })
      .catch(() => {
        // Missing browser crypto only disables instrumentation; query execution is unchanged.
      });
    return () => {
      mounted = false;
      unregister();
    };
  }, [active, instanceId, name, serializedArgs]);
}

export function useTrackedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query["_returnType"] | undefined {
  useSubscriptionRegistration(query, args[0]);
  return useQuery(query, ...args);
}

export function useTrackedPaginatedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | "skip",
  options: { initialNumItems: number }
): UsePaginatedQueryReturnType<Query> {
  useSubscriptionRegistration(query, args);
  return usePaginatedQuery(query, args, options);
}
