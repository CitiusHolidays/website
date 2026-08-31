"use client";

import { ArrowDown, ArrowUp, RotateCcw, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { normalizeInboundEnquiryBrief } from "@/lib/contact/inboundIntentContract";
import {
  addDestinationToPlan,
  createEmptyDestinationPlan,
  DESTINATION_PLAN_STORAGE_KEY,
  DESTINATION_SHORTLIST_LIMIT,
  moveDestinationInPlan,
  prepareDestinationPlanHandoff,
  readDestinationPlan,
  removeDestinationFromPlan,
  resetDestinationPlan,
  saveDestinationPlan,
} from "@/lib/public/destinationPlan";
import { ConciergeContactHandoff } from "./ConciergeContactHandoff";
import EnquiryBriefFields, { createEmptyEnquiryBrief } from "./EnquiryBriefFields";

const PLAN_CHANGED_EVENT = "citius:destination-plan-changed";
const NOT_HYDRATED = "__citius_destination_plan_not_hydrated__";
const STORAGE_UNAVAILABLE = "__citius_destination_plan_storage_unavailable__";

function subscribeToDestinationPlan(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(PLAN_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PLAN_CHANGED_EVENT, callback);
  };
}

function destinationPlanSnapshot() {
  try {
    return window.localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

function serverDestinationPlanSnapshot() {
  return NOT_HYDRATED;
}

function notifyDestinationPlanChanged() {
  window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
}

function editableBrief(brief) {
  return createEmptyEnquiryBrief({
    ...brief,
    paxCount: brief.paxCount === undefined ? "" : String(brief.paxCount),
  });
}

function PlannerRecovery({ reset, status }) {
  const copy =
    status === "catalog-drift"
      ? "Your saved shortlist refers to an older destination catalogue. Reset it before making a new plan so outdated destinations are never sent."
      : "This browser's saved plan could not be read safely. Reset it to start a new local plan.";
  return (
    <section
      aria-labelledby="destination-plan-recovery-title"
      className="mx-auto mt-8 max-w-7xl rounded-3xl border border-amber-300 bg-amber-50 p-5"
    >
      <h3
        className="font-bold font-heading text-brand-dark text-xl"
        id="destination-plan-recovery-title"
      >
        Saved plan needs a reset
      </h3>
      <p className="mt-2 max-w-3xl text-amber-950 text-sm leading-6">{copy}</p>
      <button
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-dark px-5 font-semibold text-sm text-white focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
        onClick={reset}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={17} /> Reset saved plan
      </button>
    </section>
  );
}

function ShortlistItem({ destination, index, move, remove, shortlistLength }) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-2xl border border-brand-border bg-white p-3">
      <Image
        alt=""
        className="size-16 shrink-0 rounded-xl object-cover"
        height={64}
        src={destination.image || "/gallery/aboutus.webp"}
        width={64}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-brand-dark text-sm">{destination.name}</p>
        <p className="mt-0.5 text-brand-muted text-xs capitalize">{destination.region}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          aria-label={`Move ${destination.name} earlier`}
          className="inline-flex size-11 items-center justify-center rounded-full border border-brand-border text-brand-dark disabled:opacity-40"
          disabled={index === 0}
          onClick={() => move(destination.id, -1)}
          type="button"
        >
          <ArrowUp aria-hidden="true" size={17} />
        </button>
        <button
          aria-label={`Move ${destination.name} later`}
          className="inline-flex size-11 items-center justify-center rounded-full border border-brand-border text-brand-dark disabled:opacity-40"
          disabled={index === shortlistLength - 1}
          onClick={() => move(destination.id, 1)}
          type="button"
        >
          <ArrowDown aria-hidden="true" size={17} />
        </button>
        <button
          aria-label={`Remove ${destination.name} from shortlist`}
          className="inline-flex size-11 items-center justify-center rounded-full border border-red-200 text-red-700"
          onClick={() => remove(destination.id)}
          type="button"
        >
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div>
    </li>
  );
}

