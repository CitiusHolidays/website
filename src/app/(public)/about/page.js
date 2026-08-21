import AboutPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Citius Holidays — 15 years in MICE and corporate travel. Meet the team, read our mission, and learn how we work.",
  title: "About Citius | 15 Years in Travel",
});

export default function AboutPage() {
  return <AboutPageClient />;
}
