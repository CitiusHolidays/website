import { Suspense } from "react";
import PublicRouteLoadingShell from "@/components/layout/PublicRouteLoadingShell";
import { resolvePilgrimageTrailContactContext } from "@/data/trails";
import { getContactIntentPrefill, resolveContactIntent } from "@/lib/public/contactIntent";
import ContactPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Contact Citius for any inquiries or bookings. Our team is here to help you with your travel needs.",
  title: "Contact Citius | Get in Touch",
});

async function ContactPageContent({ searchParams }) {
  const query = await searchParams;
  const contactIntent = resolveContactIntent(query?.intent);
  const pilgrimageTrail =
    contactIntent === "pilgrimage-callback" || contactIntent === "pilgrimage-enquiry"
      ? resolvePilgrimageTrailContactContext(query?.trail)
      : null;
  const initialValues = {
    ...getContactIntentPrefill(contactIntent, pilgrimageTrail),
  };

  return (
    <ContactPageClient
      initialValues={initialValues}
      key={`${contactIntent ?? "general"}:${pilgrimageTrail?.slug ?? "general"}`}
    />
  );
}

export default function ContactPage({ searchParams }) {
  return (
    <Suspense
      fallback={
        <PublicRouteLoadingShell
          description="Tell us your dates, group size, and destination. Our team will contact you to discuss your plans."
          title="Get in Touch"
        />
      }
    >
      <ContactPageContent searchParams={searchParams} />
    </Suspense>
  );
}
