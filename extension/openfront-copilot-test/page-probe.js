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

  function includesHint(value, hints) {
    const normalizedValue = String(value || "").toLowerCase();
    return hints.some((hint) => normalizedValue.includes(hint));
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

  function collectRuntimeStatus() {
    const availableGlobalNames = GLOBAL_NAMES.filter((name) =>
      typeof globalThis[name] !== "undefined"
    );
    const runtimeSource = availableGlobalNames[0] || null;
    const candidateGlobalKeys = collectCandidateGlobalKeys();
    const customElements = collectCustomElements();
    const canvasCount = document.querySelectorAll("canvas").length;
    const scriptSourceHints = collectScriptSourceHints();
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
        discovery
      },
      window.location.origin
    );
  }

  collectRuntimeStatus();
  window.setInterval(collectRuntimeStatus, POLL_INTERVAL_MS);
})();
