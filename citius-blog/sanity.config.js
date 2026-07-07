import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";

export default defineConfig({
  dataset: "production",
  name: "default",

  plugins: [structureTool(), visionTool()],

  projectId: "469zdu2i",

  schema: {
    types: schemaTypes,
  },
  title: "blog",
});
