import { notFound } from "next/navigation";

// Unknown /portal/* addresses render src/app/portal/not-found.js inside the portal shell instead of
// the root 404, which has no shell and points at staff sign-in.
export default function PortalMissingPage() {
  notFound();
}
