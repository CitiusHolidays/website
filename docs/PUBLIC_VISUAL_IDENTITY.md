# Public visual identity foundation

The public route group owns an editorial display voice and perceptually coherent color tokens. Auth,
account, vendor, and portal routes remain outside the `public-site` wrapper and continue using the
operational type system.

This is a bounded foundation, not a permission to run a repository-wide color rewrite. The contract
scope is the public layout, Home, Pilgrimage, and Sacred Bharat surfaces listed in
`src/app/publicVisualIdentity.contract.test.ts`. Extend that list deliberately when a new public
surface is reviewed; do not migrate authenticated or operational screens by search-and-replace.

The CRM has a separately approved premium treatment for Citius Connect. It is scoped to the
`.portal-shell` boundary, keeps the operational layout and density, and may override the CRM's
semantic brand tokens and heading stack without changing the public-site token contract or the
customer Account surface. This is a deliberate portal-specific theme, not an extension of the
public visual-identity migration.

## Color tokens

| Before | After |
| --- | --- |
| Warm paper literals such as `#fdfbf7` | `--color-public-paper: oklch(0.989 0.006 84.566)` |
| Generic white public surfaces | `--color-public-surface: oklch(1 0 0)` |
| Deep hero literal `#0b1026` | `--color-public-night: oklch(0.182 0.046 271.579)` |
| Generic ink `#0f172a` | `--color-public-ink: oklch(0.208 0.04 265.755)` |
| Muted copy `#64748b` | `--color-public-muted: oklch(0.5 0.041 257.417)` with increased light-surface contrast |
| Citius blue `#102a83` | `--color-public-blue: oklch(0.335 0.152 265.502)` |
| Citius orange `#f58220` | `--color-public-orange: oklch(0.722 0.171 53.919)` for dark surfaces |
| Citius orange ink `#8a3500` | `--color-public-orange-ink: oklch(0.443 0.128 44.307)` for small text on light surfaces |
| Citius green `#8dc63f` | `--color-public-green: oklch(0.761 0.174 129.577)` |
| Citius lime `#b5d43a` | `--color-public-lime: oklch(0.82 0.176 120.498)` |

All brand conversions stay inside sRGB because they originate from the existing Citius palette.
The contract test calculates WCAG contrast from the OKLCH values; regular-text pairs range from
5.81:1 to 18.82:1.

## Migration checklist

- [x] Semantic public surface roles are expressed in OKLCH and covered by a contract test.
- [x] Literal-background checks are limited to the reviewed public surfaces; unrelated auth and
  portal literals remain outside this migration.
- [x] Public media cards share `--radius-public-media` and `--shadow-public-media` through the
  `.public-media-edge` class. Full-bleed heroes intentionally keep their edge open.
- [ ] Review new public routes against the same token and contrast contract before adding them to
  the migration scope.
- [ ] Re-check visual balance at desktop, 390px mobile, dark preference, reduced motion, and 20px
  root text after any token value change.

Use `bun test src/app/publicVisualIdentity.contract.test.ts` as the bounded migration check. A
passing test proves token presence and representative source usage; it is not a substitute for a
browser visual review.

## Typography

| Before | After |
| --- | --- |
| Poppins used for every public heading role | Poppins remains the public heading font via `font-heading` |
| Browser-synthesized missing styles possible | `font-synthesis: none` on the root |
| Platform-dependent root smoothing | Root antialiasing via WebKit and Firefox font-smoothing properties |
| Generic selection styling | Public-only, high-contrast Citius lime/ink selection pair |

Body, navigation, controls, auth, and customer Account typography are unchanged by the public
token migration. Citius Connect may use the separately documented `.portal-shell` premium heading
stack described above.

## Verification

- `bun test src/app/publicVisualIdentity.contract.test.ts`
- `bun run typecheck`
- Biome on the public layout, token sheet, representative surfaces, and contract test
- Desktop and 390px browser captures for Home and Pilgrimage
- Dark preference, reduced motion, 20px root text, and horizontal-overflow checks
