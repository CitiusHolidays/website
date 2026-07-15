const SALES_PIPELINE_MOVE_ROLES = new Set([
  "Admin",
  "Director Cement",
  "Directors",
  "Sales",
  "Sales Cement",
  "Sales Head",
]);

const CONTRACTING_PIPELINE_MOVE_ROLES = new Set([
  "Admin",
  "Contracting",
  "Contracting Cement",
  "Contracting Head",
  "Director Cement",
  "Directors",
  "Head of Ticketing",
  "Ticketing",
]);

function hasPipelineRole(roles: string[], allowedRoles: Set<string>) {
  return roles.some((role) => allowedRoles.has(role));
}

export function canMoveSalesPipelineForAccess(canManageQueries: boolean, roles: string[]) {
  return canManageQueries && hasPipelineRole(roles, SALES_PIPELINE_MOVE_ROLES);
}

export function canMoveContractingPipelineForAccess(canManageProposals: boolean, roles: string[]) {
  return canManageProposals && hasPipelineRole(roles, CONTRACTING_PIPELINE_MOVE_ROLES);
}
