import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

export const client = createClient({
  projectId,
  dataset,
  apiVersion: "2025-02-19",
  useCdn: true,
  perspective: "published",
});
