import ContactPageClient from "./page.client";

export const generateMetadata = () => ({
  title: "Contact Citius | Get in Touch",
  description:
    "Contact Citius for any inquiries or bookings. Our team is here to help you with your travel needs.",
});

export default function ContactPage() {
  return (
    <ContactPageClient />
  );
}
