"use client";

import { m } from "motion/react";
import { useReducer } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import { ACCOUNT_CONTAINER_VARIANTS, ProfileAlert, ProfileField, ProfileInput } from "./AccountUi";

const PHONE_REGEX = /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;

function createProfileState(user) {
  return {
    isEditingProfile: false,
    isSavingProfile: false,
    profileAlert: null,
    profileForm: {
      name: user.name || "",
      phoneNumber: user.phoneNumber || "",
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
  const profileData = savedProfileData ?? user;

  const memberSince = profileData?.createdAt
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
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      const data = await response.json();

      if (!response.ok) {
        dispatch({
          patch: {
            isSavingProfile: false,
            profileAlert: {
              message: data?.error || "Unable to update profile.",
              type: "error",
            },
          },
          type: "patch",
        });
        return;
      }

      dispatch({
        patch: {
          isEditingProfile: false,
          isSavingProfile: false,
          profileAlert: {
            message: "Profile updated successfully.",
            type: "success",
          },
          profileForm: {
            name: data.user?.name || "",
            phoneNumber: data.user?.phoneNumber || "",
          },
          savedProfileData: {
            ...profileData,
            ...data.user,
          },
        },
        type: "patch",
      });
    } catch (error) {
      dispatch({
        patch: {
          isSavingProfile: false,
          profileAlert: {
            message: error.message || "Unable to update profile.",
            type: "error",
          },
        },
        type: "patch",
      });
    }
  };

  return (
    <m.div
      animate="visible"
      className="overflow-hidden rounded-3xl bg-white shadow-[#0B1026]/5 shadow-xl"
      exit={{ opacity: 0, y: 10 }}
      initial="hidden"
      key="profile"
      variants={ACCOUNT_CONTAINER_VARIANTS}
    >
      <div className="border-gray-100 border-b p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-heading text-3xl text-[#0B1026]">Personal Details</h2>
            <p className="font-light text-gray-500 text-sm">
              Update how we reach you and what shows on bookings.
            </p>
          </div>
          {isEditingProfile ? (
            <div className="flex items-center gap-3">
              <button
                className="rounded-full border border-gray-200 px-4 py-2 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-50"
                onClick={resetProfileForm}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`rounded-full px-4 py-2 font-semibold text-sm transition-colors ${
                  isSavingProfile
                    ? "cursor-not-allowed bg-[#0B1026]/60 text-white"
                    : "bg-[#0B1026] text-white hover:bg-[#1a2c4e]"
                }`}
                disabled={isSavingProfile}
                onClick={handleProfileSave}
                type="button"
              >
                {isSavingProfile ? "Saving…" : "Save Changes"}
              </button>
            </div>
          ) : (
            <button
              className="rounded-full border border-[#0B1026] px-4 py-2 font-semibold text-[#0B1026] text-sm transition-colors hover:bg-[#0B1026] hover:text-white"
              onClick={() => {
                dispatch({
                  patch: { isEditingProfile: true, profileAlert: null },
                  type: "patch",
                });
              }}
              type="button"
            >
              Edit Details
            </button>
          )}
        </div>
        {profileAlert && <ProfileAlert message={profileAlert.message} type={profileAlert.type} />}
      </div>

      {isEditingProfile ? (
        <div className="grid gap-x-12 gap-y-8 p-8 md:grid-cols-2">
          <ProfileInput
            label="Full Name"
            onChange={(value) => handleProfileInput("name", value)}
            placeholder="Enter your full name"
            value={profileForm.name}
          />
          <ProfileInput disabled label="Email Address" value={profileData.email} />
          <ProfileInput
            label="Phone Number"
            onChange={(value) => handleProfileInput("phoneNumber", value)}
            placeholder="+1 555-123-4567"
            type="tel"
            value={profileForm.phoneNumber}
          />
          <ProfileField label="Member Since" value={memberSince} />
        </div>
      ) : (
        <div className="grid gap-x-12 gap-y-8 p-8 md:grid-cols-2">
          <ProfileField label="Full Name" value={profileData.name} />
          <ProfileField label="Email Address" value={profileData.email} />
          <ProfileField label="Phone Number" value={profileData.phoneNumber || "Not provided"} />
          <ProfileField label="Member Since" value={memberSince} />
        </div>
      )}

      <div className="border-gray-100 border-t bg-[#f8fafc] p-8">
        <h3 className="mb-4 font-heading text-[#0B1026] text-xl">Passport Details</h3>
        <p className="mb-4 font-light text-gray-500 text-sm">
          Your passport details are securely encrypted. We only decrypt them when necessary for
          booking arrangements.
        </p>
        <div className="flex max-w-md items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-gray-500 text-sm">
          <div className="size-2 rounded-full bg-green-500" />
          {profileData.passportDetailsEncrypted
            ? "Passport details on file"
            : "No passport details provided"}
        </div>
      </div>
    </m.div>
  );
}
