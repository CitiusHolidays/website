"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useReducer, useRef } from "react";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";
import { AuthRecoveryTransition } from "@/components/auth/AuthRecoveryTransition";
import { authClient } from "@/lib/auth-client";
import { formatAuthRecoveryError } from "@/lib/auth-errors";

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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { password, confirmPassword, showPassword, isLoading, invalidField, status } = state;
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const focusInvalidField = () => {
    if (invalidField === "password") {
      passwordRef.current?.focus();
    } else if (invalidField === "confirmPassword") {
      confirmPasswordRef.current?.focus();
    }
  };

  useEffect(() => {
    if (status.type !== "success") {
      return;
    }
    const redirectTimer = setTimeout(() => {
      router.push("/auth/guest");
    }, 3000);
    return () => clearTimeout(redirectTimer);
  }, [router, status.type]);

  const updatePassword = (event) => {
    dispatch({ name: "password", type: "field", value: event.target.value });
  };
  const updateConfirmPassword = (event) => {
    dispatch({ name: "confirmPassword", type: "field", value: event.target.value });
  };
  const togglePassword = () => dispatch({ type: "togglePassword" });
  const handleSubmit = async (e) => {
    e.preventDefault();
    const issue = resetPasswordIssue({ confirmPassword, password, token });
    if (issue) {
      dispatch(issue);
      return;
    }

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
    dispatch({ type: "loading", value: false });
  };

  return (
    <>
      <AuthRecoveryTransition
        announcement={status.message}
        onEntered={status.type === "error" && invalidField ? focusInvalidField : undefined}
        paneKey={
          status.type === "error" ? `error-${invalidField || "form"}` : status.type || "form"
        }
        tone={status.type === "error" ? "assertive" : "polite"}
      >
        {status.message ? (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${
              status.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border-red-100 bg-red-50 text-red-600"
            }`}
            id="reset-password-status"
          >
            {status.message}
          </div>
        ) : null}

        {status.type === "success" ? (
          <div className="text-center">
            <Link
              className="inline-flex min-h-11 items-center rounded-sm font-medium text-auth-accent-ink text-sm transition-colors hover:text-auth-accent-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
              href="/auth/guest"
            >
              Redirecting to sign in…
            </Link>
          </div>
        ) : (
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
        )}
      </AuthRecoveryTransition>

      {status.type === "success" ? null : (
        <div className="mt-8 text-center">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-sm font-medium text-auth-accent-ink text-sm transition-colors hover:text-auth-accent-ink/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-auth-accent-ink focus-visible:outline-offset-2"
            href="/auth/forgot-password"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Request a new link
          </Link>
        </div>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthRecoveryLayout
      formDescription="Choose a new password with at least eight characters."
      formTitle="Set new password"
    >
      <Suspense fallback={<p className="text-[#0B1026]/60">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthRecoveryLayout>
  );
}
