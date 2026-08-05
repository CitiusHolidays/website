# Public design-taste review

**Review status:** baseline captured; public redesign follow-up remains intentionally separate from
the current account/CRM work.

This is a practical pre-flight for high-demand public surfaces. It is not a request to repaint the
whole site or to copy an inspiration gallery. The reviewed source scope is:

- `src/components/pages/HomeHeroClient.js` and `HomeMainClient.js`;
- `src/app/(public)/pilgrimage/` and `src/components/pilgrimage/` hero/media surfaces;
- `src/app/(public)/sacred-bharat/` and its shared public layout;
- the bounded tokens and representative-surface contract in
  `src/app/publicVisualIdentity.contract.test.ts`.

Authenticated account and Citius Connect have separate visual contracts. Commercial-files is also
outside this review.

## Checklist

| Check | Baseline result | Evidence / action |
| --- | --- | --- |
| One clear visual idea in the hero | **Pass with follow-up** | Home uses a full-bleed MP4/poster hero and one primary CTA. Revisit copy/photography together in a future public visual pass. |
| Primary CTA is obvious and accessible | **Pass** | CTA has a high-contrast surface, keyboard focus from the shared link styles, and a secondary service route. Keep the action rounded only while it remains visually dominant. |
| Typography has hierarchy | **Pass** | Public headings use `font-heading`; body/navigation remain the shared sans role. Do not introduce another global display font. |
| Inter + Lucide default pairing | **Intentional exception** | Existing public surfaces use the approved shared sans and Lucide icons for compact, familiar controls. A future brand pass may replace individual icon treatments only with a tested equivalent; do not mass-replace icons in this slice. |
| Glass and pill patterns | **Bounded exception** | Hero status/badge and compact controls use translucency/pills for legibility and status. Avoid adding glass cards; replace the hero badge in the future visual pass if it competes with the destination. |
| Media edges and shadows | **Pass** | Gallery cards and the home editorial image use `.public-media-edge`, backed by one radius/shadow token pair. Full-bleed heroes intentionally remain edge-to-edge. |
| Colour semantics and contrast | **Pass** | Public OKLCH roles and WCAG AA pairs are covered by `publicVisualIdentity.contract.test.ts`; migration scope is explicitly bounded. |
| Mobile and reduced motion | **Evidence required per release** | Run the documented 390px, 20px-root, dark-preference, reduced-motion, and overflow checks for each public visual change. |

## Design rules for the next public pass

1. Start with the destination image, the visitor's question, and one action; remove decoration that
   does not support one of those three.
2. Prefer editorial spacing, typographic contrast, and a small accent over stacked gradients,
   translucent cards, or repeated pills.
3. Keep the media policy intact: poster-first, MP4-only hero sources, reduced-motion poster-only, and
   no eager network load before the hero is visible.
4. Use `docs/BRAND_ARCHITECTURE.md` and `docs/BRAND_VISUAL_WORLD_BOARD.md` to choose the owning
   identity before choosing a visual treatment.
5. Record any intentional exception (status pill, compact navigation, full-bleed hero) in the
   implementation ticket and test its contrast/focus/reduced-motion behaviour.

## Follow-up actions

- Run a focused visual review of Home, Pilgrimage, and Sacred Bharat at desktop and 390px widths
  before changing fonts or hero imagery.
- Decide whether the public body font should remain Inter or move to a reviewed alternative; do not
  make that choice while changing the customer Account font.
- Replace the hero badge/glass treatment only after a side-by-side visual review proves that the
  label remains legible without it.
- Keep the OKLCH and media-edge contract as the regression gate for future public work.

The current slice deliberately records these decisions and guardrails instead of claiming that the
entire public site has been redesigned.
