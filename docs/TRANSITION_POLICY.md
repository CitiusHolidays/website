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

`src/transitionPolicy.contract.test.ts` enforces these boundaries.

## Portal CRM motion

Portal toasts, entity/import modals, confirm dialogs, and list-toolbar filter expand use Motion with **GPU `transform` strings** only — not `x`, `y`, `scale`, or `scaleY` shorthand props on `animate` / `initial` / `exit`. Toasts enter and exit from the same bottom edge (`translateY(100%)`). JS-driven portal motion must branch on `useReducedMotion()`; do not rely on the global 1ms CSS override alone.

The command palette still mounts and unmounts **without** open/close animation. Sidebar active-route indication is static (no `layoutId` spring). Contract tests in `src/transitionPolicy.contract.test.ts` cover these portal rules.
