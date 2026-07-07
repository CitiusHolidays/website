import PolicyContent from "./page.client";

export const metadata = {
  description:
    "Billing Policy, Payment Gateway Policy, and Terms & Conditions for Citius Holidays.",
  title: "Policies & Terms | Citius Holidays",
};

export default function PoliciesPage() {
  return (
    <div>
      <PolicyContent />
    </div>
  );
}
