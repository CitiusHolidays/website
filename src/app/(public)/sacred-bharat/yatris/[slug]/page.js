import { Suspense } from "react";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
import YatriPassportPageClient from "./page.client";

export const metadata = {
  description: "Public Sacred Bharat Yatri Passport with temple visits, trails, and badges.",
  title: "Yatri Passport | Sacred Bharat",
};

export default function YatriPassportPage({ params }) {
  return (
    <Suspense
      fallback={
        <PublicRouteLoadingShell
          description="Temple visits, trails, badges, and the Yatri's public journey are loading."
          eyebrow="Sacred Bharat"
          title="Yatri Passport"
          tone="sacred"
        />
      }
    >
      <YatriPassportContent params={params} />
    </Suspense>
  );
}

async function YatriPassportContent({ params }) {
  const { slug } = await params;
  return <YatriPassportPageClient slug={slug} />;
}
