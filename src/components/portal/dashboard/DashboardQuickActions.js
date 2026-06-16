"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { PORTAL_Z } from "@/lib/portal/zIndex";

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

  const [menuOpen, setMenuOpen] = useState(false);

  if (!actions.length) return null;

  const [primary, ...secondary] = actions;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={primary.onClick} className="portal-primary-btn inline-flex gap-2">
        <Plus size={16} />
        {primary.label}
      </button>
      {secondary.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            className="portal-outline-btn inline-flex items-center gap-2"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            Create
            <ChevronDown size={14} />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                aria-label="Close create menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={`absolute left-0 ${PORTAL_Z.dropdown} z-10 mt-2 min-w-[12rem] rounded-lg border border-brand-border bg-white p-2 shadow-lg`}
              >
                {secondary.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="block w-full rounded-md px-3 py-2 text-left text-sm text-brand-dark hover:bg-brand-light"
                    onClick={() => {
                      setMenuOpen(false);
                      item.onClick();
                    }}
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
