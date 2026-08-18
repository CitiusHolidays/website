/// <reference types="vite/client" />

// Include generated JavaScript alongside TypeScript source, while excluding
// every test file so integration specs are never registered as Convex modules.
export const modules = import.meta.glob([
  "./**/*.{js,ts}",
  "!./**/*.test.{js,jsx,ts,tsx}",
  "!./**/*.convex.integration.ts",
  "!./**/*.d.ts",
]);
