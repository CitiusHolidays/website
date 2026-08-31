import { notFound } from "next/navigation";
import {
  SacredBharatEditionRoute,
  sacredBharatEditionMetadata,
} from "@/components/sacredBharat/edition/SacredBharatEditionRoute";
import {
  getSacredBharatEdition,
  SACRED_BHARAT_EDITION_REGISTRY,
} from "@/data/sacredBharat/editionRegistry";

// Archive availability remains request-bound even though edition ids are file-backed.
export const instant = false;

export function generateStaticParams() {
  return SACRED_BHARAT_EDITION_REGISTRY.editions.map((edition) => ({
    editionId: edition.edition,
  }));
}

async function editionFromParams(params) {
  const { editionId } = await params;
  return getSacredBharatEdition(editionId);
}

export async function generateMetadata({ params }) {
  const edition = await editionFromParams(params);
  return edition ? await sacredBharatEditionMetadata(edition) : {};
}

export default async function SacredBharatArchivePage({ params }) {
  const edition = await editionFromParams(params);
  if (!edition) {
    notFound();
  }
  return <SacredBharatEditionRoute edition={edition} />;
}
