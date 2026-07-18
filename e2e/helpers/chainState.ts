/**
 * Shared state for serial critical-path specs (tickets 05–10).
 * Populated in-memory during a single Playwright worker run.
 */
export const e2eChain = {
  clientName: "",
  jobCode: "",
  proposalCode: "",
  queryCode: "",
  travellerName: "",
};

export function resetE2eChain() {
  e2eChain.clientName = "";
  e2eChain.queryCode = "";
  e2eChain.proposalCode = "";
  e2eChain.jobCode = "";
  e2eChain.travellerName = "";
}

export function uniqueE2eLabel(prefix: string) {
  return `${prefix} ${Date.now()}`;
}
