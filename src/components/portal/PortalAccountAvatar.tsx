"use client";

import { UserRound } from "lucide-react";
import Image from "next/image";

export function PortalAccountAvatar({ image, name }: { image?: string | null; name: string }) {
  if (image) {
    return (
      <Image
        alt={`${name} profile photo`}
        className="size-8 rounded-full object-cover"
        height={32}
        src={image}
        width={32}
      />
    );
  }
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-citius-blue/10 text-citius-blue">
      <UserRound aria-hidden="true" size={16} />
    </span>
  );
}
