#!/usr/bin/env node
import type {
  MechanicsConstructionDuration,
  MechanicsFormula,
  MechanicsGenerated,
  MechanicsUnitCost,
  MechanicsUnitInfo,
} from "../shared/mechanics/mechanics.types";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const EXPECTED_PINNED_COMMIT = "52033597efb09de6c8d724f6e2784c3c9e8a7511";

const FILES = {
  pinnedCommit: "research/pinned-commit.txt",
  defaultConfig:
    ".tmp/OpenFrontIO-upstream/src/core/configuration/DefaultConfig.ts",
  schemas: ".tmp/OpenFrontIO-upstream/src/core/Schemas.ts",
  game: ".tmp/OpenFrontIO-upstream/src/core/game/Game.ts",
  gameImpl: ".tmp/OpenFrontIO-upstream/src/core/game/GameImpl.ts",
  winCheck: ".tmp/OpenFrontIO-upstream/src/core/execution/WinCheckExecution.ts",
  mapPlaylist: ".tmp/OpenFrontIO-upstream/src/server/MapPlaylist.ts",
  gameServer: ".tmp/OpenFrontIO-upstream/src/server/GameServer.ts",
  outJson: "generated/mechanics.generated.json",
  outDiff: "generated/mechanics.diff.md",
};

function readText(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function writeText(relativePath, contents) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function cleanExpression(expression) {
  return expression.replace(/\s+/g, " ").trim();
}

function evaluateNumericExpression(expression) {
  const normalized = expression.replace(/_/g, "").trim();
  assert(
    /^[0-9+\-*/().\sA-Za-z]*$/.test(normalized) === false
      ? false
      : !/[A-Za-z]/.test(normalized),
    `Unsupported numeric expression: ${expression}`,
  );
  return Function(`"use strict"; return (${normalized});`)();
}

function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inSingle || inDouble || inTemplate) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (inSingle && char === "'") inSingle = false;
      if (inDouble && char === '"') inDouble = false;
      if (inTemplate && char === "`") inTemplate = false;
      continue;
    }

    if (char === "/" && next === "/") {
      const newline = text.indexOf("\n", index + 2);
      if (newline === -1) {
        return text.length - 1;
      }
      index = newline;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      if (end === -1) {
        throw new Error("Unterminated block comment");
      }
      index = end + 1;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === "`") {
      inTemplate = true;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  throw new Error(`No matching ${closeChar} found`);
}

function extractDelimited(text, anchor, openChar, closeChar) {
  const anchorIndex = text.indexOf(anchor);
  assert(anchorIndex !== -1, `Anchor not found: ${anchor}`);
  const openIndex = text.indexOf(openChar, anchorIndex);
  assert(openIndex !== -1, `Open delimiter not found for: ${anchor}`);
  const closeIndex = findMatching(text, openIndex, openChar, closeChar);
  return text.slice(openIndex + 1, closeIndex);
}

