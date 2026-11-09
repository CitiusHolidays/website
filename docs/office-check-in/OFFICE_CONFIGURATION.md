# Office check-in: configuration needed from each office

No production values are set in code. Collect the items below for each office (Mumbai/Thane,
Bengaluru, Kolkata, and any other branch), enter them in **Office check-in → Admin**, and keep the
office in **Report only** until the pilot exit criteria are met.

## 1. Network (for office computers, including Ethernet desktops)

Ask the office's IT contact or ISP:

- Every public egress IP or range the office uses, **IPv4 and IPv6**. Many ISPs give a single static
  IPv4; some hand out dynamic addresses or IPv6 prefixes. Record whether each is static.
- Backup or failover links (second ISP, 4G router) and their egress IPs.
- Whether a **company VPN** exists, and whether remote staff on that VPN exit through the office
  connection. If they do, the office range cannot tell them apart: add it as **Office (shared with
  VPN)** so it counts as uncertain, and rely on location for those staff.
- Any proxy, secure web gateway or Zero Trust client (Cloudflare WARP, Zscaler, etc.) on office
  machines. Their exit IPs belong to the provider, not the office; add them as **VPN or proxy exit**.
- Guest Wi-Fi that shares the office IP: anyone on it will match the office network.

Use the narrowest range that covers the office. The editor refuses ranges broader than /22 (IPv4)
or /48 (IPv6).

During the pilot, **Unmatched networks seen during pilot** lists the /24 or /48 prefixes that
check-ins came from but did not match. Confirm any candidate with IT before adding it.

## 2. Location (where a location check is appropriate)

- Office latitude and longitude, measured at the office entrance or centre of the floor (not taken
  from a map search result for the building's address).
- A radius in metres. Start wide enough to include the building and its entrance (for example 100 to
  150 m in a dense city block), then tighten from pilot data. Allowed range: 25 to 2000 m.
- An accuracy limit in metres, smaller than the radius (a reading passes only when its whole
  accuracy circle fits inside the fence). Indoor phone readings are often 20 to 100 m and desktop browsers
  without GPS can be kilometres off. Readings worse than the limit are recorded as uncertain.
  A device can first answer with the position it remembers from earlier (common on a Mac after
  sleep), so the press waits up to 10 seconds for a reading taken after it; only if none arrives is
  the old one sent, and it is recorded as uncertain.
- Which staff use phones or laptops versus fixed desktops. Desktops usually cannot give a useful
  location, so a location-only or "both" rule will leave them uncertain.

## 3. Rule per office

| Rule | Use when |
| --- | --- |
| Office network | Staff use office desktops or office Wi-Fi and the range is not shared with a VPN. |
| Location | Staff use phones or laptops and there is no reliable office network range. |
| Both | You need both signals. Desktop users without location will stay uncertain. |
| Either | Desktops pass on the network, phones pass on location. Weaker than Both. |

## 4. Deployment prerequisites (owner: release/infra)

- Confirm the custom domain is served directly by Vercel with no proxy in front. If a proxy sits in
  front, the observed IP is the proxy's and every check-in would look identical.
- Set `OFFICE_CHECK_IN_GATEWAY_SECRET` (same random value) in the Vercel project and the Convex
  deployment, and `OFFICE_CHECK_IN_CLIENT_IP_SOURCE=vercel-edge` in Vercel. Without these, clock-in
  returns "unavailable" or records the IP as unavailable.
- The Staff Workspace sends `Permissions-Policy: geolocation=(self)` for `/portal` routes only; the
  public site keeps geolocation disabled.
- Retention: check-ins and attendance audit events are deleted automatically after 92 days by the
  daily **Office check-in retention** Live Feature Control; office and rule configuration history is
  kept.

## 5. Pilot and exit criteria

1. Assign staff to their office (Admin → Staff office assignment).
2. Run report-only for at least two working weeks per office, covering desktops, laptops on Wi-Fi,
   phones, VPN users and anyone who works near the boundary.
3. Review every fail and uncertain record with managers; correct ranges, radius and accuracy.
4. Agree in writing which outcome rate is acceptable before proposing **Enforce** for an office.
   Switching to Enforce requires an explicit confirmation and is audited.
