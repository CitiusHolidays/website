# Citius CRM Context

This glossary names business concepts in the Citius CRM portal so implementation tickets use the same language as the operation.

## Language

**Staff Workspace**:
The internal Citius application experience used by staff to carry out CRM and travel-operations work. Its current layout and presentation are the canonical baseline and it is never exposed to customers. Shared-component adoption may standardize implementation internals but must preserve its visible composition and workflow behavior.
_Avoid_: Customer-facing account, marketing site, forcing customer presentation patterns onto staff workflows, treating foundation adoption as permission to redesign the workspace

**Customer Travel Account**:
The authenticated customer-facing experience for viewing journeys and managing personal or account information. Its current layout and presentation are the canonical baseline. It may share implementation foundations with the Staff Workspace, but it remains visually distinct and grants no staff CRM access.
_Avoid_: Staff Workspace, public marketing site, treating shared interface foundations as shared permissions or identical presentation, redesigning the account merely to adopt shared primitives

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

**Commercial Files**:
The non-sensitive files attached to a Query, Proposal, or Job Card and shared through the linked Commercial Record Chain, including proposal working files and the Proposal Doc. They are visible read-only outside the owning team while remaining managed at their source.
_Avoid_: Working files as a separate record, copying files between linked records, sharing passport, visa, expense, finance, or HR files through the commercial chain

**Client**:
The person or organization record that receives Citius travel service and carries primary contact details; a Client may be associated with one or more Travellers.
_Avoid_: Treating the Client record as the Traveller, using a Job Card as an identity factor, sharing every Traveller's documents with every Client contact

**Traveller**:
An individual person travelling under a Job Card. Traveller is the canonical unit for operational records and for customer document intake, even when several Travellers share one Client or booking.
_Avoid_: Passenger as a separate domain entity, one document scope for an entire Job Card, assuming the Query creator is the Traveller

**Customer Document Intake**:
The time-limited, customer-facing workflow through which one Traveller submits requested sensitive travel documents to the Citius CRM without receiving staff portal access.
_Avoid_: Commercial Files upload, open public upload, granting a customer CRM credentials

**Intake Link**:
A short-lived, single-use capability that identifies one Traveller's requested Customer Document Intake and expires after completion or its security window.
_Avoid_: Reusable customer login, a bearer URL that authorizes a whole Job Card, treating the link alone as proof of identity

**Sensitive Travel Document**:
A passport, visa, identity, or travel document submitted through Customer Document Intake and governed by its own encryption, access, retention, and audit boundaries rather than the Commercial Record Chain.
_Avoid_: Commercial File, unencrypted attachment, inheriting access from a linked Query or Proposal

**Source-owning team**:
The team authorized to upload and delete Commercial Files on their source record; all other teams with chain access can read and download those files but cannot change them.
_Avoid_: Uploader-only ownership, per-file ad hoc sharing, granting write access to every team that can view the chain

**Team File Area**:
The team-owned portion of a Commercial Files source, allowing multiple participating teams to manage their own non-sensitive files on the same Job Card while everyone with chain access can read them together.
_Avoid_: One shared write bucket, assigning Job Card files only to the last uploader, exposing sensitive team documents through the commercial chain

**Recoverable Deletion**:
The state entered when a user explicitly deletes a Commercial File: it leaves normal views, remains restorable for 14 days, and is then permanently purged by the system.
_Avoid_: Immediate hard delete, administrator-driven purge, treating replaced Proposal Docs as deleted files

**Proposal Doc History**:
The retained, private collection of previously active Proposal Docs that can be restored as the current document; a replacement creates history and is not itself a deletion.
_Avoid_: Overwriting the only Proposal Doc, exposing every historical version to read-only teams, moving replacements directly to Recoverable Deletion

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
