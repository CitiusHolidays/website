import { redirect } from "next/navigation";

export const metadata = {
  description: "Sacred Bharat / 001 — Sacred Details.",
  title: "Sacred Bharat / 001",
};

export default function YatriPassportPage() {
  redirect("/sacred-bharat/001");
}
