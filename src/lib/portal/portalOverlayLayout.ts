/** Header chrome height (matches portal sticky `top-16`). */
export const PORTAL_HEADER_OFFSET = "4rem";

/** Typical sticky list-toolbar band below the header (title + filter row). */
export const PORTAL_TOOLBAR_BAND = "4.5rem";

/** Viewport offset where scrollable main content begins (below header + toolbar). */
export const PORTAL_MAIN_BELOW_TOOLBAR = `calc(${PORTAL_HEADER_OFFSET} + ${PORTAL_TOOLBAR_BAND})`;

/** Command palette / save-view panel sits just below the sticky toolbar. */
export const PORTAL_COMMAND_PALETTE_PANEL_TOP = `calc(${PORTAL_MAIN_BELOW_TOOLBAR} + 0.75rem)`;
