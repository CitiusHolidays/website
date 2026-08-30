import { redirect } from "next/navigation";

export const metadata = {
  description: "Vendor access is unavailable. Contact Citius Holidays for partner assistance.",
  title: "Vendor Access Unavailable | Citius Holidays",
};

export default function VendorAuthPage() {
  redirect("/contact");
}
