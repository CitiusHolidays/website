# Portal roles and access

Source of truth: `convex/crm/lib.ts` (`ALL_ROLES`, `ROLE_PERMISSIONS`, `getRolePermissions`). The matching client constants live in `src/lib/portal/constants.js`.

Every provisioned staff user with at least one role also gets baseline access to request leave, view expenses, and create expenses. Users with multiple roles receive the union of all permissions.

## Roles

| Role | What it does | Main access |
| --- | --- | --- |
| Admin | Full system administrator for Citius Connect. | All portal permissions, including staff, dropdowns, CRM, job cards, traveller operations, finance, approvals, reports, activity, and sensitive traveller data. |
| Directors | Executive oversight across sales, contracting, job cards, operations, finance, leaves, approvals, and reports. | View dashboard, queries, contracting, proposals, job cards, travellers, visa, ticketing, operations, tour managers, finance, expenses, team, leave, approvals, reports, and sensitive traveller data; approve expenses and leave. |
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
| Contracting Cement | Cement-scoped contracting role for Cement and Cement Bidding query types. | View dashboard, queries, contracting, proposals, job cards, and leave; manage contracting and proposals. |
| Operations Cement | Cement-scoped operations role for Cement and Cement Bidding job-card execution. | View dashboard, job cards, travellers, visa, operations, tour managers, ticketing, expenses, and leave; manage travellers, visa, operations, and tour managers. |
| Sales Cement | Cement-scoped sales role for Cement and Cement Bidding query types. | View dashboard, queries, proposals, and leave; manage queries; send proposals. |
| Director Cement | Cement-scoped director role for Cement and Cement Bidding oversight. | View dashboard, queries, contracting, proposals, job cards, travellers, visa, ticketing, operations, tour managers, finance, expenses, team, leave, approvals, reports, and sensitive traveller data; approve expenses and leave. |

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
