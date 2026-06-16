import YatriPassportPageClient from "./page.client";

export const metadata = {
  title: "Yatri Passport | Sacred Bharat",
  description: "Public Sacred Bharat Yatri Passport with temple visits, trails, and badges.",
};

export default async function YatriPassportPage({ params }) {
  const { slug } = await params;
  return <YatriPassportPageClient slug={slug} />;
}
