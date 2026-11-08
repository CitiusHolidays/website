import { Suspense } from "react";
import PolicyContent from "./page.client";
import { resolvePolicyView } from "./policyView";

export const metadata = {
  description:
    "Terms & Conditions, Billing & Payment Policy, and Privacy Policy for Citius Holidays.",
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
