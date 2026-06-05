/**
 * Portal UI stacking order (low → high).
 * Confirm dialogs must stay above entity and nested modals (e.g. attachments).
 */
export const PORTAL_Z = {
  chrome: "z-40",
  dropdown: "z-50",
  mobileBackdrop: "z-50",
  mobileDrawer: "z-[60]",
  toast: "z-[60]",
  importModal: "z-[75]",
  entityModal: "z-[80]",
  nestedModal: "z-[90]",
  confirm: "z-[100]",
  skipLinkFocus: "z-[100]",
};
