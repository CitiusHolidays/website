# Citius CRM Context

This glossary names business concepts in the Citius CRM portal so implementation tickets use the same language as the operation.

## Language

**Travel Series / Travel Batch**:
A full trip instance under one Job Card for group travel where different passenger groups go to the same place on different dates or schedules. The portal UI calls this "Travel in Series"; backend fields and import/export columns still use travel batch terminology (`travelBatchId`, Travel Batch). A Travel Batch has the same operational fields the trip would have if it were not split into series; the batch only separates people by time and day while preserving one Job Card.
_Avoid_: Batch identity as loose document fields, reduced batch metadata, separate Job Card per batch, changing storage fields only to match the UI label

**Ticketing Scope**:
The sales-level indication of whether a Query needs domestic ticketing, international ticketing, both, or no ticketing work. A Ticketing assignment is required only when the scope is Domestic, International, or Both; `Not required` creates no Ticketing Head alert or assignment task.
_Avoid_: Ticketing person dropdown at sales query creation

**Assigned Sales Rep**:
The Sales person selected on a Query as its commercial owner. The selection defaults to the Query creator but may differ when a Director or another authorized person raises the Query; Job Card initials come from the Assigned Sales Rep.
_Avoid_: Assuming the Query creator is always the Sales Rep, using the Job Card creator's initials

**Finance Head**:
The staff member whose job role is Finance Head and who receives finance-head notifications for confirmed orders and Job Card handoff.
_Avoid_: All Accounts staff, configurable HOD Finance without role match

**Proposal Pricing Complete**:
A Proposal is ready for Sales/client handoff and Job Card handoff only when both selling price and cost price per person are entered. Draft Proposals may remain pricing-incomplete while Contracting and Ticketing collaborate.
_Avoid_: Treating Draft pricing gaps as workflow-ready, discovering missing proposal pricing during Job Card creation

**Proposal Handoff**:
The workflow transition where a Proposal leaves Draft preparation and is sent to Sales. Proposal Handoff requires Proposal Pricing Complete; client delivery is not a separate Proposal state.
_Avoid_: Mark client sent, allowing Sales review or downstream Job Card opening from a pricing-incomplete Proposal

**Commercial Record Chain**:
The linked Query, Proposal, and Job Card that carry a travel opportunity from enquiry through confirmed operational work. Commercial files are visible throughout this chain without being copied, while passport, visa, expense, finance, and HR files retain their separate sensitive-access boundaries.
_Avoid_: Duplicating files between linked records, inheriting sensitive-document access through a commercial link

**Budget per Person**:
The traveller's pre-tax target price per person recorded on a Query. Opportunity value is the Budget per Person multiplied by the number of passengers.
_Avoid_: Total trip budget in the per-person field, tax-inclusive budget

**Selling Price per Person**:
The pre-tax selling price for one passenger on a Proposal or Confirmed Offer.
_Avoid_: Total trip selling price, tax-inclusive selling price

**Confirmed Offer**:
The immutable commercial snapshot selected and finalized by Sales when an order is confirmed, containing passenger count, per-person land, airfare, visa, selling price, and travel dates. A Job Card receives its commercial values from this snapshot rather than from a later-edited Proposal.
_Avoid_: Live Proposal values as the confirmed commercial record, Accounts changing confirmed commercial amounts

**Profit per Person**:
The Selling Price per Person minus land, airfare, and visa cost per person, excluding tax. It is calculated from the Confirmed Offer and is distinct from the manually entered Approx. Margin.
_Avoid_: Tax-inclusive profit, using Profit per Person as Approx. Margin

**Job Card**:
The operational record opened by Accounts after Sales confirms an order. Its number identifies the Sales-owned booking across Sales, Contracting, Ticketing, and Operations dashboards.
_Avoid_: Creating a Job Card before order confirmation, using the Accounts creator as the commercial owner
