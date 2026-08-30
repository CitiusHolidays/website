"use client";

import { useId, useRef, useState } from "react";
import { usePortalOverlayFrame } from "@/components/portal/usePortalOverlayFrame";
import {
  ControlledDialog,
  ControlledDialogClose,
  ControlledDialogTitle,
} from "@/components/ui/application-dialog";

export default function SaveViewDialog({
  open,
  onClose,
  onSave,
  saving = false,
  mode = "view",
  shareableRoles = /** @type {string[]} */ ([]),
}) {
  const [name, setName] = useState("");
  const [sharedRole, setSharedRole] = useState("");
  const inputId = useId();
  const inputRef = useRef(null);
  const { backdropStyle, frameStyle, panelStyle } = usePortalOverlayFrame({ open });
  const handleNameChange = (event) => setName(event.target.value);
  const handleSharedRoleChange = (event) => setSharedRole(event.target.value);
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setName("");
      setSharedRole("");
      onClose();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) {
      return;
    }
    const options = { isFavorite: mode === "view" };
    if (mode === "layout" && sharedRole) {
      options.sharedRole = sharedRole;
    }
    await onSave(trimmed, options);
    setName("");
    setSharedRole("");
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
      popupClassName="material-floating portal-command-surface pointer-events-auto mx-auto w-full max-w-md rounded-xl border border-brand-border/80 bg-white/95 p-4 shadow-2xl backdrop-blur-xl [--material-preference-background:var(--color-brand-light)] [--material-preference-boundary:var(--color-brand-muted)]"
      popupRender={<form onSubmit={submit} />}
      viewportClassName="portal-command-overlay"
      viewportStyle={frameStyle}
    >
      <ControlledDialogTitle className="font-heading font-semibold text-base text-citius-blue">
        {mode === "layout" ? "Save layout preset" : "Save current view"}
      </ControlledDialogTitle>
      {mode === "layout" ? (
        <p className="mt-1 text-brand-muted text-sm">
          Saves visible columns and sorting only. Filters and permissions stay unchanged.
        </p>
      ) : null}
      <label
        className="mt-3 block font-medium text-brand-muted text-xs"
        htmlFor={`${inputId}-name`}
      >
        {mode === "layout" ? "Preset name" : "View name"}
      </label>
      <input
        aria-label={mode === "layout" ? "Preset name" : "View name"}
        className="portal-toolbar-control mt-1 w-full rounded-lg border border-brand-border px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
        id={`${inputId}-name`}
        maxLength={80}
        onChange={handleNameChange}
        placeholder={mode === "layout" ? "e.g. Finance review" : "e.g. My open queries"}
        ref={inputRef}
        value={name}
      />
      {mode === "layout" && shareableRoles.length > 0 ? (
        <>
          <label
            className="mt-3 block font-medium text-brand-muted text-xs"
            htmlFor={`${inputId}-availability`}
          >
            Availability
          </label>
          <select
            aria-label="Layout availability"
            className="portal-toolbar-control mt-1 w-full rounded-lg border border-brand-border bg-white px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
            disabled={saving}
            id={`${inputId}-availability`}
            onChange={handleSharedRoleChange}
            value={sharedRole}
          >
            <option value="">Private to me</option>
            {shareableRoles.map((role) => (
              <option key={role} value={role}>
                {role} role
              </option>
            ))}
          </select>
        </>
      ) : null}
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
