"use client";

import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";
import { AuthRecoveryTransition } from "@/components/auth/AuthRecoveryTransition";
import { authClient } from "@/lib/auth-client";
import { formatAuthRecoveryError } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ message: "", type: "" });
  const emailRef = useRef(null);
  const focusEmail = () => emailRef.current?.focus();
  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

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
        setStatus({ message: formatAuthRecoveryError(error.message, "request"), type: "error" });
      } else {
        setStatus({
          message:
            "Reset link sent! Please check your inbox for instructions to reset your password.",
          type: "success",
        });
      }
    } catch (err) {
      setStatus({ message: formatAuthRecoveryError(err?.message, "request"), type: "error" });
    }
    setIsLoading(false);
  };

  return (
    <AuthRecoveryLayout
      formDescription="Enter your email and we’ll send a secure link to choose a new password."
      formTitle="Reset password"
    >
      <AuthRecoveryTransition
        announcement={status.message}
        onEntered={status.type === "error" ? focusEmail : undefined}
        paneKey={status.type || "form"}
        tone={status.type === "error" ? "assertive" : "polite"}
      >
        {status.message ? (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              status.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-red-100 bg-red-50 text-red-600"
            }`}
            id="forgot-password-status"
          >
            {status.message}
          </div>
        ) : null}

        {status.type === "success" ? null : (
          <form aria-busy={isLoading} className="space-y-5" onSubmit={handleSubmit}>
            <div className="group">
              <label
                className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
                htmlFor="forgot-email"
              >
                Email address
              </label>
              <div className="relative">
                <input
                  aria-describedby={status.type === "error" ? "forgot-password-status" : undefined}
                  aria-invalid={status.type === "error" || undefined}
                  autoComplete="email"
                  className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pr-4 pl-11 text-[#0f172a] text-lg outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#94a3b8] focus:border-auth-accent-ink focus:ring-2 focus:ring-auth-accent-ink"
                  id="forgot-email"
                  name="email"
                  onChange={handleEmailChange}
                  placeholder="you@example.com"
                  ref={emailRef}
                  required
                  type="email"
                  value={email}
                />
                <Mail
                  aria-hidden="true"
                  className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-auth-accent-ink"
                />
              </div>
            </div>

            <button
              aria-busy={isLoading}
              className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1026] px-4 py-3 font-medium text-lg text-white transition-[background-color,transform] duration-150 hover:bg-[#1a2c4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              disabled={isLoading}
              type="submit"
            >
              <span>{isLoading ? "Sending…" : "Send reset link"}</span>
              {isLoading ? null : (
                <ArrowRight
                  aria-hidden="true"
                  className="size-5 transition-transform fine-hover:group-hover:translate-x-1"
                />
              )}
            </button>
          </form>
        )}
      </AuthRecoveryTransition>

      <div className="mt-8 text-center">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-sm font-medium text-auth-accent-ink text-sm transition-colors hover:text-auth-accent-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
          href="/auth/guest"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to sign in
        </Link>
      </div>
    </AuthRecoveryLayout>
  );
}
