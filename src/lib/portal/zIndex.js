/**
 * Portal UI stacking order (low → high).
 * Header-attached dropdowns sit in the header (chrome) stacking context, so list
 * toolbars must stay below chrome. Command palette / save-view dialogs portal to
 * document.body and use PORTAL_Z_INDEX for inline styles.
 */
export const PORTAL_Z = {
  toolbar: "z-30",
  chrome: "z-40",
  dropdownBackdrop: "z-[45]",
  dropdown: "z-50",
  commandPalette: "z-[55]",
  mobileBackdrop: "z-50",
  mobileDrawer: "z-[60]",
  toast: "z-[65]",
  importModal: "z-[75]",
  entityModal: "z-[80]",
  nestedModal: "z-[90]",
  confirm: "z-[100]",
  skipLinkFocus: "z-[100]",
};

/** Numeric mirror of PORTAL_Z for inline styles (command palette frame, etc.). */
export const PORTAL_Z_INDEX = {
  toolbar: 30,
  chrome: 40,
  dropdownBackdrop: 45,
  dropdown: 50,
  commandPalette: 55,
  mobileBackdrop: 50,
  mobileDrawer: 60,
  toast: 65,
  importModal: 75,
  entityModal: 80,
  nestedModal: 90,
  confirm: 100,
  skipLinkFocus: 100,
};
