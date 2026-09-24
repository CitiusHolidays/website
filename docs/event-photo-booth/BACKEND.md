# Event Photo Booth backend

The single event defaults Closed without a database seed. Active provisioned Admins and Directors
can participate and manage in either state; specifically assigned staff can manage Closed but do
not inherit participant access. The independent `eventPhotoBooth:getMyAccess` query supplies UI
capabilities without modifying CRM roles. Only Admins and Directors can assign existing staff.

`src/lib/eventPhotoBooth/api.ts` owns typed function references; `contracts.ts` owns serializable
DTOs. Published visible scenes alone reach participants. Whole-list draft saves and publication
require the current revision, so a stale editor cannot overwrite another operator's content.
Scene order is array order; at most 24 scenes contain bounded English/Hindi titles and captions.
Bundled artwork is restricted to six known keys. Uploaded artwork uses booth-owned record IDs,
never arbitrary Convex storage IDs or external URLs.

Staff artwork uploads accept at most 900,000 bytes of JPEG, PNG or WebP, at most 4096 pixels per
side and one frame. The existing Sharp dependency decodes, strips metadata and re-encodes WebP
before storing it. `convex.json` externalizes Sharp for the Convex Node runtime. Unreferenced
uploads and replaced artwork are cleaned up after a one-day grace period, with both draft and
published snapshots checked before deletion. This path is for staff scene artwork only.
Participant photos and exports are never sent to this backend.

For aggregate metrics, configure the same random `EVENT_PHOTO_BOOTH_GATEWAY_SECRET` in the
identified Next server and Convex deployment. It is never a browser variable. Without it, the
metrics endpoint fails closed; photo creation, download and share remain independent of metrics.
Environment provisioning is a separate release action and has not been performed by source edits.

`POST /api/event-photo-booth/events` accepts only `{events:[{event,count,sceneId?}]}`: up to 20
entries, counts 1–10, and only the five named metrics. Visits have no scene; other actions name a
published visible scene. Batches amortize gateway requests and aggregate writes. Metrics do not
establish unique attendance, successful downloads or published social posts. Retries can count
again; the client should send best-effort batches without automatic replay.

The gateway rotates an HMAC of the source IP daily; raw IP, auth identity, photos and contact
fields are not stored. A durable rate limiter permits 1200 batches per 15 minutes per hash to
accommodate shared venue Wi-Fi. Transient limiter keys expire after one day and scheduled cleanup
removes both the key and limiter state. The counters occupy one separate document, so metric
writes do not invalidate participant configuration queries. Staff metrics are intentionally live.

Source checks cover the role matrix, publication and revision conflict, private-file isolation,
raster validation and cleanup, gateway limits and aggregate retention. They do not establish
configured hosted secrets, deployment, authenticated live behavior or real-phone cutout quality.
