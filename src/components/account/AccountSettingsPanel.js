"use client";

import { m as motion } from "motion/react";
import { ACCOUNT_CONTAINER_VARIANTS, SettingRow, Toggle } from "./AccountUi";

export function AccountSettingsPanel() {
  return (
    <motion.div
      key="settings"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: 10 }}
      variants={ACCOUNT_CONTAINER_VARIANTS}
      className="bg-white rounded-3xl shadow-xl shadow-[#0B1026]/5 overflow-hidden"
    >
      <div className="p-8 border-b border-gray-100">
        <h2 className="font-heading text-3xl text-[#0B1026]">Account Settings</h2>
      </div>

      <div className="divide-y divide-gray-100">
        <SettingRow
          title="Email Notifications"
          description="Receive updates about your bookings and exclusive offers."
          action={<Toggle />}
        />
        <SettingRow
          title="Two-Factor Authentication"
          description="Add an extra layer of security to your account."
          action={
            <button type="button" className="text-[#d4af37] text-sm font-medium">
              Enable
            </button>
          }
        />
        <SettingRow
          title="Delete Account"
          description="Permanently remove your account and all data."
          action={
            <button type="button" className="text-red-500 text-sm font-medium">
              Delete
            </button>
          }
        />
      </div>
    </motion.div>
  );
}
