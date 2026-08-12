import { resolveContactIntent } from "@/lib/public/contactIntent";
import ContactPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Contact Citius for any inquiries or bookings. Our team is here to help you with your travel needs.",
  title: "Contact Citius | Get in Touch",
});

// Contact intent is request URL state and must prefill the first rendered form consistently.
export const instant = false;

export default async function ContactPage({ searchParams }) {
  const query = await searchParams;
  const contactIntent = resolveContactIntent(query?.intent);

  return <ContactPageClient contactIntent={contactIntent} key={contactIntent ?? "general"} />;
}
