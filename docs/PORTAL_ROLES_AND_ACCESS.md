# Portal roles and access

Source of truth: `convex/crm/lib.ts` (`ALL_ROLES`, `ROLE_PERMISSIONS`, `DIRECTOR_PERMISSIONS`, `TEAM_PICKER_PERMISSIONS`, `getRolePermissions`). The matching client constants live in `src/lib/portal/constants.js`, and client-only affordance checks live in `src/lib/portal/permissions.js`.

Every provisioned staff user with at least one role also gets baseline access to request leave, view expenses, and create expenses. Users with multiple roles receive the union of all permissions.

Directors and Director Cement now share the same operational permission set: all portal permissions except staff administration, dropdown/settings administration, and activity-log access. They can still perform director override actions such as team assignment and job-card creator allowlist management.

## Roles

| Role | What it does | Main access |
| --- | --- | --- |
| Admin | Full system administrator for Citius Connect. | All portal permissions, including staff, dropdowns/settings, CRM, job cards, traveller operations, finance, approvals, reports, activity, and sensitive traveller data. |
| Directors | Executive oversight and operational override across sales, contracting, job cards, operations, finance, leaves, approvals, and reports. | All operational permissions, including managing queries, contracting, proposals, job cards, travellers, visa, ticketing, operations, tour managers, finance, expenses, leave, approvals, reports, and sensitive traveller data. Cannot manage staff, manage dropdowns/settings, or view the activity log. |
| Sales Head | Sales manager for query pipeline and proposal/client decisions. | View/manage queries, view proposals, send proposals, view team, view leave, approve leave. |
| Sales | Sales user who creates and updates enquiries, tracks client decisions, and sends finalized proposals. | View/manage queries, view proposals, send proposals, view leave. |
| Contracting Head | Contracting lead who reviews submitted queries, assigns/oversees proposal costing, and manages contracting proposal work. | View queries, contracting, proposals, job cards, team, and leave; manage contracting and proposals; approve leave. |
| Contracting | Contracting SPOC for costing and proposal preparation. | View queries, contracting, proposals, job cards, and leave; manage contracting and proposals. |
| Accounts | Accounts user who creates job cards and handles finance workflow. | View/manage job cards, view/manage finance, view expenses, view leave, view reports. |
| Accounts Head | Accounts lead with oversight of queries, job cards, finance, reports, and team context. | View queries, job cards, finance, expenses, team, leave, and reports; manage job cards and finance. |
| Operations Head | Operations lead for job-card execution, traveller master, visa/passport operations, hotel/rooming, tour managers, ticketing visibility, and sensitive traveller data. | View queries, contracting, proposals, job cards, travellers, visa, operations, tour managers, ticketing, expenses, finance, team, leave, and sensitive traveller data; manage job cards, travellers, visa, operations, and tour managers; approve leave. |
| Operations | Operations executor for traveller master, visa/passport operations, hotel/rooming, tour managers, and ticketing visibility. | View job cards, travellers, visa, operations, tour managers, ticketing, expenses, and leave; manage travellers, visa, operations, and tour managers. |
| Head of Ticketing | Ticketing lead for ticketing work and team oversight. | View queries, proposals, job cards, travellers, ticketing, tour managers, team, and leave; manage ticketing; approve leave. |
| Ticketing | Ticketing user who manages PNRs, tickets, seats, and ticketing inputs on assigned work. | View queries, proposals, job cards, travellers, ticketing, tour managers, and leave; manage proposals and ticketing. |
| Tour Manager | Tour manager user who sees assigned operational context and can manage their expenses. | View job cards, travellers, visa, ticketing, tour managers, expenses, and leave; manage expenses. |
| Finance | Finance user for invoices, expenses, approvals, and reports. | View job cards, finance, expenses, leave, approvals, and reports; manage finance; approve expenses. |
| HR | HR user for staff leave and approval administration. | View dashboard, team, leave, and approvals; manage leave; approve leave. |
| Contracting Cement | Cement-scoped contracting role for Cement and Cement Bidding query types. | View dashboard, queries, contracting, proposals, job cards, and leave; manage contracting and proposals. This role is included in contracting SPOC pickers. |
| Operations Cement | Cement-scoped operations role for Cement and Cement Bidding job-card execution. | View dashboard, job cards, travellers, visa, operations, tour managers, ticketing, expenses, and leave; manage travellers, visa, operations, and tour managers. |
| Sales Cement | Cement-scoped sales role for Cement and Cement Bidding query types. | View dashboard, queries, proposals, and leave; manage queries; send proposals. |
| Director Cement | Cement-scoped director role for Cement and Cement Bidding oversight and overrides. | Same operational permissions as Directors, including director assignment overrides and sensitive traveller data. Cannot manage staff, manage dropdowns/settings, or view the activity log. Director Cement is not treated as a cement-scoped restricted user for query-type filtering. |

## Permission rules

- `Admin` is the only role with every permission, including settings/staff and activity-log access.
- `Directors` and `Director Cement` use `DIRECTOR_PERMISSIONS`, which is computed from all permissions minus `manage:staff`, `manage:dropdowns`, and `view:activity`.
- `getRolePermissions` always adds `request:leave`, `view:expenses`, and `create:expenses` for any provisioned staff user with at least one role.
- Cement-scoped base roles (`Sales Cement`, `Contracting Cement`, `Operations Cement`) are limited to Cement and Cement Bidding query types. Admin, Directors, and Director Cement bypass that restriction.
- The portal client and Convex backend must stay in sync: update both `convex/crm/lib.ts` and `src/lib/portal/constants.js` when role permission mappings change.

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

`tools/portal-role-pages-expected.json` documents the expected page-level access fixture used by portal permission tests. Director access should include operational pages such as pipeline, accounts/job-card command center, passport, visa, hotels, ticketing, flights, seat allocation, tickets, and tour managers, while still denying settings and activity.

`src/lib/portal/rolePermissionsParity.test.js` asserts that `convex/crm/lib.ts` and `src/lib/portal/constants.js` stay in sync for permissions, roles, director permissions, team-picker permissions, and shared team-role lists.

## Record-level edit rules

Coarse `manage:*` permissions gate API entry points, but proposal/query/job-card mutations also enforce assignment rules:

- **Proposal edit/send** — Contracting SPOC, collaborators, department heads, directors, and the **assigned Ticketing SPOC** on a linked query may edit proposal costing (`canEditProposalRecord` in `convex/crm/lib.ts`). Head of Ticketing remains view-only unless they are the assigned ticketing owner.
- **Query visibility** — Department heads (including **Accounts Head**) can see queries in their oversight scope. Accounts and Finance still only see confirmed orders unless they are also assigned owners.
- **Job card creation** — Accounts, Accounts Head, director roles (`Admin`, `Directors`, `Director Cement`), and allowlisted Accounts staff may create job cards from confirmed queries.

## Notification email behavior

Bell notifications are still targeted by exact user or role rows. Email recipient lookup expands department notifications to the corresponding head role so operational heads do not miss email when a workflow targets the base department role:

| Notification role | Also emails |
| --- | --- |
| Sales | Sales Head |
| Contracting | Contracting Head |
| Accounts | Accounts Head |
| Operations | Operations Head |
| Ticketing | Head of Ticketing |

Head-targeted notifications do not email the base department role unless that base role is also targeted.
