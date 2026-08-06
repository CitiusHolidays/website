import { PORTAL_NAV_ICONS } from "@/components/portal/portalNavIconMap";

export default function PortalNavIcon({ href }: { href: string }) {
  const Icon = PORTAL_NAV_ICONS[href];
  return Icon ? (
    <Icon aria-hidden="true" className="shrink-0" size={18} strokeWidth={1.75} />
  ) : null;
}
