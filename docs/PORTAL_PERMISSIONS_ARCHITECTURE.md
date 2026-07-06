# Portal permissions architecture

This doc explains how Citius Connect authorization is split between backend enforcement, client affordances, and portal page visibility.

## Source files

| Concern | File |
| --- | --- |
| Backend role names, permission strings, role-to-permission mapping, Convex guard helpers | `convex/crm/lib.ts` |
| Staff access queries and narrow staff pickers | `convex/crm/staff.ts` |
| Query team assignment workflow | `convex/crm/queryTeamAssignment.ts` |
| Client mirror of roles, permissions, nav groups, and role mappings | `src/lib/portal/constants.js` |
| Client permission helpers and UI affordance checks | `src/lib/portal/permissions.js` |
| Portal state and data loading gates | `src/components/portal/usePortalWorkspaceState.js` |
| Expected page matrix fixture | `tools/portal-role-pages-expected.json` |

When changing role permissions, update the backend source first, then mirror the client constants and the expected page fixture.

## Permission model

`getRolePermissions` unions permissions for every role on a staff user. If the user has any role at all, it also adds baseline staff permissions:

- `request:leave`
- `view:expenses`
- `create:expenses`

`Admin` receives every permission. `Directors` and `Director Cement` use `DIRECTOR_PERMISSIONS`, which is computed from the full permission list minus:

- `manage:staff`
- `manage:dropdowns`
- `view:activity`

This makes director roles operationally broad without giving them staff/settings administration or activity-log visibility.

## Backend guards vs client helpers

Convex guards are authoritative. Client helpers only decide whether to show navigation, buttons, forms, and dropdowns.

Backend guard patterns:

- `requireStaff` authenticates the current staff user and computes portal access.
- `requireAnyPermission` guards functions that can be used by several workflows.
- `requireHeadOrAdmin` is used where department-head authority is the domain rule.
- Specific workflow functions add their own role checks when page-level permissions are too broad.

Client helper patterns:

- `canAccessPage` and `getAccessibleNavGroups` decide page navigation visibility.
- `canAccessPipeline` allows pipeline access from either sales-management or contracting visibility.
- `isDirectorOrAdmin` includes Admin, Directors, and Director Cement.
- `isCementScopedUser` excludes Admin, Directors, and Director Cement before limiting cement users to Cement query types.

## Team pickers

The Team Directory page requires `view:team` and uses `crm.staff.listDirectory`.

Assignment dropdowns should not require full Team Directory access. They use `crm.staff.listTeamOptions`, which returns active staff rows with enough profile fields for selectors and is guarded by `TEAM_PICKER_PERMISSIONS`.

`TEAM_PICKER_PERMISSIONS` includes:

- `view:team`
- `manage:queries`
- `manage:contracting`
- `manage:proposals`
- `manage:jobCards`
- `manage:operations`
- `manage:ticketing`
- `manage:leave`

This is why Sales can populate the initial contracting SPOC dropdown without gaining Team Directory page access.

## Assignment authority

Assignment authority is separate from page access.

| Helper | Allowed by current client rule |
| --- | --- |
| `canAssignContracting` | Admin, Directors, Director Cement, Contracting Head, Operations Head |
| `canAssignQueryTicketing` | Admin, Directors, Director Cement, Head of Ticketing |
| `canAssignOperations` | Admin, Directors, Director Cement, Operations Head |
| `canAssignTicketing` | Admin, Directors, Director Cement, Head of Ticketing |
| `canAssignTourManagers` | Admin, Directors, Director Cement, Operations Head |
| `canManageJobCardCreatorAccess` | Admin, Directors, Director Cement, Accounts Head |

Sales, Sales Head, and Sales Cement can use the Sales initial assignment form when they have `manage:queries`, but they are not treated as head/director assigners.

## Cement roles

Base cement roles are scoped roles:

- `Sales Cement`
- `Contracting Cement`
- `Operations Cement`

They are limited to Cement and Cement Bidding query types through cement-scope filtering. `Contracting Cement` is also eligible for contracting SPOC selection in query team assignment.

`Director Cement` is a director override role, not a cement-scoped restricted role. It receives director operational permissions and bypasses the cement query-type restriction.

## Page matrix and tests

Keep these tests aligned after authorization changes:

- `src/lib/portal/permissions.test.js`
- `src/lib/portal/zIndex.test.js` when chrome stacking changes
- `tools/portal-role-pages-expected.json`
- Convex workflow tests under `convex/crm/*test.ts`

For Convex API/schema changes, run `bunx convex codegen`. For portal permission helper changes, run the focused Bun tests first, then broaden to `bun test` or `bun run check` as needed.
