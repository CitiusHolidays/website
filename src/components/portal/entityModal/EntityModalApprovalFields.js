"use client";

import { Textarea } from "@/components/portal/PortalModalForm";

export function EntityModalApprovalFields({ modal, form, updateForm }) {
  return (
    <>
      {modal === "approvalDecide" && (
        <Textarea
          formField="decisionNote"
          label="Decision Note"
          onChange={updateForm}
          placeholder="Explain what details are needed or why this is rejected"
          required
          value={form.decisionNote}
        />
      )}
    </>
  );
}
