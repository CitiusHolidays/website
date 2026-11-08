import { awayReasonNeedsLocation } from "@convex/crm/officeCheckInVerification";
import { describeAwayLocation } from "@/lib/officeCheckIn/presentation";
import { mapLinkFor } from "@/lib/officeCheckIn/ruleDraft";
import type { CheckInRecord } from "./officeCheckInTypes";

const COPY = {
  reviewer: { none: "No location was saved with this answer.", shared: "" },
  self: { none: null, shared: "Shared with the people who oversee you. " },
} as const;

/**
 * The location saved with an On tour or On market visit answer, with a link that opens the exact
 * point in Google Maps. Answers saved before locations were kept say so to the reviewer.
 */
export function AwayLocationNote({
  record,
  timeZone,
  viewer,
}: {
  record: CheckInRecord;
  timeZone: string;
  viewer: "reviewer" | "self";
}) {
  const { awayLocation: location } = record;
  if (!location) {
    const { none } = COPY[viewer];
    return none && record.awayReason && awayReasonNeedsLocation(record.awayReason) ? (
      <p className="text-brand-muted text-sm">{none}</p>
    ) : null;
  }
  return (
    <p className="text-pretty text-brand-dark text-sm">
      {COPY[viewer].shared}
      {describeAwayLocation(location, timeZone)}.{" "}
      <a
        className="text-citius-blue underline underline-offset-2"
        href={mapLinkFor(location.latitude, location.longitude)}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open in Google Maps
      </a>
    </p>
  );
}
