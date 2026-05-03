(function () {
  const OVERLAY_ID = "openfront-copilot-test-overlay";
  const PROBE_MESSAGE_TYPE = "OPENFRONT_COPILOT_RUNTIME_STATUS";
  const PROBE_SCRIPT_ID = "openfront-copilot-test-page-probe";

  function isOpenFrontHost(hostname) {
    return hostname === "openfront.io" || hostname.endsWith(".openfront.io");
  }

  function isLocalDevHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  function readLocalhostOverride() {
    if (!isLocalDevHost(window.location.hostname)) {
      return false;
    }

    try {
      return window.localStorage.getItem("openfront-copilot-enabled") === "1";
    } catch (error) {
      return false;
    }
  }

  const state = {
    activationHost: window.location.hostname,
    activationKind: isOpenFrontHost(window.location.hostname)
      ? "openfront"
      : isLocalDevHost(window.location.hostname)
        ? "localhost-dev"
        : "unsupported",
    localhostOverrideEnabled: readLocalhostOverride(),
    bridgeLoaded: false,
    runtimeFound: false,
    runtimeSource: null,
    latestDiscovery: null,
    latestContextSummary: null
  };

  function formatCountPair(aliveCount, totalCount) {
    return typeof aliveCount === "number" && typeof totalCount === "number"
      ? `${aliveCount}/${totalCount}`
      : "unknown";
  }

  function getMyPlayerLabel(contextSummary) {
    if (!contextSummary || !contextSummary.myPlayer) {
      return "unknown";
    }

    const myPlayer = contextSummary.myPlayer;
    return myPlayer.displayName ||
      myPlayer.name ||
      (typeof myPlayer.smallID !== "undefined" ? String(myPlayer.smallID) : "") ||
      (typeof myPlayer.id !== "undefined" ? String(myPlayer.id) : "") ||
      "unknown";
  }

  function getOverlayLines() {
    const discovery = state.latestDiscovery;
    const contextSummary = state.latestContextSummary;
    const pageState = discovery ? discovery.pageState || {} : {};
    const totalPlayerViews =
      contextSummary && typeof contextSummary.totalPlayerViews === "number"
        ? String(contextSummary.totalPlayerViews)
        : contextSummary && typeof contextSummary.playerCount === "number"
          ? String(contextSummary.playerCount)
          : "unknown";
    const humansLine = formatCountPair(
      contextSummary ? contextSummary.aliveHumanTotalIncludingMe : null,
      contextSummary ? contextSummary.humanTotalIncludingMe : null
    );
    const humanOpponentsLine = formatCountPair(
      contextSummary ? contextSummary.aliveHumanOpponentCount : null,
      contextSummary ? contextSummary.humanOpponentCount : null
    );
    const botsLine = formatCountPair(
      contextSummary ? contextSummary.aliveBotPlayerCount : null,
      contextSummary ? contextSummary.botPlayerCount : null
    );
    const nationBotsLine = formatCountPair(
      contextSummary ? contextSummary.aliveNationBotCount : null,
      contextSummary ? contextSummary.nationBotCount : null
    );
    const unknownCount =
      contextSummary && typeof contextSummary.unknownPlayerCount === "number"
        ? String(contextSummary.unknownPlayerCount)
        : "unknown";
    const myPlayerLabel = getMyPlayerLabel(contextSummary);

    return [
      "extension loaded",
      state.bridgeLoaded ? "page bridge loaded" : "page bridge loading",
      `runtime: ${state.runtimeFound ? "found" : "not found"}`,
      `context: ${
        contextSummary && contextSummary.contextFound ? "found" : "not found"
      }`,
      `me: ${myPlayerLabel}`,
      `players: ${totalPlayerViews}`,
      `humans: ${humansLine}`,
      `human opponents: ${humanOpponentsLine}`,
      `bots: ${botsLine}`,
      `nations: ${nationBotsLine}`,
      `unknown: ${unknownCount}`,
      `config: ${
        contextSummary && contextSummary.gameConfigFound ? "found" : "not found"
      }`,
      `canvas: ${discovery ? discovery.canvasCount : 0}`,
      `path: ${pageState.pathname || window.location.pathname}`,
      `host: ${state.activationHost}`,
      `runtime source: ${state.runtimeSource || "none"}`,
      "mode: read-only",
      "no actions enabled"
    ];
  }

  function getDiscoveryJson() {
    return JSON.stringify(
      state.latestDiscovery || {
        runtimeFound: state.runtimeFound,
        runtimeSource: state.runtimeSource
      },
      null,
      2
    );
  }

  function copyDiscoveryJson(button) {
    const discoveryJson = getDiscoveryJson();
    copyJsonText(button, discoveryJson, "copy discovery JSON");
  }

  function getContextJson() {
    return JSON.stringify(state.latestContextSummary || {}, null, 2);
  }

  function copyContextJson(button) {
    const contextJson = getContextJson();
    copyJsonText(button, contextJson, "copy context JSON");
  }

  function getDomProbeJson() {
    const domProbe =
      state.latestDiscovery && state.latestDiscovery.domProbe
        ? state.latestDiscovery.domProbe
        : {};
    return JSON.stringify(domProbe, null, 2);
  }

  function copyDomProbeJson(button) {
    const domProbeJson = getDomProbeJson();
    copyJsonText(button, domProbeJson, "copy DOM probe JSON");
  }

  function copyJsonText(button, text, idleLabel) {
    const onSuccess = function () {
      button.textContent = "copied";
      window.setTimeout(() => {
        button.textContent = idleLabel;
      }, 1200);
    };
    const onFailure = function () {
      button.textContent = "copy failed";
      window.setTimeout(() => {
        button.textContent = idleLabel;
      }, 1200);
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(onSuccess).catch(onFailure);
      return;
    }

    onFailure();
  }

  function ensureOverlay() {
    if (!document.body) {
      return null;
    }

    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.style.position = "fixed";
      overlay.style.top = "12px";
      overlay.style.right = "12px";
      overlay.style.zIndex = "2147483647";
      overlay.style.padding = "10px 12px";
      overlay.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      overlay.style.borderRadius = "8px";
      overlay.style.background = "rgba(15, 23, 42, 0.92)";
      overlay.style.color = "#f8fafc";
      overlay.style.font = '12px/1.4 ui-monospace, "SFMono-Regular", Consolas, monospace';
      overlay.style.boxShadow = "0 8px 24px rgba(15, 23, 42, 0.35)";
      overlay.style.pointerEvents = "auto";
      overlay.style.minWidth = "220px";
      document.body.appendChild(overlay);

      const title = document.createElement("div");
      title.textContent = "OpenFront Copilot Test";
      title.style.fontWeight = "600";
      title.style.marginBottom = "6px";
      overlay.appendChild(title);

      const lines = document.createElement("pre");
      lines.setAttribute("data-role", "lines");
      lines.style.margin = "0";
      lines.style.whiteSpace = "pre-wrap";
      lines.style.userSelect = "text";
      overlay.appendChild(lines);

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.textContent = "copy discovery JSON";
      copyButton.style.marginTop = "8px";
      copyButton.style.padding = "0";
      copyButton.style.border = "0";
      copyButton.style.background = "transparent";
      copyButton.style.color = "#93c5fd";
      copyButton.style.cursor = "pointer";
      copyButton.style.font = "inherit";
      copyButton.style.textDecoration = "underline";
      copyButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyDiscoveryJson(copyButton);
      });
      overlay.appendChild(copyButton);

      const copyContextButton = document.createElement("button");
      copyContextButton.type = "button";
      copyContextButton.textContent = "copy context JSON";
      copyContextButton.style.display = "block";
      copyContextButton.style.marginTop = "6px";
      copyContextButton.style.padding = "0";
      copyContextButton.style.border = "0";
      copyContextButton.style.background = "transparent";
      copyContextButton.style.color = "#93c5fd";
      copyContextButton.style.cursor = "pointer";
      copyContextButton.style.font = "inherit";
      copyContextButton.style.textDecoration = "underline";
      copyContextButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyContextJson(copyContextButton);
      });
      overlay.appendChild(copyContextButton);

      const copyDomProbeButton = document.createElement("button");
      copyDomProbeButton.type = "button";
      copyDomProbeButton.textContent = "copy DOM probe JSON";
      copyDomProbeButton.style.display = "block";
      copyDomProbeButton.style.marginTop = "6px";
      copyDomProbeButton.style.padding = "0";
      copyDomProbeButton.style.border = "0";
      copyDomProbeButton.style.background = "transparent";
      copyDomProbeButton.style.color = "#93c5fd";
      copyDomProbeButton.style.cursor = "pointer";
      copyDomProbeButton.style.font = "inherit";
      copyDomProbeButton.style.textDecoration = "underline";
      copyDomProbeButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyDomProbeJson(copyDomProbeButton);
      });
      overlay.appendChild(copyDomProbeButton);
    }

    const lines = overlay.querySelector('[data-role="lines"]');
    if (lines) {
      lines.textContent = getOverlayLines().join("\n");
    }

    return overlay;
  }

  function renderOverlay() {
    if (ensureOverlay()) {
      return;
    }

    window.addEventListener(
      "DOMContentLoaded",
      function handleReady() {
        window.removeEventListener("DOMContentLoaded", handleReady);
        ensureOverlay();
      },
      { once: true }
    );
  }

  function injectPageProbe() {
    if (document.getElementById(PROBE_SCRIPT_ID)) {
      state.bridgeLoaded = true;
      renderOverlay();
      return;
    }

    const script = document.createElement("script");
    script.id = PROBE_SCRIPT_ID;
    script.src = chrome.runtime.getURL("page-probe.js");
    script.async = false;
    script.onload = function () {
      state.bridgeLoaded = true;
      renderOverlay();
      script.remove();
    };
    script.onerror = function () {
      renderOverlay();
      script.remove();
    };

    (document.head || document.documentElement).appendChild(script);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.type !== PROBE_MESSAGE_TYPE) {
      return;
    }

    state.runtimeFound = Boolean(data.runtimeFound);
    state.runtimeSource = data.runtimeSource || null;
    state.latestDiscovery = data.discovery || null;
    state.latestContextSummary = data.contextSummary || null;
    renderOverlay();
  });

  if (state.activationKind === "unsupported") {
    return;
  }

  renderOverlay();
  injectPageProbe();
})();
