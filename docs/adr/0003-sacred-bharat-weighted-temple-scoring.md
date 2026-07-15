# ADR 0003: Weighted Temple Points for Sacred Bharat Soul Score

## Status

Accepted (2026-07-06)

## Context

Sacred Bharat launched with flat **+25 points per visit** for implementation speed. The product brief specifies a **Temple Scorecard** (75–100 points per site) based on spiritual significance, history, difficulty, culture, and popularity. Level titles (Seeker through Moksha Pathfinder) in the brief assume this weighted model.

## Decision

1. Each sacred site in `src/data/sacredBharat/temples.js` carries a canonical `points` field from the scorecard.
2. **Soul Score** = Σ visited site `points` + Σ completed trail `completionBonus`.
3. Level thresholds in `levels.js` stay aligned to the brief (250 / 500 / 1000 / 1500 / 2000).
4. Convex `sacredBharatScoring.ts` mirrors the client point map for leaderboard consistency.
5. Challenge `points` add to **Soul Score** when the challenge completes (in addition to trail bonuses).
6. Legacy temple ids `rameswaram` → `ramanathaswamy` and `varanasi` → `kashi-vishwanath` merge to one canonical visit.

## Consequences

- Visiting Tirupati (+100) materially advances rank vs a minor site (+75).
- Challenge points can stack with trail completion bonuses (e.g. Sacred Rivers challenge + trail).
- `rameswaram` and `varanasi` legacy visits resolve via alias map; catalog holds one row per physical site.

## Alternatives considered

- **Keep flat 25 + rescale levels**: Rejected — loses the brief's "significance" feel.
- **Compute points from criteria weights at runtime**: Rejected — scorecard is the source of truth; weights are editorial.
- **Add challenge points to Soul Score immediately**: Deferred — overlaps trail bonuses and needs explicit deduplication rules.
