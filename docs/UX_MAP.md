# UX map

A route-by-route description of what each part of the site does, who can reach it, where it
links, and every state it can show. It was built from the code at `f8ae8eac` (main, 9 Nov 2026),
checked against a local run, and updated for the fixes listed under [Known gaps](#known-gaps).
Every claim names the file that implements it.

This page describes behaviour. It does not authorize a redesign: [DESIGN.md](../DESIGN.md) owns
UI decisions, [roles and access](PORTAL_ROLES_AND_ACCESS.md) owns permissions, and executable
policy wins when it and this page disagree. Update the rows you touch when you change a route.

## How to read this page

- **Seen locally** means the state was observed with Playwright against `next dev` on
  `localhost:3000`, bound to the development Convex deployment. Signed-in states used only the
  seeded test accounts from `config/e2e-staff-profiles.json` and the seeded customer fixture
  (`convex/crm/e2eSeedActions.ts:252`). The local run had no Sanity project configured, so every
  Sanity-backed public page returned 500 locally; those pages are code-verified only.
- **Code-verified only** means the state was traced in source but not observed.
- Paths are relative to the repository root. `src/app/(public)/...` is shortened to `(public)/...`
  where the group is obvious.

## Surfaces at a glance

| Surface | Routes | Chrome | Gate |
| --- | --- | --- | --- |
| Public site | `src/app/(public)/**` | Header, footer, Concierge (`src/components/layout/AppChrome.js`); hidden on `/photo-booth` and `/sacred-bharat/*` (`src/lib/publicRouteChrome.js:2-8`) | None |
| Stand-alone public entry points | `/tour-feedback`, `/app/invite`, `/app/sign-in`, root 404 | Own minimal page, no public chrome | Token in the URL fragment, where used |
| Authentication | `src/app/(auth)/auth/**` | `AuthShell` scenic layout (`src/components/auth/AuthShell.js`) | Signed-in visitors are redirected away (`src/lib/auth-login-pages.js:33-35`) |
| Customer Travel Account | `/account` | Account rail (`src/components/account/`) | Any session (`src/app/(authenticated)/account/page.js:23`) |
| Vendor placeholder | `/vendor` | Own header | Any session (`src/app/(authenticated)/vendor/page.js:15`) |
| Staff Workspace | `src/app/portal/**` | `PortalShell` (`src/components/portal/PortalShell.tsx`) | Session plus staff access (`src/app/portal/PortalAuthBoundary.js:26-34`) |
| HTTP API | `src/app/api/**`, `src/app/.well-known/**` | n/a | Per route |

`src/proxy.js` matches only `/portal` and `/portal/*`: it copies the requested path and query
into the `x-citius-return-path` request header (`src/lib/requestReturnPath.js`, which overwrites
any client-sent value), because a layout cannot read the pathname. It never redirects.
`next.config.mjs` defines no redirects or rewrites, so every redirect below comes from a page, a
layout, or a client component.

## Cross-cutting behaviour

### Sign-in redirects

| Request | Result | Evidence |
| --- | --- | --- |
| Signed out, `/portal` or any `/portal/*` | `/auth/connect?returnTo=<path and query>` | `src/app/portal/PortalAuthBoundary.js` reads the proxy header and passes it to `requireAuth` (`src/lib/auth-server.js`), which keeps it only if `resolveAuthReturnPath` accepts it. Seen locally for `/portal/queries?open=x` |
| Signed out, `/account` (with or without `?tab=`) | `/auth/guest?returnTo=/account`, with `?tab=` kept when it names a real tab | `src/app/(authenticated)/account/page.js`. Seen locally for `?tab=settings` |
| Signed out, `/vendor` | `/auth/vendor` | `src/app/(authenticated)/vendor/page.js:15`. Seen locally |
| `/auth` (legacy) | `/auth/guest`, or the variant whose `href` equals `callbackUrl`; keeps `error` and `mode` only | `src/lib/auth-login-pages.js:50-64`. Seen locally |
| Signed in, any login page | `returnTo` if it is inside that variant's area, else the variant home (`/portal`, `/account`, `/vendor`) | `src/lib/auth-login-pages.js:31-35`, `src/lib/auth-return-path.js:12-35`. Seen locally for staff and customer |
| Signed in without staff access, `/portal/*` | `/account?portal=unauthorized`; the Account shows a status note that Citius Connect is the staff workspace, this sign-in has no staff access, and staff should ask their administrator | `src/app/portal/PortalAuthBoundary.js`, `src/components/account/AccountPortalNotice.js`. Redirect seen locally with the customer fixture; the note is covered by `AccountPortalNotice.test.jsx` and `account/page.test.js` |
| Signed-in staff, `/auth/guest` or `/account` | The customer Account; `ensureMyProfile` creates a customer profile for the staff login on first visit | `src/app/(authenticated)/account/page.js:34`. Seen locally with the Sales account |

`returnTo` is honoured after an email or Google sign-in (`src/components/auth/AuthLoginCredentials.js`).
The signed-out redirects above and the Account deletion flow (`src/components/account/AccountDeletionSection.tsx:20`)
set it.

### Error, not-found and loading boundaries

| Boundary | Covers | Shows |
| --- | --- | --- |
| `src/app/not-found.js` | Every unmatched URL outside `/portal` | "Page not found", links to `/` and `/auth/connect`, no public or portal chrome. Seen locally for `/nope` and `/inbound-leads` |
| `src/app/portal/not-found.js` | Unknown `/portal/*` paths (`src/app/portal/[...missing]/page.js` calls `notFound()`) | Inside the portal shell, so only after the portal sign-in and staff checks: "This page does not exist" with "Go to your workspace" → `/portal` and the command palette (`src/components/portal/PortalNotFound.tsx`). Covered by `portalNotFound.test.jsx`; signed-out `/portal/nope` → `/auth/connect?returnTo=/portal/nope` |
| `src/app/(auth)/error.js` | Auth pages | Scenic `PrivateAuthError`: "We couldn’t verify your session", Try again, Return to sign in (`/auth/guest` for every auth page) |
| `src/app/(authenticated)/error.js` | `/account`, `/vendor` | Plain `PrivateAuthError`, same copy, Return to sign in → `/auth/guest` |
| `src/app/portal/error.js` | Every portal page without its own boundary | `PortalRouteError` inside the portal shell (see [Staff Workspace errors](#staff-workspace-errors)) |
| `src/app/portal/{travel-schedule,external-tour-managers}/error.tsx` | Those pages | The same `PortalRouteError` |
| `src/app/portal/post-tour-feedback/error.tsx` | That page | "Feedback could not be loaded" with Try again |
| `src/app/(public)/photo-booth/error.tsx` | `/photo-booth` | Retry and a link to `/` |
| `src/app/portal/queries/loading.js` | `/portal/queries` | `QueriesLoadingPanel` |

There is no `global-error`, no root `error.js`, no `loading.js` under `(public)`, and no error
boundary for the other public pages. A failure in a layout (for example `syncMyPortalAccess` in
`PortalAuthBoundary.js:20-30`) or in a public Sanity fetch falls through to Next's default error
page. Locally, `/gallery`, `/mice`, `/pilgrimage`, `/pilgrimage/[slug]`, `/blog` and `/blog/[slug]`
returned that page because no Sanity project was configured (`src/sanity/cachedFetch.js:22`).

### Document titles

The root layout sets the template `%s | Citius Holidays` (`src/app/layout.js:39-42`), so route
titles name only the page (for example "Policies & Terms | Citius Holidays", seen locally);
`src/app/metadataTitleSuffix.contract.test.ts` keeps the brand from being repeated. The portal
layout title is absolute, "Citius Connect" (`src/app/portal/layout.js`). Portal pages set their own
title on the client as `<page> | Citius Connect` (`src/components/portal/workspace/portalRouteLifecycle.tsx`);
pages outside `PortalWorkspace` keep "Citius Connect".

## Public site

Chrome: `src/components/layout/AppChrome.js` and `AppChromeFrame.js`.

| Element | Links | Signed-in difference |
| --- | --- | --- |
| Header nav (`Header.js:18-26`) | `/`, `/about`, `/services`, `/mice`, Spiritual Trails menu (`/pilgrimage`, `/pilgrimage/{slug}`, `HeaderSpiritualTrailsDropdown.js:106,115`), `/gallery`, `/blog`, `/contact`; CTA "Let's Talk" → `/contact` | — |
| Sign in (`HeaderSignInDropdown.js:84-101`) | Citius Connect → `/auth/connect`, Guest Connect → `/auth/guest`; the vendor option is hidden (`auth-sign-in-targets.js:61`) | Replaced by the user menu |
| User menu (`HeaderUserMenu.js:124-151`) | My Account → `/account`, Sign Out → `/` | Employee Portal → `/portal` only when `getMyPortalAccess.allowed` (`Header.js:41-42`) |
| Mobile sheet (`HeaderMobileMenu.js`) | Same inventory; "Plan your trip" → `/contact`; "Checking your account…" while the session loads | Same as desktop |
| Footer (`Footer.js:67-199`) | `/`, `/about`, `/services`, `/mice`, `/pilgrimage`, `/gallery`, `/blog`, `/contact`, `/policies`, `/policies?view=terms` and `?view=billing` (new tab), social, `tel:` | — |

Every internal `href` on the public site resolves to a route (code-verified; the header and footer
inventory was seen locally on `/`, `/about`, `/services`, `/contact` and `/policies`).

| Route | Purpose and data | States | Links out | Evidence |
| --- | --- | --- | --- | --- |
| `/` | Home; static data (`src/data/publicServices`, `publicCompanyFacts`, `trendingDestinations`) | Lazy sections show skeletons (`HomeMainClient.js:48-59`); no error state | `/contact`, `/services` | Seen locally |
| `/about` | Company story; static | Static | Ends with the standard "Planning a trip or event?" call to action → `/contact` (`src/components/ui/PublicPlanningCta.js`) | Seen locally |
| `/services` | Services wheel (`CircularServicesMenu.js`); static | Static | The wheel uses buttons; the page ends with the standard planning call to action → `/contact` | Seen locally |
| `/mice` | MICE pitch; Sanity images with static fallback (`mice/page.client.js:92`) | Fallback images when Sanity is empty; a Sanity failure is unhandled | `/contact?intent=mice-proposal`, `/gallery` | Code-verified only (500 locally, no Sanity) |
| `/gallery` | Photo grid and lightbox; Sanity (`gallery/page.js:11`) | No empty state (`GalleryGrid.js:168`); no error state | Chrome only | Code-verified only |
| `/contact` | Enquiry form → `/api/inbound-intents` (`ModernContactForm.js:255`); `?intent=` prefills; `?intent=account-deletion` redirects to `/account?tab=settings#delete-account` (`contact/page.js:19-21`) | Suspense fallback; inline field and form errors; success replaces the form with "Thank you, your enquiry is with us", moves focus to it, and stays until "Send another enquiry" brings back an empty form; a live region outside the form announces it (`ModernContactForm.js`). Success seen locally with the API response stubbed in the browser | `tel:`, `mailto:` | Default state seen locally |
| `/policies` | Terms and Billing tabs, `?view=terms|billing` (`policyView.js:6-8`) | Suspense fallback | `/contact`, tabs | Seen locally |
| `/pilgrimage` | Spiritual Trails hub; static trails plus Sanity gallery | Gallery heading renders over an empty gallery (`pilgrimage/page.client.js:206-224`) | `/pilgrimage/{slug}`, `/contact`, sticky mobile bar with `?intent=pilgrimage-callback|enquiry` | Code-verified only |
| `/pilgrimage/[slug]` | Trail detail; 8 static slugs, 6 marked coming soon | Suspense fallback (`[slug]/page.js:73-81`); unknown slug → `notFound()` (`:91-93`); coming-soon trails say "not yet open for booking" (`TrailSection.js:79-82`) and their closing call asks the visitor to register interest instead of promising departure batches (`trailSection/TrailShell.js`, `TrailCta`) | `/contact` for every booking option; the closing call → `/contact?intent=pilgrimage-enquiry`; `/blog/{slug}` when a trail has related posts (none do); "All spiritual trails" back link → `/pilgrimage#all-trails` (`TrailHeroSlideshow.js`) | Code-verified only (500 locally, no Sanity); covered by `TrailShell.mounted.test.jsx` and `TrailHeroSlideshow.test.jsx` |
| `/blog`, `/blog/[slug]` | Citius Journal; Sanity | Index empty state "The first story is on its way" (`blog/page.js:222-233`); story skeleton (`[slug]/page.js:124-146`); unknown slug → `notFound()` (`:239-241`); empty body "This story has no text yet." | `/blog/{slug}`, `/pilgrimage/{slug}`, `/contact` | Code-verified only |
| `/photo-booth` | Event Photo Booth; Convex `getParticipantState`; no chrome, noindex | "Checking", closed notice, no-scenes notice, error boundary; success offers download/share then an enquiry link (`EventPhotoBooth.tsx:329-369,795`) | `/`, `/pilgrimage`, `/policies`, `/contact?intent=event-photo-booth` | Closed/default state seen locally |
| `/sacred-bharat` | Sacred Bharat edition 001; gated by the runtime control `public.sacred_bharat_001`, fails closed (`sacred-bharat/page.js:48-60`) | "Edition under review" when disabled (`:67-95`) | `/pilgrimage`, `/`, image credits | Open edition seen locally |
| `/sacred-bharat/001`, `challenges`, `leaderboard`, `groups/[id]`, `trails/[slug]`, `yatris/[slug]` | Legacy URLs | Redirect to `/sacred-bharat` (`001` keeps the query string) | — | `/sacred-bharat/leaderboard` seen locally |

### Stand-alone public entry points

| Route | Purpose | States | Links | Evidence |
| --- | --- | --- | --- | --- |
| `/tour-feedback#token` | Traveller trip feedback (`src/components/travelerFeedback/TravelerFeedbackForm.tsx`) | Loading; "Feedback form unavailable" with Try again for a missing, malformed or expired token (`:490-498`); success "Thank you for sharing." plus optional photos (`:276-292`) | `/` | Missing-token state seen locally |
| `/app/invite#token`, `/app/sign-in#token` | Hand a token to the Citius app (`src/components/customerApp/AppHandoffPage.tsx`) | Button to the app deep link; "This link is incomplete or has expired." (`:58-61`) | None | Missing-token state seen locally |
| Root 404 | `src/app/not-found.js` | Static | `/`, `/auth/connect` | Seen locally |

`src/app/sitemap.js` lists public pages only (guarded by `src/app/sitemap.test.js`) and omits
`/sacred-bharat`.
`src/app/robots.js:9` disallows `/admin`, which does not exist.

## Authentication

All pages render inside `AuthShell` with a logo and "Back to website" → `/`
(`src/components/auth/AuthShell.js:24-38`). In sign-in mode, `/auth/connect` links to guest sign-in
("Booked a trip with us?") and `/auth/guest` links to Citius Connect ("Citius Holidays staff?");
`/auth/vendor` has neither (`AuthOtherSignIn` in `src/components/auth/AuthLoginForm.js`). Every
"Forgot password?" link carries `?from=connect|guest|vendor`, and the recovery pages use it to return
to the same sign-in page (`getAuthVariantFromArea`, `authRecoveryHref` in
`src/lib/auth-sign-in-targets.js`; missing or unknown `from` means guest).

| Route | Purpose | States | Success goes to | Evidence |
| --- | --- | --- | --- | --- |
| `/auth/connect` | Staff sign-in, no sign-up (`auth-sign-in-targets.js:2-21`) | "Opening secure sign in" fallback; submitting "Processing…"; one `role=alert` error box with copy from `src/lib/auth-errors.js:29-58`; `?error=` copy (`:10-27`); Google button | `/portal` or an allowed `/portal/*` `returnTo` | Default seen locally; staff already signed in → `/portal` seen locally; customer → `/account?portal=unauthorized` seen locally |
| `/auth/guest` | Customer sign-in and sign-up (`?mode=signup`) | As above plus "Check your email" after sign-up (`AuthLoginForm.js:14-43`) | `/account` or an allowed `returnTo` | Sign-in, sign-up and `?error=account not linked` seen locally |
| `/auth/vendor` | Vendor sign-in, hidden from navigation | As `/auth/connect` | `/vendor` | Default seen locally |
| `/auth/forgot-password?from=` | Request a reset link | "Sending…", success copy replaces the form, errors from `auth-errors.js:61-77`; the emailed link keeps `from` | "Back to sign in" → the `from` sign-in page (`forgot-password/page.client.js`) | Seen locally for `from=connect` |
| `/auth/reset-password?token=&from=` | Set a new password | Without a token: "This reset link is incomplete" with "Request a new link" and "Back to sign in", no form (`reset-password/page.client.js`); mismatch and length errors; invalid/expired token copy with "Request a new link" | The `from` sign-in page after three seconds | No-token state and token form seen locally |
| `/auth/email-verified?from=` | Confirmation after email verification | `from=guest`: Travel Account copy, "Sign in" → `/auth/guest`; otherwise (staff invitations, and links sent before `from` existed): Citius Connect copy, "Go to Citius Connect" → `/auth/connect`. With Better Auth's `?error=` (expired, used or invalid link): "This link has expired" and how to get a new one (`email-verified/page.client.js`) | The button above | Guest, staff and expired states seen locally |
| `/auth` | Legacy entry | Redirect only | See [Sign-in redirects](#sign-in-redirects) | Seen locally |

## Customer Travel Account

`/account` (`src/app/(authenticated)/account/page.js`, `page.client.js`, `src/components/account/`).
Reachable by any session; it carries no staff authority ([context](customer-account/CONTEXT.md)).

| State | Behaviour | Evidence |
| --- | --- | --- |
| Signed out | → `/auth/guest?returnTo=/account` (with `?tab=` kept) | Seen locally |
| Identity link not `linked` | "Your account needs a quick check": the sign-in could not be matched to one traveller record; Contact us → `/contact` and Sign out → `/` (an error alert if sign-out fails). No journey or profile query runs (`page.js`, `src/components/account/AccountIdentityReview.js`) | Covered by `account/page.test.js` |
| Tabs | `journeys` (default), `profile`, `settings` from `?tab=`; switching does not update the URL (`page.client.js:37`) | Journeys and `?tab=settings` seen locally |
| No journeys | "No upcoming trips … will appear here." and "Completed trips appear here." with no next step (`AccountJourneysPanel.js:361-365,402-404`) | Seen locally |
| Journey detail | Loading, unavailable and failed states; Back to journeys (`AccountJourneysPanel.js:95-103,191-193,476-480`) | Code-verified only (no seeded journey on this deployment) |
| Tax invoice | Plain download link; route errors (401/404/409/503, `src/app/api/account/journeys/[bookingId]/invoice/route.ts`) are not surfaced in the UI | Code-verified only |
| Account deletion | Loading, staff (contact HR), re-auth (signs out and returns via `returnTo`), ready (type DELETE), deleted (reference + Return to home), unavailable (`AccountDeletionSection.tsx:44-51,84-196`) | Code-verified only |
| Sign out | → `/`; a failure only resets the button (`page.client.js:44-47`) | Code-verified only |
| Links | Logo and "Back to main site" → `/` (`AccountUi.js:65-68`, `AccountSidebar.js:86-94`) | Seen locally |

`/vendor` (`src/app/(authenticated)/vendor/`) is a "Coming soon" placeholder that any signed-in
person can open, including customers (seen locally). Links: logo and Back to website → `/`,
Sign Out → `/`.

## Staff Workspace

Entry: `src/app/portal/layout.js` → `PortalAuthBoundary.js` → `PortalShell`. Most pages render
`<PortalWorkspace view="…"/>`; the view's title, permission and data come from
`src/lib/portal/portalRouteManifest.ts`.

### Shell

- Header: menu button (mobile), logo → `/portal`, role label, notification bell with "View all
  notifications" → `/portal/activity` (`PortalShell.tsx:482-488,658-697`).
- Account menu: Back to site → `/`, Sign out → `/`. There is no link to `/account`
  (`PortalShell.tsx:329-346`).
- Command palette: on every `PortalWorkspace` page and, through `PortalNavigationPalette.tsx`
  (navigation only, no saved views or filters), on the four stand-alone pages below and the portal
  404. Its navigation includes Event Photo Booth when the login has photo booth access
  (`usePortalPaletteNavGroups`).

### View gate

`usePortalWorkspaceState.ts:284-289` computes `canAccessPortalRoute`; the lifecycle boundary shows
`LoadingPanel` ("Loading portal data") while access loads and, when denied, "You do not have access
to this page / Your staff role does not include this page." with "Go to your workspace" → `/portal`
(`portalRouteLifecycle.tsx`; the denied dashboard has no link because it redirects instead).
Inbound Leads also requires a Sales, Sales Head, director or admin role, matching the server
(`canAccessPortalRoute` in `portalRouteManifest.ts`). The sidebar stays usable. A login without the dashboard is
sent from `/portal` to its first page (`PortalWorkspace.tsx:63-71`).

Seen locally with the Sales account: `/portal` dashboard; denied panel on `/portal/settings`,
`/portal/finance` and `/portal/job-cards`.

### Sidebar and who reaches each page

Inventory: `src/lib/portal/constants.js:318-520`; visibility: `navItemAllowed` in
`src/lib/portal/permissions.js:132-149`. Roles below come from `getRolePermissions`
(`convex/crm/lib/rolePolicy.ts`) and the partial fixture `tools/portal-role-pages-expected.json`.

| Page (route) | Group | Roles that reach it |
| --- | --- | --- |
| Dashboard (`/portal`) | Overview | Every role with `view:dashboard` (all internal roles) |
| Notifications (`/portal/activity`) | Me | Every allowed login; `view:emailDeliveryStatus` adds the delivery panel |
| Leave (`/portal/employees-on-leave`), Office check-in, Expenses | Me / Finance | Every internal role (baseline permissions) |
| Travel schedule (`/portal/travel-schedule`) | Me | Every internal login; not external tour managers |
| All Sales Queries (`/portal/queries`) | Enquiries | Admin, Directors, Director Cement, Sales, Sales Head, Sales Cement, Contracting, Contracting Head, Contracting Cement, Accounts Head, Operations Head, Ticketing, Head of Ticketing |
| Inbound Leads (`/portal/inbound-leads`) | Enquiries | Sidebar: Admin, Directors, Director Cement, Sales, Sales Head (`permissions.js:92-102`). Server: same (`convex/crm/inboundQueryIntents.ts:195-200`) |
| Pipeline (`/portal/pipeline`) | Enquiries | `manage:queries` or `view:contracting` (`permissions.js:85-90`) |
| Contracting (`/portal/contracting`) | Enquiries | Admin, Directors, Director Cement, Contracting, Contracting Head, Contracting Cement, Operations Head |
| Proposals (`/portal/proposals`) | Proposals | Pipeline roles plus Ticketing and Head of Ticketing |
| Accounts / Job Card Creation (`/portal/accounts/job-cards`) | Job Cards | Admin, Directors, Director Cement, Accounts, Accounts Head, Operations Head |
| Job Cards (`/portal/job-cards`) | Job Cards | Every role except Sales, Sales Head, Sales Cement and HR |
| Post-tour feedback (`/portal/post-tour-feedback`) | Job Cards | Every login, including external tour managers |
| Ticket Dashboard, Flights & PNR, Seat Allocation, All Tickets | Ticketing | Admin, Directors, Director Cement, Operations, Operations Head, Operations Cement, Ticketing, Head of Ticketing, Tour Manager (Ticket Dashboard closed to external logins) |
| Traveller Master, External tour managers, Tour Managers | Operations | As Ticketing |
| Passport Documents, Visa Tracking | Operations | Admin, Directors, Director Cement, Operations, Operations Head, Operations Cement, Tour Manager (Passport closed to external logins) |
| Hotel / Rooming (`/portal/hotels`) | Operations | Admin, Directors, Director Cement, Operations, Operations Head, Operations Cement |
| Finance (`/portal/finance`) | Finance | Admin, Directors, Director Cement, Accounts, Accounts Head, Operations Head, Finance |
| Approvals (`/portal/approvals`) | Finance | Admin, Directors, Director Cement, Finance, HR |
| Reports (`/portal/reports`) | Finance | Admin, Directors, Director Cement, Accounts, Accounts Head, Finance |
| Team Directory (`/portal/team`) | Administration | Admin, Directors, Director Cement, department heads, HR |
| Event Photo Booth (`/portal/event-photo-booth`) | Administration | Logins whose booth access has `canManage` |
| Settings (`/portal/settings`) | Administration | Admin, Directors |

Every sidebar `href` has a route (code-verified).

### List and dashboard states

| View | Loading | Empty | Evidence |
| --- | --- | --- | --- |
| Dashboard | Skeletons | "No urgent work right now.", "No recent activity in this period.", "No pipeline data for this period.", "No active tours yet.", "No overdue balances in this period." (`src/components/portal/dashboard/*`) | Seen locally (Sales) |
| Queries | Route `loading.js` and "Loading All Sales Queries" | "No active queries yet." / "No lost queries." (`QueriesView.tsx:598`) | Code-verified only |
| Job Cards, Travellers, Finance | Table skeleton (`SelectableDataTable.tsx:674-675`) | "No Job Cards yet.", "No travellers yet.", "No invoices yet." | Code-verified only |
| Any filtered table | — | "No matches. Adjust or clear filters." with Clear filters (`SelectableDataTable.tsx:644-645`) | Code-verified only |
| Inbound Leads | `PortalViewLoading` until the first page arrives (`InboundLeadsView.jsx`) | "No inbound leads match these filters." | Covered by `InboundLeadsView.mounted.test.jsx`; Sales page seen locally |

### Stand-alone portal pages

| Page | Gate | Wrong role sees | Loading / empty | Bad link |
| --- | --- | --- | --- | --- |
| `/portal/job-cards/[jobCardId]` (`JobCardCommandCenter.js`) | Convex `getCommandCenter`: `view:jobCards` plus record scope (`convex/crm/jobCardCommandCenter.ts:51-64`) | "You do not have access to this" (seen locally as Sales) | Unlabelled pulse box (`JobCardCommandCenter.js:152-154`) | "This record could not be found" for an invalid id or deleted card (seen locally for `abc` as Operations) |
| `/portal/job-cards/tour-manager/[assignmentId]` (server page, `TourManagerAllocationUnavailable.tsx`) | Convex `getJobCardIdForTourManagerAssignment`: `view:jobCards` plus record scope on the assignment's Job Card (`convex/crm/jobCardReads.ts`) | "This Job Card is not available" with Go to Job Cards; the query returns null, never an error | Resolved on the server, which replaces the address with `/portal/job-cards/[jobCardId]` | Same panel for a removed allocation, an allocation with no Job Card, a Tour Manager whose allocation is no longer active, or a malformed id |
| `/portal/travel-schedule` (`StaffTravelWorkspace.tsx`) | Convex `requireStaff()` | External logins: "You do not have access to this" | "Loading travel..."; "You have no trips recorded." (`:407-411`) | Trip rows link to the Job Card only when the server returns it, which needs `view:jobCards` and record scope (`convex/crm/staffTravel.ts:36-49`) |
| `/portal/external-tour-managers` (`ExternalTourManagersWorkspace.tsx`) | Convex `view:tourManagers` | "You do not have access to this" (seen locally as Sales) | "Loading profiles..."; "No external tour-manager profiles yet." (`:765-767`) | "This profile is no longer available." (`:654`) |
| `/portal/post-tour-feedback` (`PostTourFeedbackWorkspace.tsx`) | Convex `requireStaffSession`, open to every login | — | "Loading post-tour feedback..." (`page.tsx:23`) | "This Job Card is no longer available. Choose another Job Card." (`:260-263`) |

### Staff Workspace errors

Every portal error boundary renders `PortalRouteError` (`src/components/portal/PortalRouteError.tsx`)
inside the shell. `classifyPortalRouteError` (`src/lib/portal/portalRouteError.ts`) reads the
Convex error a client query threw:

| Error | Copy | Actions |
| --- | --- | --- |
| `ConvexError("FORBIDDEN")` (`convex/crm/lib/staffAccess.ts`), which also covers a session that lost staff access | "You do not have access to this" | Go to your workspace, Sign in again |
| `ConvexError` "… not found" or "Invalid … id" | "This record could not be found" | Go to your workspace |
| Anything else, including argument-validator errors from URL ids such as `/portal/inbound-leads?open=inboundIntent&id=x` | "This page could not be loaded" | Try again, Go to your workspace |

Unknown portal paths render `src/app/portal/not-found.js` inside the portal shell, with a link back
to `/portal` (see [boundaries](#error-not-found-and-loading-boundaries)).

### Notification links

Two builders produce portal links: `src/lib/portal/notificationPaths.js` (in-app) and
`convex/crm/notificationPaths.ts` (email). They agree for query, proposal, job card, ticket, leave,
approval, inbound lead and post-tour report (`convex/crm/dashboardPaths.test.ts` checks the pair).
The email change takes effect once the Convex functions are deployed. Expense-approval
notifications open `/portal/expenses`. Tour Manager allocation notifications carry the assignment
id and open `/portal/job-cards/tour-manager/<assignmentId>` in both builders, so notifications
already in the bell get the new link too.

## HTTP API (for orientation)

| Area | Routes | Caller |
| --- | --- | --- |
| Auth | `/api/auth/[...all]` | Better Auth |
| Account | `/api/account/confirmed-trips`, `/api/account/journeys/[bookingId]`, `/invoice`, `/api/account/deletion`, `/api/profile` | Customer Account |
| Public | `/api/contact`, `/api/inbound-intents`, `/api/chat`, `/api/sacred-bharat/events`, `/api/sacred-bharat/journey-planner`, `/api/event-photo-booth/events`, `/api/tour-feedback/[operation]` | Public pages |
| Payments | `/api/create-order`, `/api/verify-payment`, `/api/webhooks/razorpay` | Booking flow, Razorpay |
| Staff files | `/api/portal/files/*`, `/api/portal/exports/[operationId]`, `/api/portal/post-tour/photos`, `/api/portal/office-check-in` | Staff Workspace |
| Platform | `/api/revalidate`, `/api/e2e/identity`, `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` | Sanity, E2E harness, mobile apps |

## Known gaps

Fixed in this quality pass (each with a test, apart from the one-word copy fix):

- Page titles repeated the brand ("… | Citius Holidays | Citius Holidays").
- Inbound Leads let roles with `view:queries` but no Sales or director role (Contracting, Ticketing,
  Sales Cement and others) through the route gate, then the server refused them.
- Portal errors all said "We could not verify your session"; they now distinguish no access,
  missing record and load failure, in Staff Workspace styling, with a way back.
- Inbound Leads showed "No inbound leads match these filters." while the first page loaded.
- Post-tour report emails linked to `/portal/activity` instead of the report.
- The "no access" panel had no onward link.
- The sitemap listed `/account`.
- A stray comma in the coming-soon trail notice.

Fixed in the UX gaps pass (each with a test):

- Signed-out `/portal/*` and `/account?tab=` links keep the target through sign-in.
- `/account?portal=unauthorized` explains why the person is in the Travel Account.
- An unlinked customer identity gets a support page with Contact us and Sign out instead of an
  error loop.
- Expense and Tour Manager allocation notifications open `/portal/expenses` and `/portal/job-cards`.
- Unknown `/portal/*` paths show a not-found page inside the Staff Workspace.
- Recovery pages return to the sign-in page the person came from; `email-verified` has traveller
  copy and an expired-link state; staff and guest sign-in link to each other.
- Reset password without a token shows an incomplete-link state instead of the form.
- Coming-soon trails ask for interest instead of promising departures; the trail back link is
  restored; `/about` and `/services` end with the planning call to action; the contact
  confirmation stays until the person moves on.
- The command palette is on the stand-alone portal pages and includes the photo booth.
- Eyebrow labels removed from the surfaces listed in the previous version of this table.
- The unused `BookingCard` and the `PastJourneyCard` link to `/services/{slug}` are gone.

Decided by the owner (9 November 2026), no change needed:

- Staff may open the customer Account: a staff member who goes on a trip uses it like any traveller,
  next to their Staff Workspace.
- `/vendor` stays public as a coming-soon page.
- Google sign-in stays on the staff and vendor pages: only whitelisted email addresses get access.

Fixed after the owner's decisions:

- A traveller's verification email (sign-up, or sign-in before verifying) signs them in and opens
  their Travel Account (`autoSignInAfterVerification`, `verificationCallbackHref`); an expired link
  still shows the expired state, and staff and vendor links keep their own next step.
- Tour Manager allocation notifications open the allocated Job Card, not the Job Card list, through
  `/portal/job-cards/tour-manager/<assignmentId>`; a caller who cannot open that card gets a way
  to the list instead.
- `global-error`, root and public error boundaries (`src/app/global-error.js`, `src/app/error.js`)
  and `robots.js` listing the real private prefixes landed in the platform follow-ups.

Open, needing an owner or another workstream:

| Gap | Where | Why it is open |
| --- | --- | --- |
| No privacy policy page | `/policies` | Legal content; the owner will do it later (draft in PR #308) |
