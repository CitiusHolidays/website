import Link from "next/link";
import PortalNavigationPalette from "@/components/portal/PortalNavigationPalette";
import { buttonVariants } from "@/components/ui/application-button-variants";

/** An unknown Staff Workspace address, shown inside the portal shell with a way back. */
export default function PortalNotFound() {
  return (
    <PortalNavigationPalette>
      <div
        className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm"
        data-portal-not-found=""
      >
        <h1 className="font-heading font-semibold text-citius-blue text-xl">
          This page does not exist
        </h1>
        <p className="mt-2 text-brand-muted text-sm">
          The link may be out of date, or the address may have a typo. Use the sidebar or go back to
          your workspace.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={buttonVariants({ variant: "primary" })} href="/portal">
            Go to your workspace
          </Link>
        </div>
      </div>
    </PortalNavigationPalette>
  );
}
