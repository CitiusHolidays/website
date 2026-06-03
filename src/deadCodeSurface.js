/**
 * Static-analysis surface for lib modules imported via `@/` aliases that
 * deslop-js does not resolve. Keeps named exports reachable from the app entry.
 */

import PilgrimageTrailPageClient from "./app/pilgrimage/[slug]/page.client.js";
import PilgrimagePageClient from "./app/pilgrimage/page.client.js";
import { DashboardView } from "./components/portal/dashboard/DashboardView.js";
import { EntityModal } from "./components/portal/EntityModal.js";
import { PortalDateRangeFilter } from "./components/portal/PortalDateRangeFilter.js";
import { PortalListFilters } from "./components/portal/PortalListFilters.js";
import * as portalModalForm from "./components/portal/PortalModalForm.js";
import { PortalSelectFilter } from "./components/portal/PortalSelectFilter.js";
import { SelectableDataTable } from "./components/portal/SelectableDataTable.js";
import { usePortalNotificationDeepLink } from "./components/portal/usePortalNotificationDeepLink.js";
import { usePortalWorkspaceState } from "./components/portal/usePortalWorkspaceState.js";
import AnimatedSubmitButton from "./components/ui/AnimatedSubmitButton.js";
import { renderFormattedText } from "./components/ui/ChatbotMessages.js";
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
import * as entityModalLinks from "./lib/portal/entityModalLinks.js";
import * as leaveMatrix from "./lib/portal/leaveMatrix.js";
import * as leavePolicy from "./lib/portal/leavePolicy.js";
import * as listFilterConfig from "./lib/portal/listFilterConfig.js";
import * as listFilters from "./lib/portal/listFilters.js";
import * as notificationPaths from "./lib/portal/notificationPaths.js";
import * as portalNotificationTargets from "./lib/portal/notificationTargets.js";
import * as patchReducer from "./lib/portal/patchReducer.js";
import * as portalPeriodFilter from "./lib/portal/periodFilter.js";
import * as portalPermissions from "./lib/portal/permissions.js";
import * as portalSpreadsheetExports from "./lib/portal/spreadsheetExports.js";
import * as portalSpreadsheetImports from "./lib/portal/spreadsheetImports.js";
import { syncNotificationDeepLink } from "./lib/portal/syncNotificationDeepLink.js";
import * as urlFilterState from "./lib/portal/urlFilterState.js";
import * as portalWorkflow from "./lib/portal/workflow.js";
import * as razorpay from "./lib/razorpay.js";
import * as guestStorage from "./lib/sacredBharat/guestStorage.js";
import * as sacredBharatScoring from "./lib/sacredBharat/scoring.js";

export const __srcExportSurface = [
  PilgrimagePageClient,
  PilgrimageTrailPageClient,
  AnimatedSubmitButton,
  TurnstileWidget,
  renderFormattedText,
  DashboardView,
  EntityModal,
  PortalDateRangeFilter,
  PortalListFilters,
  ...Object.values(portalModalForm),
  PortalSelectFilter,
  SelectableDataTable,
  usePortalWorkspaceState,
  usePortalNotificationDeepLink,
  syncNotificationDeepLink,
  ...Object.values(authClient),
  ...Object.values(authServer),
  ...Object.values(authSignInTargets),
  ...Object.values(contactSpamGuard),
  ...Object.values(emailSend),
  ...Object.values(entityModalLinks),
  ...Object.values(leaveMatrix),
  ...Object.values(leavePolicy),
  ...Object.values(listFilterConfig),
  ...Object.values(listFilters),
  ...Object.values(patchReducer),
  ...Object.values(notificationPaths),
  ...Object.values(portalConstants),
  ...Object.values(portalNotificationTargets),
  ...Object.values(portalPeriodFilter),
  ...Object.values(portalPermissions),
  ...Object.values(portalSpreadsheetExports),
  ...Object.values(portalSpreadsheetImports),
  ...Object.values(portalWorkflow),
  ...Object.values(urlFilterState),
  ...Object.values(razorpay),
  ...Object.values(guestStorage),
  ...Object.values(sacredBharatLevels),
  ...Object.values(sacredBharatScoring),
  ...Object.values(sacredBharatTemples),
  ...Object.values(sacredBharatTrails),
  ...Object.values(trails),
];
