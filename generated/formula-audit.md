# Formula Audit

Pinned source: `52033597efb09de6c8d724f6e2784c3c9e8a7511`

## Source files inspected

- `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/AttackExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/DefensePostExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/PortExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/SAMLauncherExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/TradeShipExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/TrainExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/TrainStationExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/WarshipExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/MIRVExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/NukeExecution.ts`
- `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts`
- `.tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts`
- `.tmp/OpenFrontIO-upstream/src/core/game/TrainStation.ts`
- `.tmp/OpenFrontIO-upstream/src/core/game/TransportShipUtils.ts`
- `.tmp/OpenFrontIO-upstream/src/core/game/UnitImpl.ts`

## Verified

### 1. Combat attacker loss formula

- `verified`
- Source: `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:619` `attackLogic`
- Attacker loss vs player defenders:
  - `defenderTroopLoss = defender.troops() / defender.numTilesOwned()`
  - `currentAttackerLoss = within(defender.troops() / attackTroops, 0.6, 2) * mag * 0.8 * largeDefenderAttackDebuff * largeAttackBonus * traitorMod`
  - `altAttackerLoss = 1.3 * defenderTroopLoss * (mag / 100) * traitorMod`
  - `attackerTroopLoss = 0.7 * currentAttackerLoss + 0.3 * altAttackerLoss`

### 2. Attack speed formula

- `verified`
- Source: `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:619` `attackLogic`
- Player-defender tile cost:
  - `within(defender.troops() / (5 * attackTroops), 0.2, 1.5) * speed * largeDefenderSpeedDebuff * largeAttackerSpeedBonus * traitorSpeedMod`
- Throughput helper:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:747` `attackTilesPerTick`
  - Player defender: `within(((5 * attackTroops) / defender.troops()) * 2, 0.01, 0.5) * numAdjacentTilesWithEnemy * 3`
  - Terra Nullius: `numAdjacentTilesWithEnemy * 2`

### 3. Terrain defense/speed constants

- `verified`
- Source: `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:619` `attackLogic`
- Plains: `mag=80`, `speed=16.5`
- Highland: `mag=100`, `speed=20`
- Mountain: `mag=120`, `speed=25`

### 4. Defense post range and multiplier

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:213` `defensePostRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:217` `defensePostDefenseBonus`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:221` `defensePostSpeedBonus`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:652-657` inside `attackLogic`
- Values:
  - `defensePostRange = 30`
  - `defensePostDefenseBonus = 5`
  - `defensePostSpeedBonus = 3`

### 6. Ongoing attack troop injection behavior

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/execution/AttackExecution.ts:137` `init`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/AttackExecution.ts:199` `retreat`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts:256` `tick`
- Notes:
  - New land attacks on the same target merge into an existing outgoing attack unless `sourceTile !== null`.
  - Completed boat invasions inject surviving boat troops through `new AttackExecution(boat.troops(), attacker, target.id(), dst, false)`.
  - `AttackExecution.retreat()` has explicit `removeTroops === false` handling to avoid refunding injected troops twice.

### 7. Port cost and trade ship formulas

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:374` `unitInfo`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:317` `tradeShipGold`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:326` `tradeShipSpawnRate`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/PortExecution.ts:71` `shouldSpawnTradeShip`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/PortExecution.ts:99` `tradingPorts`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/TradeShipExecution.ts:168` `complete`
- Values:
  - Port cost: `min(1_000_000, 2^numUnits * 125_000)` shared with factories
  - Trade gold: `floor((75_000 / (1 + exp(-0.03 * (dist - 300))) + 50 * dist) * goldMultiplierFor(player))`
  - Spawn rate uses `decayRate = Math.LN2 / 50`, `baseSpawnRate = 1 - sigmoid(numTradeShips, decayRate, 200)`, `rejectionModifier = 1 / (tradeShipSpawnRejections + 1)`

### 8. Train payout formulas

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:277` `trainSpawnRate`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:282` `trainGold`
  - `.tmp/OpenFrontIO-upstream/src/core/game/TrainStation.ts:15` `TradeStationStopHandler.onStop`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/TrainStationExecution.ts:53` `shouldSpawnTrain`
- Values:
  - Train spawn rate: `(numPlayerFactories + 10) * 15`
  - Base gold by relation: `ally=35000`, `team=25000`, `other=25000`, `self=10000`
  - Penalty: first 10 visited cities free, then `5000` per additional stop, floored at `5000`
  - If station owner differs from train owner, both receive the same gold amount

### 9. Troop growth formula and cap/growth curve

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:197` `cityTroopIncrease`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:813` `maxTroops`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:847` `troopIncreaseRate`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts:76` `tick`
- Values:
  - City level contribution: `250000` per summed city level
  - Base cap: `2 * (pow(numTilesOwned, 0.6) * 1000 + 50000) + cityLevelSum * 250000`
  - Human infinite troop cap: `1_000_000_000`
  - Growth: `(10 + troops^0.73 / 4) * (1 - troops / max)` then bot/nation modifiers, then clamp to max

