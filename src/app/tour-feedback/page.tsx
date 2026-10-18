import TravelerFeedbackForm from "@/components/travelerFeedback/TravelerFeedbackForm";
export const metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Tour feedback",
};
export default function TourFeedbackPage() {
  return <TravelerFeedbackForm />;
}
