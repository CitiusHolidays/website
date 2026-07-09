"use client";

import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useReducer } from "react";
import AuthRecoveryLayout from "@/components/auth/AuthRecoveryLayout";
import { authClient } from "@/lib/auth-client";

const initialFormState = {
  confirmPassword: "",
  isLoading: false,
  password: "",
  showPassword: false,
  status: { message: "", type: "" },
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
        status: {
          message: "Reset token is missing or invalid. Please request a new link.",
          type: "error",
        },
        type: "status",
      });
      return;
    }
    if (password !== confirmPassword) {
      dispatch({ status: { message: "Passwords do not match.", type: "error" }, type: "status" });
      return;
    }
    if (password.length < 8) {
      dispatch({
        status: { message: "Password must be at least 8 characters.", type: "error" },
        type: "status",
      });
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
          status: { message: error.message || "Failed to reset password.", type: "error" },
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
        setTimeout(() => {
          router.push("/auth/guest");
        }, 3000);
      }
    } catch (err) {
      dispatch({
        status: { message: err.message || "An unexpected error occurred.", type: "error" },
        type: "status",
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

      {status.type === "success" ? (
        <div className="text-center">
          <Link
            className="font-medium text-[#d4af37] text-sm transition-colors hover:text-[#b5952f]"
            href="/auth/guest"
          >
            Redirecting to sign in…
          </Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="group">
            <label
              className="mb-1.5 ml-1 block font-medium text-[#0f172a] text-sm"
              htmlFor="reset-password"
            >
              New password
            </label>
            <div className="relative">
              <input
                className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pr-11 pl-11 text-[#0f172a] text-lg outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                id="reset-password"
                onChange={(e) =>
                  dispatch({ name: "password", type: "field", value: e.target.value })
                }
                placeholder="At least 8 characters"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <Lock className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-4 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#0f172a] focus:outline-none"
                onClick={() => dispatch({ type: "togglePassword" })}
                type="button"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
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
                className="w-full rounded-xl border border-[#e2e8f0] bg-white py-3.5 pr-4 pl-11 text-[#0f172a] text-lg outline-none transition-all duration-200 placeholder:font-light placeholder:text-[#94a3b8] focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
                id="reset-confirm-password"
                onChange={(e) =>
                  dispatch({ name: "confirmPassword", type: "field", value: e.target.value })
                }
                placeholder="Confirm password"
                required
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <Lock className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[#94a3b8] transition-colors group-focus-within:text-[#d4af37]" />
            </div>
          </div>

          <button
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0B1026] py-4 font-medium text-lg text-white shadow-[#0B1026]/20 shadow-lg transition-all duration-300 hover:shadow-[#0B1026]/30 hover:shadow-xl"
            disabled={isLoading}
            type="submit"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B1026] to-[#1a2c4e] opacity-100 transition-opacity group-hover:opacity-90" />
            <span className="relative z-10">{isLoading ? "Saving…" : "Set password"}</span>
            {isLoading ? null : (
              <ArrowRight className="relative z-10 size-5 transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </form>
      )}

      {status.type === "success" ? null : (
        <div className="mt-8 text-center">
          <Link
            className="inline-flex items-center gap-2 font-medium text-[#d4af37] text-sm transition-colors hover:text-[#b5952f]"
            href="/auth/forgot-password"
          >
            <ArrowLeft className="size-4" />
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
      formDescription="Choose a secure password for your staff or traveler account."
      formTitle="Set new password"
      panelHeading={
        <>
          Set a new <span className="text-[#d4af37] italic">password</span>
        </>
      }
      panelSubtext="Choose a strong password to secure your Citius Holidays account."
    >
      <Suspense fallback={<p className="text-[#0B1026]/60">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthRecoveryLayout>
  );
}
