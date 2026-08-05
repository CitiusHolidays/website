"use client";

import { m } from "motion/react";
import { ACCOUNT_CONTAINER_VARIANTS, SettingRow, Toggle } from "./AccountUi";

export function AccountSettingsPanel() {
  return (
    <m.div
      animate="visible"
      className="overflow-hidden rounded-3xl bg-white shadow-[#0B1026]/5 shadow-xl"
      exit={{ opacity: 0, y: 10 }}
      initial="hidden"
      key="settings"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <div className="border-gray-100 border-b p-8">
        <h2 className="font-heading text-3xl text-[#0B1026]">Account Settings</h2>
      </div>

      <div className="divide-y divide-gray-100">
        <SettingRow
          action={<Toggle />}
          description="Receive updates about your bookings and exclusive offers."
          title="Email Notifications"
        />
        <SettingRow
          action={
            <button className="font-medium text-[#d4af37] text-sm" type="button">
              Enable
            </button>
          }
          description="Add an extra layer of security to your account."
        />
        <SettingRow
          action={
            <button className="font-medium text-red-500 text-sm" type="button">
              Delete
            </button>
          }
          description="Permanently remove your account and all data."
        />
      </div>
    </m.div>
  );
}
