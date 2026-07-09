# Citius CRM Context

This glossary names business concepts in the Citius CRM portal so implementation tickets use the same language as the operation.

## Language

**Travel Series / Travel Batch**:
A full trip instance under one Job Card for group travel where different passenger groups go to the same place on different dates or schedules. The portal UI calls this "Travel in Series"; backend fields and import/export columns still use travel batch terminology (`travelBatchId`, Travel Batch). A Travel Batch has the same operational fields the trip would have if it were not split into series; the batch only separates people by time and day while preserving one Job Card.
_Avoid_: Batch identity as loose document fields, reduced batch metadata, separate Job Card per batch, changing storage fields only to match the UI label

**Ticketing Scope**:
The sales-level indication of whether a query needs domestic ticketing, international ticketing, both, or no ticketing work.
_Avoid_: Ticketing person dropdown at sales query creation

**Finance Head**:
The staff member whose job role is Finance Head and who receives finance-head notifications for confirmed orders and Job Card handoff.
_Avoid_: All Accounts staff, configurable HOD Finance without role match

**Proposal Pricing Complete**:
A Proposal is ready for Sales/client handoff and Job Card handoff only when both selling price and cost price per person are entered. Draft Proposals may remain pricing-incomplete while Contracting and Ticketing collaborate.
_Avoid_: Treating Draft pricing gaps as workflow-ready, discovering missing proposal pricing during Job Card creation

**Proposal Handoff**:
The workflow transition where a Proposal leaves Draft preparation and is sent to Sales or marked sent to the client. Proposal Handoff requires Proposal Pricing Complete.
_Avoid_: Allowing Sales review, client send, or downstream Job Card opening from a pricing-incomplete Proposal
