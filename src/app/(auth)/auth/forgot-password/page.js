import ForgotPasswordPageClient from "./page.client";

export const metadata = {
  description: "Request a secure password reset link for your Citius Holidays account.",
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
