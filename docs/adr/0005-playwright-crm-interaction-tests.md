# Playwright for CRM interaction tests alongside navigation smoke

Citius keeps **`agent-browser` navigation smoke** for fast route/render checks and adds **Playwright** for CRM modal and CRUD flows. Extending the smoke JSON manifest with click steps would couple unrelated concerns and does not scale to hold-to-confirm, linked-entity autofill, or multi-view journeys. Playwright provides tagged specs (`@critical`, `@smoke`, `@workflow`), trace artifacts, and per-role `storageState` while smoke stays cheap and read-only.
