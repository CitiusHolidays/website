import { Inter, Poppins } from "next/font/google";
import RuntimeInsights from "@/components/layout/RuntimeInsights";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

import "./globals.css";

const inter = Inter({
  display: "swap",
  style: ["normal", "italic"],
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
    "Citius Holidays plans MICE programmes, corporate travel, leisure trips, and pilgrimage routes across India and abroad.",
  metadataBase: new URL("https://www.citiusholidays.com"),
  openGraph: {
    description:
      "MICE, corporate, leisure, and pilgrimage travel planned by Citius Holidays. Offices in Delhi, Kolkata, and Bangalore.",
    images: [
      {
        alt: "Citius Holidays travel across Santorini",
        height: 630,
        url: "/social/citius-holidays-social-card.jpg",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: "Citius Holidays",
    title: "Citius Holidays — MICE, Corporate & Leisure Travel",
    type: "website",
    url: "https://www.citiusholidays.com",
  },
  title: {
    default: "Citius Holidays — MICE, Corporate & Leisure Travel",
    template: "%s | Citius Holidays",
  },
  twitter: {
    card: "summary_large_image",
    description:
      "MICE, corporate, leisure, and pilgrimage travel planned by Citius Holidays. Offices in Delhi, Kolkata, and Bangalore.",
    images: ["/social/citius-holidays-social-card.jpg"],
    title: "Citius Holidays — MICE, Corporate & Leisure Travel",
  },
};

export default async function RootLayout({ children }) {
  return (
    <html className={poppins.variable} lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} bg-brand-light font-sans text-brand-dark`}>
        <ConvexClientProvider>
          {children}
          <RuntimeInsights />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
