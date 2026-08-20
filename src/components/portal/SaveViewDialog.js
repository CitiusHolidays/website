"use client";

import { useId, useRef, useState } from "react";
import { usePortalOverlayFrame } from "@/components/portal/usePortalOverlayFrame";
import {
  ControlledDialog,
  ControlledDialogClose,
  ControlledDialogTitle,
} from "@/components/ui/application-dialog";

export default function SaveViewDialog({ open, onClose, onSave, saving = false }) {
  const [name, setName] = useState("");
  const inputId = useId();
  const inputRef = useRef(null);
  const { backdropStyle, frameStyle, panelStyle } = usePortalOverlayFrame({ open });
  const handleNameChange = (event) => setName(event.target.value);
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setName("");
      onClose();
    }
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

  return (
    <ControlledDialog
      backdropClassName="portal-command-backdrop"
      backdropStyle={backdropStyle}
      closeDisabled={saving}
      initialFocus={inputRef}
      onOpenChange={handleOpenChange}
      open={open}
      panelClassName="portal-save-view-panel"
      panelStyle={panelStyle}
      popupClassName="material-floating portal-command-surface pointer-events-auto mx-auto w-full max-w-md rounded-xl border border-brand-border/80 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
      popupRender={<form onSubmit={submit} />}
      viewportClassName="portal-command-overlay"
      viewportStyle={frameStyle}
    >
      <ControlledDialogTitle className="font-heading font-semibold text-base text-citius-blue">
        Save current view
      </ControlledDialogTitle>
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
        onChange={handleNameChange}
        placeholder="e.g. My open queries"
        ref={inputRef}
        value={name}
      />
      <div className="mt-4 flex justify-end gap-2">
        <ControlledDialogClose
          className="portal-outline-btn transition-transform duration-150 ease-out active:scale-[0.96]"
          disabled={saving}
          type="button"
        >
          Cancel
        </ControlledDialogClose>
        <button
          className="portal-primary-btn transition-transform duration-150 ease-out active:scale-[0.96]"
          disabled={!name.trim() || saving}
          type="submit"
        >
          Save
        </button>
      </div>
    </ControlledDialog>
  );
}
