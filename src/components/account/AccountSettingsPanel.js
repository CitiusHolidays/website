"use client";

import { m } from "motion/react";
import Link from "next/link";
import { Status } from "@/components/ui/application-status";
import { ACCOUNT_DELETION_CONTACT_HREF } from "@/lib/public/contactIntent";
import { ACCOUNT_CONTAINER_VARIANTS, SettingRow } from "./AccountUi";

export function AccountSettingsPanel() {
  return (
    <m.div
      animate="visible"
      className="account-card overflow-hidden rounded-sm"
      exit={{ opacity: 0, y: 10 }}
      initial="hidden"
      key="settings"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <div className="border-gray-100 border-b p-8">
        <h2 className="account-display text-3xl text-[var(--account-ink)]">Account Settings</h2>
      </div>

      <div className="divide-y divide-[var(--account-border)]">
        <SettingRow
          action={
            <Status aria-label="Email notifications. Planned" surface="account" tone="neutral">
              Planned
            </Status>
          }
          description="Receive booking updates and trip reminders. This preference will be available when notification settings are connected."
          title="Email Notifications"
        />
        <SettingRow
          action={
            <Status aria-label="Two-step verification. Planned" surface="account" tone="neutral">
              Planned
            </Status>
          }
          description="Add an extra layer of security to your account. Two-step verification is planned for a future account update."
          title="Two-step verification"
        />
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
    </m.div>
  );
}
