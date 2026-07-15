"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { Compass } from "lucide-react";
import { m } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReducer } from "react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth-client";
import { formatAuthApiError } from "@/lib/auth-errors";
import { CITIUS_CONNECT_LOGO_HEIGHT, CITIUS_CONNECT_LOGO_WIDTH } from "@/lib/citiusConnectLogo";
import { AuthLoginForm, AuthVerificationNotice } from "./AuthLoginForm";

const AUTH_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.1,
    },
  },
};

const AUTH_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: { damping: 10, stiffness: 100, type: "spring" },
    y: 0,
  },
};

function createAuthState({ allowSignup, initialMode, error }) {
  return {
    formData: { email: "", name: "", password: "" },
    formError: error || "",
    isLoading: false,
    isVerificationSent: false,
    mode: allowSignup ? (initialMode === "signup" ? "signup" : "signin") : "signin",
    showPassword: false,
  };
}

function authReducer(state, action) {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "setFormField":
      return {
        ...state,
        formData: { ...state.formData, [action.name]: action.value },
      };
    default:
      return state;
  }
}

export function AuthLoginCredentials({
  variant,
  copy,
  brandLogo,
  brandLogoAlt,
  isConnect,
  initialMode = "signin",
  error,
}) {
  const router = useRouter();
  const syncAuthIdentity = useMutation(api.authSync.syncMyAuthIdentity);
  const [state, dispatch] = useReducer(
    authReducer,
    { error, initialMode, variant },
    ({ variant, initialMode, error }) =>
      createAuthState({ allowSignup: variant.allowSignup, error, initialMode })
  );
  const { mode, isLoading, showPassword, formError, formData, isVerificationSent } = state;

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
          try {
            await syncAuthIdentity({});
          } catch (syncError) {
            console.error("Failed to sync auth identity after sign in:", syncError);
          }
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
        patch: { formError: err.message || "An unexpected error occurred", isLoading: false },
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
        patch: { formError: "Failed to initialize Google sign in", isLoading: false },
        type: "patch",
      });
    }
  };

  return (
    <div className="relative flex w-full items-center justify-center p-6 md:w-1/2 md:p-12 lg:w-7/12">
      <m.div
        animate="visible"
        className="w-full max-w-md"
        initial="hidden"
        variants={AUTH_CONTAINER_VARIANTS}
      >
        <div className="mb-8 text-center md:hidden">
          <div className="mb-4 flex items-center justify-center">
            {isConnect ? (
              <Image
                alt={brandLogoAlt}
                className="h-11 w-auto max-w-[200px]"
                height={CITIUS_CONNECT_LOGO_HEIGHT}
                src={brandLogo}
                width={CITIUS_CONNECT_LOGO_WIDTH}
              />
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Compass className="size-6 text-[#0B1026]" />
                <span className="text-[#0B1026] text-sm uppercase tracking-[0.2em]">
                  {copy.brandLabel}
                </span>
              </div>
            )}
          </div>
          {isConnect ? null : (
            <h1 className="font-heading text-4xl text-[#0B1026]">{copy.mobileTitle}</h1>
          )}
        </div>

        <m.div className="mb-8" variants={AUTH_ITEM_VARIANTS}>
          <h2 className="mb-3 font-heading text-4xl text-[#0B1026] md:text-5xl">
            {mode === "signin" ? copy.signInTitle : copy.signUpTitle}
          </h2>
          <p className="font-light text-[#0B1026]/60 text-lg">
            {mode === "signin" ? copy.signInSubtitle : copy.signUpSubtitle}
          </p>
        </m.div>

        <m.div className="mb-8 space-y-4" variants={AUTH_ITEM_VARIANTS}>
          <button
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 text-[#0f172a] shadow-sm transition-[border-color,background-color,box-shadow] duration-300 hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:shadow-md"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            type="button"
          >
            <svg
              className="size-5 transition-transform fine-hover:group-hover:scale-110"
              viewBox="0 0 24 24"
            >
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

          <div className="relative flex items-center py-2">
            <div className="grow border-[#e2e8f0] border-t" />
            <span className="mx-4 shrink-0 font-light text-[#94a3b8] text-sm uppercase tracking-wider">
              Or continue with
            </span>
            <div className="grow border-[#e2e8f0] border-t" />
          </div>
        </m.div>

        {isVerificationSent ? (
          <AuthVerificationNotice
            email={formData.email}
            onBackToSignIn={() => {
              dispatch({
                patch: { isVerificationSent: false, mode: "signin" },
                type: "patch",
              });
            }}
          />
        ) : (
          <AuthLoginForm
            copy={copy}
            formData={formData}
            formError={formError}
            isLoading={isLoading}
            mode={mode}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onToggleMode={toggleMode}
            onTogglePassword={() =>
              dispatch({ patch: { showPassword: !showPassword }, type: "patch" })
            }
            showPassword={showPassword}
            variant={variant}
          />
        )}
      </m.div>
    </div>
  );
}
