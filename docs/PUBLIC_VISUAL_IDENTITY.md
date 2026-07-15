# Public visual identity foundation

The public route group owns an editorial display voice and perceptually coherent color tokens. Auth,
account, vendor, and portal routes remain outside the `public-site` wrapper and continue using the
operational type system.

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

## Typography

| Before | After |
| --- | --- |
| Poppins used for every public heading role | Poppins remains the public heading font via `font-heading` |
| Browser-synthesized missing styles possible | `font-synthesis: none` on the root |
| Platform-dependent root smoothing | Root antialiasing via WebKit and Firefox font-smoothing properties |
| Generic selection styling | Public-only, high-contrast Citius lime/ink selection pair |

Body, navigation, controls, auth, and portal typography are unchanged.

## Verification

- `bun test src/app/publicVisualIdentity.contract.test.ts`
- `bun run typecheck`
- Biome on the public layout, token sheet, representative surfaces, and contract test
- Desktop and 390px browser captures for Home and Pilgrimage
- Dark preference, reduced motion, 20px root text, and horizontal-overflow checks