### 10. Betrayal/traitor timing and modifiers

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:161` `traitorDefenseDebuff`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:164` `traitorSpeedDebuff`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:167` `traitorDuration`
  - `.tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts:525` `isTraitor`
  - `.tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts:529` `getTraitorRemainingTicks`
  - `.tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts:537` `markTraitor`
  - `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts:763` `breakAlliance`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/MIRVExecution.ts:58` `init`
- Values:
  - `traitorDefenseDebuff = 0.5`
  - `traitorSpeedDebuff = 0.8`
  - `traitorDuration = 300 ticks`
- Notes:
  - Breaking alliance marks the breaker traitor unless the other player is already traitor or disconnected.
  - MIRV launch against an allied target breaks alliance immediately and applies `-100` relation.

### 11. Nuke/SAM/MIRV constants

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:892` `nukeMagnitudes`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:904` `nukeAllianceBreakThreshold`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:908` `defaultNukeSpeed`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:912` `defaultNukeTargetableRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:916` `defaultSamRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:920` `samRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:925` `maxSamRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:929` `defaultSamMissileSpeed`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/SAMLauncherExecution.ts:206` `SAMLauncherExecution`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/MIRVExecution.ts:25` `MirvExecution`
- Values:
  - MIRV warhead magnitude: `inner=12`, `outer=18`
  - Atom bomb magnitude: `inner=12`, `outer=30`
  - Hydrogen bomb magnitude: `inner=80`, `outer=100`
  - Alliance break threshold: `100`
  - Default nuke speed: `6`
  - Default targetable range: `150`
  - Default SAM range: `70`
  - `samRange(level) = 150 - 480 / (level + 5)`
  - Default SAM missile speed: `12`
  - MIRV search/protection radii: `400` / `50`
  - MIRV spread constants: `range=1500`, `minimumSpread=55`, `warheadCount=350`

### 12. Boat/warship mechanics

- `verified`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:595` `boatMaxNumber`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:764` `boatAttackAmount`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:768` `warshipShellLifetime`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:956` `shellLifetime`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:960` `warshipPatrolRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:964` `warshipTargettingRange`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:968` `warshipShellAttackRate`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:976` `safeFromPiratesCooldownMax`
  - `.tmp/OpenFrontIO-upstream/src/core/game/TransportShipUtils.ts:5` `canBuildTransportShip`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts:55` `init`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts:164` `tick`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/WarshipExecution.ts:53` `tick`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/TradeShipExecution.ts:148` `tick`
  - `.tmp/OpenFrontIO-upstream/src/core/game/UnitImpl.ts:430` `setSafeFromPirates/isSafeFromPirates`
- Values:
  - Boat cap: `3` unless transport ships are disabled, then `0`
  - Boat attack amount: `floor(attacker.troops() / 5)`
  - Warship shell lifetime: `20`
  - Shell lifetime after owner death: `50`
  - Warship patrol range: `100`
  - Warship targeting range: `130`
  - Warship shell cadence: `20`
  - Safe-from-pirates window: `20 ticks`
- Notes:
  - Warships regenerate `1` health per tick if the owner still has a port.
  - Warships prioritize `TransportShip`, then `Warship`, then `TradeShip`.
  - Trade ships become pirate-safe when moving on shoreline water tiles.

## Inferred

### 5. Annexation/enclosure rules, including coastal/naval enclosure

- `inferred`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts:116` `removeClusters`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts:158` `surroundedBySamePlayer`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts:212` `isSurrounded`
  - `.tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts:1177` `conquerPlayer`
- Verified land rules:
  - Largest cluster can be removed if surrounded by exactly one non-friendly player and the enemy bounding box is inscribed in the cluster bounding box.
  - Other clusters can be removed when they are surrounded and not touching shore or map edge.
- Uncertain/coastal notes:
  - `isOceanShore()` and `isShore()` cause early return `false`, so coastal areas are explicitly excluded from the generic enclosure removal path.
  - I did not find a separate explicit “coastal enclosure” or “naval enclosure” formula beyond disconnected teammate ship transfer on conquest in `conquerPlayer()`.

### Defense post naval targeting behavior

- `inferred`
- Source:
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:972` `defensePostShellAttackRate`
  - `.tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts:980` `defensePostTargettingRange`
  - `.tmp/OpenFrontIO-upstream/src/core/execution/DefensePostExecution.ts:56` `tick`
- Notes:
  - The targeting constants exist.
  - The ship-targeting block is commented out, so active runtime behavior is not verified from current code.
