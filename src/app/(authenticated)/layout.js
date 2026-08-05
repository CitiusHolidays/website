import ReducedMotionProvider from "@/components/providers/ReducedMotionProvider";

export default function AuthenticatedLayout({ children }) {
  // Authenticated customer/vendor surfaces own their chrome. Reusing the
  // marketing header/footer here makes private dashboards look like public
  // pages and can layer a light header over the account's dark rail.
  return <ReducedMotionProvider>{children}</ReducedMotionProvider>;
}
