import { Inter, Poppins } from "next/font/google";
import RuntimeInsights from "@/components/layout/RuntimeInsights";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

import "./globals.css";

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

export const metadata = {
  description:
    "Experience the extraordinary. Citius Holidays curates bespoke luxury getaways and adventurous expeditions designed for the discerning traveler.",
  metadataBase: new URL("https://www.citiusholidays.com"),
  openGraph: {
    description:
      "Citius Holidays offers bespoke travel experiences, from luxury getaways to adventurous expeditions. Discover your next journey with us.",
    images: [
      {
        alt: "Citius Holidays",
        height: 630,
        url: "/gallery/aboutus.webp",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: "Citius Holidays",
    title: "Citius Holidays - Your Trusted Travel Partner",
    type: "website",
    url: "https://www.citiusholidays.com",
  },
  title: {
    default: "Citius Holidays - Bespoke Journeys & Luxury Escapes",
    template: "%s | Citius Holidays",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "Citius Holidays offers bespoke travel experiences, from luxury getaways to adventurous expeditions. Discover your next journey with us.",
    images: ["/gallery/aboutus.webp"],
    title: "Citius Holidays - Your Trusted Travel Partner",
  },
};

export default async function RootLayout({ children }) {
  return (
    <html className={`${poppins.variable} font-heading`} lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} bg-brand-light font-sans text-brand-dark`}>
        <ConvexClientProvider>
          {children}
          <RuntimeInsights />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
