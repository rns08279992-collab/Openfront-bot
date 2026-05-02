(function () {
  const PROBE_MESSAGE_TYPE = "OPENFRONT_COPILOT_RUNTIME_STATUS";
  const POLL_INTERVAL_MS = 1000;
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

  function buildContextSummary(callResults) {
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

    return {
      contextFound: Boolean(contextValue),
      contextKeys: limitKeys(contextValue, 50),
      gameConfigFound: Boolean(configValue),
      gameConfigKeys: limitKeys(configValue, 50),
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
    const contextSummary = buildContextSummary(safeCallResults);
    const blockedFunctions = functionInventory
      .filter((entry) => entry.blockedReason)
      .map((entry) => ({
        name: entry.name,
        reason: entry.blockedReason
      }));
    const pageState = {
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
