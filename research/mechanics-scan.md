# Mechanics Scan

Research basis:

- Confirmed upstream snapshot reviewed under `.tmp/OpenFrontIO-upstream` at commit `52033597efb09de6c8d724f6e2784c3c9e8a7511`.
- Confirmed primary mechanics source: `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`.
- Confirmed companion sources reviewed for config shape, runtime application, and team/victory derivation:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/Config.ts`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/ConfigLoader.ts`
  - `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts`
  - `.tmp/OpenFrontIO-upstream/src/core/GameRunner.ts`
  - `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts`
  - `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/WinCheckExecution.ts`
  - `.tmp/OpenFrontIO-upstream/src/server/MapPlaylist.ts`
  - `.tmp/OpenFrontIO-upstream/src/server/GameServer.ts`
- Confirmed local placeholders reviewed:
  - `scripts/extract-mechanics.ts`
  - `shared/mechanics/mechanics.types.ts`
  - `generated/mechanics.generated.json`
- Confirmed limitation: no `mechanics.js` file exists in this workspace. Any stale-risk notes about `mechanics.js` below are inferred risk areas for a hypothetical hand-maintained assumptions file, not a confirmed diff against an existing file.

## Confirmed Extraction Boundary

- Confirmed: `DefaultConfig.ts` contains most numeric mechanics and formula bodies.
- Confirmed: `Schemas.ts` defines legal `GameConfig` fields, enum domains, and intent/message contracts.
- Confirmed: `MapPlaylist.ts` derives some lobby/public values before they ever reach `DefaultConfig`, especially `spawnImmunityDuration`, `disabledUnits`, `startingGold`, `goldMultiplier`, `difficulty`, `maxPlayers`, and some public modifiers.
- Confirmed: `GameImpl.ts`, `GameRunner.ts`, and `Game.ts` describe runtime-only legality and team/state behavior that cannot be represented as fixed constants alone.
- Confirmed: `WinCheckExecution.ts` adds a hard-coded hard time limit that is not exposed through `Config`.

## Mechanics / Config Categories

Legend:

- `directly extractable`: literal/enum/constant or stable formula body can be read from pinned source without executing a game.
- `derived`: value is created by composing other config, formulas, or playlist logic; extractor should emit metadata/formula/source, not flatten to one universal number.
- `runtime-only`: depends on live game state, player state, tile state, or current intent legality.

