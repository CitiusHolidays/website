"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@/components/ui/foundation/base";
import { PORTAL_Z } from "@/lib/portal/zIndex";

export function PortalTooltip({
  children,
  content,
}: {
  children: ReactElement;
  content: ReactNode;
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={600} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner collisionPadding={8} side="top" sideOffset={6}>
          <BaseTooltip.Popup
            className={`${PORTAL_Z.dropdown} max-w-64 rounded-lg bg-brand-dark px-2.5 py-1.5 text-center text-white text-xs shadow-lg data-ending-style:opacity-0 data-starting-style:opacity-0`}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
