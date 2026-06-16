"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function PrivateGroupPanel() {
  const { isAuthenticated } = useConvexAuth();
  const groups = useQuery(api.sacredBharat.listMyGroups, isAuthenticated ? {} : "skip");
  const createGroup = useMutation(api.sacredBharat.createGroup);
  const joinGroup = useMutation(api.sacredBharat.joinGroupByInviteCode);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-brand-light bg-white p-5 text-center">
        <Users className="mx-auto mb-3 size-5 text-citius-blue" />
        <p className="font-heading text-lg text-brand-dark">Private groups</p>
        <p className="mt-2 font-sans text-sm text-brand-muted">
          Sign in to compare progress with family, friends, or a pilgrimage group.
        </p>
      </div>
    );
  }

  const onCreate = async (event) => {
    event.preventDefault();
    await createGroup({ name: name || "Sacred Bharat Group" });
    setName("");
  };
  const onJoin = async (event) => {
    event.preventDefault();
    if (!inviteCode.trim()) return;
    await joinGroup({ inviteCode });
    setInviteCode("");
  };

  return (
    <div className="rounded-lg border border-brand-light bg-white p-5">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-citius-blue" />
        <h2 className="font-heading text-lg text-brand-dark">Private groups</h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form onSubmit={onCreate} className="space-y-2">
          <input
            aria-label="Group name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Group name"
            className="w-full rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-citius-blue px-3 py-2 font-sans text-xs font-semibold text-white"
          >
            Create group
          </button>
        </form>
        <form onSubmit={onJoin} className="space-y-2">
          <input
            aria-label="Invite code"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="Invite code"
            className="w-full rounded-md border border-brand-light px-3 py-2 font-sans text-sm uppercase"
          />
          <button
            type="submit"
            className="rounded-md bg-brand-dark px-3 py-2 font-sans text-xs font-semibold text-white"
          >
            Join group
          </button>
        </form>
      </div>
      <div className="mt-5 grid gap-2">
        {(groups ?? []).map((group) => (
          <Link
            key={group.id}
            href={`/sacred-bharat/groups/${group.id}`}
            className="flex items-center justify-between rounded-md bg-brand-light/40 px-3 py-2 font-sans text-sm text-brand-dark"
          >
            <span>{group.name}</span>
            <span className="text-xs text-brand-muted">{group.inviteCode}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
