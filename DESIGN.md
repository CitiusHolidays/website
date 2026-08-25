# Design authority router

Start here before changing a user interface. This page routes each product
surface to its owning identity, source boundary, and verification seam. It is
not a token catalog and does not authorize a redesign.

| Surface | Owning authority | Source boundary | Verification |
| --- | --- | --- | --- |
| Citius Holidays public site | [Brand architecture](docs/BRAND_ARCHITECTURE.md), [public visual identity](docs/PUBLIC_VISUAL_IDENTITY.md), [design-taste baseline](docs/PUBLIC_DESIGN_TASTE_REVIEW.md), and [visual-world board](docs/BRAND_VISUAL_WORLD_BOARD.md) | `src/app/(public)/`, `.public-site`, and `src/app/globals.css` | `src/app/publicVisualIdentity.contract.test.ts` plus desktop, 390px, reduced-motion, dark-preference, 20px-root, and overflow review |
| Sacred Bharat | [Sacred Bharat identity kit](docs/SACRED_BHARAT_IDENTITY_KIT.md), [brand architecture](docs/BRAND_ARCHITECTURE.md), and [Sacred Bharat context](docs/sacred-bharat/CONTEXT.md) | `src/app/(public)/sacred-bharat/`, `src/components/sacredBharat/`, and public tokens | Focused Sacred Bharat tests plus responsive, keyboard, reduced-motion, cultural-content, and asset-provenance review |
| Customer Travel Account | [Customer Travel Account context](CONTEXT.md) and the current rendered Account baseline | `src/app/(authenticated)/account/` and `src/components/account/` | Account mounted tests and authenticated desktop/mobile browser comparison against the current baseline |
| Citius Connect Staff Workspace | [Portal workflows](docs/PORTAL_CRM_WORKFLOWS.md), [roles and access](docs/PORTAL_ROLES_AND_ACCESS.md), [role dashboard](docs/ROLE_DASHBOARD.md), and [transition policy](docs/TRANSITION_POLICY.md) | `.portal-shell`, `src/components/portal/`, `src/lib/portal/`, and `src/components/motion-ui/` adapters | Focused mounted/contract tests, React Doctor, role-aware authenticated browser checks, and the Staff Workspace performance gate |
| Authentication | [Auth/domain cutover](docs/AUTH_DOMAIN_CUTOVER.md), [brand architecture](docs/BRAND_ARCHITECTURE.md), and the owning destination's identity | `src/app/(auth)/` and `src/components/auth/` | Auth contract tests plus guest, staff, recovery, and responsive browser checks |

## Shared foundations do not merge products

Shared application primitives, Motion adapters, color utilities, or auth
infrastructure do not imply shared layout, brand treatment, terminology, or
permissions. Preserve the current Staff Workspace and Customer Travel Account
as distinct canonical baselines. Keep public tokens inside the public scope and
Sacred Bharat language outside the CRM.

Historical screenshots and dated reviews are evidence for their named revision,
not proof of the current UI. Capture fresh visual evidence whenever a change can
alter layout, hierarchy, motion, or responsive behavior.

## Authentication visual contract

- Use one centered, quiet auth composition across sign-in, account creation, recovery,
  verification, and auth errors while preserving each destination's name, copy, behavior,
  and authorization boundary.
- Auth scenery is a dedicated six-image set of real named places: three in India and three
  elsewhere. Do not reuse destination-card or public-gallery photography in auth, and do not
  reuse auth scenery in another site module.
- Apply the approved strong Citius-color dither treatment before shipping the images. Keep the
  browser implementation static and lightweight; it must not run canvas, WebGL, or image
  processing at page load.
- Keep language brief but contextual, retain an obvious route back to the public site, and do not
  load the public footer or chatbot inside auth routes.

## Public navigation and homepage contract

- Below the desktop navigation breakpoint, use a right-side sheet that leaves part of the current
  page visible. Keep the public route inventory, group Spiritual Trails behind one disclosure, and
  keep the primary trip-planning and session actions reachable in the sheet's persistent action
  area.
- Preserve modal accessibility when the sheet is open: labelled navigation, visible focus,
  background inertness, contained scrolling, Escape dismissal, focus restoration, safe-area
  padding, reduced-motion behavior, and touch targets that are at least 44 CSS pixels.
- Keep the Home hero evergreen. Time-bound journeys and campaigns may appear as supporting
  editorial content, but they do not replace the site's primary promise or action.
- A required image region must render meaningful media or a shaped loading state; do not ship an
  empty decorative placeholder. Prefer a distinct, source-appropriate public image, but repeat an
  approved public image when the alternative is an empty panel. Generated or newly sourced assets
  must start from a full-resolution master and ship through responsive image delivery without
  visible grain, pixelation, or unreviewed cross-surface reuse.
- This redesign is limited to presentation, navigation clarity, loading behavior, and measured
  performance. It does not authorize new customer or Staff Workspace product workflows.

## Durable typography constraints

- Do not use eyebrow or overline text: no small, widely tracked label above a title. Put necessary
  context in the heading, supporting copy, or a compact status badge beside the heading.
- Do not add, replace, or change fonts without explicit product approval. Use the configured Inter
  body/control role (`font-sans`) and Poppins heading role (`font-heading`) across their existing
  surfaces.

## Approval boundary

Source-owned tokens and passing tests establish implementation consistency, not
product approval. A new logo, typeface, brand scope, layout system, permission
surface, or cross-product convergence requires an explicit product/design
decision. Record that durable decision in `docs/` or an ADR and keep local
mockups or screenshots as evidence only.
