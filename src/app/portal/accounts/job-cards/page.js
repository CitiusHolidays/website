import PortalWorkspace from "@/components/portal/PortalWorkspace";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function PortalAccountsJobCardsPage() {
  return <PortalWorkspace view="accounts-job-cards" />;
}
