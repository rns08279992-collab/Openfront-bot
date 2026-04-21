export interface MechanicsField {
  name: string;
  schema: string;
  optional: boolean;
  nullable: boolean;
}

export interface MechanicsFormula {
  kind: "formula";
  sourceFile: string;
  sourceExpression: string;
  dependsOn: string[];
}

export interface MechanicsConstructionDuration {
  sourceExpression: string;
  instantBuildZero: boolean;
}

export interface MechanicsUnitCostFixed {
  kind: "fixed";
  value: string;
  sourceExpression: string;
}

export interface MechanicsUnitCostFormula {
  kind: "formula";
  sourceExpression: string;
  dependsOn: string[];
  countsAgainst?: string[];
}

export type MechanicsUnitCost =
  | MechanicsUnitCostFixed
  | MechanicsUnitCostFormula;

export interface MechanicsUnitInfo {
  cost: MechanicsUnitCost;
  maxHealth?: number;
  damage?: number;
  constructionDuration?: MechanicsConstructionDuration;
  upgradable?: true;
}

export interface MechanicsDeferredCategory {
  category: string;
  reason: string;
  sources: string[];
}

export interface MechanicsGenerated {
  pinnedCommit: string;
  generatedFrom: {
    research: string[];
    primaryInputs: string[];
    supportingInputs: string[];
  };
  schema: {
    gameConfigFields: MechanicsField[];
    teamCountModes: string[];
    publicModifierFields: MechanicsField[];
    updateableLobbyConfigFields: string[];
    enums: {
      difficulty: string[];
      gameMode: string[];
      gameType: string[];
      gameMapSize: string[];
      playerType: string[];
      terrainType: string[];
      unitType: string[];
    };
    unitGroups: {
      nukes: string[];
      structures: string[];
      buildMenus: string[];
      playerBuildable: string[];
    };
  };
  constants: {
    server: {
      turnIntervalMs: number;
      gameCreationRateMs: number;
    };
    spawn: {
      defaultSpawnImmunityTicks: number;
      samConstructionTicks: number;
      numSpawnPhaseTurns: {
        singleplayer: number;
        randomSpawn: number;
        default: number;
      };
      effectiveSpawnImmunityWindow: {
        sourceFile: string;
        sourceExpression: string;
      };
    };
    economy: {
      cityTroopIncrease: number;
    };
    timers: Record<string, number>;
    ranges: Record<string, number>;
    thresholds: {
      percentageTilesOwnedToWin: {
        freeForAll: number;
        team: number;
      };
      boatMaxNumberDefault: number;
      winCheckHardTimeLimitSeconds: number;
      defenseDebuffMidpoint: number;
      defenseDebuffDecayRate: string;
    };
    traitor: {
      defenseDebuff: number;
      speedDebuff: number;
      durationTicks: number;
    };
    naval: {
      warshipShellLifetime: number;
      shellLifetime: number;
      warshipShellAttackRate: number;
      defensePostShellAttackRate: number;
      safeFromPiratesCooldownMax: number;
    };
    nukes: {
      magnitudes: Record<string, { inner: number; outer: number }>;
      nukeAllianceBreakThreshold: number;
      defaultNukeSpeed: number;
      defaultSamMissileSpeed: number;
    };
  };
  units: Record<string, MechanicsUnitInfo>;
  formulas: Record<string, MechanicsFormula>;
  playlistDerived: {
    maxPlayerCountCap: number;
    teamWeights: Array<{
      config: string;
      weight: number;
    }>;
    specialModifierPoolWeights: Array<{
      modifier: string;
      tickets: number;
    }>;
    mutuallyExclusiveModifiers: Array<[string, string]>;
    spawnImmunityRules: Array<{
      when: string;
      ticks: number;
      source: string;
    }>;
    disabledUnitsByModifier: Record<string, string[]>;
    oneVOneDefaults: {
      rankedType: string;
      maxPlayers: number;
      maxTimerValueMinutes: {
        compact: number;
        normal: number;
      };
      spawnImmunityTicks: number;
    };
  };
  deferredCategories: MechanicsDeferredCategory[];
}
