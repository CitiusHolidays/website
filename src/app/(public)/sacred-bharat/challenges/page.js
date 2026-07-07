import ChallengeGrid from "@/components/sacredBharat/ChallengeGrid";

export const metadata = {
  description: "Curated Sacred Bharat challenges based on honor-system temple visits and trails.",
  title: "Sacred Bharat Challenges",
};

export default function SacredBharatChallengesPage() {
  return (
    <main className="min-h-screen bg-[#fdfcfb] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="font-heading text-3xl text-brand-dark">Sacred Bharat challenges</h1>
          <p className="mt-2 max-w-2xl font-sans text-brand-muted text-sm">
            Seasonal and trail-based goals for yatris. Visits remain self-declared on an honor
            system.
          </p>
        </div>
        <ChallengeGrid />
      </div>
    </main>
  );
}