function splitTopLevel(input, delimiterChar) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let angle = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inSingle || inDouble || inTemplate) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (inSingle && char === "'") inSingle = false;
      if (inDouble && char === '"') inDouble = false;
      if (inTemplate && char === "`") inTemplate = false;
      continue;
    }

    if (char === "/" && next === "/") {
      const newline = input.indexOf("\n", index + 2);
      if (newline === -1) break;
      index = newline;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = input.indexOf("*/", index + 2);
      if (end === -1) break;
      index = end + 1;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === "`") {
      inTemplate = true;
      continue;
    }

    if (char === "(") round += 1;
    if (char === ")") round -= 1;
    if (char === "[") square += 1;
    if (char === "]") square -= 1;
    if (char === "{") curly += 1;
    if (char === "}") curly -= 1;
    if (char === "<") angle += 1;
    if (char === ">") angle -= 1;

    if (
      char === delimiterChar &&
      round === 0 &&
      square === 0 &&
      curly === 0 &&
      angle === 0
    ) {
      const part = input.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 1;
    }
  }

  const tail = input.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function splitTopLevelNoAngle(input, delimiterChar) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inSingle || inDouble || inTemplate) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (inSingle && char === "'") inSingle = false;
      if (inDouble && char === '"') inDouble = false;
      if (inTemplate && char === "`") inTemplate = false;
      continue;
    }

    if (char === "/" && next === "/") {
      const newline = input.indexOf("\n", index + 2);
      if (newline === -1) break;
      index = newline;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = input.indexOf("*/", index + 2);
      if (end === -1) break;
      index = end + 1;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === "`") {
      inTemplate = true;
      continue;
    }

    if (char === "(") round += 1;
    if (char === ")") round -= 1;
    if (char === "[") square += 1;
    if (char === "]") square -= 1;
    if (char === "{") curly += 1;
    if (char === "}") curly -= 1;

    if (char === delimiterChar && round === 0 && square === 0 && curly === 0) {
      const part = input.slice(start, index).trim();
      if (part) parts.push(part);
      start = index + 1;
    }
  }

  const tail = input.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function skipWhitespace(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function extractMethodBody(text, methodName) {
  const signatureRegex = new RegExp(
    `(?:^|\\n)\\s*(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?${methodName}\\s*\\(`,
    "m",
  );
  const match = signatureRegex.exec(text);
  assert(match && match.index !== undefined, `Method not found: ${methodName}`);
  const methodIndex = match.index;
  const paramsStart = text.indexOf("(", methodIndex);
  const paramsEnd = findMatching(text, paramsStart, "(", ")");
  let bodyStart = text.indexOf("{", paramsEnd);
  assert(bodyStart !== -1, `Method body start not found: ${methodName}`);

  const returnTypeSeparator = text.indexOf(":", paramsEnd);
  if (returnTypeSeparator !== -1 && returnTypeSeparator < bodyStart) {
    const firstBraceEnd = findMatching(text, bodyStart, "{", "}");
    const afterFirstBrace = skipWhitespace(text, firstBraceEnd + 1);
    if (text[afterFirstBrace] === "{") {
      bodyStart = afterFirstBrace;
    }
  }

  assert(bodyStart !== -1, `Method body start not found: ${methodName}`);
  const bodyEnd = findMatching(text, bodyStart, "{", "}");
  return text.slice(bodyStart + 1, bodyEnd);
}

function extractReturnExpression(methodBody) {
  const match = methodBody.match(/return\s+([\s\S]*?);/);
  assert(match, `Return expression not found in method body:\n${methodBody}`);
  return cleanExpression(match[1]);
}

function extractConstExpression(text, constName) {
  const regex = new RegExp(
    `(?:export\\s+)?const\\s+${constName}\\s*=\\s*([^;]+);`,
    "m",
  );
  const match = text.match(regex);
  assert(match, `Constant not found: ${constName}`);
  return cleanExpression(match[1]);
}

function extractStaticReadonlyExpression(text, constName) {
  const regex = new RegExp(
    `static\\s+readonly\\s+${constName}\\s*=\\s*([^;]+);`,
    "m",
  );
  const match = text.match(regex);
  assert(match, `Static readonly not found: ${constName}`);
  return cleanExpression(match[1]);
}

function extractEnum(text, enumName) {
  const body = extractDelimited(text, `export enum ${enumName}`, "{", "}");
  return splitTopLevel(body, ",").map((entry) => {
    const [name, rawValue] = entry.split("=").map((part) => part.trim());
    if (!rawValue) return name;
    return rawValue.replace(/^["']|["']$/g, "");
  });
}

function extractConstString(text, constName) {
  const regex = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*(["'])(.*?)\\1\\s+as\\s+const;`,
    "m",
  );
  const match = text.match(regex);
  assert(match, `Const string not found: ${constName}`);
  return match[2];
}

function extractObjectFields(objectSource) {
  const withoutComments = objectSource
    .replace(/\/\/[^\n\r]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  return splitTopLevel(withoutComments, ",").map((entry) => {
    const colonIndex = entry.indexOf(":");
    const name = entry.slice(0, colonIndex).trim();
    const schema = entry.slice(colonIndex + 1).trim();
    const normalizedSchema = cleanExpression(schema).replace(/\s*\.\s*/g, ".");
    return {
      name,
      schema: normalizedSchema,
      optional: /\.optional\(\)$/.test(normalizedSchema),
      nullable: /\.nullable\(\)(?:\.optional\(\))?$/.test(normalizedSchema),
    };
  });
}

function extractGameConfigFields(schemasText) {
  const body = extractDelimited(
    schemasText,
    "export const GameConfigSchema = z.object(",
    "{",
    "}",
  );
  const fields = extractObjectFields(body);
  const publicModifiersField = fields.find(
    (field) => field.name === "publicGameModifiers",
  );
  assert(publicModifiersField, "publicGameModifiers field not found");
  const publicModifierBody = extractDelimited(
    publicModifiersField.schema,
    "z.object(",
    "{",
    "}",
  );

  return {
    fields,
    publicModifierFields: extractObjectFields(publicModifierBody),
  };
}

function extractAssignedArray(text, anchor) {
  const anchorIndex = text.indexOf(anchor);
  assert(anchorIndex !== -1, `Array anchor not found: ${anchor}`);
  const equalsIndex = text.indexOf("=", anchorIndex);
  assert(equalsIndex !== -1, `Assignment not found for: ${anchor}`);
  const openIndex = text.indexOf("[", equalsIndex);
  assert(openIndex !== -1, `Array open bracket not found for: ${anchor}`);
  const closeIndex = findMatching(text, openIndex, "[", "]");
  return text.slice(openIndex + 1, closeIndex);
}

function extractUnitGroups(gameText): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const regex =
    /export const (\w+) = unitTypeGroup\(\[([\s\S]*?)\]\s+as const\);/g;
  let match;
  while ((match = regex.exec(gameText)) !== null) {
    const groupName = match[1];
    const parts = splitTopLevel(match[2], ",");
    const values = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("...")) {
        const spreadName = trimmed.replace("...", "").replace(".types", "");
        assert(groups[spreadName], `Unknown group spread: ${spreadName}`);
        values.push(...groups[spreadName]);
        continue;
      }
      values.push(trimmed.replace("UnitType.", ""));
    }

    groups[groupName] = values;
  }

  return groups;
}

function extractUnitCaseBlock(text, unitName) {
  const caseAnchor = `case UnitType.${unitName}:`;
  const start = text.indexOf(caseAnchor);
  assert(start !== -1, `Unit case not found: ${unitName}`);
  const breakIndex = text.indexOf("break;", start);
  assert(breakIndex !== -1, `Unit case break not found: ${unitName}`);
  return text.slice(start, breakIndex);
}

function parseConstructionDuration(
  caseBlock,
): MechanicsConstructionDuration | undefined {
  const match = caseBlock.match(/constructionDuration:\s*([^,]+),/);
  if (!match) return undefined;
  const sourceExpression = cleanExpression(match[1]);
  return {
    sourceExpression,
    instantBuildZero: sourceExpression.includes("this.instantBuild() ? 0 :"),
  };
}

function parseUnitCost(caseBlock): MechanicsUnitCost {
  if (/cost:\s*\(\)\s*=>\s*0n/.test(caseBlock)) {
    return { kind: "fixed", value: "0", sourceExpression: "() => 0n" };
  }

  const wrapperIndex = caseBlock.indexOf("cost: this.costWrapper(");
  if (wrapperIndex !== -1) {
    const callIndex = caseBlock.indexOf("this.costWrapper(", wrapperIndex);
    const parenIndex = caseBlock.indexOf("(", callIndex);
    const closeParenIndex = findMatching(caseBlock, parenIndex, "(", ")");
    const sourceExpression = cleanExpression(caseBlock.slice(callIndex, closeParenIndex + 1));
    const inner = caseBlock.slice(parenIndex + 1, closeParenIndex);
    const segments = splitTopLevelNoAngle(inner, ",");
    return {
      kind: "formula",
      sourceExpression: cleanExpression(segments[0]),
      dependsOn: ["unitsOwnedConstructed", "infiniteGoldForHumanLobbyCreator"],
      countsAgainst: segments.slice(1).map((segment) =>
        segment.replace("UnitType.", "").trim(),
      ),
    };
  }

  const mirvIndex = caseBlock.indexOf("cost:");
  assert(mirvIndex !== -1, `Unit cost not found in case block:\n${caseBlock}`);
  const functionIndex = caseBlock.indexOf("(game: Game, player: Player) => {", mirvIndex);
  assert(functionIndex !== -1, `Unsupported unit cost block:\n${caseBlock}`);
  const bodyOpen = caseBlock.indexOf("{", functionIndex);
  const bodyClose = findMatching(caseBlock, bodyOpen, "{", "}");
  const sourceExpression = cleanExpression(caseBlock.slice(functionIndex, bodyClose + 1));
  return {
    kind: "formula",
    sourceExpression,
    dependsOn: ["numMirvsLaunched", "infiniteGoldForHumanLobbyCreator"],
  };
}

function extractUnits(
  defaultConfigText,
  unitTypeNames,
): Record<string, MechanicsUnitInfo> {
  const units: Record<string, MechanicsUnitInfo> = {};
  for (const unitName of unitTypeNames) {
    const block = extractUnitCaseBlock(defaultConfigText, unitName);
    const unit: MechanicsUnitInfo = {
      cost: parseUnitCost(block),
    };

    const maxHealth = block.match(/maxHealth:\s*([0-9_]+)/);
    if (maxHealth) unit.maxHealth = Number(maxHealth[1].replace(/_/g, ""));

    const damage = block.match(/damage:\s*([0-9_]+)/);
    if (damage) unit.damage = Number(damage[1].replace(/_/g, ""));

    const constructionDuration = parseConstructionDuration(block);
    if (constructionDuration) unit.constructionDuration = constructionDuration;

    if (/upgradable:\s*true/.test(block)) unit.upgradable = true;

    units[unitName] = unit;
  }
  return units;
}

function makeFormula(
  sourceFile,
  sourceExpression,
  dependsOn,
): MechanicsFormula {
  return {
    kind: "formula",
    sourceFile,
    sourceExpression: cleanExpression(sourceExpression),
    dependsOn,
  };
}

function extractUpdateableLobbyFields(gameServerText) {
  const body = extractMethodBody(gameServerText, "updateGameConfig");
  const regex = /if\s+\(gameConfig\.(\w+)\s*!==\s*undefined\)/g;
  const fields = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    fields.push(match[1]);
  }
  return fields;
}

function buildData(): MechanicsGenerated {
  const pinnedCommit = readText(FILES.pinnedCommit).trim();
  assert(
    pinnedCommit === EXPECTED_PINNED_COMMIT,
    `Pinned commit mismatch: expected ${EXPECTED_PINNED_COMMIT}, got ${pinnedCommit}`,
  );

  const defaultConfigText = readText(FILES.defaultConfig);
  const schemasText = readText(FILES.schemas);
  const gameText = readText(FILES.game);
  const gameImplText = readText(FILES.gameImpl);
  const winCheckText = readText(FILES.winCheck);
  const mapPlaylistText = readText(FILES.mapPlaylist);
  const gameServerText = readText(FILES.gameServer);

  const gameConfig = extractGameConfigFields(schemasText);
  const unitGroups = extractUnitGroups(gameText);
  const teamCountModes = [
    extractConstString(gameText, "Duos"),
    extractConstString(gameText, "Trios"),
    extractConstString(gameText, "Quads"),
    extractConstString(gameText, "HumansVsNations"),
  ];

  const defaultSpawnImmunityTicksExpr = extractConstExpression(
    defaultConfigText,
    "DEFAULT_SPAWN_IMMUNITY_TICKS",
  );
  const samConstructionTicksExpr = extractConstExpression(
    defaultConfigText,
    "SAM_CONSTRUCTION_TICKS",
  );
  const hardTimeLimitExpr = extractStaticReadonlyExpression(
    winCheckText,
    "HARD_TIME_LIMIT_SECONDS",
  );

  const teamWeightsBody = extractAssignedArray(mapPlaylistText, "const TEAM_WEIGHTS");
  const teamWeights = splitTopLevel(teamWeightsBody, ",")
    .filter((entry) => entry.startsWith("{"))
    .map((entry) => {
      const configMatch = entry.match(/config:\s*([^,}]+)/);
      const weightMatch = entry.match(/weight:\s*([^,}]+)/);
      assert(configMatch && weightMatch, `Invalid team weight entry: ${entry}`);
      return {
        config: configMatch[1]
          .trim()
          .replace("HumansVsNations", "Humans Vs Nations")
          .replace("Duos", "Duos")
          .replace("Trios", "Trios")
          .replace("Quads", "Quads")
          .replace(/^["']|["']$/g, ""),
        weight: Number(weightMatch[1].trim()),
      };
    });

  const specialModifierPoolBody = extractAssignedArray(
    mapPlaylistText,
    "const SPECIAL_MODIFIER_POOL",
  );
  const specialModifierPoolWeights = [];
  const modifierPoolRegex =
    /Array<ModifierKey>\(([\d.]+)\)\.fill\("([^"]+)"\)/g;
  let poolMatch;
  while ((poolMatch = modifierPoolRegex.exec(specialModifierPoolBody)) !== null) {
    specialModifierPoolWeights.push({
      modifier: poolMatch[2],
      tickets: Number(poolMatch[1]),
    });
  }

  const mutuallyExclusiveBody = extractAssignedArray(
    mapPlaylistText,
    "const MUTUALLY_EXCLUSIVE_MODIFIERS",
  );
  const mutuallyExclusiveModifiers: Array<[string, string]> = [
    ...mutuallyExclusiveBody.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g),
  ].map((match) => [match[1], match[2]]);

  const updateableLobbyFields = extractUpdateableLobbyFields(gameServerText);

  const unitTypes = extractEnum(gameText, "UnitType").map((value) =>
    value === "Transport" ? "TransportShip" : value,
  );
  const unitNameMap = {
    TransportShip: "TransportShip",
    Warship: "Warship",
    Shell: "Shell",
    SAMMissile: "SAMMissile",
    Port: "Port",
    "Atom Bomb": "AtomBomb",
    "Hydrogen Bomb": "HydrogenBomb",
    "Trade Ship": "TradeShip",
    "Missile Silo": "MissileSilo",
    "Defense Post": "DefensePost",
    "SAM Launcher": "SAMLauncher",
    City: "City",
    MIRV: "MIRV",
    "MIRV Warhead": "MIRVWarhead",
    Train: "Train",
    Factory: "Factory",
  };
  const unitCaseNames = Object.values(unitNameMap);

  const data = {
    pinnedCommit,
    generatedFrom: {
      research: [
        "research/pinned-commit.txt",
        "research/mechanics-scan.md",
        "research/source-index.md",
        "research/repo-structure.md",
        "research/architecture-notes.md",
      ],
      primaryInputs: [
        FILES.defaultConfig,
        FILES.schemas,
        FILES.game,
        FILES.gameImpl,
        FILES.winCheck,
        FILES.mapPlaylist,
        FILES.gameServer,
      ],
      supportingInputs: [
        ".tmp/OpenFrontIO-upstream/src/core/configuration/Config.ts",
        ".tmp/OpenFrontIO-upstream/src/core/configuration/ConfigLoader.ts",
        ".tmp/OpenFrontIO-upstream/src/core/GameRunner.ts",
      ],
    },
    schema: {
      gameConfigFields: gameConfig.fields,
      teamCountModes,
      publicModifierFields: gameConfig.publicModifierFields,
      updateableLobbyConfigFields: updateableLobbyFields,
      enums: {
        difficulty: extractEnum(gameText, "Difficulty"),
        gameMode: extractEnum(gameText, "GameMode"),
        gameType: extractEnum(gameText, "GameType"),
        gameMapSize: extractEnum(gameText, "GameMapSize"),
        playerType: extractEnum(gameText, "PlayerType"),
        terrainType: extractEnum(gameText, "TerrainType"),
        unitType: extractEnum(gameText, "UnitType"),
      },
      unitGroups: {
        nukes: unitGroups.Nukes,
        structures: unitGroups.Structures,
        buildMenus: unitGroups.BuildMenus,
        playerBuildable: unitGroups.PlayerBuildable,
      },
    },
    constants: {
      server: {
        turnIntervalMs: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "turnIntervalMs")),
        ),
        gameCreationRateMs: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "gameCreationRate"),
          ),
        ),
      },
      spawn: {
        defaultSpawnImmunityTicks: evaluateNumericExpression(
          defaultSpawnImmunityTicksExpr,
        ),
        samConstructionTicks: evaluateNumericExpression(
          samConstructionTicksExpr,
        ),
        numSpawnPhaseTurns: {
          singleplayer: 100,
          randomSpawn: 150,
          default: 300,
        },
        effectiveSpawnImmunityWindow: {
          sourceFile: FILES.gameImpl,
          sourceExpression:
            "numSpawnPhaseTurns() + spawnImmunityDuration() > ticks()",
        },
      },
      economy: {
        cityTroopIncrease: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "cityTroopIncrease"),
          ),
        ),
      },
      timers: {
        samCooldown: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "SAMCooldown")),
        ),
        siloCooldown: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "SiloCooldown")),
        ),
        donateCooldown: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "donateCooldown")),
        ),
        embargoAllCooldown: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "embargoAllCooldown"),
          ),
        ),
        deletionMarkDuration: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "deletionMarkDuration"),
          ),
        ),
        deleteUnitCooldown: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "deleteUnitCooldown"),
          ),
        ),
        emojiMessageDuration: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "emojiMessageDuration"),
          ),
        ),
        emojiMessageCooldown: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "emojiMessageCooldown"),
          ),
        ),
        targetDuration: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "targetDuration")),
        ),
        targetCooldown: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "targetCooldown")),
        ),
        allianceRequestDuration: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "allianceRequestDuration"),
          ),
        ),
        allianceRequestCooldown: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "allianceRequestCooldown"),
          ),
        ),
        allianceDuration: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "allianceDuration"),
          ),
        ),
        temporaryEmbargoDuration: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "temporaryEmbargoDuration"),
          ),
        ),
        allianceExtensionPromptOffset: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "allianceExtensionPromptOffset"),
          ),
        ),
      },
      ranges: {
        defensePostRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defensePostRange"),
          ),
        ),
        defensePostDefenseBonus: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defensePostDefenseBonus"),
          ),
        ),
        defensePostSpeedBonus: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defensePostSpeedBonus"),
          ),
        ),
        trainStationMinRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "trainStationMinRange"),
          ),
        ),
        trainStationMaxRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "trainStationMaxRange"),
          ),
        ),
        railroadMaxSize: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "railroadMaxSize"),
          ),
        ),
        radiusPortSpawn: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "radiusPortSpawn"),
          ),
        ),
        tradeShipShortRangeDebuff: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "tradeShipShortRangeDebuff"),
          ),
        ),
        defaultNukeTargetableRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defaultNukeTargetableRange"),
          ),
        ),
        defaultSamRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defaultSamRange"),
          ),
        ),
        maxSamRange: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "maxSamRange")),
        ),
        structureMinDist: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "structureMinDist"),
          ),
        ),
        warshipPatrolRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "warshipPatrolRange"),
          ),
        ),
        warshipTargettingRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "warshipTargettingRange"),
          ),
        ),
        defensePostTargettingRange: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defensePostTargettingRange"),
          ),
        ),
        minDistanceBetweenPlayers: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "minDistanceBetweenPlayers"),
          ),
        ),
      },
      thresholds: {
        percentageTilesOwnedToWin: {
          freeForAll: 80,
          team: 95,
        },
        boatMaxNumberDefault: 3,
        winCheckHardTimeLimitSeconds: evaluateNumericExpression(hardTimeLimitExpr),
        defenseDebuffMidpoint: evaluateNumericExpression(
          extractConstExpression(defaultConfigText, "DEFENSE_DEBUFF_MIDPOINT"),
        ),
        defenseDebuffDecayRate: extractConstExpression(
          defaultConfigText,
          "DEFENSE_DEBUFF_DECAY_RATE",
        ),
      },
      traitor: {
        defenseDebuff: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "traitorDefenseDebuff"),
          ),
        ),
        speedDebuff: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "traitorSpeedDebuff"),
          ),
        ),
        durationTicks: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "traitorDuration")),
        ),
      },
      naval: {
        warshipShellLifetime: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "warshipShellLifetime"),
          ),
        ),
        shellLifetime: evaluateNumericExpression(
          extractReturnExpression(extractMethodBody(defaultConfigText, "shellLifetime")),
        ),
        warshipShellAttackRate: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "warshipShellAttackRate"),
          ),
        ),
        defensePostShellAttackRate: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defensePostShellAttackRate"),
          ),
        ),
        safeFromPiratesCooldownMax: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "safeFromPiratesCooldownMax"),
          ),
        ),
      },
      nukes: {
        magnitudes: {
          MIRVWarhead: { inner: 12, outer: 18 },
          AtomBomb: { inner: 12, outer: 30 },
          HydrogenBomb: { inner: 80, outer: 100 },
        },
        nukeAllianceBreakThreshold: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "nukeAllianceBreakThreshold"),
          ),
        ),
        defaultNukeSpeed: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defaultNukeSpeed"),
          ),
        ),
        defaultSamMissileSpeed: evaluateNumericExpression(
          extractReturnExpression(
            extractMethodBody(defaultConfigText, "defaultSamMissileSpeed"),
          ),
        ),
      },
    },
    units: extractUnits(defaultConfigText, unitCaseNames),
    formulas: {
      spawnImmunityDuration: makeFormula(
        FILES.defaultConfig,
        extractReturnExpression(
          extractMethodBody(defaultConfigText, "spawnImmunityDuration"),
        ),
        ["gameConfig.spawnImmunityDuration", "DEFAULT_SPAWN_IMMUNITY_TICKS"],
      ),
      goldMultiplier: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "goldMultiplierFor"),
        ["gameConfig.goldMultiplier", "hostCheats.goldMultiplier", "isLobbyCreator"],
      ),
      startingGold: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "startingGoldFor"),
        ["gameConfig.startingGold", "hostCheats.startingGold", "isLobbyCreator"],
      ),
      trainSpawnRate: makeFormula(
        FILES.defaultConfig,
        extractReturnExpression(extractMethodBody(defaultConfigText, "trainSpawnRate")),
        ["numPlayerFactories"],
      ),
      trainGold: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "trainGold"),
        ["relation", "citiesVisited", "goldMultiplierFor"],
      ),
      tradeShipGold: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "tradeShipGold"),
        ["distance", "tradeShipShortRangeDebuff", "goldMultiplierFor"],
      ),
      tradeShipSpawnRate: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "tradeShipSpawnRate"),
        ["tradeShipSpawnRejections", "numTradeShips"],
      ),
      proximityBonusPortsNb: makeFormula(
        FILES.defaultConfig,
        extractReturnExpression(
          extractMethodBody(defaultConfigText, "proximityBonusPortsNb"),
        ),
        ["totalPorts"],
      ),
      falloutDefenseModifier: makeFormula(
        FILES.defaultConfig,
        extractReturnExpression(
          extractMethodBody(defaultConfigText, "falloutDefenseModifier"),
        ),
        ["falloutRatio"],
      ),
      startManpower: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "startManpower"),
        ["playerType", "difficulty", "hostCheats.infiniteTroops", "isLobbyCreator"],
      ),
      maxTroops: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "maxTroops"),
        ["playerType", "numTilesOwned", "cityLevels", "difficulty", "hostCheats.infiniteTroops"],
      ),
      troopIncreaseRate: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "troopIncreaseRate"),
        ["playerTroops", "maxTroops", "playerType", "difficulty"],
      ),
      goldAdditionRate: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "goldAdditionRate"),
        ["playerType", "goldMultiplierFor"],
      ),
      attackLogic: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "attackLogic"),
        [
          "terrainType",
          "nearbyDefensePosts",
          "falloutRatio",
          "attackerType",
          "defenderType",
          "sameTeam",
          "defenderDisconnected",
          "attackerTilesOwned",
          "defenderTilesOwned",
          "defenderTroops",
          "attackTroops",
          "traitorState",
        ],
      ),
      attackTilesPerTick: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "attackTilesPerTick"),
        ["attackTroops", "defenderTroops", "numAdjacentTilesWithEnemy", "defenderType"],
      ),
      attackAmount: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "attackAmount"),
        ["attackerType", "attackerTroops"],
      ),
      boatAttackAmount: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "boatAttackAmount"),
        ["attackerTroops"],
      ),
      samRange: makeFormula(
        FILES.defaultConfig,
        extractReturnExpression(extractMethodBody(defaultConfigText, "samRange")),
        ["level", "maxSamRange"],
      ),
      nukeDeathFactor: makeFormula(
        FILES.defaultConfig,
        extractMethodBody(defaultConfigText, "nukeDeathFactor"),
        ["nukeType", "humans", "tilesOwned", "maxTroops"],
      ),
    },
    playlistDerived: {
      maxPlayerCountCap: 125,
      teamWeights,
      specialModifierPoolWeights,
      mutuallyExclusiveModifiers,
      spawnImmunityRules: [
        {
          when: "Humans Vs Nations",
          ticks: 50,
          source: "if (playerTeams === HumansVsNations) return 5 * 10;",
        },
        {
          when: "startingGold >= 25_000_000",
          ticks: 1500,
          source:
            "if (startingGold !== undefined && startingGold >= 25_000_000) return 150 * 10;",
        },
        {
          when: "startingGold is truthy and below 25_000_000",
          ticks: 450,
          source: "if (startingGold) return SAM_CONSTRUCTION_TICKS + 15 * 10;",
        },
        {
          when: "default",
          ticks: 50,
          source: "return 5 * 10;",
        },
      ],
      disabledUnitsByModifier: {
        isPortsDisabled: ["Port"],
        isNukesDisabled: [
          "MissileSilo",
          "AtomBomb",
          "HydrogenBomb",
          "MIRV",
          "SAMLauncher",
        ],
        isSAMsDisabled: ["SAMLauncher"],
      },
      oneVOneDefaults: {
        rankedType: "1v1",
        maxPlayers: 2,
        maxTimerValueMinutes: {
          compact: 10,
          normal: 15,
        },
        spawnImmunityTicks: 300,
      },
    },
    deferredCategories: [
      {
        category: "runtime action legality",
        reason:
          "GameRunner.playerActions() and Player capability methods depend on live tile ownership, borders, alliances, embargoes, and stateful cooldowns.",
        sources: [".tmp/OpenFrontIO-upstream/src/core/GameRunner.ts", FILES.game],
      },
      {
        category: "effective team assignment and team labels",
        reason:
          "GameImpl.populateTeams() and assignTeams() derive concrete teams from player counts and special team modes at runtime.",
        sources: [FILES.gameImpl],
      },
      {
        category: "effective win resolution",
        reason:
          "Win thresholds are extracted, but actual winner selection still depends on current tiles without fallout, disconnections, ranked mode, and timer state.",
        sources: [FILES.winCheck],
      },
      {
        category: "combat outcomes",
        reason:
          "Base formulas are extracted, but actual losses and tile throughput depend on dynamic terrain, nearby units, fallout, troop counts, and traitor state.",
        sources: [FILES.defaultConfig],
      },
      {
        category: "public playlist RNG outcomes",
        reason:
          "Weights and rule tables are extracted, but the actual public lobby result is randomized at runtime.",
        sources: [FILES.mapPlaylist],
      },
    ],
  };

  assert(
    Array.isArray(data.schema.enums.unitType) &&
      data.schema.enums.unitType.length >= 10,
    "UnitType extraction failed",
  );
  assert(data.units.Warship.maxHealth === 1000, "Warship extraction failed");
  assert(
    data.constants.thresholds.winCheckHardTimeLimitSeconds === 10200,
    "Hard time limit extraction failed",
  );

  return data;
}

