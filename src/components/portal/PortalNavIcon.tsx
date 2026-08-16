import { PORTAL_NAV_ICONS } from "@/components/portal/portalNavIconMap";
import { hasOwnKey } from "@/lib/runtimeValues";

export default function PortalNavIcon({ href }: { href: string }) {
  const Icon = hasOwnKey(PORTAL_NAV_ICONS, href) ? PORTAL_NAV_ICONS[href] : null;
  return Icon ? (
    <Icon aria-hidden="true" className="shrink-0" size={18} strokeWidth={1.75} />
  ) : null;
}
