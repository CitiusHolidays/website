"use client";

import { m } from "motion/react";
import { Status } from "@/components/ui/application-status";
import { AccountDeletionSection } from "./AccountDeletionSection";
import { ACCOUNT_CONTAINER_VARIANTS, SettingRow } from "./AccountUi";

export function AccountSettingsPanel({ onSignOut }) {
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
        <AccountDeletionSection signOut={onSignOut} />
      </div>
    </m.div>
  );
}
