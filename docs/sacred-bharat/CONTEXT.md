# Sacred Bharat

Gamified spiritual pilgrimage tracking for public guests and signed-in yatris — separate from the Citius CRM portal and `/pilgrimage` booking flows.

## Language

**Sacred Site**:
A canonical temple or pilgrimage destination in the Sacred Bharat catalog, identified by a stable `id` (e.g. `kedarnath`).
_Avoid_: Temple row, POI, location pin

**Darshan**:
A yatri marking that they have visited a sacred site. Stored as a visit record (guest: localStorage; signed-in: Convex `sacredBharatVisits`). Legacy ids `rameswaram` and `varanasi` resolve to `ramanathaswamy` and `kashi-vishwanath`.
_Avoid_: Check-in, tick, complete

**Merged Sacred Site**:
Canonical catalog entry that absorbs a former duplicate id (e.g. Ramanathaswamy includes Rameswaram Char Dham; Kashi Vishwanath includes Varanasi ghats). One darshan, one Temple Points award.
_Avoid_: Double visit, separate ghat entry

**Soul Score**:
The yatri's total pilgrimage points: sum of each visited site's **Temple Points**, plus **Trail Completion Bonuses**, plus completed **Challenge** point rewards.
_Avoid_: XP, karma, leaderboard points (use Soul Score unless comparing ranks)

**Temple Points**:
Weighted significance score (max 100 per site) from the Sacred Bharat scorecard — not a flat per-visit constant.
_Avoid_: +25 pts, generic visit credit

**Spiritual Trail**:
A curated set of sacred sites (or a region rule for Bharat Explorer) that awards a badge and completion bonus when all requirements are met.
_Avoid_: Quest, route, package

**Yatri**:
Anyone using Sacred Bharat to track visits — guest or authenticated. Level titles (Seeker → Moksha Pathfinder) derive from Soul Score thresholds.
_Avoid_: User, player, customer

**Yatri Passport**:
Optional public profile (`sacredBharatProfiles`) with slug, display name, and share settings for visits and wishlist.
_Avoid_: Account profile, CRM staff profile

**Wishlist**:
Sacred sites or trails marked for a future journey — planning intent, not a visit.
_Avoid_: Cart, saved trip, CRM query

**Private Group**:
Family or friends leaderboard scoped by invite code — not the national leaderboard.
_Avoid_: Team, CRM group, portal role group

**Challenge**:
Time-bound or milestone badge (e.g. First Five Darshans). Completed challenges add their `points` to **Soul Score** in addition to temple and trail bonuses.
_Avoid_: Trail (when the full trail is meant), CRM task

**AI Journey Planner**:
Streaming pilgrimage itinerary generator on `/sacred-bharat` using the yatri's visited sites and catalog metadata. Premium-adjacent feature; leads to Citius contact for curated quotes.
_Avoid_: Generic site chatbot, CRM query form
