import { Inter, Poppins } from "next/font/google";
import Footer from "../components/layout/Footer";
import Header from "../components/layout/Header";
import DeferredChatbot from "../components/ui/DeferredChatbot";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { getToken } from "@/lib/auth-server";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://www.citiusholidays.com"),
  title: {
    default: "Citius Travel - Bespoke Journeys & Luxury Escapes",
    template: `%s | Citius Travel`,
  },
  description:
    "Experience the extraordinary. Citius Travel curates bespoke luxury getaways and adventurous expeditions designed for the discerning traveler.",
  openGraph: {
    title: "Citius Travel - Your Trusted Travel Partner",
    description:
      "Citius Travel offers bespoke travel experiences, from luxury getaways to adventurous expeditions. Discover your next journey with us.",
    url: "https://www.citiusholidays.com",
    siteName: "Citius Travel",
    images: [
      {
        url: "/gallery/aboutus.webp",
        width: 1200,
        height: 630,
        alt: "Citius Travel",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Citius Travel - Your Trusted Travel Partner",
    description:
      "Citius Travel offers bespoke travel experiences, from luxury getaways to adventurous expeditions. Discover your next journey with us.",
    images: ["/gallery/aboutus.webp"],
  },
};

export default async function RootLayout({ children }) {
  const initialToken = await getToken().catch(() => null);

  return (
    <html lang="en" className={`${poppins.variable} font-heading`}>
      <body
        className={`${inter.variable} font-sans bg-brand-light text-brand-dark`}
      >
        <ConvexClientProvider initialToken={initialToken}>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 w-full">
              {children}
              <Analytics/>
              <SpeedInsights/>
            </main>
            <Footer />
            <DeferredChatbot />
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
