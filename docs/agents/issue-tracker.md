# Issue tracker: Local Markdown

Issues and specs for this repository live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The specification is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue
- Comments and conversation history append under a `## Comments` heading

## Publishing

When a skill says to publish to the issue tracker, create the corresponding local Markdown files under `.scratch/<feature-slug>/`.

## Fetching

When a skill says to fetch a ticket, read the referenced local issue file. The user will normally provide its path or issue number.

## Blocking and frontier

- A ticket's `Blocked by:` line lists the numbered tickets that must be completed first.
- A ticket is unblocked when every listed blocker is complete.
- The frontier is every `ready-for-agent` ticket whose blockers are complete.
- For a linear sequence, work from the lowest unblocked ticket number upward.
