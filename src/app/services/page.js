import ServicesPageClient from "./page.client";

export const generateMetadata = () => ({
  title: 'Services | Citius Travel Management',
  description: 'Explore the comprehensive suite of travel and event services offered by Citius, from MICE and VISA assistance to branding and sporting events.',
})

export default function ServicesPage() {
  return (
    <ServicesPageClient />
  );
}
