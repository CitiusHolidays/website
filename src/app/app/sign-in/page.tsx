import AppHandoffPage from "@/components/customerApp/AppHandoffPage";

export const metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Sign in to the app",
};

export default function AppSignInPage() {
  return <AppHandoffPage kind="sign-in" />;
}
