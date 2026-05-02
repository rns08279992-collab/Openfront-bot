export type FormulaAuditStatus = "verified" | "inferred" | "unverified";

export interface FormulaSourceRef {
  readonly file: string;
  readonly line?: number;
  readonly symbol?: string;
}

export interface FormulaRegistryEntry {
  readonly key: string;
  readonly status: FormulaAuditStatus;
  readonly summary: string;
  readonly sources: readonly FormulaSourceRef[];
  readonly values?: Readonly<Record<string, number | string | boolean>>;
  readonly notes: readonly string[];
}

export const FORMULA_REGISTRY: readonly FormulaRegistryEntry[] = [
  {
    key: "combat.attackerLoss",
    status: "verified",
    summary: "Attacker loss is derived inside attackLogic() from terrain magnitude, defender troop density, defender size debuff, attacker size bonus, and traitor state.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 619,
        symbol: "attackLogic",
      },
    ],
    values: {
      plainsMagnitude: 80,
      highlandMagnitude: 100,
      mountainMagnitude: 120,
      weightedCurrentLoss: 0.7,
      weightedAltLoss: 0.3,
    },
    notes: [
      "For player defenders: defenderTroopLoss = defender.troops() / defender.numTilesOwned().",
      "Attacker loss blends currentAttackerLoss and altAttackerLoss after defense post, fallout, size, and traitor modifiers are applied.",
    ],
  },
  {
    key: "combat.attackSpeed",
    status: "verified",
    summary: "Attack speed comes from terrain base speed, then scales by defense posts, fallout, defender size debuff, attacker size bonus, and traitor speed debuff.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 619,
        symbol: "attackLogic",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 747,
        symbol: "attackTilesPerTick",
      },
    ],
    values: {
      plainsSpeed: 16.5,
      highlandSpeed: 20,
      mountainSpeed: 25,
      terraNulliusMinTilesPerTick: 5,
      terraNulliusMaxTilesPerTick: 100,
    },
    notes: [
      "Against players, tilesPerTickUsed is the per-tile cost returned by attackLogic().",
      "Overall throughput also depends on attackTilesPerTick(), which uses border size, attacker troops, defender troops, and defender type.",
    ],
  },
  {
    key: "combat.terrainAndDefensePost",
    status: "verified",
    summary: "Terrain magnitudes/speeds and defense post combat aura constants are explicit in DefaultConfig.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 213,
        symbol: "defensePostRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 217,
        symbol: "defensePostDefenseBonus",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 221,
        symbol: "defensePostSpeedBonus",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 619,
        symbol: "attackLogic",
      },
    ],
    values: {
      defensePostRange: 30,
      defensePostDefenseBonusMultiplier: 5,
      defensePostSpeedBonusMultiplier: 3,
    },
    notes: [
      "attackLogic() multiplies terrain magnitude by defensePostDefenseBonus() and terrain speed by defensePostSpeedBonus() once if any nearby friendly defense post is found.",
    ],
  },
  {
    key: "combat.defensePostNaval",
    status: "inferred",
    summary: "Defense post naval range constants exist, but active ship-targeting logic is commented out in DefensePostExecution.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 972,
        symbol: "defensePostShellAttackRate",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 980,
        symbol: "defensePostTargettingRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/DefensePostExecution.ts",
        line: 56,
        symbol: "tick",
      },
    ],
    values: {
      defensePostShellAttackRateTicks: 100,
      defensePostTargettingRange: 75,
    },
    notes: [
      "The post can shoot shells via shoot(), but the ship-acquisition block is currently commented out.",
      "Range constants are verified; live naval-targeting behavior is not active in the inspected source.",
    ],
  },
  {
    key: "territory.enclosure",
    status: "inferred",
    summary: "Land enclosure removal is explicit; coastal and naval cases are excluded or handled separately rather than by one unified enclosure formula.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts",
        line: 116,
        symbol: "removeClusters",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts",
        line: 158,
        symbol: "surroundedBySamePlayer",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts",
        line: 212,
        symbol: "isSurrounded",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts",
        line: 1177,
        symbol: "conquerPlayer",
      },
    ],
    notes: [
      "Largest cluster is removed only if enclosed by one non-friendly player and the enemy bounding box is inscribed in the cluster bounding box.",
      "Other clusters are removed when fully surrounded and not touching shore or the map edge.",
      "Coastal clusters short-circuit out via isOceanShore()/isShore(); this is evidence against generic coastal enclosure.",
      "Naval follow-up is separate: on teammate conquest of a disconnected player, warships and transport ships transfer ownership.",
    ],
  },
  {
    key: "combat.ongoingAttackInjection",
    status: "verified",
    summary: "New same-target land attacks are merged at attack init, and completed boat invasions inject their surviving troops into a follow-on AttackExecution without removing troops twice.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/AttackExecution.ts",
        line: 137,
        symbol: "init",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/AttackExecution.ts",
        line: 199,
        symbol: "retreat",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts",
        line: 256,
        symbol: "tick",
      },
    ],
    notes: [
      "Land attacks with the same target merge unless the new attack has a sourceTile (boat attacks are excluded from direct merge).",
      "Boat completion spawns AttackExecution(startTroops=boat.troops(), sourceTile=dst, removeTroops=false).",
      "AttackExecution.retreat() contains explicit logic to avoid refunding injected startTroops twice for removeTroops=false land attacks.",
    ],
  },
  {
    key: "economy.portAndTradeShips",
    status: "verified",
    summary: "Port cost progression, trade ship spawn probability, weighted destination choice, and trade gold payout are explicit in DefaultConfig and Port/TradeShip execution code.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 374,
        symbol: "unitInfo",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 317,
        symbol: "tradeShipGold",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 326,
        symbol: "tradeShipSpawnRate",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 772,
        symbol: "radiusPortSpawn",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 780,
        symbol: "proximityBonusPortsNb",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/PortExecution.ts",
        line: 71,
        symbol: "shouldSpawnTradeShip",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/PortExecution.ts",
        line: 99,
        symbol: "tradingPorts",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/TradeShipExecution.ts",
        line: 168,
        symbol: "complete",
      },
    ],
    values: {
      portBaseCost: 125000,
      portCostCap: 1000000,
      radiusPortSpawn: 20,
      tradeShipShortRangeDebuff: 300,
      tradeShipSpawnDecayRate: "Math.LN2 / 50",
    },
    notes: [
      "Port cost shares the exponential progression bucket with factories.",
      "Uncaptured trade ships pay both source and destination port owners; captured trade ships pay only the captor at arrival.",
    ],
  },
  {
    key: "economy.trainPayout",
    status: "verified",
    summary: "Train spawn rate and trainGold payout formula are explicit, and train stops pay both the train owner and external station owner when applicable.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 277,
        symbol: "trainSpawnRate",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 282,
        symbol: "trainGold",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/TrainStation.ts",
        line: 15,
        symbol: "TradeStationStopHandler.onStop",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/TrainStationExecution.ts",
        line: 53,
        symbol: "shouldSpawnTrain",
      },
    ],
    values: {
      allyBaseGold: 35000,
      teamBaseGold: 25000,
      otherBaseGold: 25000,
      selfBaseGold: 10000,
      distancePenaltyPerExtraStop: 5000,
      minimumTrainGold: 5000,
    },
    notes: [
      "The first 10 visited cities are penalty-free because citiesVisited is reduced by 9 then clamped at 0.",
      "When trainOwner !== stationOwner, both players receive the same gold amount.",
    ],
  },
  {
    key: "growth.troops",
    status: "verified",
    summary: "Max troop cap and per-tick troop growth are explicit functions of tiles, city levels, troop ratio to cap, and player type/difficulty modifiers.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 197,
        symbol: "cityTroopIncrease",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 813,
        symbol: "maxTroops",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 847,
        symbol: "troopIncreaseRate",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/PlayerExecution.ts",
        line: 76,
        symbol: "tick",
      },
    ],
    values: {
      cityTroopIncrease: 250000,
      humanInfiniteTroopCap: 1000000000,
      botCapMultiplier: "1/3",
    },
    notes: [
      "Base cap before type modifiers is 2 * (pow(numTilesOwned, 0.6) * 1000 + 50000) + cityLevelSum * cityTroopIncrease().",
      "Growth adds (10 + troops^0.73 / 4) * (1 - troops / max), then applies bot/nation modifiers, then clamps at max.",
    ],
  },
  {
    key: "diplomacy.traitor",
    status: "verified",
    summary: "Traitor timing and combat modifiers are explicit, and alliance breaks mark the breaker as traitor unless the other party is already traitor or disconnected.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 161,
        symbol: "traitorDefenseDebuff",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 164,
        symbol: "traitorSpeedDebuff",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 167,
        symbol: "traitorDuration",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts",
        line: 525,
        symbol: "isTraitor",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts",
        line: 529,
        symbol: "getTraitorRemainingTicks",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/PlayerImpl.ts",
        line: 537,
        symbol: "markTraitor",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts",
        line: 763,
        symbol: "breakAlliance",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/MIRVExecution.ts",
        line: 58,
        symbol: "init",
      },
    ],
    values: {
      traitorDefenseDebuff: 0.5,
      traitorSpeedDebuff: 0.8,
      traitorDurationTicks: 300,
    },
    notes: [
      "Combat uses traitorDefenseDebuff() and traitorSpeedDebuff() on defenders marked traitor.",
      "MIRV launch against an allied player breaks alliance immediately and applies -100 relation.",
    ],
  },
  {
    key: "nukes.sam.mirv",
    status: "verified",
    summary: "Nuke magnitudes, nuke speed, SAM speed/range, MIRV spread constants, and alliance-break threshold are explicit in source.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 892,
        symbol: "nukeMagnitudes",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 904,
        symbol: "nukeAllianceBreakThreshold",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 908,
        symbol: "defaultNukeSpeed",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 912,
        symbol: "defaultNukeTargetableRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 916,
        symbol: "defaultSamRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 920,
        symbol: "samRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 925,
        symbol: "maxSamRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 929,
        symbol: "defaultSamMissileSpeed",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/SAMLauncherExecution.ts",
        line: 206,
        symbol: "SAMLauncherExecution",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/MIRVExecution.ts",
        line: 25,
        symbol: "MirvExecution",
      },
    ],
    values: {
      mirvInner: 12,
      mirvOuter: 18,
      atomInner: 12,
      atomOuter: 30,
      hydrogenInner: 80,
      hydrogenOuter: 100,
      nukeAllianceBreakThreshold: 100,
      defaultNukeSpeed: 6,
      defaultNukeTargetableRange: 150,
      defaultSamRange: 70,
      maxSamRange: 150,
      defaultSamMissileSpeed: 12,
      mirvWarheadSearchRadius: 400,
      mirvWarheadProtectionRadius: 50,
      mirvRange: 1500,
      mirvMinimumSpread: 55,
      mirvWarheadCount: 350,
    },
    notes: [
      "samRange(level) = maxSamRange() - 480 / (level + 5).",
      "NukeExecution exempts MIRV warheads from alliance breaking.",
    ],
  },
  {
    key: "naval.boatsAndWarships",
    status: "verified",
    summary: "Boat cap, launch amount, shore deployment, retreat, warship patrol/targeting, capture, shell cadence, and safe-from-pirates behavior are explicit.",
    sources: [
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 595,
        symbol: "boatMaxNumber",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 764,
        symbol: "boatAttackAmount",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 768,
        symbol: "warshipShellLifetime",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 956,
        symbol: "shellLifetime",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 960,
        symbol: "warshipPatrolRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 964,
        symbol: "warshipTargettingRange",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 968,
        symbol: "warshipShellAttackRate",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
        line: 976,
        symbol: "safeFromPiratesCooldownMax",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/TransportShipUtils.ts",
        line: 5,
        symbol: "canBuildTransportShip",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts",
        line: 55,
        symbol: "init",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/TransportShipExecution.ts",
        line: 164,
        symbol: "tick",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/WarshipExecution.ts",
        line: 53,
        symbol: "tick",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/execution/TradeShipExecution.ts",
        line: 148,
        symbol: "tick",
      },
      {
        file: ".tmp/OpenFrontIO-upstream/src/core/game/UnitImpl.ts",
        line: 430,
        symbol: "setSafeFromPirates/isSafeFromPirates",
      },
    ],
    values: {
      boatMaxNumberDefault: 3,
      boatAttackFraction: "floor(attacker.troops() / 5)",
      warshipShellLifetimeTicks: 20,
      shellLifetimeTicks: 50,
      warshipPatrolRange: 100,
      warshipTargettingRange: 130,
      warshipShellAttackRateTicks: 20,
      safeFromPiratesCooldownMaxTicks: 20,
    },
    notes: [
      "Transport ships deploy toward targetTransportTile() and return survivors to shore on retreat if they re-enter friendly land.",
      "Warships prefer TransportShip, then Warship, then TradeShip targets; TradeShips are hunted only when the warship owner has a port and the ship is not shoreline-protected.",
      "Trade ships refresh pirate safety on shoreline water tiles.",
    ],
  },
] as const;

export function getFormulaRegistryEntry(
  key: string,
): FormulaRegistryEntry | undefined {
  return FORMULA_REGISTRY.find((entry) => entry.key === key);
}
