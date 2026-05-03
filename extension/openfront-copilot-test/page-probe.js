(function () {
  const PROBE_MESSAGE_TYPE = "OPENFRONT_COPILOT_RUNTIME_STATUS";
  const POLL_INTERVAL_MS = 1000;
  const DOM_SELECTORS_TO_SCAN = [
    "player-info-overlay",
    "player-panel",
    "emoji-table",
    "leader-board",
    "team-stats",
    "game-left-sidebar",
    "game-right-sidebar",
    "build-menu",
    "spawn-timer",
    "unit-display",
    "control-panel",
    "canvas",
    "map-display",
    "single-player-modal",
    "host-lobby-modal",
    "game-starting-modal",
    "game-info-modal"
  ];
  const DOM_PROPERTY_NAMES = [
    "game",
    "g",
    "transform",
    "transformHandler"
  ];
  const GLOBAL_NAMES = [
    "__OPENFRONT_BOT_RUNTIME__",
    "__OPENFRONT_RUNTIME__",
    "__OPENFRONT_CLIENT_GAME_RUNNER__",
    "currentGameRunner"
  ];
  const GLOBAL_KEY_HINTS = [
    "openfront",
    "game",
    "runner",
    "client",
    "lobby",
    "map",
    "player"
  ];
  const TAG_HINTS = ["game", "lobby", "map", "modal", "player", "canvas"];
  const SCRIPT_HINTS = ["openfront", "main", "client", "game", "index"];
  const CANDIDATE_FUNCTION_NAMES = [
    "getOpenFrontGameContext",
    "findOpenFrontGameContextInDom",
    "isUsableOpenFrontGameContext",
    "getGameConfig",
    "getAliveHumanPlayers",
    "getPlayerGoldNumber",
    "getPlayerDisplayName",
    "getPlayerRelationToMyPlayer",
    "isAllowedTradePartnerForMyPlayer",
    "ensureSelectiveTradePolicyPatchForPlayer",
    "rememberOpenFrontGameContext"
  ];
  const SAFE_CALL_ALLOWLIST = [
    "getOpenFrontGameContext",
    "findOpenFrontGameContextInDom",
    "getGameConfig",
    "getAliveHumanPlayers"
  ];
  const BLOCKED_NAME_PARTS = [
    "patch",
    "set",
    "update",
    "send",
    "click",
    "attack",
    "spawn",
    "alliance",
    "request",
    "mutate",
    "dispatch",
    "remember",
    "ensure"
  ];
  const SAMPLE_BUCKET_LIMIT = 5;
  const MAX_PLAYERS_SAMPLE_COUNT = 1 + SAMPLE_BUCKET_LIMIT * 4;

  function includesHint(value, hints) {
    const normalizedValue = String(value || "").toLowerCase();
    return hints.some((hint) => normalizedValue.includes(hint));
  }

  function limitKeys(value, maxKeys) {
    if (!value || typeof value !== "object") {
      return [];
    }

    try {
      return Object.keys(value).slice(0, maxKeys);
    } catch (error) {
      return [];
    }
  }

  function getTypeName(value) {
    if (value === null) {
      return "null";
    }

    if (Array.isArray(value)) {
      return "Array";
    }

    if (typeof value !== "object" && typeof value !== "function") {
      return typeof value;
    }

    const constructorName =
      value &&
      value.constructor &&
      typeof value.constructor.name === "string" &&
      value.constructor.name;
    return constructorName || typeof value;
  }

  function summarizeValue(value) {
    const summary = {
      typeName: getTypeName(value)
    };

    if (Array.isArray(value)) {
      summary.length = value.length;
      summary.itemTypeName = value.length > 0 ? getTypeName(value[0]) : null;
      summary.keySample =
        value.length > 0 && value[0] && typeof value[0] === "object"
          ? limitKeys(value[0], 20)
          : [];
      return summary;
    }

    if (value && typeof value === "object") {
      summary.keys = limitKeys(value, 50);
      return summary;
    }

    if (typeof value !== "function") {
      summary.value = value;
    }

    return summary;
  }

  function limitArray(values, maxItems) {
    return Array.isArray(values) ? values.slice(0, maxItems) : [];
  }

  function getElementId(element) {
    return typeof element.id === "string" ? element.id : "";
  }

  function getElementClassName(element) {
    const className = element.className;

    if (typeof className === "string") {
      return className;
    }

    if (className && typeof className.baseVal === "string") {
      return className.baseVal;
    }

    return "";
  }

  function getPrototypePropertyNames(value) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
      return [];
    }

    try {
      const prototype = Object.getPrototypeOf(value);
      return prototype ? Object.getOwnPropertyNames(prototype).slice(0, 50) : [];
    } catch (error) {
      return [];
    }
  }

  function hasProperty(value, name) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
      return false;
    }

    try {
      return name in value;
    } catch (error) {
      return false;
    }
  }

  function readProperty(value, name) {
    if (!hasProperty(value, name)) {
      return undefined;
    }

    try {
      return value[name];
    } catch (error) {
      return undefined;
    }
  }

  function summarizeGameCandidate(game) {
    if (!game || (typeof game !== "object" && typeof game !== "function")) {
      return null;
    }

    return {
      typeName: getTypeName(game),
      keys: limitKeys(game, 30),
      hasPlayerViews: typeof readProperty(game, "playerViews") === "function",
      hasMyPlayer: typeof readProperty(game, "myPlayer") === "function",
      hasTicks: typeof readProperty(game, "ticks") === "function",
      hasConfig: hasProperty(game, "config")
    };
  }

  function summarizeTransformCandidate(transform) {
    if (
      !transform ||
      (typeof transform !== "object" && typeof transform !== "function")
    ) {
      return null;
    }

    return {
      typeName: getTypeName(transform),
      keys: limitKeys(transform, 30),
      hasWorldToScreenCoordinates:
        typeof readProperty(transform, "worldToScreenCoordinates") === "function",
      hasScreenToWorldCoordinates:
        typeof readProperty(transform, "screenToWorldCoordinates") === "function"
    };
  }

  function safeZeroArgCall(value, name) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
      return undefined;
    }

    const propertyValue = readProperty(value, name);
    if (typeof propertyValue !== "function") {
      return undefined;
    }

    try {
      return propertyValue.call(value);
    } catch (error) {
      return undefined;
    }
  }

  function safeReadValue(value, name) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
      return undefined;
    }

    const propertyValue = readProperty(value, name);
    if (typeof propertyValue === "function") {
      return safeZeroArgCall(value, name);
    }

    return propertyValue;
  }

  function normalizePlayerType(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().toUpperCase();
  }

  function getPlayerIdentity(player) {
    return {
      id: safeZeroArgCall(player, "id"),
      smallID: safeZeroArgCall(player, "smallID")
    };
  }

  function isSamePlayer(player, myPlayer) {
    const playerIdentity = getPlayerIdentity(player);
    const myPlayerIdentity = getPlayerIdentity(myPlayer);

    return Boolean(
      (playerIdentity.id !== undefined &&
        myPlayerIdentity.id !== undefined &&
        playerIdentity.id === myPlayerIdentity.id) ||
        (playerIdentity.smallID !== undefined &&
          myPlayerIdentity.smallID !== undefined &&
          playerIdentity.smallID === myPlayerIdentity.smallID)
    );
  }

  function classifyPlayer(player, myPlayer) {
    if (!player || (typeof player !== "object" && typeof player !== "function")) {
      return "unknown";
    }

    if (myPlayer && isSamePlayer(player, myPlayer)) {
      return "me";
    }

    const rawType = normalizePlayerType(safeZeroArgCall(player, "type"));
    const rawDataType = normalizePlayerType(
      player &&
        player.data &&
        typeof player.data === "object" &&
        typeof player.data.playerType === "string"
        ? player.data.playerType
        : undefined
    );
    const combinedType = [rawType, rawDataType].filter(Boolean).join(" ");

    if (rawType === "NATION" || rawDataType === "NATION") {
      return "nation_bot";
    }

    if (
      combinedType.includes("BOT") ||
      combinedType.includes("AI")
    ) {
      return "bot";
    }

    if (safeZeroArgCall(player, "isBot") === true) {
      return "bot";
    }

    if (
      safeZeroArgCall(player, "isHuman") === true ||
      (safeZeroArgCall(player, "isPlayer") === true &&
        combinedType.indexOf("BOT") === -1 &&
        combinedType.indexOf("AI") === -1 &&
        rawType !== "NATION" &&
        rawDataType !== "NATION")
    ) {
      return "human";
    }

    return "unknown";
  }

  function buildPlayerSample(player, myPlayer) {
    return {
      classification: classifyPlayer(player, myPlayer),
      isAlive: safeZeroArgCall(player, "isAlive"),
      id: safeZeroArgCall(player, "id"),
      smallID: safeZeroArgCall(player, "smallID"),
      displayName: safeZeroArgCall(player, "displayName"),
      name: safeZeroArgCall(player, "name"),
      type: safeZeroArgCall(player, "type"),
      playerType:
        player &&
        player.data &&
        typeof player.data === "object" &&
        typeof player.data.playerType !== "undefined"
          ? player.data.playerType
          : undefined
    };
  }

  function buildMyPlayerDetails(myPlayer) {
    if (!myPlayer || (typeof myPlayer !== "object" && typeof myPlayer !== "function")) {
      return null;
    }

    return {
      id: safeReadValue(myPlayer, "id"),
      smallID: safeReadValue(myPlayer, "smallID"),
      displayName: safeReadValue(myPlayer, "displayName"),
      name: safeReadValue(myPlayer, "name"),
      gold: safeReadValue(myPlayer, "gold"),
      troops: safeReadValue(myPlayer, "troops"),
      maxTroops: safeReadValue(myPlayer, "maxTroops"),
      numTilesOwned: safeReadValue(myPlayer, "numTilesOwned"),
      isAlive: safeReadValue(myPlayer, "isAlive")
    };
  }

  function coerceFiniteNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim().replace(/,/g, "");
    if (!normalized) {
      return null;
    }

    const match = normalized.match(/^([+-]?\d+(?:\.\d+)?)([kKmMbB])?$/);
    if (!match) {
      return null;
    }

    const base = Number(match[1]);
    if (!Number.isFinite(base)) {
      return null;
    }

    const suffix = match[2] ? match[2].toUpperCase() : "";
    const multiplier =
      suffix === "K" ? 1e3 : suffix === "M" ? 1e6 : suffix === "B" ? 1e9 : 1;
    const coerced = base * multiplier;
    return Number.isFinite(coerced) ? coerced : null;
  }

  function buildReadOnlyControlPanelStats() {
    const stats = {
      found: false,
      troopsRaw: null,
      maxTroopsRaw: null,
      goldRaw: null,
      troopsDisplay: null,
      maxTroopsDisplay: null,
      goldDisplay: null,
      troopRate: null,
      attackRatio: null,
      attackingTroops: null,
      errors: []
    };
    const controlPanel = document.querySelector("control-panel");

    if (!controlPanel) {
      return stats;
    }

    stats.found = true;

    const reads = [
      { sourceName: "_troops", targetName: "troopsRaw" },
      { sourceName: "_maxTroops", targetName: "maxTroopsRaw" },
      { sourceName: "_gold", targetName: "goldRaw" },
      { sourceName: "troopRate", targetName: "troopRate" },
      { sourceName: "attackRatio", targetName: "attackRatio" },
      { sourceName: "_attackingTroops", targetName: "attackingTroops" }
    ];

    for (const { sourceName, targetName } of reads) {
      try {
        stats[targetName] = coerceFiniteNumber(controlPanel[sourceName]);
      } catch (error) {
        stats.errors.push({
          name: sourceName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    stats.troopsDisplay = Number.isFinite(stats.troopsRaw) ? stats.troopsRaw / 10 : null;
    stats.maxTroopsDisplay = Number.isFinite(stats.maxTroopsRaw)
      ? stats.maxTroopsRaw / 10
      : null;
    stats.goldDisplay = Number.isFinite(stats.goldRaw) ? stats.goldRaw : null;

    return stats;
  }

  function buildReadOnlyThreatSummary(snapshot) {
    const myPlayer = snapshot && snapshot.myPlayer ? snapshot.myPlayer : null;
    const controlPanelStats =
      snapshot && snapshot.controlPanelStats ? snapshot.controlPanelStats : null;
    const humanOpponentCount =
      snapshot && typeof snapshot.humanOpponentCount === "number"
        ? snapshot.humanOpponentCount
        : null;
    const botPlayerCount =
      snapshot && typeof snapshot.botPlayerCount === "number"
        ? snapshot.botPlayerCount
        : null;
    const myPlayerTroops = myPlayer ? coerceFiniteNumber(myPlayer.troops) : null;
    const myPlayerMaxTroops = myPlayer ? coerceFiniteNumber(myPlayer.maxTroops) : null;
    const fallbackTroops =
      controlPanelStats && controlPanelStats.found
        ? coerceFiniteNumber(controlPanelStats.troopsRaw)
        : null;
    const fallbackMaxTroops =
      controlPanelStats && controlPanelStats.found
        ? coerceFiniteNumber(controlPanelStats.maxTroopsRaw)
        : null;
    const troops = Number.isFinite(myPlayerTroops) ? myPlayerTroops : fallbackTroops;
    const maxTroops = Number.isFinite(myPlayerMaxTroops)
      ? myPlayerMaxTroops
      : fallbackMaxTroops;
    const hasFiniteTroops = Number.isFinite(troops);
    const hasFiniteMaxTroops = Number.isFinite(maxTroops);
    const usingFallback =
      (hasFiniteTroops && troops === fallbackTroops && troops !== myPlayerTroops) ||
      (hasFiniteMaxTroops &&
        maxTroops === fallbackMaxTroops &&
        maxTroops !== myPlayerMaxTroops);
    const statsSource = usingFallback ? "control-panel fallback" : "myPlayer";
    const reasons = [];
    const suggestions = [];

    if (!myPlayer && !usingFallback) {
      reasons.push("my player data unavailable");
    }

    if (!hasFiniteTroops) {
      reasons.push("troops unavailable");
    }

    if (!hasFiniteMaxTroops) {
      reasons.push("max troops unavailable");
    }

    if (!hasFiniteTroops || !hasFiniteMaxTroops) {
      if (humanOpponentCount > 0) {
        suggestions.push("monitor human opponents");
      }
      if (humanOpponentCount === 0 && botPlayerCount > 0) {
        suggestions.push("bot-only match: economy focus");
      }

      return {
        status: "unknown",
        urgency: "unknown",
        statsSource,
        reasons,
        suggestions
      };
    }

    const troopRatio = maxTroops > 0 ? troops / maxTroops : null;
    const hasTroopRatio = typeof troopRatio === "number" && Number.isFinite(troopRatio);
    const lowTroops = hasTroopRatio && troopRatio < 0.45;
    const veryLowTroops = hasTroopRatio && troopRatio < 0.25;
    const hasHumanOpponents = humanOpponentCount > 0;

    if (usingFallback) {
      reasons.push("troops from control-panel fallback");
    }

    if (veryLowTroops) {
      reasons.push(`low troop ratio (${troops}/${maxTroops})`);
    } else if (lowTroops) {
      reasons.push(`watch troop ratio (${troops}/${maxTroops})`);
    }

    if (hasHumanOpponents) {
      reasons.push(`human opponents present (${humanOpponentCount})`);
    }

    if (!lowTroops && !hasHumanOpponents) {
      reasons.push("troops stable and no human opponents");
    }

    if (lowTroops) {
      suggestions.push("grow before fighting");
    }
    if (hasHumanOpponents) {
      suggestions.push("monitor human opponents");
    }
    if (humanOpponentCount === 0 && botPlayerCount > 0) {
      suggestions.push("bot-only match: economy focus");
    }

    if (veryLowTroops) {
      return {
        status: "danger",
        urgency: "high",
        troopCapacityRatio: troopRatio,
        statsSource,
        reasons,
        suggestions
      };
    }

    if (lowTroops || hasHumanOpponents) {
      return {
        status: "watch",
        urgency: "medium",
        troopCapacityRatio: troopRatio,
        statsSource,
        reasons,
        suggestions
      };
    }

    return {
      status: "safe",
      urgency: "low",
      troopCapacityRatio: troopRatio,
      statsSource,
      reasons,
      suggestions
    };
  }

  function addPlayerSampleToBucket(buckets, classification, player, myPlayer) {
    const bucket = buckets[classification];
    if (!bucket || bucket.length >= SAMPLE_BUCKET_LIMIT) {
      return;
    }

    bucket.push(buildPlayerSample(player, myPlayer));
  }

  function summarizePlayers(playerViews, myPlayer) {
    const summary = {
      totalPlayerViews: Array.isArray(playerViews) ? playerViews.length : 0,
      aliveTotal: 0,
      meFound: false,
      myPlayerFound: false,
      humanOpponentCount: 0,
      aliveHumanOpponentCount: 0,
      humanTotalIncludingMe: 0,
      aliveHumanTotalIncludingMe: 0,
      humanPlayerCount: 0,
      aliveHumanPlayerCount: 0,
      botPlayerCount: 0,
      aliveBotPlayerCount: 0,
      nationBotCount: 0,
      aliveNationBotCount: 0,
      unknownPlayerCount: 0,
      playersSample: [],
      myPlayer: buildMyPlayerDetails(myPlayer)
    };

    if (!Array.isArray(playerViews)) {
      return summary;
    }

    const sampleBuckets = {
      human: [],
      bot: [],
      nation_bot: [],
      unknown: []
    };

    for (const player of playerViews) {
      const classification = classifyPlayer(player, myPlayer);
      const isAlive = safeZeroArgCall(player, "isAlive") === true;

      if (isAlive) {
        summary.aliveTotal += 1;
      }

      if (classification === "me") {
        summary.meFound = true;
        summary.myPlayerFound = true;
        summary.humanTotalIncludingMe += 1;
        if (isAlive) {
          summary.aliveHumanTotalIncludingMe += 1;
        }
      } else if (classification === "human") {
        summary.humanOpponentCount += 1;
        summary.humanTotalIncludingMe += 1;
        summary.humanPlayerCount += 1;
        if (isAlive) {
          summary.aliveHumanOpponentCount += 1;
          summary.aliveHumanTotalIncludingMe += 1;
          summary.aliveHumanPlayerCount += 1;
        }
        addPlayerSampleToBucket(sampleBuckets, "human", player, myPlayer);
      } else if (classification === "bot") {
        summary.botPlayerCount += 1;
        if (isAlive) {
          summary.aliveBotPlayerCount += 1;
        }
        addPlayerSampleToBucket(sampleBuckets, "bot", player, myPlayer);
      } else if (classification === "nation_bot") {
        summary.nationBotCount += 1;
        if (isAlive) {
          summary.aliveNationBotCount += 1;
        }
        addPlayerSampleToBucket(sampleBuckets, "nation_bot", player, myPlayer);
      } else {
        summary.unknownPlayerCount += 1;
        addPlayerSampleToBucket(sampleBuckets, "unknown", player, myPlayer);
      }
    }

    summary.playersSample = [];

    if (summary.meFound) {
      summary.playersSample.push(buildPlayerSample(myPlayer, myPlayer));
    }

    summary.playersSample = summary.playersSample
      .concat(sampleBuckets.human)
      .concat(sampleBuckets.bot)
      .concat(sampleBuckets.nation_bot)
      .concat(sampleBuckets.unknown)
      .slice(0, MAX_PLAYERS_SAMPLE_COUNT);

    return summary;
  }

  function selectPreferredProperty(element, propertyNames) {
    for (const name of propertyNames) {
      if (hasProperty(element, name)) {
        return {
          name,
          value: readProperty(element, name)
        };
      }
    }

    return null;
  }

  function buildElementProbeEntry(element, scanReason) {
    const ownPropertyNames = (() => {
      try {
        return Object.getOwnPropertyNames(element).slice(0, 50);
      } catch (error) {
        return [];
      }
    })();
    const prototypePropertyNames = getPrototypePropertyNames(element);
    const selectedGameProperty = selectPreferredProperty(element, ["game", "g"]);
    const selectedTransformProperty = selectPreferredProperty(element, [
      "transform",
      "transformHandler"
    ]);

    return {
      scanReason,
      tagName: String(element.tagName || "").toLowerCase(),
      id: getElementId(element),
      className: getElementClassName(element),
      ownPropertyNames,
      prototypePropertyNames,
      hasGameProperty: hasProperty(element, "game"),
      hasGProperty: hasProperty(element, "g"),
      hasTransformProperty: hasProperty(element, "transform"),
      hasTransformHandlerProperty: hasProperty(element, "transformHandler"),
      gameSummary: selectedGameProperty
        ? summarizeGameCandidate(selectedGameProperty.value)
        : null,
      transformSummary: selectedTransformProperty
        ? summarizeTransformCandidate(selectedTransformProperty.value)
        : null,
      gameSourceProperty: selectedGameProperty ? selectedGameProperty.name : null,
      transformSourceProperty: selectedTransformProperty
        ? selectedTransformProperty.name
        : null
    };
  }

  function collectDomProbe() {
    const candidateElements = [];
    const seenElements = new Set();

    for (const selector of DOM_SELECTORS_TO_SCAN) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (seenElements.has(element)) {
          continue;
        }

        seenElements.add(element);
        candidateElements.push({
          element,
          scanReason: `selector:${selector}`
        });
      }
    }

    const allElements = document.querySelectorAll("*");
    for (const element of allElements) {
      if (
        !DOM_PROPERTY_NAMES.some((name) => hasProperty(element, name)) ||
        seenElements.has(element)
      ) {
        continue;
      }

      seenElements.add(element);
      candidateElements.push({
        element,
        scanReason: "property-scan"
      });
    }

    const elements = candidateElements.map(({ element, scanReason }) =>
      buildElementProbeEntry(element, scanReason)
    );
    const usablePair = {
      contextFound: false,
      sourceElementTag: null,
      gameSourceProperty: null,
      transformSourceProperty: null,
      totalPlayerViews: null,
      aliveTotal: null,
      meFound: false,
      myPlayerFound: false,
      humanOpponentCount: null,
      aliveHumanOpponentCount: null,
      humanTotalIncludingMe: null,
      aliveHumanTotalIncludingMe: null,
      humanPlayerCount: null,
      aliveHumanPlayerCount: null,
      botPlayerCount: null,
      aliveBotPlayerCount: null,
      nationBotCount: null,
      aliveNationBotCount: null,
      unknownPlayerCount: null,
      playersSample: [],
      myPlayer: null,
      currentTick: null,
      errors: []
    };

    for (const candidate of candidateElements) {
      const gameCandidate = selectPreferredProperty(candidate.element, ["game", "g"]);
      const transformCandidate = selectPreferredProperty(candidate.element, [
        "transform",
        "transformHandler"
      ]);
      const game = gameCandidate ? gameCandidate.value : null;
      const transform = transformCandidate ? transformCandidate.value : null;
      const hasUsableGame =
        game && typeof readProperty(game, "playerViews") === "function";
      const hasUsableTransform =
        transform &&
        typeof readProperty(transform, "worldToScreenCoordinates") === "function";

      if (!hasUsableGame || !hasUsableTransform) {
        continue;
      }

      usablePair.contextFound = true;
      usablePair.sourceElementTag = String(candidate.element.tagName || "").toLowerCase();
      usablePair.gameSourceProperty = gameCandidate ? gameCandidate.name : null;
      usablePair.transformSourceProperty = transformCandidate
        ? transformCandidate.name
        : null;

      try {
        const playerViews = game.playerViews();
        const myPlayer = game.myPlayer ? game.myPlayer() : null;
        const playerSummary = summarizePlayers(playerViews, myPlayer);
        usablePair.totalPlayerViews = playerSummary.totalPlayerViews;
        usablePair.aliveTotal = playerSummary.aliveTotal;
        usablePair.meFound = playerSummary.meFound;
        usablePair.myPlayerFound = playerSummary.myPlayerFound;
        usablePair.humanOpponentCount = playerSummary.humanOpponentCount;
        usablePair.aliveHumanOpponentCount = playerSummary.aliveHumanOpponentCount;
        usablePair.humanTotalIncludingMe = playerSummary.humanTotalIncludingMe;
        usablePair.aliveHumanTotalIncludingMe =
          playerSummary.aliveHumanTotalIncludingMe;
        usablePair.humanPlayerCount = playerSummary.humanPlayerCount;
        usablePair.aliveHumanPlayerCount = playerSummary.aliveHumanPlayerCount;
        usablePair.botPlayerCount = playerSummary.botPlayerCount;
        usablePair.aliveBotPlayerCount = playerSummary.aliveBotPlayerCount;
        usablePair.nationBotCount = playerSummary.nationBotCount;
        usablePair.aliveNationBotCount = playerSummary.aliveNationBotCount;
        usablePair.unknownPlayerCount = playerSummary.unknownPlayerCount;
        usablePair.playersSample = playerSummary.playersSample;
        usablePair.myPlayer = playerSummary.myPlayer;
      } catch (error) {
        usablePair.errors.push({
          name: "playerViews",
          error: error instanceof Error ? error.message : String(error)
        });
      }

      try {
        usablePair.myPlayerFound = Boolean(game.myPlayer && game.myPlayer());
      } catch (error) {
        usablePair.errors.push({
          name: "myPlayer",
          error: error instanceof Error ? error.message : String(error)
        });
      }

      try {
        usablePair.currentTick = game.ticks ? game.ticks() : null;
      } catch (error) {
        usablePair.errors.push({
          name: "ticks",
          error: error instanceof Error ? error.message : String(error)
        });
      }

      break;
    }

    return {
      selectorsScanned: DOM_SELECTORS_TO_SCAN,
      propertyNamesScanned: DOM_PROPERTY_NAMES,
      candidateCount: elements.length,
      elements,
      usablePair
    };
  }

  function collectCandidateGlobalKeys() {
    return Object.keys(globalThis)
      .filter((key) => includesHint(key, GLOBAL_KEY_HINTS))
      .slice(0, 30);
  }

  function collectCustomElements() {
    const uniqueTagNames = new Set();
    const elements = document.querySelectorAll("*");

    for (const element of elements) {
      const tagName = String(element.tagName || "").toLowerCase();
      if (tagName && includesHint(tagName, TAG_HINTS)) {
        uniqueTagNames.add(tagName);
        if (uniqueTagNames.size >= 30) {
          break;
        }
      }
    }

    return Array.from(uniqueTagNames);
  }

  function collectScriptSourceHints() {
    return Array.from(document.scripts)
      .map((script) => script.src || "")
      .filter((src) => src && includesHint(src, SCRIPT_HINTS))
      .slice(0, 20);
  }

  function getBlockedReason(name) {
    const normalizedName = String(name || "").toLowerCase();
    const blockedPart = BLOCKED_NAME_PARTS.find((part) =>
      normalizedName.includes(part)
    );
    return blockedPart ? `blocked:name_contains:${blockedPart}` : null;
  }

  function getFunctionInventory() {
    return CANDIDATE_FUNCTION_NAMES.map((name) => {
      const value = globalThis[name];
      const typeofValue = typeof value;
      const entry = {
        name,
        typeof: typeofValue
      };

      if (typeofValue === "function") {
        entry.length = value.length;
        try {
          entry.sourcePreview = Function.prototype.toString
            .call(value)
            .slice(0, 300);
        } catch (error) {
          entry.sourcePreview = `[toString failed: ${error.message}]`;
        }
      } else {
        entry.length = null;
        entry.sourcePreview = null;
      }

      const blockedReason = getBlockedReason(name);
      if (blockedReason) {
        entry.blockedReason = blockedReason;
      }

      return entry;
    });
  }

  function safeCallFunction(name) {
    const value = globalThis[name];
    const blockedReason = getBlockedReason(name);

    if (!SAFE_CALL_ALLOWLIST.includes(name)) {
      return {
        name,
        called: false,
        error: "not_allowlisted"
      };
    }

    if (blockedReason) {
      return {
        name,
        called: false,
        error: blockedReason
      };
    }

    if (typeof value !== "function") {
      return {
        name,
        called: false,
        error: `not_callable:${typeof value}`
      };
    }

    if (value.length !== 0) {
      return {
        name,
        called: false,
        error: `requires_arguments:length_${value.length}`
      };
    }

    try {
      return {
        name,
        called: true,
        result: value()
      };
    } catch (error) {
      return {
        name,
        called: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  function buildContextSummary(callResults, domProbe) {
    const resultMap = {};

    for (const result of callResults) {
      resultMap[result.name] = result;
    }

    const contextResult = resultMap.getOpenFrontGameContext &&
      resultMap.getOpenFrontGameContext.called
      ? resultMap.getOpenFrontGameContext
      : resultMap.findOpenFrontGameContextInDom &&
          resultMap.findOpenFrontGameContextInDom.called
        ? resultMap.findOpenFrontGameContextInDom
        : null;
    const configResult = resultMap.getGameConfig;
    const playersResult = resultMap.getAliveHumanPlayers;
    const contextValue = contextResult && contextResult.called ? contextResult.result : null;
    const configValue = configResult && configResult.called ? configResult.result : null;
    const playersValue = playersResult && playersResult.called ? playersResult.result : null;
    const domContext = domProbe && domProbe.usablePair ? domProbe.usablePair : null;
    const controlPanelStats = buildReadOnlyControlPanelStats();

    const contextSummary = {
      contextFound: Boolean((domContext && domContext.contextFound) || contextValue),
      contextKeys: limitKeys(contextValue, 50),
      gameConfigFound: Boolean(configValue),
      gameConfigKeys: limitKeys(configValue, 50),
      sourceElementTag:
        domContext && domContext.contextFound ? domContext.sourceElementTag : null,
      gameSourceProperty:
        domContext && domContext.contextFound ? domContext.gameSourceProperty : null,
      transformSourceProperty:
        domContext && domContext.contextFound
          ? domContext.transformSourceProperty
          : null,
      playerCount:
        domContext && typeof domContext.totalPlayerViews === "number"
          ? domContext.totalPlayerViews
          : null,
      totalPlayerViews:
        domContext && typeof domContext.totalPlayerViews === "number"
          ? domContext.totalPlayerViews
          : null,
      aliveTotal:
        domContext && typeof domContext.aliveTotal === "number"
          ? domContext.aliveTotal
          : null,
      myPlayerFound:
        domContext && domContext.contextFound ? domContext.myPlayerFound : false,
      meFound: domContext && domContext.contextFound ? domContext.meFound : false,
      humanOpponentCount:
        domContext && typeof domContext.humanOpponentCount === "number"
          ? domContext.humanOpponentCount
          : null,
      aliveHumanOpponentCount:
        domContext && typeof domContext.aliveHumanOpponentCount === "number"
          ? domContext.aliveHumanOpponentCount
          : null,
      humanTotalIncludingMe:
        domContext && typeof domContext.humanTotalIncludingMe === "number"
          ? domContext.humanTotalIncludingMe
          : null,
      aliveHumanTotalIncludingMe:
        domContext && typeof domContext.aliveHumanTotalIncludingMe === "number"
          ? domContext.aliveHumanTotalIncludingMe
          : null,
      humanPlayerCount:
        domContext && typeof domContext.humanPlayerCount === "number"
          ? domContext.humanPlayerCount
          : null,
      aliveHumanPlayerCount:
        domContext && typeof domContext.aliveHumanPlayerCount === "number"
          ? domContext.aliveHumanPlayerCount
          : null,
      botPlayerCount:
        domContext && typeof domContext.botPlayerCount === "number"
          ? domContext.botPlayerCount
          : null,
      aliveBotPlayerCount:
        domContext && typeof domContext.aliveBotPlayerCount === "number"
          ? domContext.aliveBotPlayerCount
          : null,
      nationBotCount:
        domContext && typeof domContext.nationBotCount === "number"
          ? domContext.nationBotCount
          : null,
      aliveNationBotCount:
        domContext && typeof domContext.aliveNationBotCount === "number"
          ? domContext.aliveNationBotCount
          : null,
      unknownPlayerCount:
        domContext && typeof domContext.unknownPlayerCount === "number"
          ? domContext.unknownPlayerCount
          : null,
      playersSample: domContext
        ? limitArray(domContext.playersSample, MAX_PLAYERS_SAMPLE_COUNT)
        : [],
      myPlayer: domContext ? domContext.myPlayer : null,
      controlPanelStats,
      currentTick:
        domContext && domContext.contextFound ? domContext.currentTick : null,
      aliveHumanPlayersCount: Array.isArray(playersValue) ? playersValue.length : null,
      aliveHumanPlayerKeySample:
        Array.isArray(playersValue) &&
        playersValue.length > 0 &&
        playersValue[0] &&
        typeof playersValue[0] === "object"
          ? limitKeys(playersValue[0], 20)
          : [],
      typeNames: {
        context: getTypeName(contextValue),
        gameConfig: getTypeName(configValue),
        aliveHumanPlayers: getTypeName(playersValue)
      },
      valueSummaries: {
        context: summarizeValue(contextValue),
        gameConfig: summarizeValue(configValue),
        aliveHumanPlayers: summarizeValue(playersValue)
      },
      errors: callResults
        .filter((result) => result.error)
        .map((result) => ({
          name: result.name,
          error: result.error
        }))
        .concat(limitArray(domContext ? domContext.errors : [], 20))
    };

    contextSummary.threatSummary = buildReadOnlyThreatSummary(contextSummary);

    return contextSummary;
  }

  function collectRuntimeStatus() {
    const availableGlobalNames = GLOBAL_NAMES.filter((name) =>
      typeof globalThis[name] !== "undefined"
    );
    const runtimeSource = availableGlobalNames[0] || null;
    const candidateGlobalKeys = collectCandidateGlobalKeys();
    const customElements = collectCustomElements();
    const canvasCount = document.querySelectorAll("canvas").length;
    const scriptSourceHints = collectScriptSourceHints();
    const functionInventory = getFunctionInventory();
    const safeCallResults = SAFE_CALL_ALLOWLIST.map(safeCallFunction);
    const domProbe = collectDomProbe();
    const contextSummary = buildContextSummary(safeCallResults, domProbe);
    const blockedFunctions = functionInventory
      .filter((entry) => entry.blockedReason)
      .map((entry) => ({
        name: entry.name,
        reason: entry.blockedReason
      }));
    const pageState = {
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      title: document.title,
      bodyChildCount: document.body ? document.body.children.length : 0
    };
    const discovery = {
      runtimeFound: runtimeSource !== null,
      runtimeSource,
      knownRuntimeGlobals: GLOBAL_NAMES,
      availableGlobalNames,
      candidateGlobalKeys,
      customElements,
      canvasCount,
      scriptSourceHints,
      functionInventory,
      safeCallAllowlist: SAFE_CALL_ALLOWLIST,
      safeCallResults: safeCallResults.map((result) => ({
        name: result.name,
        called: result.called,
        error: result.error || null,
        resultSummary: result.called ? summarizeValue(result.result) : null
      })),
      blockedFunctions,
      domProbe,
      pageState
    };

    window.postMessage(
      {
        type: PROBE_MESSAGE_TYPE,
        runtimeFound: discovery.runtimeFound,
        runtimeSource: discovery.runtimeSource,
        checkedAtIso: new Date().toISOString(),
        pageUrl: window.location.href,
        availableGlobalNames,
        discovery,
        contextSummary
      },
      window.location.origin
    );
  }

  collectRuntimeStatus();
  window.setInterval(collectRuntimeStatus, POLL_INTERVAL_MS);
})();
