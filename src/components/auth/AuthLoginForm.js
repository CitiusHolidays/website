"use client";

import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import Link from "next/link";

const AUTH_ITEM_VARIANTS = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 10 },
  },
};

export function AuthVerificationNotice({ email, onBackToSignIn }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-emerald-50 border border-green-100 rounded-2xl p-6 text-center space-y-4"
    >
      <div className="size-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
        ✓
      </div>
      <h3 className="font-heading text-2xl font-medium text-emerald-900">Check Your Email</h3>
      <p className="text-emerald-700 text-sm leading-relaxed font-light">
        We&apos;ve sent a verification link to{" "}
        <strong className="font-medium text-emerald-900">{email}</strong>. Please click the link in
        the email to verify and activate your account.
      </p>
      <button
        type="button"
        onClick={onBackToSignIn}
        className="mt-4 px-4 py-2 bg-[#0B1026] text-white rounded-lg text-sm font-medium hover:bg-[#1a2c4e] transition-colors"
      >
        Back to Sign In
      </button>
    </motion.div>
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
      <form onSubmit={onSubmit} className="space-y-5">
        <AnimatePresence mode="wait">
          {mode === "signup" && variant.allowSignup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="group">
                <label
                  htmlFor="auth-name"
                  className="block text-sm font-medium text-[#0f172a] mb-1.5 ml-1"
                >
                  Full Name
                </label>
                <div className="relative">
                  <input
                    id="auth-name"
                    type="text"
                    name="name"
                    required={mode === "signup"}
                    value={formData.name}
                    onChange={onInputChange}
                    className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200 placeholder:text-[#94a3b8] placeholder:font-light"
                    placeholder="John Doe"
                  />
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#94a3b8] group-focus-within:text-[#d4af37] transition-colors" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={AUTH_ITEM_VARIANTS} className="group">
          <label
            htmlFor="auth-email"
            className="block text-sm font-medium text-[#0f172a] mb-1.5 ml-1"
          >
            Email Address
          </label>
          <div className="relative">
            <input
              id="auth-email"
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={onInputChange}
              className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200 placeholder:text-[#94a3b8] placeholder:font-light"
              placeholder="you@example.com"
            />
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#94a3b8] group-focus-within:text-[#d4af37] transition-colors" />
          </div>
        </motion.div>

        <motion.div variants={AUTH_ITEM_VARIANTS} className="group">
          <div className="flex items-center justify-between mb-1.5 ml-1">
            <label htmlFor="auth-password" className="block text-sm font-medium text-[#0f172a]">
              Password
            </label>
            {mode === "signin" && (
              <Link
                href="/auth/forgot-password"
                className="text-sm text-[#d4af37] hover:text-[#b5952f] transition-colors"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              name="password"
              required
              value={formData.password}
              onChange={onInputChange}
              className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] text-lg px-4 py-3.5 pl-11 pr-11 rounded-xl focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all duration-200 placeholder:text-[#94a3b8] placeholder:font-light"
              placeholder="••••••••"
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-[#94a3b8] group-focus-within:text-[#d4af37] transition-colors" />
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </motion.div>

        {formError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2"
          >
            <div className="size-1.5 rounded-full bg-red-500" />
            {formError}
          </motion.div>
        )}

        <motion.button
          variants={AUTH_ITEM_VARIANTS}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
          type="submit"
          className="w-full bg-[#0B1026] text-white font-medium text-lg py-4 rounded-xl shadow-lg shadow-[#0B1026]/20 hover:shadow-xl hover:shadow-[#0B1026]/30 transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 group-hover:opacity-90 transition-opacity" />
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-10 mix-blend-overlay" />
          <span className="relative z-10">
            {isLoading ? "Processing…" : mode === "signin" ? copy.submitSignIn : copy.submitSignUp}
          </span>
          {!isLoading && (
            <ArrowRight className="size-5 relative z-10 group-hover:translate-x-1 transition-transform" />
          )}
        </motion.button>
      </form>

      {variant.allowSignup && (
        <motion.div variants={AUTH_ITEM_VARIANTS} className="mt-8 text-center">
          <p className="text-[#64748b]">
            {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={onToggleMode}
              className="ml-2 font-medium text-[#d4af37] hover:text-[#b5952f] transition-colors relative group"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
              <span className="absolute -bottom-0.5 left-0 size-0.5 bg-[#d4af37] transition-all group-hover:w-full" />
            </button>
          </p>
        </motion.div>
      )}
    </>
  );
}
