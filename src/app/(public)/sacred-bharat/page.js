import {
  SacredBharatEditionRoute,
  sacredBharatEditionMetadata,
} from "@/components/sacredBharat/edition/SacredBharatEditionRoute";
import { resolveSacredBharatEdition } from "@/data/sacredBharat/editionRegistry";
import { isRuntimeString } from "@/lib/runtimeValues";

// Edition availability and legacy share selection are resolved for each request.
export const instant = false;

const SHARE_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

async function editionForRoot(searchParams) {
  const parameters = await searchParams;
  const via = isRuntimeString(parameters?.via) ? parameters.via : null;
  return resolveSacredBharatEdition({
    hasLegacyShareToken: via !== null && SHARE_TOKEN_PATTERN.test(via),
  });
}

export async function generateMetadata({ searchParams }) {
  return await sacredBharatEditionMetadata(await editionForRoot(searchParams));
}

export default async function SacredBharatPage({ searchParams }) {
  return <SacredBharatEditionRoute edition={await editionForRoot(searchParams)} />;
}