| category | confirmed source file(s) | status | confirmed notes |
| --- | --- | --- | --- |
| `GameConfig` schema and optional knobs | `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts` | directly extractable | Confirmed schema fields: `difficulty`, `nations`, `bots`, `instantBuild`, `randomSpawn`, `maxTimerValue`, `spawnImmunityDuration`, `disabledUnits`, `playerTeams`, `goldMultiplier`, `startingGold`, `hostCheats`, `disableAlliances`, `waterNukes`, and `publicGameModifiers`. |
| Enum domains and unit catalog | `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts`, `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts` | directly extractable | Confirmed enums: `Difficulty`, `GameMode`, `GameType`, `GameMapType`, `GameMapSize`, `RankedType`, `UnitType`, `PlayerType`, `TerrainType`, team-count string constants, and grouped unit sets (`Nukes`, `Structures`, `BuildMenus`, `PlayerBuildable`). |
| Server tick cadence and worker/server timing | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/configuration/Config.ts` | directly extractable | Confirmed `turnIntervalMs = 100`, `gameCreationRate = 2 * 60 * 1000`; these are server/runtime cadence values, not combat formulas. |
| Spawn phase duration and immunity | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/server/MapPlaylist.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts` | derived | Confirmed default immunity is `5 * 10` ticks. Confirmed public/special lobbies can override immunity in `MapPlaylist.getSpawnImmunityDuration`. Confirmed effective immunity window is `numSpawnPhaseTurns + spawnImmunityDuration` in `GameImpl`. |
| Team structure and team labels | `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts`, `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts` | derived | Confirmed `playerTeams` can be numeric or named size modes (`Duos`, `Trios`, `Quads`, `Humans Vs Nations`). Confirmed actual team labels/colors are created in `GameImpl.populateTeams()`. |
| Unit costs and construction durations | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | derived | Confirmed all unit costs live in `unitInfo()` and several depend on current owned/constructed counts, `instantBuild`, infinite-gold flags, or live game stats (`MIRV`). |
| Upgradable structure metadata | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | directly extractable | Confirmed `upgradable` on `Port`, `MissileSilo`, `SAMLauncher`, `City`, `Factory`. |
| Economy base knobs | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts`, `.tmp/OpenFrontIO-upstream/src/server/GameServer.ts` | derived | Confirmed `startingGold`, `goldMultiplier`, `hostCheats`, `infiniteGold`, `donateGold`, `infiniteTroops`, `donateTroops` are schema/config inputs. Confirmed effective values vary by player type and lobby-creator status. |
| Starting manpower by player type/difficulty | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | derived | Confirmed `Bot = 10_000`, `Human = 25_000` unless infinite troops, `Nation` varies by `Difficulty`. |
| Troop cap and troop growth formulas | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | derived | Confirmed `maxTroops()` and `troopIncreaseRate()` depend on tiles, city levels, player type, difficulty, and infinite-troops cheats. |
| Passive gold income | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | derived | Confirmed human base `100`, bot base `50`, then multiplied by effective gold multiplier. |
| Donations, targeting, emoji, deletion, embargo, alliance timers | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | directly extractable | Confirmed durations/cooldowns are fixed methods in `DefaultConfig.ts`: donation, embargo-all, deletion-mark, delete-unit, emoji, target, alliance request, alliance duration, temporary embargo, alliance extension prompt offset. |
| Win thresholds and time-based victory | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/execution/WinCheckExecution.ts` | derived | Confirmed tile-win threshold is `80` FFA and `95` team. Confirmed runtime win also depends on `maxTimerValue` and hard time limit `170 * 60` seconds. |
| Terrain-based combat coefficients | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | derived | Confirmed `attackLogic()` uses terrain-specific `mag` and `speed` baselines for `Plains`, `Highland`, `Mountain`. |
| Defense-post combat modifiers | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | derived | Confirmed fixed helper values `range = 30`, `defense bonus = 5`, `speed bonus = 3`, plus defense-post shell rate and targeting range. Effective use is runtime because nearby-unit presence changes combat. |
| Fallout combat modifier | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts` | derived | Confirmed formula is `5 - falloutRatio * 2`; effective modifier depends on current fallout ratio and target tile fallout presence. |
| Large-attacker / large-defender combat scaling | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | derived | Confirmed defender debuff uses sigmoid with midpoint `150_000` and decay rate `ln(2) / 50000`; attacker bonuses depend on tile ownership above `100_000`. |
| Traitor penalties | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts` | derived | Confirmed values: defense debuff `0.5`, speed debuff `0.8`, duration `30 * 10`. Effective use is runtime because traitor status is stateful. |
| Basic attack dispatch amounts | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | derived | Confirmed `attackAmount()` and `boatAttackAmount()` depend on attacker troop count and type. |
| Attack throughput | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | derived | Confirmed `attackTilesPerTick()` depends on attack troops, defender troops, defender type, and adjacent-enemy tile count. |
| Naval / warship mechanics | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | directly extractable for base stats; runtime-only for behavior | Confirmed constants: warship shell lifetime, patrol range, targeting range, shell attack rate, transport boat max count, port spawn radius. |
| Trade ship mechanics | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | derived | Confirmed formulas for `tradeShipGold()`, `tradeShipSpawnRate()`, short-range debuff, proximity bonus, and pirate safety cooldown. |
| Train / rail mechanics | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts`, `.tmp/OpenFrontIO-upstream/src/core/GameRunner.ts` | derived | Confirmed formulas for train spawn rate, train gold by relation and distance penalty, station min/max range, railroad max size. Runtime legality of actual build/use is separate. |
| Nuke and SAM stats | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | derived | Confirmed magnitudes, alliance-break threshold, nuke speed/range, SAM cooldown/range, missile speed, SAM level scaling, and nuke death factor formula. |
| Structure placement spacing | `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts` | directly extractable | Confirmed `minDistanceBetweenPlayers = 30`, `structureMinDist = 15`, train-station ranges, and railroad max size. |
| Public playlist/default lobby derivations | `.tmp/OpenFrontIO-upstream/src/server/MapPlaylist.ts` | derived | Confirmed map frequency, team weights, special modifier pool, mutually exclusive modifiers, crowded-player logic, max-player calculation, and public default config construction. |
| Updateable lobby config fields | `.tmp/OpenFrontIO-upstream/src/server/GameServer.ts`, `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts` | directly extractable | Confirmed server mutates a partial `GameConfig` in lobby for `update_game_config`; important for deciding which extracted keys should map back to live config fields. |
| Intent/message legality | `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts` | directly extractable | Confirmed wire-legal intent union and client/server message types. Important context, but not numeric mechanics. |
| Action legality surface | `.tmp/OpenFrontIO-upstream/src/core/GameRunner.ts`, `.tmp/OpenFrontIO-upstream/src/core/game/Game.ts` | runtime-only | Confirmed action availability depends on current tile, owner, borders, alliances, embargo state, targeting state, and build checks. This should not be collapsed into static constants. |

## Confirmed Values Worth Extracting First

- Spawn and phase values:
  - `DEFAULT_SPAWN_IMMUNITY_TICKS = 5 * 10`
  - `SAM_CONSTRUCTION_TICKS = 30 * 10`
  - `numSpawnPhaseTurns()` returns `100` for singleplayer, `150` for random spawn, else `300`
- Economy/timers:
  - `cityTroopIncrease = 250_000`
  - `SAMCooldown = 120`
  - `SiloCooldown = 75`
  - `donateCooldown = 10 * 10`
  - `embargoAllCooldown = 10 * 10`
  - `deletionMarkDuration = 30 * 10`
  - `deleteUnitCooldown = 30 * 10`
  - `emojiMessageDuration = 5 * 10`
  - `emojiMessageCooldown = 5 * 10`
  - `targetDuration = 10 * 10`
  - `targetCooldown = 15 * 10`
  - `allianceRequestDuration = 20 * 10`
  - `allianceRequestCooldown = 30 * 10`
  - `allianceDuration = 300 * 10`
  - `temporaryEmbargoDuration = 300 * 10`
  - `allianceExtensionPromptOffset = 300`
- Win rules:
  - `percentageTilesOwnedToWin = 80` FFA / `95` team
  - hard time limit in `WinCheckExecution = 170 * 60` seconds
- Fixed ranges / constants:
  - `defensePostRange = 30`
  - `defensePostDefenseBonus = 5`
  - `defensePostSpeedBonus = 3`
  - `trainStationMinRange = 15`
  - `trainStationMaxRange = 100`
  - `railroadMaxSize = 120`
  - `boatMaxNumber = 3` unless transport ships disabled
  - `warshipShellLifetime = 20`
  - `radiusPortSpawn = 20`
  - `tradeShipShortRangeDebuff = 300`
  - `defaultNukeSpeed = 6`
  - `defaultNukeTargetableRange = 150`
  - `defaultSamRange = 70`
  - `maxSamRange = 150`
  - `defaultSamMissileSpeed = 12`
  - `structureMinDist = 15`
  - `shellLifetime = 50`
  - `warshipPatrolRange = 100`
  - `warshipTargettingRange = 130`
  - `warshipShellAttackRate = 20`
  - `defensePostShellAttackRate = 100`
  - `defensePostTargettingRange = 75`
  - `safeFromPiratesCooldownMax = 20`
  - `minDistanceBetweenPlayers = 30`

## Proposed JSON Shape

This is a proposed shape for `generated/mechanics.generated.json`. It keeps directly extractable values as data, but preserves derived/runtime mechanics as formulas with source references instead of flattening them into guessed constants.

```json
{
  "pinnedCommit": "52033597efb09de6c8d724f6e2784c3c9e8a7511",
  "generatedFrom": {
    "primary": [
      "src/core/configuration/DefaultConfig.ts",
      "src/core/Schemas.ts",
      "src/core/game/Game.ts"
    ],
    "supporting": [
      "src/core/game/GameImpl.ts",
      "src/core/GameRunner.ts",
      "src/core/execution/WinCheckExecution.ts",
      "src/server/MapPlaylist.ts",
      "src/server/GameServer.ts"
    ]
  },
  "schema": {
    "gameConfig": {
      "fields": {},
      "teamCountModes": [],
      "publicModifierFields": []
    },
    "enums": {
      "difficulty": [],
      "gameMode": [],
      "gameType": [],
      "gameMapSize": [],
      "unitType": [],
      "playerType": [],
      "terrainType": []
    },
    "unitGroups": {
      "nukes": [],
      "structures": [],
      "buildMenus": [],
      "playerBuildable": []
    }
  },
  "constants": {
    "server": {
      "turnIntervalMs": 100,
      "gameCreationRateMs": 120000
    },
    "spawn": {
      "defaultSpawnImmunityTicks": 50,
      "samConstructionTicks": 300
    },
    "timers": {},
    "ranges": {},
    "thresholds": {}
  },
  "units": {
    "Warship": {
      "maxHealth": 1000,
      "cost": {
        "kind": "formula",
        "source": "Math.min(1_000_000, (numUnits + 1) * 250_000)",
        "dependsOn": ["numUnitsOwnedConstructed", "infiniteGold"]
      }
    }
  },
  "economy": {
    "startingGold": {
      "kind": "derived",
      "dependsOn": ["gameConfig.startingGold", "hostCheats.startingGold", "playerType", "isLobbyCreator"]
    },
    "goldMultiplier": {
      "kind": "derived",
      "dependsOn": ["gameConfig.goldMultiplier", "hostCheats.goldMultiplier", "isLobbyCreator"]
    },
    "passiveGoldRate": {
      "kind": "formula",
      "dependsOn": ["playerType", "effectiveGoldMultiplier"]
    }
  },
  "combat": {
    "attackLogic": {
      "kind": "runtime_formula",
      "dependsOn": [
        "terrainType",
        "defensePostsNearby",
        "falloutRatio",
        "attackerType",
        "defenderType",
        "defenderDisconnected",
        "sameTeam",
        "attackerTilesOwned",
        "defenderTilesOwned",
        "defenderTroops",
        "attackerTroops",
        "defenderIsTraitor"
      ],
      "coefficients": {}
    },
    "attackTilesPerTick": {
      "kind": "runtime_formula"
    },
    "attackAmount": {
      "kind": "runtime_formula"
    },
    "boatAttackAmount": {
      "kind": "runtime_formula"
    }
  },
  "growth": {
    "startManpower": {
      "kind": "derived"
    },
    "maxTroops": {
      "kind": "runtime_formula"
    },
    "troopIncreaseRate": {
      "kind": "runtime_formula"
    }
  },
  "trade": {
    "trainGold": {
      "kind": "formula"
    },
    "tradeShipGold": {
      "kind": "formula"
    },
    "tradeShipSpawnRate": {
      "kind": "formula"
    }
  },
  "nukes": {
    "magnitudes": {},
    "samRangeByLevel": {
      "kind": "formula",
      "source": "maxSamRange - 480 / (level + 5)"
    },
    "nukeDeathFactor": {
      "kind": "runtime_formula"
    }
  },
  "victory": {
    "tilePercentToWin": {
      "ffa": 80,
      "team": 95
    },
    "timeLimit": {
      "configMaxTimerMinutes": {
        "kind": "config_field"
      },
      "hardLimitSeconds": 10200
    }
  },
  "playlistDerived": {
    "spawnImmunityRules": {
      "kind": "derived_from_map_playlist"
    },
    "specialModifierPool": {
      "kind": "derived_from_map_playlist"
    },
    "disabledUnitsFromModifiers": {
      "kind": "derived_from_map_playlist"
    }
  },
  "runtimeOnly": {
    "playerActions": {},
    "playerInteraction": {},
    "teamAssignment": {},
    "effectiveWinCheck": {}
  }
}
```

## Stale-Risk Areas From `mechanics.js` Assumptions

Confirmed limitation:

- No `mechanics.js` file exists in this workspace, so the items below are inferred stale-risk areas for any manual assumptions file that tries to summarize mechanics.

High stale-risk areas:

1. Spawn immunity assumed as a single fixed value.
   Confirmed risk: `DefaultConfig` defaults to `5 * 10`, but `MapPlaylist.ts` can set `150 * 10`, `SAM_CONSTRUCTION_TICKS + 15 * 10`, or `5 * 10` depending on mode and starting gold.
2. Win condition assumed as `80% tiles`.
   Confirmed risk: team mode uses `95%`, `maxTimerValue` can end games early, and `WinCheckExecution` also has a hard limit of `170 * 60` seconds.
3. Unit costs assumed as fixed numbers.
   Confirmed risk: multiple unit costs scale by constructed/owned count, `MIRV` cost scales by `numMirvsLaunched()`, and infinite-gold cheats can zero the cost.
4. Construction durations assumed as fixed numbers without `instantBuild`.
   Confirmed risk: multiple structures become `0` duration when `instantBuild` is enabled.
5. Starting gold assumed as a single lobby constant.
   Confirmed risk: humans use `startingGold`, bots start at `0`, and host cheats can add extra gold for the lobby creator only.
6. Starting troops / troop cap assumed as static.
   Confirmed risk: `startManpower`, `maxTroops`, and `troopIncreaseRate` vary by player type, difficulty, city levels, tiles owned, and host cheats.
7. Disabled units assumed from UI labels rather than effective config.
   Confirmed risk: `disabledUnits` can be explicitly set, or derived from public modifiers in `MapPlaylist.ts`, and `boatMaxNumber()` also effectively disables transport ships when `TransportShip` is disabled.
8. Nuke and SAM ranges assumed as fixed.
   Confirmed risk: default SAM range is `70`, but actual `samRange(level)` is formula-based and approaches `150`; nuke death is also formula-driven rather than purely radius-driven.
9. Action legality assumed from schema alone.
   Confirmed risk: `Schemas.ts` only defines wire-legal intents. Real legality depends on `GameRunner.playerActions()` and `Player` capability methods at runtime.
10. Team counts assumed directly from `playerTeams`.
    Confirmed risk: `GameImpl.populateTeams()` expands special modes into actual team sets and labels; `Humans Vs Nations` is special-cased.
11. Public modifier assumptions assumed as one-to-one with final config.
    Confirmed risk: `MapPlaylist.ts` applies exclusions, mutual exclusivity, derived disabled units, derived nations disabling, and derived spawn immunity.
12. Hard-coded combat loss math without terrain/runtime state.
    Confirmed risk: `attackLogic()` depends on terrain type, nearby defense posts, fallout ratio, traitor state, attacker/defender types, disconnect/team conditions, and large-territory scaling.

## Short Extraction Plan For `scripts/extract-mechanics.ts`

Confirmed goal:

- Produce generated data from pinned upstream TypeScript sources.
- Do not hard-code mechanics that can be extracted.

Recommended plan:

1. Treat the pinned source tree as input root.
   - Read from `.tmp/OpenFrontIO-upstream/src/core/...` and `.tmp/OpenFrontIO-upstream/src/server/MapPlaylist.ts`.
   - Fail fast if `research/pinned-commit.txt` does not match the expected commit string.
2. Parse TypeScript with an AST-driven approach.
   - Recommended: TypeScript compiler API or `ts-morph`.
   - Reason: this keeps the extractor resilient to formatting changes and avoids regex-parsing method bodies.
3. Extract enum and schema domains first.
   - Pull enum members from `Game.ts`.
   - Pull `GameConfigSchema` field names and optionality from `Schemas.ts`.
   - Pull grouped unit arrays (`Nukes`, `Structures`, `BuildMenus`, `PlayerBuildable`) from `Game.ts`.
4. Extract literal-return methods from `DefaultConfig`.
   - For methods that return a literal or constant expression, emit normalized numeric values plus raw source expression and source file.
   - Examples: cooldowns, ranges, thresholds, durations, fixed constants.
5. Extract formula methods as structured metadata, not guessed numbers.
   - Emit `kind`, `source`, `dependsOn`, and optionally named coefficients.
   - Examples: `attackLogic`, `maxTroops`, `troopIncreaseRate`, `tradeShipGold`, `tradeShipSpawnRate`, `trainGold`, `samRange`, `nukeDeathFactor`.
6. Extract `unitInfo()` per `UnitType`.
   - For each switch case, emit fixed fields (`maxHealth`, `damage`, `upgradable`, `constructionDuration`) when statically available.
   - For costs, emit either numeric literal or formula source plus dependencies.
   - Mark `MIRV` cost as game-stat derived.
7. Extract playlist-derived public config rules separately.
   - From `MapPlaylist.ts`, emit spawn-immunity rules, modifier pool weights, mutually exclusive modifier pairs, disabled-unit derivation, and special public config defaults.
   - Keep these under a separate `playlistDerived` section so they are not confused with universal core mechanics.
8. Mark runtime-only surfaces explicitly.
   - Emit metadata stubs for `playerActions`, `playerInteraction`, team assignment, and effective win checks, but do not flatten them to constants.
9. Preserve provenance.
   - Every emitted section should include `sourceFile`.
   - Formula entries should include the raw expression or switch-case text used to derive them.
10. Add validation output.
   - Validate that every `UnitType` has a `unitInfo` record or a deliberate exclusion.
   - Validate known fixed methods exist before generation so upstream changes fail loudly instead of silently going stale.

## Confirmed vs Inferred Summary

- Confirmed:
  - The exact pinned upstream commit.
  - The reviewed source files listed above.
  - That `DefaultConfig.ts` is the main mechanics source.
  - That `MapPlaylist.ts` and `WinCheckExecution.ts` contain important derived mechanics not represented as single constants in `DefaultConfig.ts`.
  - That `GameRunner.ts` and `Game.ts` are runtime legality surfaces, not flat mechanics tables.
- Inferred:
  - Any stale-risk statement framed as a `mechanics.js` assumption risk, because no such file exists in this workspace to compare directly.
