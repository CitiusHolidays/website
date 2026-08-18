import { describe, expect, test } from "bun:test";
import { PORTAL_NAV_ICONS } from "@/components/portal/portalNavIconMap";
import { PORTAL_NAV_GROUPS } from "@/lib/portal/constants";

describe("PortalNavIcon", () => {
  test("Provides an icon for every CRM sidebar destination", () => {
    const navHrefs = PORTAL_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

    expect(Object.keys(PORTAL_NAV_ICONS).sort()).toEqual(navHrefs.sort());
  });
});
