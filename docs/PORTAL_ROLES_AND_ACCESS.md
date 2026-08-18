# Portal roles and access

Executable source of truth: `convex/crm/lib/rolePolicy.ts`. `convex/crm/lib.ts`
re-exports that policy for backend consumers. The matching client constants
live in `src/lib/portal/constants.js`, and client-only affordance checks live in
`src/lib/portal/permissions.js`.

Every provisioned staff user with at least one role also gets baseline access to request leave, view expenses, and create expenses. Users with multiple roles receive the union of all permissions.

Directors receive every portal permission, including staff administration,
dropdown/settings administration, and activity-log access. Director Cement uses the restricted director permission set: every permission except
`manage:staff`, `manage:dropdowns`, and `view:activity`. Both retain the
explicit director override actions described below.

## Roles

| Role | Stable responsibility | Notes |
| --- | --- | --- |
| Admin | Full system administration. | Receives every permission. |
| Directors | Executive and system-wide operational oversight. | Receives every permission, separately from `DIRECTOR_PERMISSIONS`. |
| Sales Head / Sales | Query ownership, pipeline, and Sales Decision. | Head adds team and approval oversight. |
| Contracting Head / Contracting | Proposal costing and Contracting SPOC work. | Head adds assignment, team, and approval oversight. |
| Accounts Head / Accounts | Confirmed-order Job Cards and finance workflow. | Head adds query and team oversight. |
| Operations Head / Operations | Traveller, visa, hotel/rooming, and delivery operations. | Head adds assignment and sensitive-data oversight. |
| Head of Ticketing / Ticketing | Ticketing execution and assigned proposal inputs. | Head has team oversight; assigned Ticketing can manage proposal costing. |
| Tour Manager | Assigned trip context and own expenses. | Record assignment still limits visible work. |
| Finance | Finance, expense approval, and reports. | Does not inherit Accounts Job Card creation. |
| HR | Leave and approval administration. | Two-stage leave rules remain separate from page access. |
| Contracting / Operations / Sales Cement | Cement and Cement Bidding work in the matching department. | Base Cement roles receive query-type record scope. |
| Director Cement | Director overrides for Cement operations. | Uses the restricted director permission set and currently bypasses Cement query-type filtering. |

## Permission rules

- `Admin` and `Directors` each receive every current permission.
- `Director Cement` alone uses `DIRECTOR_PERMISSIONS`, computed from all
  permissions minus `manage:staff`, `manage:dropdowns`, and `view:activity`.
- `getRolePermissions` always adds `request:leave`, `view:expenses`, and `create:expenses` for any provisioned staff user with at least one role.
- Cement-scoped base roles (`Sales Cement`, `Contracting Cement`, `Operations Cement`) are limited to Cement and Cement Bidding query types. Admin, Directors, and Director Cement bypass that restriction.
- Do not maintain a second exact permission matrix in prose. Update
  `convex/crm/lib/rolePolicy.ts` first, then the client mirror and parity fixture.

## Assignment and picker access

Assignment helpers are intentionally narrower than raw page access:

| Action | Allowed roles |
| --- | --- |
| Assign contracting on a query | Admin, Directors, Director Cement, Contracting Head, Operations Head |
| Assign ticketing on a query | Admin, Directors, Director Cement, Head of Ticketing |
| Assign operations on a job card | Admin, Directors, Director Cement, Operations Head |
| Assign ticketing on a job card | Admin, Directors, Director Cement, Head of Ticketing |
| Assign tour managers | Admin, Directors, Director Cement, Operations Head |
| Manage Accounts job-card creator access | Admin, Directors, Director Cement, Accounts Head |
| Create job cards from Accounts | Accounts, Accounts Head, Admin, Directors, Director Cement |

Sales users can use the initial Sales query assignment form but cannot perform head/director assignment actions. That is why `listTeamOptions` exists: users with a team-picker permission can load active staff dropdown options without receiving full Team Directory access.

`TEAM_PICKER_PERMISSIONS` currently includes `view:team`, `manage:queries`, `manage:contracting`, `manage:proposals`, `manage:jobCards`, `manage:operations`, `manage:ticketing`, and `manage:leave`.

## Page-access verification

`tools/portal-role-pages-expected.json` documents the expected page-level access
fixture used by portal permission tests. Directors access includes Settings and
Activity because the executable role has all permissions. Director Cement keeps
the operational page set while Settings and Activity remain excluded.

`src/lib/portal/rolePermissionsParity.test.js` imports the server policy and
asserts that `src/lib/portal/constants.js` stays in sync for permissions, roles,
director permissions, team-picker permissions, and shared team-role lists.

## Record-level edit rules

Coarse `manage:*` permissions gate API entry points, but proposal/query/job-card mutations also enforce assignment rules:

- **Proposal edit/send** — Contracting SPOC, collaborators, department heads, directors, and the **assigned Ticketing SPOC** on a linked query may edit proposal costing (`canEditProposalRecord` in `convex/crm/lib.ts`). Head of Ticketing remains view-only unless they are the assigned ticketing owner.
- **Query visibility** — Department heads (including **Accounts Head**) can see queries in their oversight scope. Accounts and Finance still only see confirmed orders unless they are also assigned owners.
- **Job card creation** — Accounts, Accounts Head, director roles (`Admin`, `Directors`, `Director Cement`), and allowlisted Accounts staff may create job cards from confirmed queries.

## Notification email behavior

Bell notifications are targeted by exact staff, user, or role rows created by the workflow. Staff
records can also carry **Additional email alert roles** in Settings. Portal roles always retain
their standard role-based email alerts; additional roles add email coverage without changing portal
access or bell visibility.

Email recipient lookup expands department notifications to the corresponding head role so operational heads do not miss email when a workflow targets the base department role:

| Notification role | Also emails |
| --- | --- |
| Sales | Sales Head |
| Contracting | Contracting Head |
| Accounts | Accounts Head |
| Operations | Operations Head |
| Ticketing | Head of Ticketing |

Head-targeted notifications do not email the base department role unless that base role is also targeted.

Direct staff email targets do not depend on either role list. Workflows that intentionally need a
bell without email use the explicit no-email target instead of relying on an empty preference list.

Sales query intake is narrower than the base expansion table: new or submitted queries notify the assigned Contracting/Ticketing SPOCs plus the relevant assignment heads. They do not create bell or email alerts for the entire Contracting team.

Delivery oversight is a separate permission, `view:emailDeliveryStatus`. Department heads, Admin,
Directors, and Director Cement can see privacy-safe queued/retry/sent/exhausted counts in Activity;
recipient addresses and provider response bodies are never exposed. Base department roles do not
inherit this summary surface.
