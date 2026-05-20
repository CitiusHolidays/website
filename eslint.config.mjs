import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "convex/_generated/**",
      "convex/betterAuth/_generated/**",
      "citius-blog/dist/**",
      "citius-blog/.next/**",
      "tools/**",
    ],
  },
];

export default eslintConfig;
