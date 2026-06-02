/**
 * Static-analysis surface for lib modules imported via `@/` aliases that
 * deslop-js does not resolve. Keeps named exports reachable from the app entry.
 */

import PilgrimageTrailPageClient from "./app/pilgrimage/[slug]/page.client.js";
import PilgrimagePageClient from "./app/pilgrimage/page.client.js";
import AnimatedSubmitButton from "./components/ui/AnimatedSubmitButton.js";
import TurnstileWidget from "./components/ui/TurnstileWidget.js";
import * as sacredBharatLevels from "./data/sacredBharat/levels.js";
import * as sacredBharatTemples from "./data/sacredBharat/temples.js";
import * as sacredBharatTrails from "./data/sacredBharat/trails.js";
import * as trails from "./data/trails.js";
import * as authClient from "./lib/auth-client.js";
import * as authServer from "./lib/auth-server.js";
import * as authSignInTargets from "./lib/auth-sign-in-targets.js";
import * as contactSpamGuard from "./lib/contact/spam-guard.js";
import * as emailSend from "./lib/email/send.js";
import * as portalConstants from "./lib/portal/constants.js";
import * as portalNotificationTargets from "./lib/portal/notificationTargets.js";
import * as portalPeriodFilter from "./lib/portal/periodFilter.js";
import * as portalPermissions from "./lib/portal/permissions.js";
import * as portalSpreadsheetExports from "./lib/portal/spreadsheetExports.js";
import * as portalSpreadsheetImports from "./lib/portal/spreadsheetImports.js";
import * as portalWorkflow from "./lib/portal/workflow.js";
import * as razorpay from "./lib/razorpay.js";
import * as guestStorage from "./lib/sacredBharat/guestStorage.js";

export const __srcExportSurface = [
  PilgrimagePageClient,
  PilgrimageTrailPageClient,
  AnimatedSubmitButton,
  TurnstileWidget,
  ...Object.values(authClient),
  ...Object.values(authServer),
  ...Object.values(authSignInTargets),
  ...Object.values(contactSpamGuard),
  ...Object.values(emailSend),
  ...Object.values(portalConstants),
  ...Object.values(portalNotificationTargets),
  ...Object.values(portalPeriodFilter),
  ...Object.values(portalPermissions),
  ...Object.values(portalSpreadsheetExports),
  ...Object.values(portalSpreadsheetImports),
  ...Object.values(portalWorkflow),
  ...Object.values(razorpay),
  ...Object.values(guestStorage),
  ...Object.values(sacredBharatLevels),
  ...Object.values(sacredBharatTemples),
  ...Object.values(sacredBharatTrails),
  ...Object.values(trails),
];
