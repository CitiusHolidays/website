export default function robots() {
  const baseUrl = "https://www.citiusholidays.com";

  if (process.env.VERCEL_ENV === "production") {
    return {
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: "/admin",
        },
      ],
      sitemap: `${baseUrl}/sitemap.xml`,
    };
  } else {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }
}
