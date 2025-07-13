import { createClient } from "next-sanity";

export const client = createClient({
  projectId: "469zdu2i",
  dataset: "production",
  apiVersion: "2025-07-07",
  useCdn: false,
});
