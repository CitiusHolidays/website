import process from "node:process";
import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";

const dataset = process.env.SANITY_DATASET ?? "development";

export default defineConfig({
  dataset,
  name: "default",

  plugins: [structureTool(), visionTool()],

  projectId: "469zdu2i",

  schema: {
    types: schemaTypes,
  },
  title: "blog",
});
