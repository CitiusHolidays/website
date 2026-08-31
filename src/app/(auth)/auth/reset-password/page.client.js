"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useReducer, useRef } from "react";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";
import { AuthRecoveryTransition } from "@/components/auth/AuthRecoveryTransition";
import { authClient } from "@/lib/auth-client";
import { formatAuthRecoveryError } from "@/lib/auth-errors";
import {
  getAuthRecoveryUrl,
  getSignInAuthUrl,
  resolveAuthReturnTarget,
} from "@/lib/auth-sign-in-targets";

const initialFormState = {
  confirmPassword: "",
  invalidField: "",
  isLoading: false,
  password: "",
  showPassword: false,
  status: { message: "", type: "" },
};

const FORM_REDUCERS = new Map([
  [
    "field",
    (state, action) => ({
      ...state,
      [action.name]: action.value,
      invalidField: state.invalidField === action.name ? "" : state.invalidField,
    }),
  ],
  ["togglePassword", (state) => ({ ...state, showPassword: !state.showPassword })],
  ["loading", (state, action) => ({ ...state, isLoading: action.value })],
  [
    "status",
    (state, action) => ({
      ...state,
      invalidField: action.invalidField ?? "",
      status: action.status,
    }),
  ],
]);

function formReducer(state, action) {
  const reduce = FORM_REDUCERS.get(action.type);
  return reduce ? reduce(state, action) : state;
}

function resetPasswordIssue({ confirmPassword, password, token }) {
  if (!token) {
    return {
      status: {
        message: "Reset token is missing or invalid. Please request a new link.",
        type: "error",
      },
      type: "status",
    };
  }
  if (password !== confirmPassword) {
    return {
      invalidField: "confirmPassword",
      status: { message: "Passwords do not match.", type: "error" },
      type: "status",
    };
  }
  if (password.length < 8) {
    return {
      invalidField: "password",
      status: { message: "Password must be at least 8 characters.", type: "error" },
      type: "status",
    };
  }
  return null;
}

