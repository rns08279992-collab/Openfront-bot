# Copilot Observation Expansion Roadmap

This document converts the current observation gap conclusions into concrete future implementation tickets/prompts. It is documentation-only and reflects the current pinned observation/advisor surfaces in `browser/page-adapter/ObservationAdapter.ts` and the read-only copilot report pipeline under `browser/page-adapter/advisors/`.

## 1. Tile topology

- Advisors unlocked: `EnclosureAdvisor` can move from inferred to verified closure paths; `shared/interpreter/strategy-state.ts` can replace heuristic coastline/chokepoint signals with map-backed topology; `TradeAllianceROIAdvisor` can stop treating route reachability as unknown.
- Source/runtime surface likely needed: per-tile neighbor graph from the runtime map/game manager, plus a stable way to enumerate adjacent tiles and whether a tile touches the map edge.
- Implementation risk: `high`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/AdvisorTypes.ts`, `browser/page-adapter/advisors/EnclosureAdvisor.ts`, `browser/page-adapter/advisors/TradeAllianceROIAdvisor.ts`, `shared/interpreter/strategy-state.ts`, advisor test fixtures/tests.
- Test plan: add adapter tests for topology serialization; add enclosure tests proving verified surround detection; add strategy-state tests showing topology-backed coastline/chokepoint scoring; add trade tests proving disconnected graphs still block route claims.
- Exact future Codex prompt:

```text
Implement observation gap item 1: tile topology.

Goal:
Expose enough read-only map topology in the observation to support verified enclosure checks and route connectivity checks.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Extract mechanics from runtime surfaces; do not hard-code map adjacency.
- Preserve existing observation fields and add new optional fields first.

Required changes:
- Extend browser/page-adapter/ObservationAdapter.ts with a topology surface that exposes per-tile adjacency and map-edge information for the relevant observed tiles.
- Update advisor types as needed.
- Upgrade EnclosureAdvisor to use topology for verified surround checks instead of inferred-only logic where sufficient data exists.
- Upgrade TradeAllianceROIAdvisor and shared/interpreter/strategy-state.ts to consume topology-backed connectivity where directly useful.
- Add or update focused unit tests only.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 2. Shoreline/water flags

- Advisors unlocked: `EnclosureAdvisor` can distinguish shore/open-water/map-edge cases; `TradeAllianceROIAdvisor` can reason about maritime eligibility more accurately; `shared/interpreter/strategy-state.ts` can replace heuristic coastline access and piracy assumptions.
- Source/runtime surface likely needed: per-tile land/water classification plus a shoreline/coast flag, or equivalent map API that can derive whether a tile borders water.
- Implementation risk: `medium`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/EnclosureAdvisor.ts`, `browser/page-adapter/advisors/TradeAllianceROIAdvisor.ts`, `shared/interpreter/strategy-state.ts`, advisor fixtures/tests.
- Test plan: adapter tests for shoreline/water extraction; enclosure tests covering coastal pocket disqualification; strategy-state tests for coastline access; trade tests proving non-shore ports/tiles do not overclaim naval access.
- Exact future Codex prompt:

```text
Implement observation gap item 2: shoreline/water flags.

Goal:
Expose shoreline and water-state data in observation so advisors can stop inferring coast access from visible ports and sparse frontier hints.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Do not hard-code shoreline rules if the runtime already exposes them.

Required changes:
- Extend browser/page-adapter/ObservationAdapter.ts with read-only shoreline/water fields for the observed tile set.
- Use the new fields in EnclosureAdvisor for coastal/naval-pocket checks.
- Use the new fields in TradeAllianceROIAdvisor and shared/interpreter/strategy-state.ts for coastline access and piracy/coastal exposure scoring.
- Add targeted tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 3. Terrain type

- Advisors unlocked: `TerrainCostMap` and `AttackMathEngine` can compute terrain-backed attacker loss instead of returning `null`; `EnclosureAdvisor` can sort closing tiles with real terrain cost.
- Source/runtime surface likely needed: tile terrain classification from the map/game manager for observed frontier and target tiles.
- Implementation risk: `medium`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/AdvisorTypes.ts`, `browser/page-adapter/advisors/TerrainCostMap.ts`, `browser/page-adapter/advisors/AttackMathEngine.ts`, `browser/page-adapter/advisors/EnclosureAdvisor.ts`, terrain-cost tests/fixtures.
- Test plan: adapter tests for terrain extraction; terrain-cost tests for plains/highland/mountain multipliers; attack-math tests proving warnings drop when terrain is present; enclosure ranking tests using real terrain cost.
- Exact future Codex prompt:

```text
Implement observation gap item 3: terrain type.

Goal:
Expose terrain type for relevant tiles and wire it into attack/enclosure advisors so terrain-dependent loss estimates stop falling back to unknown.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Use pinned formula registry values; only replace missing runtime inputs.

Required changes:
- Add terrain-type fields to observation for the tiles used by combat/enclosure analysis.
- Update TerrainCostMap to compute terrain multipliers when terrain is present.
- Update AttackMathEngine and EnclosureAdvisor to consume the richer terrain estimates.
- Add focused tests covering all supported terrain cases.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 4. Defense post coverage

