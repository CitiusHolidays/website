import AppHandoffPage from "@/components/customerApp/AppHandoffPage";

export const metadata = {
  referrer: "no-referrer",
  robots: { follow: false, index: false },
  title: "Your trip invite",
};

export default function AppInvitePage() {
  return <AppHandoffPage kind="invite" />;
}
