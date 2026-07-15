import { requireAuth } from "@/lib/auth-server";
import VendorPageClient from "./page.client";

// Vendor identity is resolved from request headers and must never enter a shared cache.
export const instant = false;

export const metadata = {
  description: "Partner and supplier portal for Citius Holidays vendors.",
  title: "Vendor Portal | Citius Holidays",
};

export default async function VendorPage() {
  const { user } = await requireAuth("/vendor");

  return <VendorPageClient user={user} />;
}