- Advisors unlocked: `TerrainCostMap` and `AttackMathEngine` can apply the pinned defense-post combat aura instead of warning that coverage is unknown; `CopilotReportBuilder` can reduce top-warning noise on combat recommendations.
- Source/runtime surface likely needed: a runtime query for nearby friendly defense posts affecting a target tile, or enough visible structure data plus range helpers to derive coverage exactly.
- Implementation risk: `medium`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/TerrainCostMap.ts`, `browser/page-adapter/advisors/AttackMathEngine.ts`, `browser/page-adapter/advisors/CopilotReportBuilder.ts`, terrain/attack tests.
- Test plan: adapter tests for coverage extraction; terrain-cost tests for covered vs uncovered hostile tiles; attack-math tests verifying effective attack cost changes when coverage exists; report-builder tests showing warning reduction.
- Exact future Codex prompt:

```text
Implement observation gap item 4: defense post coverage.

Goal:
Expose exact defense-post coverage for analyzed tiles so combat advisors can apply the verified defense-post multiplier instead of leaving it unknown.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Prefer extracting exact coverage from runtime helpers over reimplementing spatial scans if a helper already exists.

Required changes:
- Extend observation with defense-post coverage data for relevant frontier/target tiles.
- Update TerrainCostMap and AttackMathEngine to use the new coverage field.
- Reduce stale warning output where coverage is now known.
- Add targeted unit tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 5. Naval/missile visible threat layers

- Advisors unlocked: `shared/interpreter/strategy-state.ts` can replace distance-only naval and missile heuristics with explicit visible threat layers; `CopilotReportBuilder` can surface stronger defense/nuke recommendations from those strategy signals.
- Source/runtime surface likely needed: structured observation layers for hostile naval reach, missile-capable structures/units, and possibly per-entity threat envelopes derived from visible entity type/level/state.
- Implementation risk: `high`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `shared/interpreter/strategy-state.ts`, `browser/page-adapter/advisors/CopilotReportBuilder.ts`, possibly `browser/page-adapter/advisors/AdvisorTypes.ts`, strategy-state tests/fixtures.
- Test plan: adapter tests for threat-layer extraction; strategy-state tests for coastal exposure, enemy port harass, SAM coverage risk, silo opportunity, and nuke vulnerability using the new layers; report tests confirming recommendation changes remain stable.
- Exact future Codex prompt:

```text
Implement observation gap item 5: naval and missile visible threat layers.

Goal:
Add explicit read-only threat-layer data to observation so naval and nuke/SAM strategy scoring stops depending on broad distance-only heuristics.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Reuse existing visible entity data and pinned formula constants where possible.

Required changes:
- Extend observation with structured visible threat-layer data for naval and missile-related analysis.
- Refactor shared/interpreter/strategy-state.ts to consume those layers for coastal exposure, piracy, enemy port harass, SAM coverage risk, silo opportunity, and nuke vulnerability.
- Update any affected report wiring and add targeted tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 6. SAM reload state

- Advisors unlocked: `shared/interpreter/strategy-state.ts` can distinguish visible SAM coverage from ready-to-intercept coverage; future missile recommendations can reason about actual firing windows instead of raw launcher presence.
- Source/runtime surface likely needed: visible/runtime SAM launcher cooldown or reload ticks remaining, or an equivalent readiness boolean.
- Implementation risk: `medium`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `shared/interpreter/strategy-state.ts`, advisor fixtures/tests.
- Test plan: adapter tests for SAM readiness extraction; strategy-state tests proving non-ready hostile SAMs reduce `samCoverageRisk`; regression tests ensuring ready SAM behavior remains unchanged.
- Exact future Codex prompt:

```text
Implement observation gap item 6: SAM reload state.

Goal:
Expose SAM readiness/cooldown state so missile-defense scoring can distinguish visible launchers from immediately dangerous launchers.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Prefer exact runtime readiness state over inferred cooldown math if the runtime exposes it.

Required changes:
- Add read-only SAM reload/readiness fields to observation visible structures.
- Update shared/interpreter/strategy-state.ts to use readiness-aware SAM coverage scoring.
- Add focused tests for ready vs reloading hostile SAM cases.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 7. Port network

- Advisors unlocked: `TradeAllianceROIAdvisor` can move from visible-port counts to route-accurate maritime trade ROI; `shared/interpreter/strategy-state.ts` can score trade/coastal access from actual connected port networks.
- Source/runtime surface likely needed: port-to-port connectivity or a water-network identifier/path query for owned and visible partner ports.
- Implementation risk: `high`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/TradeAllianceROIAdvisor.ts`, `shared/interpreter/strategy-state.ts`, trade advisor tests/fixtures.
- Test plan: adapter tests for port-network extraction; trade advisor tests covering connected vs disconnected partner ports; strategy-state tests for coastline/trade-route scoring from network data; warning-regression tests showing partial-ROI language narrows appropriately.
- Exact future Codex prompt:

```text
Implement observation gap item 7: port network.

