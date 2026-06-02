"use client";

import { m as motion } from "motion/react";
import { useState } from "react";
import { ACCOUNT_CONTAINER_VARIANTS, ProfileAlert, ProfileField, ProfileInput } from "./AccountUi";

const PHONE_REGEX = /^(\+\d{1,3}[\s.-]?)?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})$/;

export function AccountProfilePanel({ user }) {
  const [savedProfileData, setSavedProfileData] = useState();
  const profileData = savedProfileData ?? user;
  const [profileForm, setProfileForm] = useState({
    name: user.name || "",
    phoneNumber: user.phoneNumber || "",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileAlert, setProfileAlert] = useState(null);

  const memberSince = profileData?.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Not available";

  const handleProfileInput = (field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetProfileForm = () => {
    setProfileForm({
      name: profileData.name || "",
      phoneNumber: profileData.phoneNumber || "",
    });
    setIsEditingProfile(false);
    setProfileAlert(null);
  };

  const handleProfileSave = async () => {
    const trimmedName = (profileForm.name || "").trim();
    const trimmedPhone = (profileForm.phoneNumber || "").trim();

    if (!trimmedName || trimmedName.length < 2) {
      setProfileAlert({
        type: "error",
        message: "Please enter your full name (at least 2 characters).",
      });
      return;
    }

    if (trimmedName.length > 80) {
      setProfileAlert({
        type: "error",
        message: "Name is too long. Please keep it under 80 characters.",
      });
      return;
    }

    if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
      setProfileAlert({
        type: "error",
        message: "Please enter a valid phone number (e.g., +1 555-123-4567).",
      });
      return;
    }

    setIsSavingProfile(true);
    setProfileAlert(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          phoneNumber: trimmedPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setProfileAlert({
          type: "error",
          message: data?.error || "Unable to update profile.",
        });
        setIsSavingProfile(false);
        return;
      }

      setSavedProfileData((prev) => ({
        ...prev,
        ...profileData,
        ...data.user,
      }));
      setProfileForm({
        name: data.user?.name || "",
        phoneNumber: data.user?.phoneNumber || "",
      });
      setIsEditingProfile(false);
      setProfileAlert({
        type: "success",
        message: "Profile updated successfully.",
      });
    } catch (error) {
      setProfileAlert({
        type: "error",
        message: error.message || "Unable to update profile.",
      });
    }
    setIsSavingProfile(false);
  };

  return (
    <motion.div
      key="profile"
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: 10 }}
      variants={ACCOUNT_CONTAINER_VARIANTS}
      className="bg-white rounded-3xl shadow-xl shadow-[#0B1026]/5 overflow-hidden"
    >
      <div className="p-8 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-3xl text-[#0B1026]">Personal Details</h2>
            <p className="text-sm text-gray-500 font-light">
              Update how we reach you and what shows on bookings.
            </p>
          </div>
          {!isEditingProfile ? (
            <button
              type="button"
              onClick={() => {
                setIsEditingProfile(true);
                setProfileAlert(null);
              }}
              className="text-[#0B1026] text-sm font-semibold px-4 py-2 rounded-full border border-[#0B1026] hover:bg-[#0B1026] hover:text-white transition-colors"
            >
              Edit Details
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetProfileForm}
                className="px-4 py-2 text-sm font-medium text-gray-600 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={isSavingProfile}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                  isSavingProfile
                    ? "bg-[#0B1026]/60 text-white cursor-not-allowed"
                    : "bg-[#0B1026] text-white hover:bg-[#1a2c4e]"
                }`}
              >
                {isSavingProfile ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
        {profileAlert && <ProfileAlert type={profileAlert.type} message={profileAlert.message} />}
      </div>

      {!isEditingProfile ? (
        <div className="p-8 grid md:grid-cols-2 gap-x-12 gap-y-8">
          <ProfileField label="Full Name" value={profileData.name} />
          <ProfileField label="Email Address" value={profileData.email} />
          <ProfileField label="Phone Number" value={profileData.phoneNumber || "Not provided"} />
          <ProfileField label="Member Since" value={memberSince} />
        </div>
      ) : (
        <div className="p-8 grid md:grid-cols-2 gap-x-12 gap-y-8">
          <ProfileInput
            label="Full Name"
            value={profileForm.name}
            onChange={(value) => handleProfileInput("name", value)}
            placeholder="Enter your full name"
          />
          <ProfileInput label="Email Address" value={profileData.email} disabled />
          <ProfileInput
            label="Phone Number"
            value={profileForm.phoneNumber}
            onChange={(value) => handleProfileInput("phoneNumber", value)}
            placeholder="+1 555-123-4567"
            type="tel"
          />
          <ProfileField label="Member Since" value={memberSince} />
        </div>
      )}

      <div className="bg-[#f8fafc] p-8 border-t border-gray-100">
        <h3 className="font-heading text-xl text-[#0B1026] mb-4">Passport Details</h3>
        <p className="text-gray-500 text-sm font-light mb-4">
          Your passport details are securely encrypted. We only decrypt them when necessary for
          booking arrangements.
        </p>
        <div className="flex items-center gap-3 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4 max-w-md">
          <div className="size-2 rounded-full bg-green-500"></div>
          {profileData.passportDetailsEncrypted
            ? "Passport details on file"
            : "No passport details provided"}
        </div>
      </div>
    </motion.div>
  );
}