function ResetPasswordFields({
  confirmPassword,
  confirmPasswordRef,
  invalidField,
  isLoading,
  onConfirmPasswordChange,
  onPasswordChange,
  onSubmit,
  onTogglePassword,
  password,
  passwordRef,
  showPassword,
}) {
  return (
    <form aria-busy={isLoading} className="space-y-5" onSubmit={onSubmit}>
      <div className="group">
        <label
          className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
          htmlFor="reset-password"
        >
          New password
        </label>
        <div className="relative">
          <input
            aria-describedby={invalidField === "password" ? "reset-password-status" : undefined}
            aria-invalid={invalidField === "password" || undefined}
            autoComplete="new-password"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pr-12 pl-11 text-[#0f172a] text-lg outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#94a3b8] focus:border-auth-accent-ink focus:ring-2 focus:ring-auth-accent-ink"
            id="reset-password"
            name="new-password"
            onChange={onPasswordChange}
            placeholder="At least 8 characters"
            ref={passwordRef}
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <Lock
            aria-hidden="true"
            className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-auth-accent-ink"
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-1 grid min-h-11 min-w-11 -translate-y-1/2 place-items-center rounded-lg text-[#64748b] transition-colors hover:text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-1"
            onClick={onTogglePassword}
            type="button"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </div>

      <div className="group">
        <label
          className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
          htmlFor="reset-confirm-password"
        >
          Confirm new password
        </label>
        <div className="relative">
          <input
            aria-describedby={
              invalidField === "confirmPassword" ? "reset-password-status" : undefined
            }
            aria-invalid={invalidField === "confirmPassword" || undefined}
            autoComplete="new-password"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pr-4 pl-11 text-[#0f172a] text-lg outline-none transition-[border-color,box-shadow] duration-200 placeholder:font-normal placeholder:text-[#94a3b8] focus:border-auth-accent-ink focus:ring-2 focus:ring-auth-accent-ink"
            id="reset-confirm-password"
            name="confirm-new-password"
            onChange={onConfirmPasswordChange}
            placeholder="Confirm password"
            ref={confirmPasswordRef}
            required
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
          />
          <Lock
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
        <span>{isLoading ? "Saving…" : "Set password"}</span>
        {isLoading ? null : (
          <ArrowRight
            aria-hidden="true"
            className="size-5 transition-transform fine-hover:group-hover:translate-x-1"
          />
        )}
      </button>
    </form>
  );
}

function ResetPasswordBody({ canSubmit, children, signInHref, statusType, variantId }) {
  if (statusType === "success") {
    return (
      <div className="text-center">
        <Link
          className="inline-flex min-h-11 items-center rounded-sm font-medium text-auth-accent-ink text-sm transition-colors hover:text-auth-accent-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
          href={signInHref}
        >
          Redirecting to {variantId === "employee" ? "Citius Connect" : "your account"}…
        </Link>
      </div>
    );
  }
  if (canSubmit) {
    return children;
  }
  return null;
}

function ResetPasswordForm({ returnTo, variantId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const callbackError = searchParams.get("error");
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { password, confirmPassword, showPassword, isLoading, invalidField, status } = state;
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const recoveryLinkRef = useRef(null);
  const statusRef = useRef(null);
  const resetInFlightRef = useRef(false);
  const canSubmit = Boolean(token) && !callbackError;
  const safeReturnTo = resolveAuthReturnTarget(variantId, returnTo);
  const signInHref = getSignInAuthUrl(variantId, safeReturnTo);
  const forgotPasswordHref = getAuthRecoveryUrl("/auth/forgot-password", variantId, safeReturnTo);
  const effectiveStatus = canSubmit
    ? status
    : {
        message: "This reset link is missing, invalid, or expired. Request a new secure link.",
        type: "error",
      };
  const focusInvalidField = () => {
    if (invalidField === "password") {
      passwordRef.current?.focus();
    } else if (invalidField === "confirmPassword") {
      confirmPasswordRef.current?.focus();
    } else if (canSubmit) {
      statusRef.current?.focus();
    } else {
      recoveryLinkRef.current?.focus();
    }
  };

  useEffect(() => {
    if (status.type !== "success") {
      return;
    }
    const redirectTimer = setTimeout(() => {
      router.push(safeReturnTo);
    }, 3000);
    return () => clearTimeout(redirectTimer);
  }, [router, safeReturnTo, status.type]);

  const updatePassword = (event) => {
    dispatch({ name: "password", type: "field", value: event.target.value });
  };
  const updateConfirmPassword = (event) => {
    dispatch({ name: "confirmPassword", type: "field", value: event.target.value });
  };
  const togglePassword = () => dispatch({ type: "togglePassword" });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (resetInFlightRef.current) {
      return;
    }
    const issue = resetPasswordIssue({ confirmPassword, password, token });
    if (issue) {
      dispatch(issue);
      return;
    }

    resetInFlightRef.current = true;
    dispatch({ type: "loading", value: true });
    dispatch({ status: { message: "", type: "" }, type: "status" });

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        dispatch({
          status: { message: formatAuthRecoveryError(error.message, "reset"), type: "error" },
          type: "status",
        });
      } else {
        dispatch({
          status: {
            message: "Password reset successful! You can now log in with your new password.",
            type: "success",
          },
          type: "status",
        });
      }
    } catch (err) {
      dispatch({
        status: { message: formatAuthRecoveryError(err?.message, "reset"), type: "error" },
        type: "status",
      });
    }
    resetInFlightRef.current = false;
    dispatch({ type: "loading", value: false });
  };

  return (
    <>
      <AuthRecoveryTransition
        announcement={effectiveStatus.message}
        onEntered={effectiveStatus.type === "error" ? focusInvalidField : undefined}
        paneKey={
          effectiveStatus.type === "error"
            ? `error-${canSubmit ? invalidField || "form" : "invalid-link"}`
            : effectiveStatus.type || "form"
        }
        tone={effectiveStatus.type === "error" ? "assertive" : "polite"}
      >
        {effectiveStatus.message ? (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              effectiveStatus.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-red-100 bg-red-50 text-red-600"
            }`}
            id="reset-password-status"
            ref={statusRef}
            tabIndex={effectiveStatus.type === "error" && canSubmit ? -1 : undefined}
          >
            {effectiveStatus.message}
          </div>
        ) : null}

        <ResetPasswordBody
          canSubmit={canSubmit}
          signInHref={signInHref}
          statusType={effectiveStatus.type}
          variantId={variantId}
        >
          <ResetPasswordFields
            confirmPassword={confirmPassword}
            confirmPasswordRef={confirmPasswordRef}
            invalidField={invalidField}
            isLoading={isLoading}
            onConfirmPasswordChange={updateConfirmPassword}
            onPasswordChange={updatePassword}
            onSubmit={handleSubmit}
            onTogglePassword={togglePassword}
            password={password}
            passwordRef={passwordRef}
            showPassword={showPassword}
          />
        </ResetPasswordBody>
      </AuthRecoveryTransition>

      {status.type === "success" ? null : (
        <div className="mt-8 text-center">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-sm font-medium text-auth-accent-ink text-sm transition-colors hover:text-auth-accent-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
            href={forgotPasswordHref}
            ref={recoveryLinkRef}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Request a new link
          </Link>
        </div>
      )}
    </>
  );
}

export default function ResetPasswordPage({ returnTo, variantId = "guest" }) {
  return (
    <AuthRecoveryLayout
      formDescription={
        variantId === "employee"
          ? "Choose a new password for Citius Connect with at least eight characters."
          : "Choose a new password for your Customer Travel Account with at least eight characters."
      }
      formTitle="Set new password"
      variantId={variantId}
    >
      <Suspense fallback={<p className="text-[#0B1026]/60">Loading…</p>}>
        <ResetPasswordForm returnTo={returnTo} variantId={variantId} />
      </Suspense>
    </AuthRecoveryLayout>
  );
}
