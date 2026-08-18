# Citius product strategy: win the operating day

**Status:** Approved  
**Approved:** 2026-07-17  
**Approver:** Product owner (Burn portfolio PF-21)  
**Version:** 1.0

## Strategic choice

Citius Connect is the revenue wedge. The target customer is a group-travel operator whose Sales, Contracting, Operations, Ticketing, Finance, and HR teams still coordinate a booking across spreadsheets, chat, email, and memory. Their painful status quo is not a lack of travel inspiration; it is the daily cost of missing ownership, duplicated data, slow handoffs, and unclear next actions.

Citius wins by becoming the shared operating record from query to cash: Sales raises a query, heads assign accountable SPOCs, Contracting and Ticketing prepare the proposal, Sales records the decision, Accounts opens the Job Card, and the delivery teams complete traveller, document, rooming, ticketing, expense, approval, and finance work. The core value loop is simple: each completed handoff makes the next person's work clearer, which makes the record more complete, which makes the following handoff faster and safer.

Evidence of success is operational: more confirmed queries managed end to end, shorter handoff time, fewer unassigned or overdue records, fewer spreadsheet reconciliation failures, faster collection and approval cycles, and daily return usage by each operating team.

## One portfolio, explicit order

1. **Citius Connect CRM** earns adoption and revenue by making today's work reliable and actionable.
2. **The public website** earns qualified demand and trust, then hands intent into the operating loop without becoming a separate product roadmap.
3. **Citius Concierge** improves discovery and conversion when its answers are grounded, measurable, safely configured, and connected to useful next steps.
4. **Sacred Bharat** builds differentiated consumer engagement and first-party travel intent. It should feed qualified demand and loyalty into the core business without delaying CRM reliability.

Public, AI, and Sacred Bharat investments therefore compete on how clearly they create demand, improve conversion, or deepen retention for the CRM-led business—not on novelty alone.

The **Customer Travel Account** supports the CRM-led business after demand becomes a paid or
confirmed journey: the public site and payments create an attributable Booking, the CRM projects
immutable confirmed-trip facts, Concierge may help customers understand next steps, and Sacred
Bharat may deepen repeat travel intent, but none of those surfaces grants Account or Staff authority.
Account investment is limited to trustworthy journey visibility, service clarity, and repeat-travel
continuity—not a parallel CRM or consumer marketplace. Through the next strategy review on
**31 March 2027**, measure journey-packet access success, customer support contacts per confirmed
journey, repeat signed-in journey views, and attributable repeat enquiries. Account and Staff
Workspace remain separate canonical baselines; broad Client/Traveller sharing and Sensitive Travel
Document intake are non-goals until explicit entitlements and ADR 0012 launch evidence exist.

## Protected product principles

- Preserve settled workflow semantics: Sales Decision owns terminal query outcomes; Contracting hands proposals to Sales; Job Cards begin only after confirmation; role, assigned-team, Cement, leave, expense, notification, and document scopes stay server enforced.
- Make ownership and the next safe action obvious.
- Prefer one trustworthy operational record over duplicate convenience state.
- Show partial, stale, pending, and failed states honestly; never present sampled or incomplete values as authoritative.
- Keep human judgment where the business requires it, including manual margin entry and approval decisions.

## Non-goals

- Replacing the CRM with a generic admin dashboard or redesigning settled workflows for visual novelty.
- Treating Citius Connect, the public site, Concierge, and Sacred Bharat as four independent businesses.
- Automating financial or approval judgment that must remain accountable to staff.
- Expanding broad Admin power when assigned ownership, reporting hierarchy, or a narrow permission expresses the real rule.
- Chasing consumer engagement while core operational handoffs are unreliable.

## Bets and measures

### Near-term bets

- Finish a role-based home with a small set of trusted KPIs, an action inbox, freshness status, and direct filtered drill-downs.
- Make large CRM lists bounded and searchable without changing their workflow semantics.
- Make destructive cleanup, notifications, imports, and payment transitions observable and idempotent.
- Establish release, browser-smoke, and contract gates so wide migrations remain deployable as one coherent product.

Measures: median time to assignment and next action, unassigned/overdue backlog, list first-useful-page latency, failed import/notification/cleanup recovery, and weekly active staff by role.

### Strategic bets

- Connect public and Concierge intent to a qualified CRM query with measurable source and consent.
- Turn Sacred Bharat progress into repeat engagement and relevant pilgrimage demand without compromising guest privacy or local drafts.
- Use accumulated workflow data to recommend—not silently execute—safer next actions and operational forecasts.

Measures: qualified inquiry conversion, confirmed-order conversion, repeat traveller engagement, attributable pipeline, and operator retention.

## Governance

Version 1.0 has been the authoritative prioritization anchor since the recorded
product-owner approval on 17 July 2026. It does not override explicit workflow
contracts, executable authorization/security policy, or separately approved
implementation specifications.
