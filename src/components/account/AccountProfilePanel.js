"use client";

import { LockKeyhole, Pencil, ShieldCheck } from "lucide-react";
import { useReducer } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import { ProfileAlert, ProfileField, ProfileInput } from "./AccountUi";

const PHONE_REGEX = /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;

function createProfileState(user) {
  return {
    isEditingProfile: false,
    isSavingProfile: false,
    profileAlert: null,
    profileForm: {
      name: user?.name || "",
      phoneNumber: user?.phoneNumber || "",
    },
    savedProfileData: undefined,
  };
}

function profileReducer(state, action) {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "setFormField":
      return {
        ...state,
        profileForm: { ...state.profileForm, [action.field]: action.value },
      };
    default:
      return state;
  }
}

export function AccountProfilePanel({ user }) {
  const [state, dispatch] = useReducer(profileReducer, user, createProfileState);
  const { savedProfileData, profileForm, isEditingProfile, isSavingProfile, profileAlert } = state;
  const profileData = savedProfileData ?? user ?? {};
  const memberSince = profileData.createdAt
    ? formatDisplayDate(profileData.createdAt)
    : "Not available";

  const handleProfileInput = (field, value) => {
    dispatch({ field, type: "setFormField", value });
  };

  const resetProfileForm = () => {
    dispatch({
      patch: {
        isEditingProfile: false,
        profileAlert: null,
        profileForm: {
          name: profileData.name || "",
          phoneNumber: profileData.phoneNumber || "",
        },
      },
      type: "patch",
    });
  };

  const handleProfileSave = async () => {
    const trimmedName = (profileForm.name || "").trim();
    const trimmedPhone = (profileForm.phoneNumber || "").trim();

    if (!trimmedName || trimmedName.length < 2) {
      dispatch({
        patch: {
          profileAlert: {
            message: "Please enter your full name (at least 2 characters).",
            type: "error",
          },
        },
        type: "patch",
      });
      return;
    }

    if (trimmedName.length > 80) {
      dispatch({
        patch: {
          profileAlert: {
            message: "Name is too long. Please keep it under 80 characters.",
            type: "error",
          },
        },
        type: "patch",
      });
      return;
    }

    if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
      dispatch({
        patch: {
          profileAlert: {
            message: "Please enter a valid phone number (e.g., +1 555-123-4567).",
            type: "error",
          },
        },
        type: "patch",
      });
      return;
    }

    dispatch({ patch: { isSavingProfile: true, profileAlert: null }, type: "patch" });

    try {
      const response = await fetch("/api/profile", {
        body: JSON.stringify({
          name: trimmedName,
          phoneNumber: trimmedPhone,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        dispatch({
          patch: {
            isSavingProfile: false,
            profileAlert: { message: data?.error || "Unable to update profile.", type: "error" },
          },
          type: "patch",
        });
        return;
      }

      const data = await response.json().catch(() => null);
      if (!data?.user) {
        dispatch({
          patch: {
            isSavingProfile: false,
            profileAlert: { message: "Unable to update profile.", type: "error" },
          },
          type: "patch",
        });
        return;
      }

      dispatch({
        patch: {
          isEditingProfile: false,
          isSavingProfile: false,
          profileAlert: { message: "Profile updated successfully.", type: "success" },
          profileForm: {
            name: data.user?.name || "",
            phoneNumber: data.user?.phoneNumber || "",
          },
          savedProfileData: { ...profileData, ...data.user },
        },
        type: "patch",
      });
    } catch (error) {
      dispatch({
        patch: {
          isSavingProfile: false,
          profileAlert: {
            message: error instanceof Error ? error.message : "Unable to update profile.",
            type: "error",
          },
        },
        type: "patch",
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-slate-100 border-b p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="font-semibold text-citius-orange text-xs uppercase tracking-[0.12em]">
              Your details
            </p>
            <h2 className="mt-2 font-heading text-3xl text-brand-dark">Profile</h2>
            <p className="mt-2 max-w-xl text-pretty text-slate-600 text-sm leading-relaxed">
              Keep your contact details current so your Citius travel team knows how to reach you.
            </p>
          </div>
          {isEditingProfile ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 py-2 font-semibold text-brand-dark text-sm transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
                onClick={resetProfileForm}
                type="button"
              >
                Cancel
              </button>
              <button
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-4 py-2 font-semibold text-sm transition-[background-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2",
                  isSavingProfile
                    ? "cursor-not-allowed bg-slate-300 text-slate-600"
                    : "bg-brand-dark text-white fine-hover:hover:-translate-y-px hover:bg-slate-800"
                )}
                disabled={isSavingProfile}
                onClick={handleProfileSave}
                type="button"
              >
                {isSavingProfile ? "Saving…" : "Save changes"}
              </button>
            </div>
          ) : (
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-dark px-4 py-2 font-semibold text-brand-dark text-sm transition-[background-color,color,transform] duration-150 fine-hover:hover:-translate-y-px hover:bg-brand-dark hover:text-white focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
              onClick={() =>
                dispatch({ patch: { isEditingProfile: true, profileAlert: null }, type: "patch" })
              }
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
              Edit details
            </button>
          )}
        </div>
        {Boolean(profileAlert) && (
          <ProfileAlert message={profileAlert.message} type={profileAlert.type} />
        )}
      </div>

      {isEditingProfile ? (
        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8 sm:p-8">
          <ProfileInput
            label="Full name"
            onChange={(value) => handleProfileInput("name", value)}
            placeholder="Enter your full name"
            value={profileForm.name}
          />
          <ProfileInput disabled label="Email address" value={profileData.email} />
          <ProfileInput
            label="Phone number"
            onChange={(value) => handleProfileInput("phoneNumber", value)}
            placeholder="+1 555-123-4567"
            type="tel"
            value={profileForm.phoneNumber}
          />
          <ProfileField label="Member since" value={memberSince} />
        </div>
      ) : (
        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-8 sm:p-8">
          <ProfileField label="Full name" value={profileData.name} />
          <ProfileField label="Email address" value={profileData.email} />
          <ProfileField label="Phone number" value={profileData.phoneNumber || "Not provided"} />
          <ProfileField label="Member since" value={memberSince} />
        </div>
      )}

      <div className="grid gap-4 border-slate-100 border-t bg-slate-50 p-6 sm:grid-cols-2 sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-citius-orange"
            size={20}
          />
          <div>
            <h3 className="font-semibold text-brand-dark">Your account stays private</h3>
            <p className="mt-1 text-pretty text-slate-600 text-sm leading-relaxed">
              Personal details are only shown to you and the Citius team supporting your booking.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <LockKeyhole
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-citius-orange"
            size={20}
          />
          <div>
            <h3 className="font-semibold text-brand-dark">Sensitive documents stay separate</h3>
            <p className="mt-1 text-pretty text-slate-600 text-sm leading-relaxed">
              Document sharing is handled through a separate secure process when it is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
