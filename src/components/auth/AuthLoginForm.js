"use client";

import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";

const AUTH_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { damping: 10, stiffness: 100, type: "spring" },
    y: 0,
  },
};

export function AuthVerificationNotice({ email, onBackToSignIn }) {
  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-4 rounded-2xl border border-green-100 bg-emerald-50 p-6 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 font-bold text-2xl text-white">
        ✓
      </div>
      <h3 className="font-heading font-medium text-2xl text-emerald-900">Check Your Email</h3>
      <p className="font-light text-emerald-700 text-sm leading-relaxed">
        If this is a new account, we sent a verification link to{" "}
        <strong className="font-medium text-emerald-900">{email}</strong>. If you already have an
        account (including Google sign-in), check your inbox for a password or verification email
        instead.
      </p>
      <button
        className="mt-4 rounded-lg bg-[#0B1026] px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-[#1a2c4e]"
        onClick={onBackToSignIn}
        type="button"
      >
        Back to Sign In
      </button>
    </m.div>
  );
}

export function AuthLoginForm({
  variant,
  copy,
  mode,
  formData,
  formError,
  isLoading,
  showPassword,
  onInputChange,
  onSubmit,
  onTogglePassword,
  onToggleMode,
}) {
  return (
    <>
      <form className="space-y-5" onSubmit={onSubmit}>
        <AnimatePresence mode="wait">
          {mode === "signup" && variant.allowSignup && (
            <m.div
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="group">
                <label
                  className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
                  htmlFor="auth-name"
                >
                  Full Name
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 pl-11 text-[#0f172a] text-lg outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                    id="auth-name"
                    name="name"
                    onChange={onInputChange}
                    placeholder="John Doe"
                    required={mode === "signup"}
                    type="text"
                    value={formData.name}
                  />
                  <User className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <m.div className="group" variants={AUTH_ITEM_VARIANTS}>
          <label
            className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
            htmlFor="auth-email"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 pl-11 text-[#0f172a] text-lg outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
              id="auth-email"
              name="email"
              onChange={onInputChange}
              placeholder="you@example.com"
              required
              type="email"
              value={formData.email}
            />
            <Mail className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
          </div>
        </m.div>

        <m.div className="group" variants={AUTH_ITEM_VARIANTS}>
          <div className="mb-1.5 ml-1 flex items-center justify-between">
            <label className="block font-medium text-[#0f172a] text-sm" htmlFor="auth-password">
              Password
            </label>
            {mode === "signin" && (
              <Link
                className="text-[#d4af37] text-sm transition-colors hover:text-[#b5952f]"
                href="/auth/forgot-password"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 pr-11 pl-11 text-[#0f172a] text-lg outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
              id="auth-password"
              name="password"
              onChange={onInputChange}
              placeholder="••••••••"
              required
              type={showPassword ? "text" : "password"}
              value={formData.password}
            />
            <Lock className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
            <button
              className="absolute top-1/2 right-4 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#0f172a] focus:outline-none"
              onClick={onTogglePassword}
              type="button"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </m.div>

        {formError && (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-red-600 text-sm"
            initial={{ opacity: 0, y: -10 }}
          >
            <div className="size-1.5 rounded-full bg-red-500" />
            {formError}
          </m.div>
        )}

        <m.button
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0B1026] py-4 font-medium text-lg text-white shadow-[#0B1026]/20 shadow-lg transition-all duration-300 hover:shadow-[#0B1026]/30 hover:shadow-xl"
          disabled={isLoading}
          type="submit"
          variants={AUTH_ITEM_VARIANTS}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 transition-opacity group-hover:opacity-90" />
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />
          <span className="relative z-10">
            {isLoading ? "Processing…" : mode === "signin" ? copy.submitSignIn : copy.submitSignUp}
          </span>
          {!isLoading && (
            <ArrowRight className="relative z-10 size-5 transition-transform group-hover:translate-x-1" />
          )}
        </m.button>
      </form>

      {variant.allowSignup && (
        <m.div className="mt-8 text-center" variants={AUTH_ITEM_VARIANTS}>
          <p className="text-[#64748b]">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
            <button
              className="group relative ml-2 font-medium text-[#d4af37] transition-colors hover:text-[#b5952f]"
              onClick={onToggleMode}
              type="button"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
              <span className="absolute -bottom-0.5 left-0 size-0.5 bg-[#d4af37] transition-all group-hover:w-full" />
            </button>
          </p>
        </m.div>
      )}
    </>
  );
}
