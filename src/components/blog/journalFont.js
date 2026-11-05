import { Newsreader } from "next/font/google";

/**
 * The Citius Journal's reading face, scoped to Journal surfaces through `--font-journal`.
 * Approved for the Journal by the product owner on 5 November 2026 ("we can do whatever looks
 * good"); it does not replace Poppins or Inter anywhere else on the public site.
 */
export const journalFont = Newsreader({
  axes: ["opsz"],
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-journal",
});
