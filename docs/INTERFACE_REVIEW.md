# Interface review contract

This is the shared review checklist for Citius interface work. It turns the relevant parts of
[Web Interface Guidelines](https://github.com/aidenybai/web-interface-guidelines) into Citius-owned
observable checks. It does not import that project as code, replace a product's design authority,
or authorize a redesign.

Use this contract with the [design authority router](../DESIGN.md), the owning product context,
the [transition policy](TRANSITION_POLICY.md), and the [verification vocabulary](VERIFICATION.md).
If this checklist conflicts with executable behavior or an owning product contract, report the
conflict and fix it at the owner instead of widening this document.

## Shared foundations do not merge product baselines

| Surface | Review owner | Preservation rule |
| --- | --- | --- |
| Public site | Public brand and visual-identity contracts | Keep the public composition, content, navigation, and responsive baseline. |
| Sacred Bharat | Sacred Bharat context and identity kit | Keep Yatri language, spiritual identity, and progress separate from CRM state. |
| Customer Travel Account | Account context and the current rendered baseline | Keep the Account customer-facing and read-only; Account identity grants no Staff Workspace authority. |
| Staff Workspace | CRM workflows, role policy, and Staff Workspace accessibility/performance contracts | Keep the dense operational composition and role-aware workflows; public or Account patterns do not authorize convergence. |

Shared primitives, inspection tools, accessibility rules, and motion adapters may support all four
surfaces. They do not make the surfaces visually, behaviorally, or authoritatively identical.

## External checklist comparison

| External concern | Existing Citius owner | Citius decision |
| --- | --- | --- |
| Keyboard operation, visible focus, focus movement and restoration | Product-mounted tests, public accessibility foundations, Staff Workspace accessibility contracts, UI change brief | Adopt as an observable review requirement at the owning surface. |
| Form labels, Enter behavior, validation placement, paste, autocomplete, and mobile input sizing | Existing mounted form tests and public accessibility foundations | Adopt where the surface contains forms; retain workflow-specific submission and idempotency rules. |
| Loading, empty, error, success, partial, retry, and optimistic-recovery states | UI change brief, operation-status UX, workflow contracts | Adopt the full visible-state inventory; optimistic behavior still requires an owning workflow decision. |
| Mobile hit targets, coarse-pointer behavior, browser zoom, safe areas, and overflow | Public visual tests, responsive baselines, transition policy | Adopt as review checks without introducing a new shared layout system. |
| Hydration-safe focus/value and stable skeleton geometry | Mounted hydration tests, instant-navigation tests, Cache Components contracts | Adopt as behavior checks; do not use a developer overlay as evidence of hydration correctness. |
| Semantic HTML, accessible names, live updates, headings, and skip links | Public and Staff Workspace accessibility contracts | Adopt; native semantics remain preferred over additional ARIA. |
| Reduced motion, explicit transition properties, transform/opacity motion | Transition policy and its parser-backed ratchet | Already owned. The repository policy is stricter and wins where the external list is broader. |
| Rerender and page-performance inspection | React Doctor, local React Scan opt-in, public and Staff Workspace performance contracts | Adopt for diagnostics only. Official evidence is collected with inspection tooling disabled. |
| Vercel-specific copy, visual taste, APCA preference, and third-party library suggestions | Product brand, UX writing, accessibility, and dependency owners | Do not adopt wholesale. Review separately when a product decision calls for them. |

## Citius review checklist

### Keyboard and focus

- Complete every action with a keyboard alone, including opening, selecting, cancelling, retrying,
  and dismissing overlays.
- Show a visible `:focus-visible` treatment. A grouped control may also use `:focus-within`, but it
  cannot hide the focused element's state.
- On modal or menu open, move focus to the documented initial target. Trap it only where the
  interaction is modal, then restore it to the trigger when the surface closes.
- Use links for navigation and buttons for commands so browser shortcuts and assistive technology
  receive the correct behavior.
- Verify that skip links and heading order reach the owning surface's main content.

### Forms and validation

- Give every editable control an accessible label and a useful `name`, `type`, `inputmode`, and
  `autocomplete` value. Clicking a visible label focuses its control.
- Let Enter submit a single-line form. In a textarea, Enter inserts a line and the documented
  modified shortcut may submit.
- Do not block paste or silently discard keystrokes. Normalize on submit or blur and explain
  invalid input beside the field.
- Keep submit available until submission starts unless the owning workflow requires a stronger
  precondition. During submission, preserve the action label, expose progress, and prevent an
  accidental duplicate command through the workflow's existing idempotency contract.
- Focus or summarize the first invalid field after submission. Error copy names the recovery step.
- At mobile widths, editable text is at least 16 CSS pixels and controls have a usable coarse-pointer
  target. Browser zoom remains enabled.

### Loading, empty, error, success, partial, and retry

- Review every state named by the owning UI change brief, including sparse and dense data where
  lists or tables are involved.
- Keep skeleton and loading geometry close to final content so readiness does not cause avoidable
  layout shift. Avoid flashing a spinner for work that completes immediately.
- Empty states explain whether there is no data, no matching result, or no permission, and provide
  the next valid action where one exists.
- Error and partial states preserve safe work, avoid exposing transport or record details, and offer
  the smallest valid retry or recovery action.
- Success is visible without relying only on color. Announce asynchronous outcomes once through the
  owning polite live region or status surface.

### Mobile and coarse pointers

- Review at the owning mobile viewport, a laptop viewport, and a wide viewport. Check 200% browser
  zoom separately from responsive breakpoints.
- Keep the visual and clickable portions of a control aligned. Small icons retain an expanded hit
  target, and mobile primary controls target at least 44 CSS pixels where the layout permits.
- Gate decorative hover transforms behind a fine, hover-capable pointer. Touch interactions do not
  retain sticky hover movement.
- Check safe-area insets, unwanted horizontal overflow, fixed/sticky overlap, virtual keyboard
  occlusion, and back/forward scroll restoration.

### Hydration stability

- A focused input keeps its focus, value, selection, and accessible name through hydration and
  client navigation.
- Server HTML contains the primary heading, landmark, and meaningful instant content for the route.
- Loading fallbacks reserve useful space and never replace a surface with a blank shell.
- Browser console and contract tests contain no hydration mismatch, duplicate-ID, or controlled/
  uncontrolled-input warning for the reviewed interaction.

### Screen readers

- Prefer native headings, links, buttons, labels, tables, and lists. Add ARIA only to complete a
  semantic contract that native HTML cannot express.
- Name icon-only controls, hide decorative media, and keep important image alternatives specific to
  the owning product's content authority.
- Dynamic status is announced once and does not steal focus. Lists, counts, progress, and validation
  remain understandable without color, shape, position, or animation alone.
- Inspect the accessibility tree for the changed surface and verify landmark and heading order.

### Reduced motion

- Honor `prefers-reduced-motion` in CSS and in JavaScript-driven Motion behavior.
- Animate only named properties allowed by the [transition policy](TRANSITION_POLICY.md). Never add
  `transition-all`, permanent `will-change`, or unreviewed layout-property animation.
- Keep essential state changes immediate and understandable with animation disabled. Continuous or
  decorative movement stops or presents its final state.
- Verify focus, selection, command completion, and error recovery with reduced motion enabled.

## Diagnostic tooling boundary

Run local React inspection only with `CITIUS_REACT_INSPECTION=1 bun run dev` or
`bun run dev:inspect`. React Grab source selection and React Scan rerender outlines are diagnostic
handoff aids. They may identify where to investigate, but they do not prove accessibility,
correctness, or a performance budget.

Before official public or Staff Workspace performance collection, stop the inspection server and
run the repository performance command. Those workflows accept only production-build or deployed
output, where the shared gate excludes the inspection module regardless of the flag. Do not accept
a baseline, screenshot, or trace that includes a developer overlay as product evidence.

## Evidence boundaries

- **Local/source:** run focused mounted or contract tests for the owning surface, `bun run check`,
  and the applicable local browser matrix. Use React Grab/Scan only as diagnostic context.
- **Preview:** required only when the owning change changes a hosted surface and fresh Preview
  authority exists. Local inspection is not Preview proof.
- **Production:** requires separate explicit authority and the smallest safe product-specific
  journey. No checklist or local overlay supplies Production proof.
