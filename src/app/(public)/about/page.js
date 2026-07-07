import AboutPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Learn about Citius, our history of consumer delight and our commitment to responsible tourism.",
  title: "About Citius | 15 Years of Travel Excellence",
});

export default function AboutPage() {
  return <AboutPageClient />;
}
