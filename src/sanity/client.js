import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

export const client = createClient({
  apiVersion: "2025-02-19",
  dataset,
  perspective: "published",
  projectId,
  useCdn: true,
});
