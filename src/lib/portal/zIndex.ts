/**
 * Portal UI stacking order (low -> high).
 * Header-attached dropdowns sit in the header (chrome) stacking context, so list
 * toolbars must stay below chrome. Command palette / save-view dialogs portal to
 * document.body and use PORTAL_Z_INDEX for inline styles. Toasts sit above modals
 * so validation errors remain visible; confirm dialogs stay on top.
 */
export const PORTAL_Z = {
  chrome: "z-40",
  commandPalette: "z-[55]",
  confirm: "z-[100]",
  dropdown: "z-50",
  dropdownBackdrop: "z-[45]",
  entityModal: "z-[80]",
  importModal: "z-[75]",
  mobileBackdrop: "z-50",
  mobileDrawer: "z-[60]",
  nestedModal: "z-[90]",
  skipLinkFocus: "z-[100]",
  toast: "z-[95]",
  toolbar: "z-30",
} as const;

export type PortalZKey = keyof typeof PORTAL_Z;

/** Numeric mirror of PORTAL_Z for inline styles (command palette frame, etc.). */
export const PORTAL_Z_INDEX = {
  chrome: 40,
  commandPalette: 55,
  confirm: 100,
  dropdown: 50,
  dropdownBackdrop: 45,
  entityModal: 80,
  importModal: 75,
  mobileBackdrop: 50,
  mobileDrawer: 60,
  nestedModal: 90,
  skipLinkFocus: 100,
  toast: 95,
  toolbar: 30,
} as const satisfies Record<PortalZKey, number>;
