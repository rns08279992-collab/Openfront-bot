# Copilot Advisor Branch Summary

Branch intent: read-only copilot analysis and HUD export surface for observation-driven recommendations.

## What is read-only

- `FormulaRegistry` records pinned-source formula metadata and constants for advisor use.
- `TerrainCostMap` and `AttackMathEngine` compute read-only combat estimates from `Observation`.
- `EnclosureAdvisor`, `GrowthTempoAdvisor`, and `TradeAllianceROIAdvisor` produce read-only assessments with explicit uncertainty.
- `CopilotReportBuilder` merges those assessments into one ranked read-only recommendation.
- `CopilotHUD` and `CopilotController` render and update a text HUD from a report or observation, but they do not wire themselves into runtime dispatch.

## What is not implemented yet

- No gameplay integration beyond exported copilot classes and pure report builders.
- No bootstrap/runtime wiring that mounts the copilot HUD automatically.
- No action planner, no intent emission, and no execution path from recommendation to command.
- Trade ROI remains partial rather than route-accurate.
- Enclosure remains inferred/partial rather than source-verified in most cases.

## No autoplay / no dispatch guarantee

- The copilot modules read `Observation`, `StrategyState`, and formula metadata, then return assessments or HUD text.
- No copilot code calls runtime dispatch or action senders.
- Attack math explicitly treats `full_send_candidate` as a candidate signal only and does not authorize or execute it.

## Known Observation gaps

- Terrain cost cannot be fully verified when terrain type or defense-post coverage is missing.
- Enclosure cannot prove hostile-to-neutral adjacency, hostile-cluster bounding boxes, shore or map-edge contact, or full one-player surround state from current `Observation`.
- Growth tempo depends on observed troop cap and troop growth-per-tick; either may be missing.
- Trade ROI cannot see water connectivity, port-to-port pathing, train-cluster membership, stop count, or realized trade income history.

## How to verify

Run:

- `npm test`
- `npm run typecheck`
- `git diff --check`
- `git status --short`

Expected result:

- Tests pass.
- Typecheck passes.
- `git diff --check` is clean.
- `git status --short` shows only this summary file before commit, then a clean tree after commit/push aside from any pre-existing external worktree state.
