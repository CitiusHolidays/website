# Citius Connect logo delivery status

The current approved source is `src/static/logos/citiusconnect.png`, an RGB raster measuring
**546 × 225** with no alpha channel. `src/lib/citiusConnectLogo.js` records that intrinsic geometry;
all Portal and Staff-auth consumers use it so Next.js reserves the correct aspect ratio without
changing the logo's perceived size or the surrounding layout.

## Placement map

- Portal header: light surface, natural raster colors, existing header-height constraint.
- Citius Connect sign-in: the same light-surface raster and shared intrinsic dimensions.
- Public site, Customer Account, Sacred Bharat, and app-icon contexts: not approved placements.

## Approval boundary

A master vector, transparent light-surface export, dark-surface export, reduced mark, auto-traced
geometry, and app icon are **not approved** and do not exist in the repository. Obtain the original
brand-owner master vector before adding any of those variants. A future package must prove geometric
equivalence with this approved raster, document clear space/minimum size/background rules, and pass
side-by-side Portal and Staff-auth review before replacing the current file.
