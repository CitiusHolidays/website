# Sacred Bharat endorsed identity kit (v1 baseline)

Sacred Bharat is an endorsed Citius Holidays experience, not a separate legal company. This compact
kit keeps the experience recognisable while protecting the parent/sub-brand boundary.

## Logo and endorsement

- Use the approved Sacred Bharat wordmark/mark only when the brand owner has supplied the asset and
  its clear-space rules. Do not redraw, stretch, rotate, or add effects to a mark.
- Keep a visible but quiet **by Citius Holidays** endorsement in the page footer, account/help copy,
  or other approved lockup location.
- Do not place the Sacred Bharat mark in Citius Connect navigation or use it to label staff CRM data.
- Until a final asset package is approved, use the text name **Sacred Bharat** rather than inventing a
  replacement icon or seal.

## Color

| Role | Baseline | Use |
| --- | --- | --- |
| Night | `--color-public-night` | Hero/background anchor and high-contrast canvas |
| Paper | `--color-public-paper` | Reading surfaces and long-form content |
| Saffron/orange | `--color-public-orange` / `--color-public-orange-ink` | Progress, links, and calls to action; check contrast before small text |
| Lime/green | `--color-public-lime` / `--color-public-green` | Success or completion states only; never as a large text block |

Use the public OKLCH tokens rather than new one-off hex values. The contrast pairs and migration
scope are tested in `src/app/publicVisualIdentity.contract.test.ts`.

## Type and voice

- Use the public heading role (`font-heading`) for short display statements and the existing sans
  body role for controls and explanatory copy.
- A restrained serif may be introduced for a reviewed Sacred Bharat editorial moment, but it must
  not silently change the root font or Citius Connect/account typography.
- Write with respect and specificity: name the place, explain the activity, and avoid promises of
  religious or personal outcomes.

## UI and imagery

- Keep progress, check-in, badge, and leaderboard states understandable without colour alone.
- Use documentary or place-led imagery with descriptive alt text. Do not use sacred symbols as
  decoration or gamified rewards without cultural review.
- Avoid heavy glassmorphism, excessive pills, and motion that obscures progress or makes reading
  difficult. Honour reduced-motion preferences.

### Asset provenance boundary

| Asset | Provenance status | Approved use |
| --- | --- | --- |
| `/gallery/spiritual/varanasi-sunset.webp` | **Unknown origin**; location and authorship are unverified | **Decorative only**, with empty alternative text. It must not substantiate a place, event, customer record, Citius journey, or other documentary claim. |

Unknown-origin artwork must not be captioned or described as authenticated photography. Replacing
this asset with documentary imagery requires recorded source, location, usage rights, and content
review.

## Release gate

Before publishing a new Sacred Bharat surface, confirm: approved asset provenance, parent endorsement,
OKLCH contrast, responsive/keyboard behaviour, reduced-motion behaviour, and a content review for
cultural accuracy. A generated mockup is inspiration, not approval.
