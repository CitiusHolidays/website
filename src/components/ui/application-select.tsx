"use client";

import { Check, ChevronDown } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Select as BaseSelect } from "./foundation/base";

export interface SelectOption {
  disabled?: boolean;
  label: ReactNode;
  value: string;
}

export interface SelectProps {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  autoComplete?: string;
  className?: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  form?: string;
  iconClassName?: string;
  id?: string;
  name?: string;
  onOpenChange?: (open: boolean) => void;
  onValueChange: (value: string) => void;
  open?: boolean;
  options: readonly SelectOption[];
  popupClassName?: string;
  required?: boolean;
  value: string;
}

export function Select({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  autoComplete,
  className,
  defaultOpen,
  disabled,
  form,
  iconClassName,
  id,
  name,
  onOpenChange,
  onValueChange,
  options,
  popupClassName,
  required,
  open,
  value,
}: SelectProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusAfterCommitRef = useRef(false);
  const restoreFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isControlledOpen = open !== undefined;
  const resolvedOpen = isControlledOpen ? open : uncontrolledOpen;
  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlledOpen) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen && restoreFocusAfterCommitRef.current) {
      restoreFocusAfterCommitRef.current = false;
      if (restoreFocusTimerRef.current) {
        clearTimeout(restoreFocusTimerRef.current);
      }
      restoreFocusTimerRef.current = setTimeout(() => triggerRef.current?.focus(), 0);
    }
  };
  const handleOpenChangeComplete = (nextOpen: boolean) => {
    if (!nextOpen) {
      triggerRef.current?.focus();
    }
  };
  const handleValueChange = (nextValue: string | null) => {
    restoreFocusAfterCommitRef.current = true;
    onValueChange(nextValue ?? "");
  };
  const handleTriggerMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.button === 0 && !disabled && !resolvedOpen) {
      handleOpenChange(true);
    }
  };
  useEffect(
    () => () => {
      if (restoreFocusTimerRef.current) {
        clearTimeout(restoreFocusTimerRef.current);
      }
    },
    []
  );
  return (
    <BaseSelect.Root
      autoComplete={autoComplete}
      disabled={disabled}
      form={form}
      items={options}
      modal={false}
      name={name}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
      onValueChange={handleValueChange}
      open={resolvedOpen}
      required={required}
      value={value}
    >
      <BaseSelect.Trigger
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        className={cn(
          "relative inline-flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        data-slot="select-trigger"
        id={id}
        onMouseDown={handleTriggerMouseDown}
        ref={triggerRef}
      >
        <BaseSelect.Value>{selectedLabel}</BaseSelect.Value>
        <BaseSelect.Icon className={cn("ml-2 shrink-0 text-brand-muted/60", iconClassName)}>
          <ChevronDown aria-hidden size={16} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          className="pointer-events-auto z-[92] data-[closed]:pointer-events-none"
          sideOffset={4}
        >
          <BaseSelect.Popup
            className={cn(
              "max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-brand-border bg-white p-1 shadow-xl outline-none data-[closed]:hidden",
              popupClassName
            )}
            data-slot="select-popup"
          >
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item
                  className="grid min-h-10 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 text-brand-dark text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-brand-light data-[disabled]:opacity-50"
                  disabled={option.disabled}
                  key={option.value || "__empty__"}
                  value={option.value}
                >
                  <BaseSelect.ItemIndicator className="text-citius-blue">
                    <Check aria-hidden size={14} strokeWidth={2.5} />
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText className="col-start-2 w-full min-w-0">
                    {option.label}
                  </BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
