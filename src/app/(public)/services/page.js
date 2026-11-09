import ServicesPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "MICE, visa assistance, event management, branding, sporting hospitality, and pilgrimage routes from Citius Holidays.",
  title: "Services",
});

export default function ServicesPage() {
  return <ServicesPageClient />;
}
