"use client";

import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  contextualIconMotion,
  PUBLIC_PRESS_TRANSITION,
  publicPressTarget,
} from "@/lib/publicInteractionMotion";

const AUTH_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { damping: 10, stiffness: 100, type: "spring" },
    y: 0,
  },
};

const AUTH_INPUT_CLASS =
  "w-full rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5 pl-11 text-[#0f172a] text-lg outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#94a3b8] focus:border-auth-accent-ink focus:ring-2 focus:ring-auth-accent-ink";
const AUTH_LIGHT_LINK_CLASS =
  "font-medium text-auth-accent-ink transition-colors hover:text-auth-accent-ink/80 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2";
const AUTH_PRIMARY_ACTION_CLASS =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1026] px-4 py-3 font-medium text-lg text-white transition-[background-color,transform] duration-150 hover:bg-[#1a2c4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70";

export function AuthVerificationNotice({ email, onBackToSignIn }) {
  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      aria-atomic="true"
      aria-live="polite"
      className="space-y-4 rounded-2xl border border-green-100 bg-emerald-50 p-6 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      role="status"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 font-bold text-2xl text-white">
        ✓
      </div>
      <h3 className="font-heading font-medium text-2xl text-emerald-900">Check Your Email</h3>
      <p className="font-normal text-emerald-700 text-sm leading-relaxed">
        If this is a new account, we sent a verification link to{" "}
        <strong className="font-medium text-emerald-900">{email}</strong>. If you already have an
        account (including Google sign-in), check your inbox for a password or verification email
        instead.
      </p>
      <button
        className="mt-4 min-h-11 rounded-lg bg-[#0B1026] px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-[#1a2c4e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
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
  formStatusRef,
  isLoading,
  showPassword,
  onInputChange,
  onSubmit,
  onTogglePassword,
  onToggleMode,
}) {
  const prefersReducedMotion = useReducedMotion();
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);
  useEffect(() => {
    setShouldReduceMotion(!!prefersReducedMotion);
  }, [prefersReducedMotion]);
  const iconMotion = contextualIconMotion(shouldReduceMotion);
  const pressTarget = publicPressTarget(shouldReduceMotion);
  let submitLabel = copy.submitSignUp;
  if (isLoading) {
    submitLabel = "Processing…";
  } else if (mode === "signin") {
    submitLabel = copy.submitSignIn;
  }

  return (
    <>
      <form aria-busy={isLoading} className="space-y-5" onSubmit={onSubmit}>
        <AnimatePresence mode="wait">
          {mode === "signup" && variant.allowSignup && (
            <m.div
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0.96 }}
              initial={{ opacity: 0, scaleY: 0.96 }}
              style={{ originY: 0 }}
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
                    autoComplete="name"
                    className={AUTH_INPUT_CLASS}
                    id="auth-name"
                    name="name"
                    onChange={onInputChange}
                    placeholder="Your full name"
                    required={mode === "signup"}
                    type="text"
                    value={formData.name}
                  />
                  <User
                    aria-hidden="true"
                    className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-auth-accent-ink"
                  />
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
              autoComplete="email"
              className={AUTH_INPUT_CLASS}
              id="auth-email"
              name="email"
              onChange={onInputChange}
              placeholder="you@example.com"
              required
              type="email"
              value={formData.email}
            />
            <Mail
              aria-hidden="true"
              className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-auth-accent-ink"
            />
          </div>
        </m.div>

        <m.div className="group" variants={AUTH_ITEM_VARIANTS}>
          <div className="mb-1.5 ml-1 flex items-center justify-between">
            <label className="block font-medium text-[#0f172a] text-sm" htmlFor="auth-password">
              Password
            </label>
            {mode === "signin" && (
              <Link className={`${AUTH_LIGHT_LINK_CLASS} text-sm`} href="/auth/forgot-password">
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className={`${AUTH_INPUT_CLASS} pr-12`}
              id="auth-password"
              name="password"
              onChange={onInputChange}
              placeholder="••••••••"
              required
              type={showPassword ? "text" : "password"}
              value={formData.password}
            />
            <Lock
              aria-hidden="true"
              className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-auth-accent-ink"
            />
            <m.button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-1 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-lg text-[#64748b] transition-colors hover:text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-1"
              onClick={onTogglePassword}
              transition={PUBLIC_PRESS_TRANSITION}
              type="button"
              whileTap={pressTarget}
            >
              <AnimatePresence initial={false} mode="wait">
                <m.span
                  animate={iconMotion.animate}
                  className="block"
                  exit={iconMotion.exit}
                  initial={iconMotion.initial}
                  key={showPassword ? "visible" : "hidden"}
                  transition={iconMotion.transition}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-5" />
                  ) : (
                    <Eye aria-hidden="true" className="size-5" />
                  )}
                </m.span>
              </AnimatePresence>
            </m.button>
          </div>
        </m.div>

        <div
          aria-atomic="true"
          className={formError ? "" : "sr-only"}
          id="auth-form-error"
          ref={formStatusRef}
          role="alert"
          tabIndex={formError ? -1 : undefined}
        >
          {formError ? (
            <m.div
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-red-600 text-sm"
              initial={{ opacity: 0, y: -10 }}
            >
              <div aria-hidden="true" className="size-1.5 rounded-full bg-red-500" />
              {formError}
            </m.div>
          ) : null}
        </div>

        <m.button
          aria-busy={isLoading}
          className={AUTH_PRIMARY_ACTION_CLASS}
          disabled={isLoading}
          type="submit"
          variants={AUTH_ITEM_VARIANTS}
          whileTap={pressTarget}
        >
          <span>{submitLabel}</span>
          {!isLoading && (
            <ArrowRight className="size-5 transition-transform fine-hover:group-hover:translate-x-1" />
          )}
        </m.button>
      </form>

      {variant.allowSignup ? (
        <m.div className="mt-8 text-center" variants={AUTH_ITEM_VARIANTS}>
          <p className="text-[#64748b]">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
            <button
              className={`${AUTH_LIGHT_LINK_CLASS} group relative ml-2`}
              onClick={onToggleMode}
              type="button"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
              <span className="absolute -bottom-0.5 left-0 size-0.5 bg-auth-accent-ink transition-[width] group-hover:w-full" />
            </button>
          </p>
        </m.div>
      ) : null}
    </>
  );
}
