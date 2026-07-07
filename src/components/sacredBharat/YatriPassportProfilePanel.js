"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

function formFromProfile(profile) {
  return {
    bio: profile?.bio ?? "",
    displayName: profile?.displayName ?? "",
    homeCity: profile?.homeCity ?? "",
    isPublic: profile?.isPublic ?? false,
    shareRecentVisits: profile?.shareRecentVisits ?? true,
    shareWishlist: profile?.shareWishlist ?? false,
    slug: profile?.slug ?? "",
  };
}

function YatriPassportProfileForm({ profile, onSave }) {
  const [form, setForm] = useState(() => formFromProfile(profile));
  const patch = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const save = async (event) => {
    event.preventDefault();
    await onSave({
      bio: form.bio || undefined,
      displayName: form.displayName || "Sacred Yatri",
      homeCity: form.homeCity || undefined,
      isPublic: form.isPublic,
      shareRecentVisits: form.shareRecentVisits,
      shareWishlist: form.shareWishlist,
      slug: form.slug || form.displayName || "sacred-yatri",
    });
  };

  return (
    <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={save}>
      <input
        aria-label="Passport display name"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
        onChange={(event) => patch("displayName", event.target.value)}
        placeholder="Display name"
        value={form.displayName}
      />
      <input
        aria-label="Passport slug"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
        onChange={(event) => patch("slug", event.target.value)}
        placeholder="public-slug"
        value={form.slug}
      />
      <input
        aria-label="Home city"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
        onChange={(event) => patch("homeCity", event.target.value)}
        placeholder="Home city"
        value={form.homeCity}
      />
      <input
        aria-label="Passport bio"
        className="rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
        onChange={(event) => patch("bio", event.target.value)}
        placeholder="Short bio"
        value={form.bio}
      />
      <label className="flex items-center gap-2 font-sans text-brand-muted text-sm">
        <input
          checked={form.isPublic}
          onChange={(event) => patch("isPublic", event.target.checked)}
          type="checkbox"
        />
        Public passport
      </label>
      <label className="flex items-center gap-2 font-sans text-brand-muted text-sm">
        <input
          checked={form.shareRecentVisits}
          onChange={(event) => patch("shareRecentVisits", event.target.checked)}
          type="checkbox"
        />
        Share recent visits
      </label>
      <label className="flex items-center gap-2 font-sans text-brand-muted text-sm">
        <input
          checked={form.shareWishlist}
          onChange={(event) => patch("shareWishlist", event.target.checked)}
          type="checkbox"
        />
        Share wishlist
      </label>
      <div className="md:text-right">
        <button
          className="rounded-md bg-citius-blue px-4 py-2 font-sans font-semibold text-sm text-white"
          type="submit"
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <section className="rounded-lg border border-brand-light bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-brand-dark text-xl">Your Yatri Passport</h2>
          <p className="mt-1 font-sans text-brand-muted text-sm">
            Create a public or private Sacred Bharat identity.
          </p>
        </div>
        {profile?.isPublic && (
          <Link
            className="font-medium font-sans text-citius-blue text-sm hover:text-citius-orange"
            href={`/sacred-bharat/yatris/${profile.slug}`}
          >
            View passport
          </Link>
        )}
      </div>
      <YatriPassportProfileForm
        key={profile?.id ?? profile?.slug ?? "new-passport-profile"}
        onSave={upsertProfile}
        profile={profile}
      />
    </section>
  );
}
