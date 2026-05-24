import { unstable_noStore } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import VendorPageClient from "./page.client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vendor Portal | Citius Holidays",
  description: "Partner and supplier portal for Citius Holidays vendors.",
};

export default async function VendorPage() {
  unstable_noStore();
  const { user } = await requireAuth("/vendor");

  return <VendorPageClient user={user} />;
}
