"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { Compass } from "lucide-react";
import { m as motion } from "motion/react";
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
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const AUTH_ITEM_VARIANTS = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 10 },
  },
};

function createAuthState({ allowSignup, initialMode, error }) {
  return {
    mode: !allowSignup ? "signin" : initialMode === "signup" ? "signup" : "signin",
    isLoading: false,
    showPassword: false,
    formError: error || "",
    formData: { email: "", password: "", name: "" },
    isVerificationSent: false,
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
  const [state, dispatch] = useReducer(authReducer, { variant, initialMode, error }, ({ variant, initialMode, error }) =>
    createAuthState({ allowSignup: variant.allowSignup, initialMode, error }),
  );
  const { mode, isLoading, showPassword, formError, formData, isVerificationSent } = state;

  const toggleMode = () => {
    if (!variant.allowSignup) return;
    dispatch({
      type: "patch",
      patch: {
        mode: mode === "signin" ? "signup" : "signin",
        formError: "",
      },
    });
  };

  const handleInputChange = (e) => {
    dispatch({ type: "setFormField", name: e.target.name, value: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch({ type: "patch", patch: { isLoading: true, formError: "" } });

    try {
      if (mode === "signin") {
        const result = await signInWithEmail({
          email: formData.email,
          password: formData.password,
        });

        if (result?.error) {
          dispatch({
            type: "patch",
            patch: {
              formError: formatAuthApiError(result.error.message, result.error.code),
              isLoading: false,
            },
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
          password: formData.password,
          name: formData.name,
        });

        if (result?.error) {
          dispatch({
            type: "patch",
            patch: {
              formError: formatAuthApiError(result.error.message, result.error.code),
              isLoading: false,
            },
          });
        } else {
          dispatch({ type: "patch", patch: { isVerificationSent: true, isLoading: false } });
        }
      }
    } catch (err) {
      dispatch({
        type: "patch",
        patch: { formError: err.message || "An unexpected error occurred", isLoading: false },
      });
    }
  };

  const handleGoogleSignIn = async () => {
    dispatch({ type: "patch", patch: { isLoading: true } });
    try {
      await signInWithGoogle(variant.href);
    } catch {
      dispatch({
        type: "patch",
        patch: { formError: "Failed to initialize Google sign in", isLoading: false },
      });
    }
  };

  return (
    <div className="w-full md:w-1/2 lg:w-7/12 flex items-center justify-center p-6 md:p-12 relative">
      <motion.div
        className="w-full max-w-md"
        initial="hidden"
        animate="visible"
        variants={AUTH_CONTAINER_VARIANTS}
      >
        <div className="md:hidden mb-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            {isConnect ? (
              <Image
                src={brandLogo}
                alt={brandLogoAlt}
                width={CITIUS_CONNECT_LOGO_WIDTH}
                height={CITIUS_CONNECT_LOGO_HEIGHT}
                className="h-11 w-auto max-w-[200px]"
              />
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Compass className="size-6 text-[#0B1026]" />
                <span className="text-sm uppercase tracking-[0.2em] text-[#0B1026]">
                  {copy.brandLabel}
                </span>
              </div>
            )}
          </div>
          {!isConnect ? (
            <h1 className="font-heading text-4xl text-[#0B1026]">{copy.mobileTitle}</h1>
          ) : null}
        </div>

        <motion.div variants={AUTH_ITEM_VARIANTS} className="mb-8">
          <h2 className="font-heading text-4xl md:text-5xl text-[#0B1026] mb-3">
            {mode === "signin" ? copy.signInTitle : copy.signUpTitle}
          </h2>
          <p className="text-[#0B1026]/60 font-light text-lg">
            {mode === "signin" ? copy.signInSubtitle : copy.signUpSubtitle}
          </p>
        </motion.div>

        <motion.div variants={AUTH_ITEM_VARIANTS} className="space-y-4 mb-8">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#cbd5e1] text-[#0f172a] p-4 rounded-xl transition-all duration-300 group shadow-sm hover:shadow-md"
          >
            <svg className="size-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
            <div className="grow border-t border-[#e2e8f0]"></div>
            <span className="shrink-0 mx-4 text-[#94a3b8] text-sm font-light uppercase tracking-wider">
              Or continue with
            </span>
            <div className="grow border-t border-[#e2e8f0]"></div>
          </div>
        </motion.div>

        {isVerificationSent ? (
          <AuthVerificationNotice
            email={formData.email}
            onBackToSignIn={() => {
              dispatch({
                type: "patch",
                patch: { isVerificationSent: false, mode: "signin" },
              });
            }}
          />
        ) : (
          <AuthLoginForm
            variant={variant}
            copy={copy}
            mode={mode}
            formData={formData}
            formError={formError}
            isLoading={isLoading}
            showPassword={showPassword}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onTogglePassword={() =>
              dispatch({ type: "patch", patch: { showPassword: !showPassword } })
            }
            onToggleMode={toggleMode}
          />
        )}
      </motion.div>
    </div>
  );
}
