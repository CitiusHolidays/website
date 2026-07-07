"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { PORTAL_Z } from "@/lib/portal/zIndex";

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

  if (!actions.length) {
    return null;
  }

  const [primary, ...secondary] = actions;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="portal-primary-btn inline-flex gap-2"
        onClick={primary.onClick}
        type="button"
      >
        <Plus size={16} />
        {primary.label}
      </button>
      {secondary.length > 0 ? (
        <div className="relative">
          <button
            aria-expanded={menuOpen}
            className="portal-outline-btn inline-flex items-center gap-2"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            Create
            <ChevronDown size={14} />
          </button>
          {menuOpen ? (
            <>
              <button
                aria-label="Close create menu"
                className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                onClick={() => setMenuOpen(false)}
                type="button"
              />
              <div
                className={`absolute left-0 ${PORTAL_Z.dropdown} z-10 mt-2 min-w-[12rem] rounded-lg border border-brand-border bg-white p-2 shadow-lg`}
              >
                {secondary.map((item) => (
                  <button
                    className="block w-full rounded-md px-3 py-2 text-left text-brand-dark text-sm hover:bg-brand-light"
                    key={item.label}
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
