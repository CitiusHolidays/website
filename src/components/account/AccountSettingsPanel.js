"use client";

import { Bell, LockKeyhole, Mail, Trash2 } from "lucide-react";
import Link from "next/link";
import { SettingRow, Toggle } from "./AccountUi";

export function AccountSettingsPanel() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-slate-100 border-b p-6 sm:p-8">
        <p className="font-semibold text-citius-orange text-xs uppercase tracking-[0.12em]">
          Your preferences
        </p>
        <h2 className="mt-2 font-heading text-3xl text-brand-dark">Settings</h2>
        <p className="mt-2 max-w-xl text-pretty text-slate-600 text-sm leading-relaxed">
          Choose how Citius keeps you informed. We will always send essential booking information.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        <SettingRow
          action={<Toggle label="Email updates" />}
          description="Receive helpful updates about your bookings and travel arrangements."
          title={
            <span className="inline-flex items-center gap-2">
              <Mail aria-hidden="true" className="text-citius-orange" size={17} />
              Email updates
            </span>
          }
        />
        <SettingRow
          action={<Toggle defaultOn={false} label="Account notifications" />}
          description="Keep a small notification indicator available when your Account has something new."
          title={
            <span className="inline-flex items-center gap-2">
              <Bell aria-hidden="true" className="text-citius-orange" size={17} />
              Account notifications
            </span>
          }
        />
        <SettingRow
          action={
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-500 text-xs">
              Coming soon
            </span>
          }
          description="Additional sign-in protection will be introduced as part of a future authentication phase."
          title={
            <span className="inline-flex items-center gap-2">
              <LockKeyhole aria-hidden="true" className="text-citius-orange" size={17} />
              Extra sign-in protection
            </span>
          }
        />
        <SettingRow
          action={
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-200 px-4 py-2 font-semibold text-red-700 text-sm transition-colors duration-150 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 focus-visible:outline-offset-2"
              href="/contact"
            >
              <Trash2 aria-hidden="true" size={15} />
              Contact support
            </Link>
          }
          description="If you need your account closed, contact the Citius team so we can confirm the request safely."
          title="Close account"
        />
      </div>
    </div>
  );
}
