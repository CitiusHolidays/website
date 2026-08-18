import { Suspense } from "react";
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
        <div aria-label="Loading policy" className="min-h-[640px] bg-public-paper" role="status" />
      }
    >
      <PoliciesPageContent searchParams={searchParams} />
    </Suspense>
  );
}
