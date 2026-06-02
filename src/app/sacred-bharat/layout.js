import { SacredBharatProvider } from "@/components/sacredBharat/SacredBharatProvider";
import "../../data/sacredBharat/index.js";

export default function SacredBharatLayout({ children }) {
  return <SacredBharatProvider>{children}</SacredBharatProvider>;
}
