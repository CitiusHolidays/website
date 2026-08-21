import HomeHeroClient from "@/components/pages/HomeHeroClient";
import HomeMainClient from "@/components/pages/HomeMainClient";

export const generateMetadata = () => ({
  description:
    "MICE, corporate, and leisure travel planned by Citius Holidays. Offices in Delhi, Kolkata, and Bangalore.",
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
