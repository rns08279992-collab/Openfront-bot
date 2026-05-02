(function () {
  const PROBE_MESSAGE_TYPE = "OPENFRONT_COPILOT_RUNTIME_STATUS";
  const POLL_INTERVAL_MS = 1000;
  const GLOBAL_NAMES = [
    "__OPENFRONT_BOT_RUNTIME__",
    "__OPENFRONT_RUNTIME__",
    "__OPENFRONT_CLIENT_GAME_RUNNER__",
    "currentGameRunner"
  ];

  function collectRuntimeStatus() {
    const availableGlobalNames = GLOBAL_NAMES.filter((name) =>
      typeof globalThis[name] !== "undefined"
    );
    const runtimeSource = availableGlobalNames[0] || null;

    window.postMessage(
      {
        type: PROBE_MESSAGE_TYPE,
        runtimeFound: runtimeSource !== null,
        runtimeSource,
        checkedAtIso: new Date().toISOString(),
        pageUrl: window.location.href,
        availableGlobalNames
      },
      window.location.origin
    );
  }

  collectRuntimeStatus();
  window.setInterval(collectRuntimeStatus, POLL_INTERVAL_MS);
})();
