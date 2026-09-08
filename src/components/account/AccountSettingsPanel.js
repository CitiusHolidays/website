"use client";

import Link from "next/link";
import { Button } from "@/components/ui/application-button";
import { ACCOUNT_DELETION_CONTACT_HREF } from "@/lib/public/contactIntent";
import { SettingRow } from "./AccountUi";
import { formatAccountDateRange } from "./accountPresentation";

export function AccountSettingsPanel({
  confirmedTrips = [],
  hasMoreTrips = false,
  onOpenReminders,
}) {
  const reminderTrips = confirmedTrips.filter(
    (packet) => packet.reminders?.available === true || packet.reminders?.milestones?.length > 0
  );
  return (
    <section
      aria-labelledby="account-preferences"
      className="border-[var(--account-border)] border-t pt-6"
    >
      <h2
        className="account-display scroll-mt-28 text-2xl text-[var(--account-ink)] outline-none"
        id="account-preferences"
        tabIndex={-1}
      >
        Preferences and account help
      </h2>

      <div className="divide-y divide-[var(--account-border)]">
        <SettingRow
          description={
            reminderTrips.length || hasMoreTrips
              ? "Choose reminder milestones on each eligible Arrival Pack. A separately verified phone is required; your profile phone is not treated as verification."
              : "Journey reminders are not available for your current journeys. A separately verified phone is required; your profile phone is not treated as verification."
          }
          title="Journey reminders"
        />
        {reminderTrips.length ? (
          <ul className="space-y-2 py-4">
            {reminderTrips.map((packet) => (
              <li key={packet.confirmedOfferId}>
                <Button
                  className="min-h-11 justify-start rounded-lg px-3 py-2 text-left text-[var(--account-night)] text-sm underline underline-offset-4"
                  id={`account-reminder-link-${packet.confirmedOfferId}`}
                  onClick={() => onOpenReminders(packet.confirmedOfferId)}
                  surface="account"
                  type="button"
                >
                  {packet.travel?.destination || "Journey"} reminders ·{" "}
                  {formatAccountDateRange(packet.travel?.startDate, packet.travel?.endDate)}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {hasMoreTrips ? (
          <div className="py-4">
            <Button
              className="min-h-11 px-3 py-2 text-sm underline underline-offset-4"
              id="account-more-arrival-packs"
              onClick={() => onOpenReminders()}
              surface="account"
              type="button"
            >
              View more Arrival Packs for journey preferences
            </Button>
          </div>
        ) : null}
        <SettingRow
          action={
            <Link
              aria-label="Contact the Citius team about deleting your account"
              className="account-focus inline-flex min-h-11 items-center rounded-full border border-[var(--account-night)] px-4 font-semibold text-[var(--account-night)] text-sm transition-colors hover:bg-[var(--account-night)] hover:text-white"
              href={ACCOUNT_DELETION_CONTACT_HREF}
            >
              Contact team
            </Link>
          }
          description="Account deletion is handled by the Citius travel team so we can confirm any active bookings first."
          title="Delete account"
        />
      </div>
    </section>
  );
}
