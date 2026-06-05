"use client";

import { Plus } from "lucide-react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";

export function DashboardQuickActions({ has, openModal }) {
  const actions = [
    {
      label: "Create query",
      permission: P.MANAGE_QUERIES,
      onClick: () => openModal("query"),
    },
    {
      label: "Create proposal",
      permission: P.MANAGE_PROPOSALS,
      onClick: () => openModal("proposal"),
    },
    {
      label: "Create job card",
      permission: P.MANAGE_JOB_CARDS,
      onClick: () => openModal("jobCard"),
    },
    {
      label: "Add expense",
      permission: P.CREATE_EXPENSES,
      onClick: () => openModal("expense"),
    },
  ].filter((item) => has(item.permission));

  if (!actions.length) return null;

  return (
    <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {actions.map((item, index) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          className={`${index === 0 ? "portal-primary-btn" : "portal-outline-btn"} inline-flex min-w-40 items-center gap-2`}
        >
          <Plus size={16} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
