# Trail module boundaries

The public pilgrimage catalog and renderer are intentionally split by change frequency:

- `src/data/trails/` keeps the two detailed Kailash products, smaller programme records, supporting testimonials/sites, catalog ordering, and derived helpers in separate modules.
- `src/components/pilgrimage/trailSection/` separates itinerary/highlight tabs, package/information tabs, media/booking tabs, and the shared shell.
- `src/data/trails.js` is the compatibility facade for existing route, header, sitemap, and hub imports. Keeping that facade avoids a wide import migration while the internal modules stay independently maintainable.

`src/data/trails/trails.test.js` covers stable trail identifiers, ordering, URL helpers, and the
retained Sacred Bharat aliases used by inbound-intent compatibility.
