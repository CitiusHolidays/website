import { redirect } from "next/navigation";
import { sacredBharatEditionHref } from "@/lib/sacredBharat/editionHref";

export default async function SacredBharatEditionAliasPage({ searchParams }) {
  redirect(sacredBharatEditionHref(await searchParams));
}
