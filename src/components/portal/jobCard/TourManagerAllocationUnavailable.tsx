import Link from "next/link";
import { buttonVariants } from "@/components/ui/application-button-variants";

/** A Tour Manager allocation link whose Job Card the caller cannot open, in the error-panel card. */
export default function TourManagerAllocationUnavailable() {
  return (
    <div
      className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm"
      data-portal-route-error="missing"
      role="alert"
    >
      <h1 className="font-heading font-semibold text-citius-blue text-xl">
        This Job Card is not available
      </h1>
      <p className="mt-2 text-brand-muted text-sm">
        The allocation may have been removed, or your role does not include this Job Card.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className={buttonVariants({ variant: "primary" })} href="/portal/job-cards">
          Go to Job Cards
        </Link>
      </div>
    </div>
  );
}
