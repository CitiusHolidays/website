import { Suspense } from "react";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
import PolicyContent from "./page.client";
import { resolvePolicyView } from "./policyView";

export const metadata = {
  description:
    "Billing Policy, Payment Gateway Policy, and Terms & Conditions for Citius Holidays.",
  title: "Policies & Terms | Citius Holidays",
};

async function PoliciesPageContent({ searchParams }) {
  const query = await searchParams;
  const activeView = resolvePolicyView(query?.view);

  return (
    <div>
      <PolicyContent activeView={activeView} />
    </div>
  );
}

export default function PoliciesPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <PublicRouteLoadingShell
          description="These policies govern bookings, cancellations, and travel with Citius Holidays."
          title="Legal & Policies"
          tone="dark"
        />
      }
    >
      <PoliciesPageContent searchParams={searchParams} />
    </Suspense>
  );
}
