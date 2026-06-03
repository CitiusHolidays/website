"use client";

import { EntityModalApprovalFields } from "./EntityModalApprovalFields";
import { EntityModalExpenseFields } from "./EntityModalExpenseFields";
import { EntityModalHotelFields } from "./EntityModalHotelFields";
import { EntityModalInvoiceFields } from "./EntityModalInvoiceFields";
import { EntityModalLeaveFields } from "./EntityModalLeaveFields";
import { EntityModalPnrFields } from "./EntityModalPnrFields";
import { EntityModalSeatFields } from "./EntityModalSeatFields";
import { EntityModalStaffFields } from "./EntityModalStaffFields";
import { EntityModalTicketFields } from "./EntityModalTicketFields";
import { EntityModalTourManagerFields } from "./EntityModalTourManagerFields";
import { EntityModalVisaFields } from "./EntityModalVisaFields";

export function EntityModalFieldsSecondary(props) {
  return (
    <>
      <EntityModalVisaFields {...props} />
      <EntityModalPnrFields {...props} />
      <EntityModalTicketFields {...props} />
      <EntityModalSeatFields {...props} />
      <EntityModalHotelFields {...props} />
      <EntityModalTourManagerFields {...props} />
      <EntityModalInvoiceFields {...props} />
      <EntityModalExpenseFields {...props} />
      <EntityModalStaffFields {...props} />
      <EntityModalLeaveFields {...props} />
      <EntityModalApprovalFields {...props} />
    </>
  );
}
