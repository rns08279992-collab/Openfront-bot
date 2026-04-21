# Mechanics Diff

## Extracted Categories

- schema fields and enum domains
- unit groups
- server cadence constants
- spawn-phase constants and fixed spawn rules
- fixed timers, ranges, thresholds, and traitor modifiers
- unit metadata and build-cost formulas from unitInfo()
- high-confidence formula metadata for economy, growth, combat, trade, and nukes
- public playlist rule tables and derived modifier mappings
- lobby-updateable config field surface

## Deferred / Runtime-Only Categories

- runtime action legality: GameRunner.playerActions() and Player capability methods depend on live tile ownership, borders, alliances, embargoes, and stateful cooldowns.
- effective team assignment and team labels: GameImpl.populateTeams() and assignTeams() derive concrete teams from player counts and special team modes at runtime.
- effective win resolution: Win thresholds are extracted, but actual winner selection still depends on current tiles without fallout, disconnections, ranked mode, and timer state.
- combat outcomes: Base formulas are extracted, but actual losses and tile throughput depend on dynamic terrain, nearby units, fallout, troop counts, and traitor state.
- public playlist RNG outcomes: Weights and rule tables are extracted, but the actual public lobby result is randomized at runtime.

## Known Gaps

- No TypeScript AST dependency is introduced yet; this first extractor stays dependency-free and targets a fixed, pinned source layout.
- Some formula dependencies are normalized by name instead of being exhaustively inferred from every symbol in the method body.
- Playlist outputs are represented as rule tables and weights, not sampled lobby instances.

## Notes

- This snapshot is generated only from the pinned upstream source at commit `52033597efb09de6c8d724f6e2784c3c9e8a7511`.
- Unsupported/runtime-only categories are deferred instead of being flattened into guessed constants.
- Deferred categories in this snapshot: runtime action legality, effective team assignment and team labels, effective win resolution, combat outcomes, public playlist RNG outcomes.
