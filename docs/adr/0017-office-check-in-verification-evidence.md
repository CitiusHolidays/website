# Treat office check-in signals as evidence, piloted before blocking

Status: Proposed (2026-11-05). Needs product-owner approval before any office leaves report-only mode.

Office check-in lets staff clock in and out in the Staff Workspace and lets authorized managers see
who is in the office and whether each check-in met its office's Branch Verification Rule. It is not
payroll, continuous location tracking or a general attendance system.

## Decision

- **Signals are evidence, not proof.** A matched office network says the request left through that
  network, not that the person sat in the office; an office VPN can make a remote person look local.
  A reported location is device-supplied and can be wrong or spoofed. Each signal is recorded as
  pass, fail or uncertain; missing, denied, stale, imprecise or VPN-shared signals are uncertain,
  never fail.
- **The rule is the office's, not the employee's.** An Admin sets one of: office network, location,
  both, or either. The server evaluates every signal the rule names on the clock-in request itself;
  the employee never chooses a method, so a "both" rule cannot be met by one signal.
- **The client IP comes from the edge, not the browser.** Clock-in and clock-out go through a
  Next.js route that reads the Vercel-set `x-forwarded-for` only when
  `OFFICE_CHECK_IN_CLIENT_IP_SOURCE=vercel-edge` is configured, and forwards it to Convex with a
  server-only gateway secret. Any other setup records the IP as unavailable (uncertain).
- **Report-only first.** New rules start in report-only mode: every check-in is admitted and the
  record shows whether it would have been blocked. Blocking ("enforce") needs an explicit,
  audited confirmation per office. In enforce mode a non-passing check-in is recorded as awaiting
  review rather than refused, so a bad signal never erases the attempt. Clock-out is never blocked.
- **Oversight reuses existing roles.** Admin, Directors, Director Cement and HR oversee every office;
  `view:team` holders oversee people assigned to their own office; anyone oversees their direct
  reports. Nobody reviews or corrects their own record. Rule and office administration requires
  `manage:staff`, which Admin and Directors hold (Director Cement does not). No new permission
  strings are introduced.
- **A forgotten clock-out is corrected, not prevented.** Clock-out closes the latest open record,
  even one from an earlier work date, at the time pressed; managers then correct the times with a
  reason. Corrections cannot create sessions longer than 24 hours.
- **Retention is minimal.** Records keep outcomes, reasons, a coarse distance band, rounded accuracy
  and a /24 (IPv4) or /48 (IPv6) network prefix. Raw coordinates and full IP addresses are not
  stored. Location is requested only when the person presses Clock in or Clock out.
  Decision 2026-11-05: check-in data is kept for 3 months, implemented as 92 days. A daily scheduled
  job (`jobs.purge_office_check_ins`) deletes check-ins whose work date (office default time zone)
  is older than 92 days and attendance audit events older than 92 days. Configuration history
  (`rule_saved`, `office_created`) is kept; `office_assigned` names a person and is deleted.

## Consequences

Managers get a correctable, audited record instead of a verdict. Office network ranges, VPN
routing, coordinates and radii must be gathered and piloted per office before blocking is
considered; see [office configuration](../office-check-in/OFFICE_CONFIGURATION.md).
