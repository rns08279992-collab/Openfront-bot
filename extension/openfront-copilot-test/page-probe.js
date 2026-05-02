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
      playerCount: null,
      myPlayerFound: false,
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
        usablePair.playerCount = Array.isArray(playerViews) ? playerViews.length : null;
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

    return {
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
        domContext && typeof domContext.playerCount === "number"
          ? domContext.playerCount
          : null,
      myPlayerFound:
        domContext && domContext.contextFound ? domContext.myPlayerFound : false,
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
