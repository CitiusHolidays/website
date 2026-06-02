"use client";

import { ArrowLeft, Building2, LogOut, Package } from "lucide-react";
import { m as motion } from "motion/react";
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
      <header className="border-b border-[#e2e8f0] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src={citiusLogo} alt="Citius Holidays" width={72} height={72} />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-citius-orange">
                Citius Holidays
              </p>
              <p className="font-heading text-lg text-[#0B1026]">Vendor Portal</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] px-4 py-2 text-sm text-[#64748b] transition-colors hover:border-[#cbd5e1] hover:text-[#0f172a]"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-[#e2e8f0] bg-white p-8 shadow-sm md:p-12"
        >
          <div className="mb-8 flex items-start gap-4">
            <div className="rounded-2xl bg-[#0B1026]/5 p-4 text-[#0B1026]">
              <Building2 size={28} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-citius-orange">Coming soon</p>
              <h1 className="mt-2 font-heading text-4xl text-[#0B1026]">
                Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h1>
              <p className="mt-3 max-w-2xl text-lg font-light text-[#64748b]">
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
                key={item}
                className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] p-5 text-sm text-[#475569]"
              >
                <Package size={18} className="mb-3 text-citius-orange" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B1026] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1a2c4e]"
            >
              <ArrowLeft size={16} />
              Back to website
            </Link>
            <p className="text-sm text-[#94a3b8]">Signed in as {user?.email}</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
