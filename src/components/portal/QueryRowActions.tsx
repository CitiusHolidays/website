"use client";

import { MoreHorizontal } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { PortalActionMenu } from "@/components/portal/PortalActionMenu";

interface ActionElementProps {
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  role?: string;
}

export type ActionElement = ReactElement<ActionElementProps>;
export type OptionalAction = ActionElement | false | null | undefined;

interface QueryRowActionsProps {
  label: string;
  overflowActions?: OptionalAction[];
  primaryAction?: OptionalAction;
}

function isActionElement(action: OptionalAction): action is ActionElement {
  return isValidElement<ActionElementProps>(action);
}

function actionKey(action: ActionElement): string {
  return String(
    action.key || action.props["aria-label"] || action.props.children || "query-action"
  );
}

function withActionClass(action: OptionalAction, className: string): ReactElement | null {
  if (!isActionElement(action)) {
    return null;
  }
  return cloneElement(action, {
    className: `${action.props.className || ""} ${className}`.trim(),
  });
}

function menuItemClassName(action: ActionElement): string {
  const isDanger = String(action.props.className || "").includes("portal-danger-btn");
  const base =
    "flex min-h-10 w-auto items-center gap-2 whitespace-nowrap rounded-xl border-0 bg-transparent px-3 py-2 text-left font-medium text-sm transition-[background-color,transform] duration-150 ease-[var(--portal-ease-out)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-citius-blue/15";
  return isDanger
    ? `${base} text-[#b42318] hover:bg-red-50`
    : `${base} text-brand-dark hover:bg-brand-light`;
}

function OverflowActionItem({
  action,
  onActionComplete,
}: {
  action: ActionElement;
  onActionComplete: () => void;
}) {
  return cloneElement(action, {
    className: menuItemClassName(action),
    onClick: (event: MouseEvent<HTMLElement>) => {
      action.props.onClick?.(event);
      onActionComplete();
    },
    role: "menuitem",
  });
}

export function QueryRowActions({
  label,
  overflowActions = [],
  primaryAction,
}: QueryRowActionsProps) {
  const [open, setOpen] = useState(false);
  const actions = overflowActions.filter(isActionElement);

  const closeMenu = () => setOpen(false);

  return (
    <div className="flex items-center gap-2">
      {withActionClass(primaryAction, "min-h-11 whitespace-nowrap md:min-h-8")}
      {actions.length > 0 ? (
        <PortalActionMenu
          aria-label={`More actions for ${label}`}
          contentClassName="flex w-max flex-col gap-0.5 p-1.5"
          fitContent
          onOpenChange={setOpen}
          open={open}
          trigger={(props) => (
            <button
              {...props}
              aria-label={`More actions for ${label}`}
              className="portal-small-btn min-h-11 px-3 md:min-h-8"
              type="button"
            >
              <MoreHorizontal size={15} />
              {/* <span className="sr-only sm:not-sr-only">More</span> */}
            </button>
          )}
        >
          {actions.map((action) => (
            <OverflowActionItem
              action={action}
              key={actionKey(action)}
              onActionComplete={closeMenu}
            />
          ))}
        </PortalActionMenu>
      ) : null}
    </div>
  );
}
