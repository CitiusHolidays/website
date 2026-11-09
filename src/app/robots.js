// Signed-in, auth, API, and personal-link routes. Each also renders noindex or
// requires a session; this keeps well-behaved crawlers from spending budget on them.
const PRIVATE_PATH_PREFIXES = [
  "/account",
  "/api/",
  "/app/invite",
  "/app/sign-in",
  "/auth",
  "/portal",
  "/tour-feedback",
  "/vendor",
];

export default function robots() {
  const baseUrl = "https://www.citiusholidays.com";

  if (process.env.VERCEL_ENV === "production") {
    return {
      rules: [
        {
          allow: "/",
          disallow: PRIVATE_PATH_PREFIXES,
          userAgent: "*",
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  }
  return {
    rules: [
      {
        disallow: "/",
        userAgent: "*",
      },
    ],
  };
}
