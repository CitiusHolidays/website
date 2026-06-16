"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

function formFromProfile(profile) {
  return {
    slug: profile?.slug ?? "",
    displayName: profile?.displayName ?? "",
    bio: profile?.bio ?? "",
    homeCity: profile?.homeCity ?? "",
    isPublic: profile?.isPublic ?? false,
    shareWishlist: profile?.shareWishlist ?? false,
    shareRecentVisits: profile?.shareRecentVisits ?? true,
  };
}

function YatriPassportProfileForm({ profile, onSave }) {
  const [form, setForm] = useState(() => formFromProfile(profile));
  const patch = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const save = async (event) => {
    event.preventDefault();
    await onSave({
      slug: form.slug || form.displayName || "sacred-yatri",
      displayName: form.displayName || "Sacred Yatri",
      bio: form.bio || undefined,
      homeCity: form.homeCity || undefined,
      isPublic: form.isPublic,
      shareWishlist: form.shareWishlist,
      shareRecentVisits: form.shareRecentVisits,
    });
  };

  return (
    <form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-2">
      <input
        aria-label="Passport display name"
        value={form.displayName}
        onChange={(event) => patch("displayName", event.target.value)}
        placeholder="Display name"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
      />
      <input
        aria-label="Passport slug"
        value={form.slug}
        onChange={(event) => patch("slug", event.target.value)}
        placeholder="public-slug"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
      />
      <input
        aria-label="Home city"
        value={form.homeCity}
        onChange={(event) => patch("homeCity", event.target.value)}
        placeholder="Home city"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
      />
      <input
        aria-label="Passport bio"
        value={form.bio}
        onChange={(event) => patch("bio", event.target.value)}
        placeholder="Short bio"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
      />
      <label className="flex items-center gap-2 font-sans text-sm text-brand-muted">
        <input
          type="checkbox"
          checked={form.isPublic}
          onChange={(event) => patch("isPublic", event.target.checked)}
        />
        Public passport
      </label>
      <label className="flex items-center gap-2 font-sans text-sm text-brand-muted">
        <input
          type="checkbox"
          checked={form.shareRecentVisits}
          onChange={(event) => patch("shareRecentVisits", event.target.checked)}
        />
        Share recent visits
      </label>
      <label className="flex items-center gap-2 font-sans text-sm text-brand-muted">
        <input
          type="checkbox"
          checked={form.shareWishlist}
          onChange={(event) => patch("shareWishlist", event.target.checked)}
        />
        Share wishlist
      </label>
      <div className="md:text-right">
        <button
          type="submit"
          className="rounded-md bg-citius-blue px-4 py-2 font-sans text-sm font-semibold text-white"
        >
          Save passport
        </button>
      </div>
    </form>
  );
}

export default function YatriPassportProfilePanel() {
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.sacredBharat.getMyPassportProfile, isAuthenticated ? {} : "skip");
  const upsertProfile = useMutation(api.sacredBharat.upsertMyPassportProfile);

  if (!isAuthenticated) return null;

  return (
    <section className="rounded-lg border border-brand-light bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl text-brand-dark">Your Yatri Passport</h2>
          <p className="mt-1 font-sans text-sm text-brand-muted">
            Create a public or private Sacred Bharat identity.
          </p>
        </div>
        {profile?.isPublic && (
          <Link
            href={`/sacred-bharat/yatris/${profile.slug}`}
            className="font-sans text-sm font-medium text-citius-blue hover:text-citius-orange"
          >
            View passport
          </Link>
        )}
      </div>
      <YatriPassportProfileForm
        key={profile?.id ?? profile?.slug ?? "new-passport-profile"}
        profile={profile}
        onSave={upsertProfile}
      />
    </section>
  );
}
