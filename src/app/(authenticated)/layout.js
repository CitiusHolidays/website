import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";

export default function AuthenticatedLayout({ children }) {
  // The authenticated Customer Account owns its chrome. Reusing the marketing header/footer here
  // makes the private dashboard look like a public page and can layer a light header over the
  // account's dark rail.
  return <ReducedMotionProvider>{children}</ReducedMotionProvider>;
}
