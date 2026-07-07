import HomeHeroClient from "@/components/pages/HomeHeroClient";
import HomeMainClient from "@/components/pages/HomeMainClient";

export const generateMetadata = () => ({
  description:
    "Leading travel agency for MICE, corporate, and leisure travel. Discover curated itineraries and experiential journeys with Citius.",
  title: "Citius | We Inspire to Travel",
});

export default function HomePage() {
  return (
    <>
      <HomeHeroClient />
      <HomeMainClient />
    </>
  );
}
