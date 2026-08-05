"use client";

import { m } from "motion/react";
import { ACCOUNT_CONTAINER_VARIANTS, SettingRow, Toggle } from "./AccountUi";

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
          action={<Toggle disabled label="Email notifications" />}
          description="Receive updates about your bookings and exclusive offers. This preference will be available when notification settings are connected."
          title="Email Notifications"
        />
        <SettingRow
          action={
            <button
              aria-label="Two-step verification. Planned"
              className="cursor-not-allowed font-medium text-[var(--account-muted)] text-sm"
              disabled
              type="button"
            >
              Planned
            </button>
          }
          description="Add an extra layer of security to your account. Two-step verification is planned for a future account update."
          title="Two-step verification"
        />
        <SettingRow
          action={
            <span className="font-medium text-[var(--account-muted)] text-sm">Contact team</span>
          }
          description="Account deletion is handled by the Citius travel team so we can confirm any active journeys first."
          title="Delete account"
        />
      </div>
    </m.div>
  );
}
