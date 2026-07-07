import ServicesPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Explore the comprehensive suite of travel and event services offered by Citius, from MICE and VISA assistance to branding and sporting events.",
  title: "Services | Citius Holidays Management",
});

export default function ServicesPage() {
  return <ServicesPageClient />;
}
