import { unstable_noStore } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import VendorPageClient from "./page.client";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata = {
  description: "Partner and supplier portal for Citius Holidays vendors.",
  title: "Vendor Portal | Citius Holidays",
};

export default async function VendorPage() {
  unstable_noStore();
  const { user } = await requireAuth("/vendor");

  return <VendorPageClient user={user} />;
}
