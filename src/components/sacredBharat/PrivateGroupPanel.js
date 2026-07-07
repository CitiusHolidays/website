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
        <p className="font-heading text-brand-dark text-lg">Private groups</p>
        <p className="mt-2 font-sans text-brand-muted text-sm">
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
    if (!inviteCode.trim()) {
      return;
    }
    await joinGroup({ inviteCode });
    setInviteCode("");
  };

  return (
    <div className="rounded-lg border border-brand-light bg-white p-5">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-citius-blue" />
        <h2 className="font-heading text-brand-dark text-lg">Private groups</h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form className="space-y-2" onSubmit={onCreate}>
          <input
            aria-label="Group name"
            className="w-full rounded-md border border-brand-light px-3 py-2 font-sans text-sm"
            onChange={(event) => setName(event.target.value)}
            placeholder="Group name"
            value={name}
          />
          <button
            className="rounded-md bg-citius-blue px-3 py-2 font-sans font-semibold text-white text-xs"
            type="submit"
          >
            Create group
          </button>
        </form>
        <form className="space-y-2" onSubmit={onJoin}>
          <input
            aria-label="Invite code"
            className="w-full rounded-md border border-brand-light px-3 py-2 font-sans text-sm uppercase"
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="Invite code"
            value={inviteCode}
          />
          <button
            className="rounded-md bg-brand-dark px-3 py-2 font-sans font-semibold text-white text-xs"
            type="submit"
          >
            Join group
          </button>
        </form>
      </div>
      <div className="mt-5 grid gap-2">
        {(groups ?? []).map((group) => (
          <Link
            className="flex items-center justify-between rounded-md bg-brand-light/40 px-3 py-2 font-sans text-brand-dark text-sm"
            href={`/sacred-bharat/groups/${group.id}`}
            key={group.id}
          >
            <span>{group.name}</span>
            <span className="text-brand-muted text-xs">{group.inviteCode}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
