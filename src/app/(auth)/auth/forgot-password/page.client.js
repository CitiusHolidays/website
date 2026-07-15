"use client";

import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ message: "", type: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ message: "", type: "" });

    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setStatus({ message: error.message || "Failed to send reset link.", type: "error" });
      } else {
        setStatus({
          message:
            "Reset link sent! Please check your inbox for instructions to reset your password.",
          type: "success",
        });
      }
    } catch (err) {
      setStatus({ message: err.message || "An unexpected error occurred.", type: "error" });
    }
    setIsLoading(false);
  };

  return (
    <AuthRecoveryLayout
      formDescription="Enter your email and we'll send you a link to set or reset your password. Works for Google-only accounts too."
      formTitle="Reset password"
      panelHeading={
        <>
          Account <span className="text-[#d4af37] italic">recovery</span>
        </>
      }
      panelSubtext="We&apos;ll email you a secure link to set a new password for your Citius Holidays account."
    >
      {status.message ? (
        <div
          className={`mb-6 rounded-xl border p-4 text-sm ${
            status.type === "success"
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-red-100 bg-red-50 text-red-600"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      {status.type === "success" ? null : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="group">
            <label
              className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
              htmlFor="forgot-email"
            >
              Email address
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pr-4 pl-11 text-[#0f172a] text-lg outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                id="forgot-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
              <Mail className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
            </div>
          </div>

          <button
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0B1026] py-4 font-medium text-lg text-white shadow-[#0B1026]/20 shadow-lg transition-shadow duration-300 hover:shadow-[#0B1026]/30 hover:shadow-xl"
            disabled={isLoading}
            type="submit"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 transition-opacity group-hover:opacity-90" />
            <span className="relative z-10">{isLoading ? "Sending…" : "Send reset link"}</span>
            {isLoading ? null : (
              <ArrowRight className="relative z-10 size-5 transition-transform fine-hover:group-hover:translate-x-1" />
            )}
          </button>
        </form>
      )}

      <div className="mt-8 text-center">
        <Link
          className="inline-flex items-center gap-2 font-medium text-[#d4af37] text-sm transition-colors hover:text-[#b5952f]"
          href="/auth/guest"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      </div>
    </AuthRecoveryLayout>
  );
}
