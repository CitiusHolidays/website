import EmailVerifiedPageClient from "./page.client";

export const metadata = {
  description: "Your Citius Holidays email address has been verified.",
  title: "Email Verified",
};

export default function EmailVerifiedPage() {
  return <EmailVerifiedPageClient />;
}
