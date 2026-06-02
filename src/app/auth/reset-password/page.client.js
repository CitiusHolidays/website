"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useReducer } from "react";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";
import { authClient } from "@/lib/auth-client";

const initialFormState = {
  password: "",
  confirmPassword: "",
  showPassword: false,
  isLoading: false,
  status: { type: "", message: "" },
};

function formReducer(state, action) {
  switch (action.type) {
    case "field":
      return { ...state, [action.name]: action.value };
    case "togglePassword":
      return { ...state, showPassword: !state.showPassword };
    case "loading":
      return { ...state, isLoading: action.value };
    case "status":
      return { ...state, status: action.status };
    default:
      return state;
  }
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { password, confirmPassword, showPassword, isLoading, status } = state;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      dispatch({
        type: "status",
        status: {
          type: "error",
          message: "Reset token is missing or invalid. Please request a new link.",
        },
      });
      return;
    }
    if (password !== confirmPassword) {
      dispatch({ type: "status", status: { type: "error", message: "Passwords do not match." } });
      return;
    }
    if (password.length < 8) {
      dispatch({
        type: "status",
        status: { type: "error", message: "Password must be at least 8 characters." },
      });
      return;
    }

    dispatch({ type: "loading", value: true });
    dispatch({ type: "status", status: { type: "", message: "" } });

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (error) {
        dispatch({
          type: "status",
          status: { type: "error", message: error.message || "Failed to reset password." },
        });
      } else {
        dispatch({
          type: "status",
          status: {
            type: "success",
            message: "Password reset successful! You can now log in with your new password.",
          },
        });
        setTimeout(() => {
          router.push("/auth/guest");
        }, 3000);
      }
    } catch (err) {
      dispatch({
        type: "status",
        status: { type: "error", message: err.message || "An unexpected error occurred." },
      });
    }
    dispatch({ type: "loading", value: false });
  };

  return (
    <>
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

      {status.type !== "success" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="group">
            <label
              htmlFor="reset-password"
              className="mb-1.5 ml-1 block text-sm font-medium text-[#0f172a]"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) =>
                  dispatch({ type: "field", name: "password", value: e.target.value })
                }
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pl-11 pr-11 text-lg text-[#0f172a] outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
              />
              <Lock className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
              <button
                type="button"
                onClick={() => dispatch({ type: "togglePassword" })}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#0f172a] focus:outline-none"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          <div className="group">
            <label
              htmlFor="reset-confirm-password"
              className="mb-1.5 ml-1 block text-sm font-medium text-[#0f172a]"
            >
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="reset-confirm-password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) =>
                  dispatch({ type: "field", name: "confirmPassword", value: e.target.value })
                }
                placeholder="Confirm password"
                className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pl-11 pr-4 text-lg text-[#0f172a] outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
              />
              <Lock className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
            </div>
          </div>

          <button
            disabled={isLoading}
            type="submit"
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0B1026] py-4 text-lg font-medium text-white shadow-lg shadow-[#0B1026]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#0B1026]/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 transition-opacity group-hover:opacity-90" />
            <span className="relative z-10">{isLoading ? "Saving…" : "Set password"}</span>
            {!isLoading ? (
              <ArrowRight className="relative z-10 size-5 transition-transform group-hover:translate-x-1" />
            ) : null}
          </button>
        </form>
      ) : (
        <div className="text-center">
          <Link
            href="/auth/guest"
            className="text-sm font-medium text-[#d4af37] transition-colors hover:text-[#b5952f]"
          >
            Redirecting to sign in…
          </Link>
        </div>
      )}

      {status.type !== "success" ? (
        <div className="mt-8 text-center">
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#d4af37] transition-colors hover:text-[#b5952f]"
          >
            <ArrowLeft className="size-4" />
            Request a new link
          </Link>
        </div>
      ) : null}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthRecoveryLayout
      panelHeading={
        <>
          Set a new <span className="italic text-[#d4af37]">password</span>
        </>
      }
      panelSubtext="Choose a strong password to secure your Citius Holidays account."
      formTitle="Set new password"
      formDescription="Choose a secure password for your staff or traveler account."
    >
      <Suspense fallback={<p className="text-[#0B1026]/60">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthRecoveryLayout>
  );
}
