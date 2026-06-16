"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePortalOverlayFrame } from "@/components/portal/usePortalOverlayFrame";

const subscribeToClientMount = (onStoreChange) => {
  onStoreChange();
  return () => {};
};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export default function SaveViewDialog({ open, onClose, onSave, saving = false }) {
  const [name, setName] = useState("");
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );
  const inputId = useId();
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const { backdropStyle, panelStyle } = usePortalOverlayFrame({
    panelTop: "calc(4rem + 3rem)",
  });

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [mounted, open]);

  if (!open || !mounted) return null;

  const closeDialog = () => {
    setName("");
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    await onSave(trimmed, { isFavorite: true });
    setName("");
    onClose();
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={inputId}
      className="portal-native-dialog"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
    >
      <button
        type="button"
        aria-label="Close save view dialog"
        className="portal-command-backdrop"
        style={backdropStyle}
        onClick={closeDialog}
      />
      <div className="portal-save-view-panel" style={panelStyle}>
        <form
          onSubmit={submit}
          className="portal-command-surface pointer-events-auto mx-auto w-full max-w-md rounded-xl border border-brand-border/80 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <h2 id={inputId} className="font-heading text-base font-semibold text-citius-blue">
            Save current view
          </h2>
          <label
            className="mt-3 block text-xs font-medium text-brand-muted"
            htmlFor={`${inputId}-name`}
          >
            View name
          </label>
          <input
            ref={inputRef}
            id={`${inputId}-name`}
            aria-label="View name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="portal-toolbar-control mt-1 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
            placeholder="e.g. My open queries"
            maxLength={80}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="portal-outline-btn transition-transform duration-150 ease-out active:scale-[0.96]"
              onClick={closeDialog}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="portal-primary-btn transition-transform duration-150 ease-out active:scale-[0.96]"
              disabled={!name.trim() || saving}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </dialog>,
    document.body,
  );
}