export function useDestinationShortlist() {
  const rawSnapshot = useSyncExternalStore(
    subscribeToDestinationPlan,
    destinationPlanSnapshot,
    serverDestinationPlanSnapshot
  );
  const [memoryPlan, setMemoryPlan] = useState(createEmptyDestinationPlan);
  const [storageFailed, setStorageFailed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const hydrated = rawSnapshot !== NOT_HYDRATED;
  const storageReadable = rawSnapshot !== STORAGE_UNAVAILABLE;
  const storageAvailable = storageReadable && !storageFailed;
  const result = useMemo(
    () => (hydrated && storageReadable ? readDestinationPlan(rawSnapshot) : null),
    [hydrated, rawSnapshot, storageReadable]
  );
  const plan = storageAvailable && result && "plan" in result ? result.plan : memoryPlan;

  const persist = (nextPlan) => {
    if (storageReadable) {
      try {
        saveDestinationPlan(window.localStorage, nextPlan);
        setStorageFailed(false);
        notifyDestinationPlanChanged();
        return true;
      } catch {
        setStorageFailed(true);
      }
    }
    setMemoryPlan(nextPlan);
    return false;
  };
  const add = (destination) => {
    if (result && !("plan" in result)) {
      setStatusMessage("Reset the saved plan before adding a destination.");
      return;
    }
    const nextPlan = addDestinationToPlan(plan, destination.id);
    if (nextPlan === plan) {
      setStatusMessage(
        plan.shortlist.length >= DESTINATION_SHORTLIST_LIMIT
          ? `Your shortlist can include up to ${DESTINATION_SHORTLIST_LIMIT} destinations.`
          : `${destination.name} is already saved.`
      );
      return;
    }
    const saved = persist(nextPlan);
    setStatusMessage(
      saved
        ? `${destination.name} saved to your browser-local shortlist.`
        : `${destination.name} kept in this open page because browser storage is unavailable.`
    );
  };
  const remove = (destinationId) => {
    const destination = plan.shortlist.find(({ id }) => id === destinationId);
    persist(removeDestinationFromPlan(plan, destinationId));
    setStatusMessage(`${destination?.name ?? "Destination"} removed from your shortlist.`);
  };
  const move = (destinationId, direction) => {
    persist(moveDestinationInPlan(plan, destinationId, direction));
    setStatusMessage("Shortlist order updated.");
  };
  const reset = () => {
    let clearedStoredPlan = false;
    if (storageReadable) {
      try {
        resetDestinationPlan(window.localStorage);
        clearedStoredPlan = true;
        setStorageFailed(false);
        notifyDestinationPlanChanged();
      } catch {
        setStorageFailed(true);
      }
    }
    setMemoryPlan(createEmptyDestinationPlan());
    setStatusMessage(
      clearedStoredPlan
        ? "Your browser-local destination plan was reset."
        : "The plan was cleared from this page, but browser storage could not be cleared. Clear this site's data to remove any older saved copy."
    );
  };

  return {
    add,
    loadStatus: storageAvailable ? (result?.status ?? "empty") : "storage-unavailable",
    move,
    persist,
    plan,
    remove,
    reset,
    setStatusMessage,
    statusMessage,
    storageAvailable,
  };
}

export default function DestinationShortlistPlanner({ destinations, shortlist }) {
  const {
    loadStatus,
    move,
    plan,
    persist,
    remove,
    reset,
    setStatusMessage,
    statusMessage,
    storageAvailable,
  } = shortlist;
  const [draft, setDraft] = useState(null);
  const [draftErrors, setDraftErrors] = useState({});
  const [handoff, setHandoff] = useState(null);
  const visibleDraft = draft ?? editableBrief(plan.draft);
  const planSignature = JSON.stringify(plan);
  const destinationsById = useMemo(
    () => new Map(destinations.map((destination) => [destination.id, destination])),
    [destinations]
  );
  const selectedDestinations = plan.shortlist
    .map(({ id }) => destinationsById.get(id))
    .filter(Boolean);
  const resetPlanner = () => {
    setDraft(null);
    setDraftErrors({});
    setHandoff(null);
    reset();
  };

  if (loadStatus === "catalog-drift" || loadStatus === "invalid") {
    return <PlannerRecovery reset={resetPlanner} status={loadStatus} />;
  }

  const validateDraft = () => {
    const result = normalizeInboundEnquiryBrief(visibleDraft, { allowPaxString: true });
    if (!result.ok) {
      setDraftErrors({ [result.field || "brief"]: result.error });
      setStatusMessage(result.error);
      if (result.field) {
        requestAnimationFrame(() =>
          document.getElementById(`destination-plan-brief-${result.field}`)?.focus()
        );
      }
      return null;
    }
    setDraftErrors({});
    return result.value ?? {};
  };
  const saveDraft = () => {
    const normalizedDraft = validateDraft();
    if (!normalizedDraft) {
      return;
    }
    const saved = persist({ ...plan, draft: normalizedDraft });
    setDraft(null);
    setHandoff(null);
    setStatusMessage(
      saved
        ? "Draft saved in this browser. Nothing was sent to Citius."
        : "Draft kept only in this open page. Nothing was sent to Citius."
    );
  };
  const reviewWithCitius = () => {
    const normalizedDraft = validateDraft();
    if (!normalizedDraft) {
      return;
    }
    const reviewedPlan = { ...plan, draft: normalizedDraft };
    const prepared = prepareDestinationPlanHandoff(reviewedPlan);
    if (!prepared.ok) {
      setHandoff(null);
      setStatusMessage(
        "This plan no longer matches the destination catalogue. Reset it before review."
      );
      return;
    }
    persist(reviewedPlan);
    setDraft(null);
    setHandoff({ brief: prepared.brief, planSignature: JSON.stringify(reviewedPlan) });
    setStatusMessage(
      "Review the allowlisted fields below, add contact details, and consent before anything is sent."
    );
  };
  const updateDraft = (event) => {
    const { name, value } = event.target;
    setDraft((current) => ({ ...(current ?? visibleDraft), [name]: value }));
    setDraftErrors((current) => ({ ...current, [name]: undefined }));
    setHandoff(null);
  };

  return (
    <section
      aria-labelledby="destination-plan-title"
      className="mx-auto mt-8 max-w-7xl px-4"
      id="destination-shortlist"
    >
      <div className="rounded-3xl border border-brand-border bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h3
              className="font-bold font-heading text-2xl text-brand-dark"
              id="destination-plan-title"
            >
              Your destination shortlist
            </h3>
            <p className="mt-2 max-w-3xl text-brand-muted text-sm leading-6">
              {storageAvailable
                ? "This browser-local trip draft is saved only in this browser until you reset it or clear site data. It is not an Account record, Concierge memory, CRM lead, or booking request."
                : "This browser-local trip draft lasts only while this page stays open because browser storage is unavailable. It is not an Account record, Concierge memory, CRM lead, or booking request."}
            </p>
          </div>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-brand-border px-5 font-semibold text-brand-dark text-sm"
            onClick={resetPlanner}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} /> Reset plan
          </button>
        </div>

        {selectedDestinations.length > 0 ? (
          <ol className="mt-5 grid gap-3 lg:grid-cols-2">
            {selectedDestinations.map((destination, index) => (
              <ShortlistItem
                destination={destination}
                index={index}
                key={destination.id}
                move={move}
                remove={remove}
                shortlistLength={selectedDestinations.length}
              />
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-brand-muted text-sm">
            Save up to {DESTINATION_SHORTLIST_LIMIT} destination cards, or type a different idea
            below.
          </p>
        )}

        <div className="mt-5">
          <EnquiryBriefFields
            brief={visibleDraft}
            compact
            errors={draftErrors}
            idPrefix="destination-plan-brief"
            onChange={updateDraft}
          />
          <p className="mt-2 text-brand-muted text-xs leading-5">
            Do not enter contact, payment, passport, health, or other sensitive details in this
            browser-local draft.
          </p>
        </div>

        <p
          aria-live="polite"
          className={`mt-3 text-sm ${statusMessage ? "text-brand-muted" : "sr-only"}`}
          role="status"
        >
          {statusMessage}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            className="min-h-11 rounded-full border border-citius-blue px-5 font-semibold text-citius-blue text-sm"
            onClick={saveDraft}
            type="button"
          >
            Save draft in this browser
          </button>
          <button
            className="min-h-11 rounded-full bg-citius-blue px-5 font-semibold text-sm text-white"
            onClick={reviewWithCitius}
            type="button"
          >
            Review with Citius
          </button>
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-full px-5 font-semibold text-brand-dark text-sm underline underline-offset-4"
            href="/contact"
          >
            Contact Citius without a saved plan
          </a>
        </div>

        {handoff?.planSignature === planSignature ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-brand-border">
            <ConciergeContactHandoff
              defaultExpanded
              initialBrief={handoff.brief}
              key={handoff.planSignature}
              privacyCopy="Citius receives only the reviewed contact and trip fields below after you consent and submit. Your browser shortlist, local storage, and Concierge conversation are not attached."
              triggerLabel="Review and consent to send"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
