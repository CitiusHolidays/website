"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { formatDisplayDate } from "@/lib/formatDate";
import { useTrackedQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { isRuntimeString } from "@/lib/runtimeValues";
import { newInviteToken } from "./customerInviteTokens";

const BATCH = 50;

interface CreatedLink {
  fullName: string;
  url: string;
}

const blockedLabel = {
  age_not_recorded: "Age not recorded: mark them adult to invite",
  minor: "Minor, seen by their guardian",
} as const;

const accessLabel = {
  invited: "Invited",
  joined: "Using the app",
  none: "Not invited",
} as const;

function errorText(cause: unknown) {
  return cause instanceof ConvexError && isRuntimeString(cause.data)
    ? cause.data
    : "The invites could not be created. Try again.";
}

/**
 * Customer app invites for this trip (ADR 0020). Staff tick adult travellers and create one
 * single-use link each; the browser makes each token and sends only its hash, so the links are
 * shown here once, to copy into WhatsApp, SMS or email. Minors never get a link: their guardians
 * see them in the app.
 */
export function JobCardCustomerInvites({ jobCardId }: { jobCardId: string }) {
  const [referenceNow] = useState(() => Date.now());
  const data = useTrackedQuery(api.customerTripInvites.listForJobCard, { jobCardId, referenceNow });
  const createInvites = useMutation(api.customerTripInvites.createInvites);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [links, setLinks] = useState<CreatedLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  // Only travellers recorded as adults can be invited; unknown age is never treated as adult.
  const adults = useMemo(
    () => data?.rows.filter((row) => row.inviteBlockedReason === null) ?? [],
    [data]
  );
  if (!data || data.rows.length === 0) {
    return null;
  }
  const joined = data.rows.filter((row) => row.appAccess === "joined").length;
  const toggle = (travellerId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(travellerId)) {
        next.delete(travellerId);
      } else {
        next.add(travellerId);
      }
      return next;
    });
  };
  const selectNotInvited = () =>
    setSelected(
      new Set(adults.filter((row) => row.appAccess === "none").map((r) => r.travellerId))
    );
  const create = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    const chosen = adults.filter((row) => selected.has(row.travellerId));
    const made: CreatedLink[] = [];
    try {
      for (let start = 0; start < chosen.length; start += BATCH) {
        const slice = chosen.slice(start, start + BATCH);
        // biome-ignore lint/performance/noAwaitInLoops: batches go one at a time so a failure stops the rest
        const tokens = await Promise.all(slice.map(() => newInviteToken()));
        await createInvites({
          channel: "link",
          invites: slice.map((row, index) => ({
            tokenHash: tokens[index]?.hash ?? "",
            travellerId: row.travellerId,
          })),
          jobCardId,
        });
        slice.forEach((row, index) => {
          made.push({
            fullName: row.fullName,
            url: `${window.location.origin}/app/invite#token=${tokens[index]?.token ?? ""}`,
          });
        });
      }
      setLinks(made);
      setSelected(new Set());
      setStatus(`${made.length} invite link${made.length === 1 ? "" : "s"} ready to send.`);
    } catch (cause) {
      setLinks(made);
      setError(errorText(cause));
    }
    setBusy(false);
  };
  const copyAll = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(
        links.map((row) => `${row.fullName}: ${row.url}`).join("\n")
      );
      setStatus("Links copied.");
    } catch {
      // The browser can refuse clipboard access; the links stay listed below to copy by hand.
      setStatus("");
      setError("The links could not be copied. Copy them from the list instead.");
    }
  };
  return (
    <section
      aria-labelledby="job-card-customer-invites"
      className="rounded-lg border border-brand-border bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-prose">
          <h2 className="font-heading text-base text-brand-dark" id="job-card-customer-invites">
            Customer app invites
          </h2>
          <p className="mt-1 text-brand-muted text-sm">
            {joined} of {adults.length} adults use the Citius Holidays app. The trip shows in the
            app only while the app pilot is on. Each link works once and expires after 30 days.
          </p>
        </div>
        {data.canInvite ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button onClick={selectNotInvited} type="button" variant="outline">
              Select not invited
            </Button>
            <Button
              disabled={busy || selected.size === 0}
              loading={busy}
              onClick={create}
              type="button"
            >
              Create {selected.size || ""} invite link{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-brand-border">
        {data.rows.map((row) => (
          <li className="flex items-center gap-3 py-2 text-sm" key={row.travellerId}>
            {data.canInvite && row.inviteBlockedReason === null ? (
              <input
                aria-label={`Select ${row.fullName}`}
                checked={selected.has(row.travellerId)}
                onChange={() => toggle(row.travellerId)}
                type="checkbox"
              />
            ) : (
              <span aria-hidden="true" className="inline-block w-[13px]" />
            )}
            <span className="min-w-0 flex-1 truncate text-brand-dark">{row.fullName}</span>
            <span className="text-brand-muted">
              {row.inviteBlockedReason
                ? blockedLabel[row.inviteBlockedReason]
                : accessLabel[row.appAccess]}
              {row.invite && row.appAccess === "invited"
                ? ` until ${formatDisplayDate(row.invite.expiresAt)}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      {links.length > 0 ? (
        <div className="mt-4 rounded-lg border border-brand-border bg-brand-light p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-brand-dark text-sm">
              Send each traveller their own link. These links are shown only now.
            </p>
            <Button onClick={copyAll} type="button" variant="outline">
              Copy all
            </Button>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {links.map((row) => (
              <li className="break-all" key={row.url}>
                <span className="font-semibold text-brand-dark">{row.fullName}:</span>{" "}
                <span className="text-brand-muted">{row.url}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-2 text-brand-muted text-sm empty:hidden" role="status">
        {status}
      </p>
      {error ? (
        <p className="mt-2 text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
