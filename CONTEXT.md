# Citius CRM Context

This glossary names business concepts in the Citius CRM portal so implementation tickets use the same language as the operation.

## Language

**Travel Batch**:
A full trip instance under one Job Card for group travel where different passenger groups go to the same place on different dates or schedules. A Travel Batch has the same operational fields the trip would have if it were not batched; the batch only separates people by time and day while preserving one Job Card.
_Avoid_: Batch identity as loose document fields, reduced batch metadata, separate Job Card per batch

**Ticketing Scope**:
The sales-level indication of whether a query needs domestic ticketing, international ticketing, both, or no ticketing work.
_Avoid_: Ticketing person dropdown at sales query creation

**Finance Head**:
The staff member whose job role is Finance Head and who receives finance-head notifications for confirmed orders and Job Card handoff.
_Avoid_: All Accounts staff, configurable HOD Finance without role match
