import { Suspense } from "react";
import YatriPassportPageClient from "./page.client";

export const metadata = {
  description: "Public Sacred Bharat Yatri Passport with temple visits, trails, and badges.",
  title: "Yatri Passport | Sacred Bharat",
};

export default function YatriPassportPage({ params }) {
  return (
    <Suspense fallback={null}>
      <YatriPassportContent params={params} />
    </Suspense>
  );
}

async function YatriPassportContent({ params }) {
  const { slug } = await params;
  return <YatriPassportPageClient slug={slug} />;
}
