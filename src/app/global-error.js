"use client";

import { Inter, Poppins } from "next/font/google";
import PublicRouteError from "@/components/layout/PublicRouteError";

import "./globals.css";

// Replaces the root layout when it fails, so it brings its own document, styles, and fonts.
const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});
const poppins = Poppins({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
});

export default function GlobalError({ error, retry }) {
  return (
    <html className={poppins.variable} lang="en">
      <body className={`${inter.variable} bg-public-night font-sans text-white`}>
        <title>Something went wrong | Citius Holidays</title>
        <PublicRouteError error={error} retry={retry} />
      </body>
    </html>
  );
}
