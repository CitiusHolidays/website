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

## Approval boundary

Source-owned tokens and passing tests establish implementation consistency, not
product approval. A new logo, typeface, brand scope, layout system, permission
surface, or cross-product convergence requires an explicit product/design
decision. Record that durable decision in `docs/` or an ADR and keep local
mockups or screenshots as evidence only.
