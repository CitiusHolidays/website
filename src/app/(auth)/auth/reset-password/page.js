import ResetPasswordPageClient from "./page.client";

export const metadata = {
  description: "Set a new password for your Citius Holidays account.",
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
