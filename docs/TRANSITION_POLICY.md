# UI transition policy

Interactive transitions must name the properties they animate. `transition-all` is prohibited under `src/` because it can accidentally animate layout, delay keyboard interactions, and make later style changes expensive to reason about.

## Classification

| Interaction | Approved transition |
| --- | --- |
| Text, fill, border, and background state | `transition-colors` or `transition-[background-color,color,border-color]` |
| Elevation feedback | `transition-shadow` or an explicit list including `box-shadow` |
| Decorative movement | `transition-transform`, with the hover transform gated by `fine-hover` |
| Mixed button feedback | An explicit list such as `transition-[transform,background-color,box-shadow]` |
| Focus rings | `transition-[border-color,box-shadow]` |
| Progress indicators | `transition-[width]` |
| Intentional header compaction | Only the changed sizing, spacing, color, radius, and shadow properties |

Color and shadow hover feedback may remain available on touch. Decorative translation, scale, and rotation must only run for a hover-capable fine pointer so touch devices do not retain sticky transformed states.

The global `prefers-reduced-motion: reduce` rule collapses transition and animation duration and removes active-control transforms. The portal command palette is mounted and unmounted without backdrop or panel open/close animation; only direct hover, selection, and press feedback inside the already-open palette may transition.

## Shared vocabulary

Use the narrowest established term when describing or naming motion:

- **Origin-aware animation** begins from the interaction or visual origin that caused it.
- **Direction-aware transition** enters and exits along the direction implied by navigation.
- **Accordion / Collapse** reveals or conceals content within the current flow.
- **Marquee** continuously moves a repeated track; `LogoMarquee` is the canonical component name.
- **Number ticker** animates toward a numeric value; `NumberTicker` is the canonical component name.
- **Hold to confirm** requires a sustained press before a destructive action runs.

Application code uses the canonical `LogoMarquee` and `NumberTicker` names. Marquees wrap without animation under reduced motion, and number tickers expose their final value to assistive technology without waiting for viewport animation.

Mounted interaction and accessibility tests cover the user-visible motion behavior. Review motion
changes against the vocabulary and constraints in this document.

## Render-tier guardrail

Avoid bare or broad transition utilities, unapproved layout-property animation, animated root/body
custom properties, and permanent `will-change`. Motion's `transition={...}` configuration is not a
class-token violation. These are the intentional exceptions:

| Surface | Property | Reason |
| --- | --- | --- |
| Header compact state | width, height, padding | The header's measured compact geometry is an approved preservation boundary pending any separately measured replacement. |
| Auth underline and pilgrimage/Sacred Bharat progress bars | width | The changing width is the visual value itself, not an incidental layout side effect. |
| Animated submit label state | position | Motion switches the old/new labels between relative and absolute positioning as a discrete state; it does not interpolate the property. |

These exceptions are preservation boundaries, not approval to copy the patterns:

| Owning follow-up | Current debt |
| --- | --- |
| Public motion repair | Spiritual Hero `letter-spacing`; contact floating-label `top` and `font-size`; Team Member `max-height`; Trending Destinations `grid-template-rows` |
| Staff motion repair | No remaining dashboard disclosure layout-animation debt; geometry is discrete and only the state cue transitions. |

Each owning repair should remove its listed debt. Do not add new layout, root-variable, or
permanent-layer promotion occurrences.

## Portal CRM motion

Portal toasts, entity/import modals, confirm dialogs, and list-toolbar filter expand use Motion with **GPU `transform` strings** only — not `x`, `y`, `scale`, or `scaleY` shorthand props on `animate` / `initial` / `exit`. Toasts enter and exit from the same bottom edge (`translateY(100%)`). JS-driven portal motion must branch on `useReducedMotion()`; do not rely on the global 1ms CSS override alone.

The command palette still mounts and unmounts **without** open/close animation. Sidebar active-route
indication is static (no `layoutId` spring). Mounted interaction tests cover the observable menu,
dialog, toast, and reduced-motion behavior.
