import ContactPageClient from "./page.client";

export const generateMetadata = () => ({
  description:
    "Contact Citius for any inquiries or bookings. Our team is here to help you with your travel needs.",
  title: "Contact Citius | Get in Touch",
});

export default function ContactPage() {
  return <ContactPageClient />;
}