Goal:
Expose enough maritime network data to compute route-aware port connectivity instead of relying on visible port counts alone.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Use runtime connectivity/path surfaces if present; do not hard-code water reachability.

Required changes:
- Extend observation with read-only port-network connectivity data.
- Upgrade TradeAllianceROIAdvisor to distinguish connected and disconnected maritime trade partners.
- Update shared/interpreter/strategy-state.ts where actual port-network reachability improves trade/coast scoring.
- Add targeted tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 8. Train network

- Advisors unlocked: `TradeAllianceROIAdvisor` can compute network-aware train upside instead of using only formula per-stop values; future strategy-state trade scoring can reflect confirmed rail connectivity.
- Source/runtime surface likely needed: train-cluster membership, reachable stop count, or a station-network query for visible/owned train stations.
- Implementation risk: `high`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/TradeAllianceROIAdvisor.ts`, possibly `shared/interpreter/strategy-state.ts`, trade tests/fixtures.
- Test plan: adapter tests for train network extraction; trade advisor tests for same-cluster vs split-cluster stations; tests for reachable stop count if exposed; warning-regression tests showing train-upside warnings shrink only when network data exists.
- Exact future Codex prompt:

```text
Implement observation gap item 8: train network.

Goal:
Expose train-network connectivity so trade ROI can reason about actual reachable rail upside instead of formula-only per-stop values.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Prefer runtime cluster/path data over reconstructing rail graphs from raw visible entities.

Required changes:
- Add read-only train-network fields to observation for owned/visible stations.
- Upgrade TradeAllianceROIAdvisor to use network-aware train route information where available.
- Update any directly affected trade scoring in shared/interpreter/strategy-state.ts if the new signal is materially useful.
- Add focused tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 9. Other-player traitor timers

- Advisors unlocked: `TerrainCostMap` and `AttackMathEngine` can stop treating enemy traitor state as unknown; diplomacy strategy can use exact betrayal windows instead of only current alliance/embargo shape.
- Source/runtime surface likely needed: traitor boolean plus remaining ticks for non-self players in `ObservationDiplomacyPlayer` or an adjacent observation entity.
- Implementation risk: `low`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/TerrainCostMap.ts`, `browser/page-adapter/advisors/AttackMathEngine.ts`, `shared/interpreter/strategy-state.ts`, advisor fixtures/tests.
- Test plan: adapter tests confirming non-self traitor fields populate; terrain/attack tests proving traitor modifier becomes exact for hostile defenders; diplomacy strategy tests for betrayal-risk messaging if wired in.
- Exact future Codex prompt:

```text
Implement observation gap item 9: other-player traitor timers.

Goal:
Expose traitor state and remaining ticks for other players so combat and diplomacy logic no longer treat those modifiers as unknown.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Preserve existing own-player traitor fields; extend the same idea to other players.

Required changes:
- Extend ObservationDiplomacyPlayer (or the closest existing observation surface) with traitor state and remaining ticks for other players.
- Update TerrainCostMap and AttackMathEngine to apply traitor-backed modifiers exactly when the data exists.
- Update shared/interpreter/strategy-state.ts only where the new timer materially improves diplomacy risk reasoning.
- Add targeted tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```

## 10. Realized income history

- Advisors unlocked: `TradeAllianceROIAdvisor` can compare predicted vs realized trade value; `shared/interpreter/strategy-state.ts` can score trade potential and economy shift from observed income trend instead of one-tick snapshots.
- Source/runtime surface likely needed: read-only time-series or recent-history samples for passive income, realized trade income, and possibly per-tick deltas already tracked by the runtime/session layer.
- Implementation risk: `medium`
- Expected files touched: `browser/page-adapter/ObservationAdapter.ts`, `browser/page-adapter/advisors/TradeAllianceROIAdvisor.ts`, `shared/interpreter/strategy-state.ts`, trade/strategy tests and fixtures.
- Test plan: adapter tests for income-history serialization; trade advisor tests showing realized trend can confirm or rebut partial ROI estimates; strategy-state tests for trade/economy scoring from history; regression tests ensuring absence of history preserves prior fallback behavior.
- Exact future Codex prompt:

```text
Implement observation gap item 10: realized income history.

Goal:
Expose recent realized income history so trade and economy advisors can reason from trends instead of a single passive-income snapshot.

Constraints:
- Keep diffs small.
- Do not touch .tmp/OpenFrontIO-upstream.
- Prefer existing runtime/session history if available; do not invent synthetic history.

Required changes:
- Extend observation with a read-only recent income history surface, including realized trade-related income if the runtime exposes it.
- Update TradeAllianceROIAdvisor to use the history to calibrate or confirm partial ROI estimates.
- Update shared/interpreter/strategy-state.ts where recent income trend materially improves trade/economy scoring.
- Add focused tests.

Verification:
- npm run typecheck
- git diff --check
- git status --short

End with:
- what changed
- how to verify
- git status --short
```
