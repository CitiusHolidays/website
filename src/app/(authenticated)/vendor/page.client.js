"use client";

import { ArrowLeft, Building2, LogOut, Package } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { logout } from "@/lib/auth-client";
import citiusLogo from "@/static/logos/logo.webp";

const handleLogout = async () => {
  await logout();
  window.location.href = "/";
};

export default function VendorPageClient({ user }) {
  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <header className="border-[#e2e8f0] border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-3" href="/">
            <Image alt="Citius Holidays" height={72} src={citiusLogo} width={72} />
            <div>
              <p className="text-citius-orange text-xs uppercase tracking-[0.2em]">
                Citius Holidays
              </p>
              <p className="font-heading text-[#0B1026] text-lg">Vendor Portal</p>
            </div>
          </Link>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] px-4 py-2 text-[#64748b] text-sm transition-colors hover:border-[#cbd5e1] hover:text-[#0f172a]"
            onClick={handleLogout}
            type="button"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-sm md:p-12"
          initial={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8 flex items-start gap-4">
            <div className="rounded-2xl bg-[#0B1026]/5 p-4 text-[#0B1026]">
              <Building2 size={28} />
            </div>
            <div>
              <p className="text-citius-orange text-sm uppercase tracking-[0.18em]">Coming soon</p>
              <h1 className="mt-2 font-heading text-4xl text-[#0B1026]">
                Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h1>
              <p className="mt-3 max-w-2xl font-light text-[#64748b] text-lg">
                The vendor portal is being prepared. This page will host supplier onboarding,
                contract documents, and booking coordination tools.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Supplier profile and compliance documents",
              "Service requests and availability updates",
              "Invoices and payment status tracking",
            ].map((item) => (
              <div
                className="rounded-2xl border border-[#cbd5e1] border-dashed bg-[#f8fafc] p-5 text-[#475569] text-sm"
                key={item}
              >
                <Package className="mb-3 text-citius-orange" size={18} />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B1026] px-5 py-3 font-medium text-sm text-white transition-colors hover:bg-[#1a2c4e]"
              href="/"
            >
              <ArrowLeft size={16} />
              Back to website
            </Link>
            <p className="text-[#94a3b8] text-sm">Signed in as {user?.email}</p>
          </div>
        </m.div>
      </main>
    </div>
  );
}
