import { Suspense } from "react";
import { resolveContactDestination, resolveContactIntent } from "@/lib/public/contactIntent";
import ContactPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Contact Citius for any inquiries or bookings. Our team is here to help you with your travel needs.",
  title: "Contact Citius | Get in Touch",
});

async function ContactPageContent({ searchParams }) {
  const query = await searchParams;
  const contactIntent = resolveContactIntent(query?.intent);

  const destination =
    contactIntent === "event-photo-booth" ? resolveContactDestination(query?.destination) : "";
  return (
    <ContactPageClient
      contactIntent={contactIntent}
      destination={destination}
      key={`${contactIntent ?? "general"}:${destination}`}
    />
  );
}

export default function ContactPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <div
          aria-label="Loading contact form"
          className="min-h-[720px] bg-public-paper"
          role="status"
        />
      }
    >
      <ContactPageContent searchParams={searchParams} />
    </Suspense>
  );
}
