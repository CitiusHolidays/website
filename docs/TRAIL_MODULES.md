# Trail module boundaries

The public pilgrimage catalog and renderer are intentionally split by change frequency:

- `src/data/trails/` keeps the two detailed Kailash products, smaller programme records, supporting testimonials/sites, catalog ordering, and derived helpers in separate modules.
- `src/components/pilgrimage/trailSection/` separates itinerary/highlight tabs, package/information tabs, media/booking tabs, and the shared shell.
- `src/data/trails.js` is the compatibility facade for existing route, header, sitemap, and hub imports. Keeping that facade avoids a wide import migration while the internal modules stay independently maintainable.

Stable trail identifiers, order, URL slugs, group order, and helper outputs are protected by `src/data/trails/trails.contract.test.js`. The same contract also pins the Sacred Bharat trail order, canonical aliases, deduplicated scoring, and Journey Planner trail filtering. Every decomposed content or presentation module must remain at or below 500 lines; the contract test enforces this ceiling.
