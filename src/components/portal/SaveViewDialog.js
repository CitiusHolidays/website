"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePortalOverlayFrame } from "@/components/portal/usePortalOverlayFrame";

const subscribeToClientMount = (onStoreChange) => {
  onStoreChange();
  return () => {};
};
const getClientPortalTarget = () => document.body;
const getServerPortalTarget = () => null;

export default function SaveViewDialog({ open, onClose, onSave, saving = false }) {
  const [name, setName] = useState("");
  const portalTarget = useSyncExternalStore(
    subscribeToClientMount,
    getClientPortalTarget,
    getServerPortalTarget
  );
  const inputId = useId();
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const { backdropStyle, panelStyle } = usePortalOverlayFrame({
    panelTop: "calc(4rem + 3rem)",
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!(open && portalTarget)) {
      return;
    }
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, [open, portalTarget]);

  if (!(open && portalTarget)) {
    return null;
  }

  const closeDialog = () => {
    setName("");
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) {
      return;
    }
    await onSave(trimmed, { isFavorite: true });
    setName("");
    onClose();
  };

  return createPortal(
    <dialog
      aria-labelledby={inputId}
      className="portal-native-dialog"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      ref={dialogRef}
    >
      <button
        aria-label="Close save view dialog"
        className="portal-command-backdrop"
        onClick={closeDialog}
        style={backdropStyle}
        type="button"
      />
      <div className="portal-save-view-panel" style={panelStyle}>
        <form
          className="portal-command-surface pointer-events-auto mx-auto w-full max-w-md rounded-xl border border-brand-border/80 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
          onSubmit={submit}
        >
          <h2 className="font-heading font-semibold text-base text-citius-blue" id={inputId}>
            Save current view
          </h2>
          <label
            className="mt-3 block font-medium text-brand-muted text-xs"
            htmlFor={`${inputId}-name`}
          >
            View name
          </label>
          <input
            aria-label="View name"
            className="portal-toolbar-control mt-1 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
            id={`${inputId}-name`}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. My open queries"
            ref={inputRef}
            value={name}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="portal-outline-btn transition-transform duration-150 ease-out active:scale-[0.96]"
              disabled={saving}
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>
            <button
              className="portal-primary-btn transition-transform duration-150 ease-out active:scale-[0.96]"
              disabled={!name.trim() || saving}
              type="submit"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </dialog>,
    portalTarget
  );
}
