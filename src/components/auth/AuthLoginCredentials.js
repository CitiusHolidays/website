"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth-client";
import { formatAuthApiError } from "@/lib/auth-errors";
import { AuthLoginForm, AuthVerificationNotice } from "./AuthLoginForm";
import AuthShell from "./AuthShell";

function createAuthState({ allowSignup, initialMode, error }) {
  return {
    formData: { email: "", name: "", password: "" },
    formError: error || "",
    isLoading: false,
    isVerificationSent: false,
    mode: allowSignup && initialMode === "signup" ? "signup" : "signin",
    showPassword: false,
  };
}

function authReducer(state, action) {
  const reducers = {
    patch: () => ({ ...state, ...action.patch }),
    setFormField: () => ({
      ...state,
      formData: { ...state.formData, [action.name]: action.value },
    }),
  };
  const reduce = reducers[action.type];
  if (!reduce) {
    return state;
  }
  return reduce();
}

export function AuthLoginCredentials({
  variant,
  copy,
  brandLogo,
  brandLogoAlt,
  initialMode = "signin",
  error,
}) {
  const router = useRouter();
  const formStatusRef = useRef(null);
  const [state, dispatch] = useReducer(
    authReducer,
    { error, initialMode, variant },
    ({ variant: seedVariant, initialMode: seedMode, error: seedError }) =>
      createAuthState({
        allowSignup: seedVariant.allowSignup,
        error: seedError,
        initialMode: seedMode,
      })
  );
  const { mode, isLoading, showPassword, formError, formData, isVerificationSent } = state;

  useEffect(() => {
    if (formError) {
      formStatusRef.current?.focus();
    }
  }, [formError]);

  const toggleMode = () => {
    if (!variant.allowSignup) {
      return;
    }
    dispatch({
      patch: {
        formError: "",
        mode: mode === "signin" ? "signup" : "signin",
      },
      type: "patch",
    });
  };

  const handleInputChange = (e) => {
    dispatch({ name: e.target.name, type: "setFormField", value: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ patch: { formError: "", isLoading: true }, type: "patch" });

    try {
      if (mode === "signin") {
        const result = await signInWithEmail({
          email: formData.email,
          password: formData.password,
        });

        if (result?.error) {
          dispatch({
            patch: {
              formError: formatAuthApiError(result.error.message, result.error.code),
              isLoading: false,
            },
            type: "patch",
          });
        } else {
          router.push(variant.href);
          router.refresh();
        }
      } else {
        const result = await signUpWithEmail({
          email: formData.email,
          name: formData.name,
          password: formData.password,
        });

        if (result?.error) {
          dispatch({
            patch: {
              formError: formatAuthApiError(result.error.message, result.error.code),
              isLoading: false,
            },
            type: "patch",
          });
        } else {
          dispatch({ patch: { isLoading: false, isVerificationSent: true }, type: "patch" });
        }
      }
    } catch (err) {
      dispatch({
        patch: { formError: formatAuthApiError(err?.message, err?.code), isLoading: false },
        type: "patch",
      });
    }
  };

  const handleGoogleSignIn = async () => {
    dispatch({ patch: { isLoading: true }, type: "patch" });
    try {
      await signInWithGoogle(variant.href);
    } catch {
      dispatch({
        patch: {
          formError: "We could not start Google sign-in. Check your connection and try again.",
          isLoading: false,
        },
        type: "patch",
      });
    }
  };

  const handleBackToSignIn = () => {
    dispatch({
      patch: { isVerificationSent: false, mode: "signin" },
      type: "patch",
    });
  };

  const handleTogglePassword = () => {
    dispatch({ patch: { showPassword: !showPassword }, type: "patch" });
  };

  return (
    <AuthShell logo={brandLogo} logoAlt={brandLogoAlt}>
      {isVerificationSent ? (
        <AuthVerificationNotice email={formData.email} onBackToSignIn={handleBackToSignIn} />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight sm:text-4xl">
              {mode === "signin" ? copy.signInTitle : copy.signUpTitle}
            </h1>
            <p className="mt-2 text-[#0B1026]/70 leading-6">
              {mode === "signin" ? copy.signInSubtitle : copy.signUpSubtitle}
            </p>
          </div>

          <button
            aria-busy={isLoading}
            className="group flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#0B1026]/15 bg-white px-4 py-3 text-[#0B1026] shadow-sm transition-[border-color,background-color] duration-150 hover:border-[#0B1026]/30 hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            type="button"
          >
            <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="font-medium">Continue with Google</span>
          </button>

          <div className="my-5 flex items-center gap-3 text-[#0B1026]/50 text-sm">
            <div className="h-px grow bg-[#0B1026]/10" />
            <span>or</span>
            <div className="h-px grow bg-[#0B1026]/10" />
          </div>

          <AuthLoginForm
            copy={copy}
            formData={formData}
            formError={formError}
            formStatusRef={formStatusRef}
            isLoading={isLoading}
            mode={mode}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onToggleMode={toggleMode}
            onTogglePassword={handleTogglePassword}
            showPassword={showPassword}
            variant={variant}
          />
        </>
      )}
    </AuthShell>
  );
}
