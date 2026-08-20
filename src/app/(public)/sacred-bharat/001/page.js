import { redirect } from "next/navigation";
import { sacredBharatEditionHref } from "@/lib/sacredBharat/editionHref";

// Legacy /001 URLs read request searchParams so share tokens survive the canonical path.
export const instant = false;

export default async function SacredBharatEditionAliasPage({ searchParams }) {
  redirect(sacredBharatEditionHref(await searchParams));
}
