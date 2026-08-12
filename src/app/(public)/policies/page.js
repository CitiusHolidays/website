import PolicyContent from "./page.client";
import { resolvePolicyView } from "./policyView";

export const metadata = {
  description:
    "Billing Policy, Payment Gateway Policy, and Terms & Conditions for Citius Holidays.",
  title: "Policies & Terms | Citius Holidays",
};

// The selected policy must be resolved before any UI is rendered so loading and final content agree.
export const instant = false;

export default async function PoliciesPage({ searchParams }) {
  const query = await searchParams;
  const activeView = resolvePolicyView(query?.view);

  return (
    <div>
      <PolicyContent activeView={activeView} />
    </div>
  );
}
