/** Server-only link so static analysis reaches the Convex HTTP entry and module graph. */
import http from "../../convex/http.ts";
import { __convexExportSurface } from "../../convex/_exportSurface.ts";
import crons from "../../convex/crons.ts";
import * as authAccountLinking from "../../convex/authAccountLinking.ts";
import * as email from "../../convex/email.ts";
import * as expenseAttachmentActions from "../../convex/crm/expenseAttachmentActions.ts";
import * as importActions from "../../convex/crm/importActions.ts";
import * as passport from "../../convex/crm/passport.ts";
import * as passportActions from "../../convex/crm/passportActions.ts";
import * as proposalAttachmentActions from "../../convex/crm/proposalAttachmentActions.ts";
import * as queryAttachmentActions from "../../convex/crm/queryAttachmentActions.ts";
import * as staffAction from "../../convex/crm/staffAction.ts";
import * as betterAuthApi from "../../convex/betterAuth/_generated/api.ts";
import * as betterAuthServer from "../../convex/betterAuth/_generated/server.ts";

import "../../convex/schema.ts";
import "../../convex/_runtimeModules.ts";
import "../../convex/betterAuth/adapter.ts";

function exportValues(module) {
  return Object.values(module).filter((value) => value != null);
}

/** Keeps Convex action modules and generated exports reachable for static analysis. */
export const __convexBackendManifest = [
  http,
  crons,
  ...__convexExportSurface,
  ...exportValues(authAccountLinking),
  ...exportValues(email),
  ...exportValues(expenseAttachmentActions),
  ...exportValues(importActions),
  ...exportValues(passport),
  ...exportValues(passportActions),
  ...exportValues(proposalAttachmentActions),
  ...exportValues(queryAttachmentActions),
  ...exportValues(staffAction),
  ...exportValues(betterAuthApi),
  ...exportValues(betterAuthServer),
];
