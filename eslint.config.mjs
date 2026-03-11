import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: ["convex/_generated/**"],
  },
];
