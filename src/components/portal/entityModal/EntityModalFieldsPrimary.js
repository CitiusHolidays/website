"use client";

import { EntityModalAssignFields } from "./EntityModalAssignFields";
import { EntityModalJobCardFields } from "./EntityModalJobCardFields";
import { EntityModalMediaFields } from "./EntityModalMediaFields";
import { EntityModalProposalFields } from "./EntityModalProposalFields";
import { EntityModalQueryFields } from "./EntityModalQueryFields";
import { EntityModalTravellerFields } from "./EntityModalTravellerFields";
import { EntityModalWorkflowFields } from "./EntityModalWorkflowFields";

export function EntityModalFieldsPrimary(props) {
  return (
    <>
      <EntityModalQueryFields {...props} />
      <EntityModalMediaFields {...props} />
      <EntityModalAssignFields {...props} />
      <EntityModalWorkflowFields {...props} />
      <EntityModalProposalFields {...props} />
      <EntityModalJobCardFields {...props} />
      <EntityModalTravellerFields {...props} />
    </>
  );
}
