/** Explains why a login without staff access landed here from `/portal` (`?portal=unauthorized`). */
export default function AccountPortalNotice() {
  return (
    <p
      className="account-card mb-8 rounded-2xl px-5 py-4 text-[var(--account-ink)] text-sm leading-6"
      role="status"
    >
      Citius Connect is the workspace for Citius Holidays staff, and this sign-in does not have
      staff access, so we have brought you to your Travel Account. If you work for us, ask your
      administrator to give your login access.
    </p>
  );
}