function buildMarkdown(data) {
  const extractedCategories = [
    "schema fields and enum domains",
    "unit groups",
    "server cadence constants",
    "spawn-phase constants and fixed spawn rules",
    "fixed timers, ranges, thresholds, and traitor modifiers",
    "unit metadata and build-cost formulas from unitInfo()",
    "high-confidence formula metadata for economy, growth, combat, trade, and nukes",
    "public playlist rule tables and derived modifier mappings",
    "lobby-updateable config field surface",
  ];

  const deferred = data.deferredCategories.map((entry) => entry.category);
  const knownGaps = [
    "No TypeScript AST dependency is introduced yet; this first extractor stays dependency-free and targets a fixed, pinned source layout.",
    "Some formula dependencies are normalized by name instead of being exhaustively inferred from every symbol in the method body.",
    "Playlist outputs are represented as rule tables and weights, not sampled lobby instances.",
  ];

  return [
    "# Mechanics Diff",
    "",
    "## Extracted Categories",
    "",
    ...extractedCategories.map((entry) => `- ${entry}`),
    "",
    "## Deferred / Runtime-Only Categories",
    "",
    ...data.deferredCategories.map(
      (entry) => `- ${entry.category}: ${entry.reason}`,
    ),
    "",
    "## Known Gaps",
    "",
    ...knownGaps.map((entry) => `- ${entry}`),
    "",
    "## Notes",
    "",
    "- This snapshot is generated only from the pinned upstream source at commit `52033597efb09de6c8d724f6e2784c3c9e8a7511`.",
    "- Unsupported/runtime-only categories are deferred instead of being flattened into guessed constants.",
    `- Deferred categories in this snapshot: ${deferred.join(", ")}.`,
    "",
  ].join("\n");
}

function main() {
  const data = buildData();
  writeText(FILES.outJson, `${JSON.stringify(data, null, 2)}\n`);
  writeText(FILES.outDiff, buildMarkdown(data));
  console.log(
    `Generated ${FILES.outJson} and ${FILES.outDiff} for pinned commit ${data.pinnedCommit}`,
  );
}

main();
