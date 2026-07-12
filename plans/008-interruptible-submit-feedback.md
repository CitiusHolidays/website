# 008 — Make submit feedback interruptible and layout-stable

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: HIGH
- **Category**: Interruptibility and performance
- **Estimated scope**: 1 file, medium

## Problem

`src/components/ui/AnimatedSubmitButton.js` uses restart-prone keyframe arrays and changes icon-container width between 0 and 20:

```jsx
animate={state === "error" ? { scale: 1, x: [0, -6, 6, -6, 0] } : ...}
style={{ ...styles.iconContainer, width: state === "idle" ? 0 : 20 }}
```

The state sequence can restart under rapid updates and the width change causes layout work.

## Target

Use layout-stable markup with transform/opacity-only transitions. Reserve a fixed 20 px icon slot in all states, animate its contents with full transform strings, and use the strong ease-out curve for 150–200 ms. Error/success feedback must retarget cleanly rather than replay array keyframes. The loader must remain constant motion only when reduced motion is not requested.

## Repo conventions to follow

- Import Motion APIs from `motion/react` in client components.
- Use full `transform` strings for predetermined transforms.
- Strong ease-out: `[0.23, 1, 0.32, 1]` or the CSS token where CSS is used.

## Steps

1. Remove badge `x`/`scale` keyframe arrays; use a stable badge transform.
2. Keep the icon slot at 20 px wide; hide idle contents through opacity/transform without changing width.
3. Replace icon and label shorthand transforms with full `transform` strings and 150–200 ms ease-out transitions.
4. Preserve processing, success, error, labels, and SVG path drawing behavior.
5. Branch the continuously rotating loader for reduced motion as specified in plan 010.

## Boundaries

- Do NOT change the public component API or form submission logic.
- Do NOT animate layout properties.
- Do NOT add dependencies.

## Verification

- **Mechanical**: defer until all plans finish.
- **Feel check**: trigger processing → success and processing → error quickly; text must not jump horizontally, and state feedback must not restart awkwardly.
- **Done when**: the button changes state without layout shift or transform keyframe arrays.
