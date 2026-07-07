export default function robots() {
  const baseUrl = "https://www.citiusholidays.com";

  if (process.env.VERCEL_ENV === "production") {
    return {
      rules: [
        {
          allow: "/",
          disallow: "/admin",
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
