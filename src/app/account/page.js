import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserBookings } from "@/lib/db/queries";
import AccountClient from "./page.client.js";

export const metadata = {
  title: "My Account | Citius Travel",
  description: "Manage your bookings and profile settings.",
};

export default async function AccountPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  const bookings = await getUserBookings(session.user.id);

  return <AccountClient user={session.user} bookings={bookings} />;
}




