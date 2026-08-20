import { redirect } from "next/navigation";

export const metadata = {
  description: "Sacred Bharat — Sacred Details.",
  title: "Sacred Bharat",
};

export default function YatriPassportPage() {
  redirect("/sacred-bharat");
}
