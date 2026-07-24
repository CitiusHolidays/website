import { PORTAL_PERMISSIONS as P } from "./constants.js";
import { buildQueryStatusInitial } from "./queryStatusAction.js";

export function buildContractingSurfaceStatusAction(
  row: Parameters<typeof buildQueryStatusInitial>[0],
  has: (permission: string) => boolean
) {
  if (!has(P.MANAGE_CONTRACTING)) {
    return null;
  }
  return {
    initial: buildQueryStatusInitial(row),
    label: "Status",
    modal: "queryStatus" as const,
  };
}
