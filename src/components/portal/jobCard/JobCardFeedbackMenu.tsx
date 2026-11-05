"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, useState } from "react";
import { PortalActionMenu } from "@/components/portal/PortalActionMenu";

export function JobCardFeedbackMenu({
  jobCardId,
  jobCode,
}: {
  jobCardId: string;
  jobCode: string;
}) {
  const [open, setOpen] = useState(false);
  const base = `/portal/post-tour-feedback?jobCardId=${encodeURIComponent(jobCardId)}`;
  const trigger: ComponentProps<typeof PortalActionMenu>["trigger"] = (props) => (
    <button
      {...props}
      aria-label={`Feedback for ${jobCode}`}
      className="portal-small-btn min-h-11 gap-1 px-2"
      type="button"
    >
      Feedback
      <ChevronDown aria-hidden size={14} />
    </button>
  );
  return (
    <PortalActionMenu
      align="left"
      aria-label={`Feedback for ${jobCode}`}
      fitContent
      onOpenChange={setOpen}
      open={open}
      trigger={trigger}
    >
      <Link className="min-h-11 px-3 py-2 text-brand-dark text-sm" href={`${base}&view=report`}>
        Internal tour report
      </Link>
      <Link className="min-h-11 px-3 py-2 text-brand-dark text-sm" href={`${base}&view=managers`}>
        Earlier team notes
      </Link>
      <Link className="min-h-11 px-3 py-2 text-brand-dark text-sm" href={`${base}&view=travellers`}>
        Traveller feedback
      </Link>
    </PortalActionMenu>
  );
}
