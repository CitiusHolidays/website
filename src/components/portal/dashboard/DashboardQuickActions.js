"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { PortalActionMenu } from "@/components/portal/PortalActionMenu";
import { Button } from "@/components/ui/application-button";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

export function DashboardQuickActions({ has, openModal }) {
  const actions = [
    {
      label: "Create query",
      onClick: () => openModal("query"),
      permission: P.MANAGE_QUERIES,
    },
    {
      label: "Create proposal",
      onClick: () => openModal("proposal"),
      permission: P.MANAGE_PROPOSALS,
    },
    {
      label: "Create job card",
      onClick: () => openModal("jobCard"),
      permission: P.MANAGE_JOB_CARDS,
    },
    {
      label: "Add expense",
      onClick: () => openModal("expense"),
      permission: P.CREATE_EXPENSES,
    },
  ].filter((item) => has(item.permission));

  const [menuOpen, setMenuOpen] = useState(false);
  const renderTrigger = (props) => (
    <Button {...props} className="portal-outline-btn inline-flex items-center gap-2" type="button">
      Create
      <ChevronDown size={14} />
    </Button>
  );

  if (!actions.length) {
    return null;
  }

  const [primary, ...secondary] = actions;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        className="portal-primary-btn inline-flex gap-2"
        onClick={primary.onClick}
        type="button"
      >
        <Plus size={16} />
        {primary.label}
      </Button>
      {secondary.length > 0 ? (
        <PortalActionMenu
          align="left"
          aria-label="Create actions"
          contentClassName="p-2"
          fitContent
          menuClassName="min-w-[12rem] rounded-lg"
          onOpenChange={setMenuOpen}
          open={menuOpen}
          trigger={renderTrigger}
        >
          {secondary.map((item) => (
            <Button
              className="block w-full rounded-md px-3 py-2 text-left text-brand-dark text-sm hover:bg-brand-light"
              key={item.label}
              onClick={item.onClick}
              type="button"
            >
              {item.label}
            </Button>
          ))}
        </PortalActionMenu>
      ) : null}
    </div>
  );
}
