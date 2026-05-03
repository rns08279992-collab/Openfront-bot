(function () {
  const OVERLAY_ID = "openfront-copilot-test-overlay";
  const JSON_PANEL_ID = "openfront-copilot-json-panel";
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
    latestContextSummary: null,
    overlayStatus: "status: ready",
    jsonPanelVisible: false,
    jsonPanelKind: null,
    jsonPanelText: "",
    jsonPanelStatus: "status: ready",
    jsonPanelIsError: false,
    buttonEvents: 0,
    lastButtonKind: "none",
    lastButtonEventType: "none"
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

  function formatSummaryList(items) {
    return Array.isArray(items) && items.length > 0
      ? items.slice(0, 2).join(" | ")
      : "none";
  }

  function formatFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "unknown";
  }

  function formatCompactNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "unknown";
    }

    const absoluteValue = Math.abs(value);
    if (absoluteValue < 1000) {
      return String(value);
    }

    const units = [
      { threshold: 1e9, suffix: "B" },
      { threshold: 1e6, suffix: "M" },
      { threshold: 1e3, suffix: "K" }
    ];

    for (const unit of units) {
      if (absoluteValue >= unit.threshold) {
        const scaled = value / unit.threshold;
        const decimals = Math.abs(scaled) < 10 ? 2 : 1;
        return `${scaled.toFixed(decimals)}${unit.suffix}`;
      }
    }

    return String(value);
  }

  function formatTroopPair(contextSummary) {
    const myPlayer = contextSummary && contextSummary.myPlayer ? contextSummary.myPlayer : null;
    const controlPanelStats =
      contextSummary && contextSummary.controlPanelStats
        ? contextSummary.controlPanelStats
        : null;
    const troops =
      myPlayer && typeof myPlayer.troops === "number" && Number.isFinite(myPlayer.troops)
        ? myPlayer.troops
        : controlPanelStats &&
            typeof controlPanelStats.troopsDisplay === "number" &&
            Number.isFinite(controlPanelStats.troopsDisplay)
          ? controlPanelStats.troopsDisplay
          : null;
    const maxTroops =
      myPlayer &&
      typeof myPlayer.maxTroops === "number" &&
      Number.isFinite(myPlayer.maxTroops)
        ? myPlayer.maxTroops
        : controlPanelStats &&
            typeof controlPanelStats.maxTroopsDisplay === "number" &&
            Number.isFinite(controlPanelStats.maxTroopsDisplay)
          ? controlPanelStats.maxTroopsDisplay
          : null;

    return `${formatCompactNumber(troops)}/${formatCompactNumber(maxTroops)}`;
  }

  function formatTroopRatio(threatSummary) {
    return threatSummary && typeof threatSummary.troopCapacityRatio === "number"
      ? threatSummary.troopCapacityRatio.toFixed(2)
      : "unknown";
  }

  function getOverlayLines() {
    const discovery = state.latestDiscovery;
    const contextSummary = state.latestContextSummary;
    const threatSummary =
      contextSummary && contextSummary.threatSummary
        ? contextSummary.threatSummary
        : null;
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
      `troops: ${formatTroopPair(contextSummary)}`,
      `troop ratio: ${formatTroopRatio(threatSummary)}`,
      `stats source: ${threatSummary ? threatSummary.statsSource || "unknown" : "unknown"}`,
      `threat status: ${threatSummary ? threatSummary.status : "unknown"}`,
      `threat urgency: ${threatSummary ? threatSummary.urgency : "unknown"}`,
      `threat reasons: ${formatSummaryList(threatSummary ? threatSummary.reasons : [])}`,
      `threat suggestions: ${formatSummaryList(
        threatSummary ? threatSummary.suggestions : []
      )}`,
      `config: ${
        contextSummary && contextSummary.gameConfigFound ? "found" : "not found"
      }`,
      `canvas: ${discovery ? discovery.canvasCount : 0}`,
      `path: ${pageState.pathname || window.location.pathname}`,
      `host: ${state.activationHost}`,
      `runtime source: ${state.runtimeSource || "none"}`,
      `buttonEvents: ${state.buttonEvents}`,
      `lastButtonKind: ${state.lastButtonKind}`,
      `lastButtonEventType: ${state.lastButtonEventType}`,
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

  function getPublicSnapshotJson() {
    if (!state.latestContextSummary) {
      return "";
    }

    return JSON.stringify(state.latestContextSummary, null, 2);
  }

  function buildPublicSnapshotPanelPayload(contextSummary) {
    if (!contextSummary) {
      return {
        text: "",
        status: "No public snapshot available yet",
        isError: true
      };
    }

    return {
      text: JSON.stringify(contextSummary, null, 2),
      status: "opened public snapshot JSON",
      isError: false
    };
  }

  function getDomProbeJson() {
    const domProbe =
      state.latestDiscovery && state.latestDiscovery.domProbe
        ? state.latestDiscovery.domProbe
        : {};
    return JSON.stringify(domProbe, null, 2);
  }

  function setOverlayStatus(message) {
    state.overlayStatus = message;
    const overlay = document.getElementById(OVERLAY_ID);
    const statusLine = overlay ? overlay.querySelector('[data-role="status"]') : null;
    if (statusLine) {
      statusLine.textContent = message;
    }
  }

  function getShortErrorMessage(error) {
    if (!error) {
      return "unknown error";
    }

    const source =
      typeof error === "string"
        ? error
        : typeof error.message === "string" && error.message
          ? error.message
          : typeof error.name === "string" && error.name
            ? error.name
            : "unknown error";

    return source.trim().replace(/\s+/g, " ").slice(0, 80) || "unknown error";
  }

  function getJsonByKind(kind) {
    if (kind === "discovery") {
      return getDiscoveryJson();
    }

    if (kind === "public snapshot") {
      return getPublicSnapshotJson();
    }

    if (kind === "DOM probe") {
      return getDomProbeJson();
    }

    return JSON.stringify({}, null, 2);
  }

  function ensureJsonPanel() {
    if (!document.body) {
      return;
    }

    let panel = document.getElementById(JSON_PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = JSON_PANEL_ID;
      panel.style.position = "fixed";
      panel.style.left = "24px";
      panel.style.top = "24px";
      panel.style.width = "min(900px, 70vw)";
      panel.style.height = "min(700px, 70vh)";
      panel.style.zIndex = "2147483647";
      panel.style.pointerEvents = "auto";
      panel.style.display = "none";
      panel.style.boxSizing = "border-box";
      panel.style.padding = "16px";
      panel.style.border = "1px solid rgba(148, 163, 184, 0.45)";
      panel.style.borderRadius = "10px";
      panel.style.background = "#0f172a";
      panel.style.color = "white";
      panel.style.boxShadow = "0 16px 48px rgba(2, 6, 23, 0.55)";
      panel.style.font = '12px/1.4 ui-monospace, "SFMono-Regular", Consolas, monospace';

      const title = document.createElement("div");
      title.setAttribute("data-role", "json-title");
      title.textContent = "Public Snapshot JSON";
      title.style.fontSize = "14px";
      title.style.fontWeight = "600";
      title.style.marginBottom = "8px";
      panel.appendChild(title);

      const statusLine = document.createElement("div");
      statusLine.setAttribute("data-role", "json-status");
      statusLine.style.marginBottom = "10px";
      statusLine.style.color = "#93c5fd";
      panel.appendChild(statusLine);

      const textarea = document.createElement("textarea");
      textarea.setAttribute("data-role", "json-textarea");
      textarea.setAttribute("readonly", "readonly");
      textarea.style.display = "block";
      textarea.style.width = "100%";
      textarea.style.height = "calc(100% - 88px)";
      textarea.style.boxSizing = "border-box";
      textarea.style.border = "1px solid rgba(148, 163, 184, 0.45)";
      textarea.style.borderRadius = "8px";
      textarea.style.background = "#0f172a";
      textarea.style.color = "white";
      textarea.style.padding = "12px";
      textarea.style.resize = "none";
      textarea.style.font = "inherit";
      textarea.style.pointerEvents = "auto";
      panel.appendChild(textarea);

      const buttonRow = document.createElement("div");
      buttonRow.style.display = "flex";
      buttonRow.style.gap = "8px";
      buttonRow.style.marginTop = "10px";
      panel.appendChild(buttonRow);

      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.setAttribute("data-select-json", "true");
      selectButton.textContent = "Select JSON";
      applyButtonStyles(selectButton);
      selectButton.style.width = "auto";
      selectButton.style.marginTop = "0";
      buttonRow.appendChild(selectButton);

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.setAttribute("data-close-json-panel", "true");
      closeButton.textContent = "Close";
      applyButtonStyles(closeButton);
      closeButton.style.width = "auto";
      closeButton.style.marginTop = "0";
      buttonRow.appendChild(closeButton);

      panel.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const button = target.closest(
          'button[data-select-json], button[data-close-json-panel]'
        );
        if (!button || !panel.contains(button)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (button.hasAttribute("data-close-json-panel")) {
          closeJsonPanel();
          return;
        }

        selectVisibleJson();
      });

      document.body.appendChild(panel);
    }

    panel.style.position = "fixed";
    panel.style.left = "24px";
    panel.style.top = "24px";
    panel.style.width = "min(900px, 70vw)";
    panel.style.height = "min(700px, 70vh)";
    panel.style.zIndex = "2147483647";
    panel.style.display = state.jsonPanelVisible ? "block" : "none";
    panel.style.pointerEvents = "auto";
    panel.style.background = "#0f172a";
    panel.style.color = "white";

    const title = panel.querySelector('[data-role="json-title"]');
    const statusLine = panel.querySelector('[data-role="json-status"]');
    const textarea = panel.querySelector('[data-role="json-textarea"]');
    if (title) {
      title.textContent = state.jsonPanelKind || "Public Snapshot JSON";
    }
    if (statusLine) {
      statusLine.textContent = state.jsonPanelStatus;
      statusLine.style.color = state.jsonPanelIsError ? "#fca5a5" : "#93c5fd";
    }
    if (textarea) {
      textarea.value = state.jsonPanelText;
    }
    return panel;
  }

  function closeJsonPanel() {
    state.jsonPanelVisible = false;
    ensureJsonPanel();
  }

  function refreshPublicSnapshotPanel() {
    if (!state.jsonPanelVisible || state.jsonPanelKind !== "Public Snapshot JSON") {
      return;
    }

    const payload = buildPublicSnapshotPanelPayload(state.latestContextSummary);
    state.jsonPanelText = payload.text;
    state.jsonPanelStatus = payload.status;
    state.jsonPanelIsError = payload.isError;
    ensureJsonPanel();
  }

  function showJsonPanel(kind, text, status, isError) {
    state.jsonPanelVisible = true;
    state.jsonPanelKind = kind;
    state.jsonPanelText = text;
    state.jsonPanelStatus = status;
    state.jsonPanelIsError = Boolean(isError);

    const panel = ensureJsonPanel();
    if (!panel) {
      return;
    }

    const textarea = panel.querySelector('[data-role="json-textarea"]');
    console.debug("[openfront-copilot-test] JSON panel opened", kind);
    console.debug("[openfront-copilot-test] JSON length", text.length);
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  }

  function openJsonPanel(title, contextSummary) {
    const payload = buildPublicSnapshotPanelPayload(contextSummary);
    console.debug("[openfront-copilot-test] opening JSON panel", title, {
      hasSnapshot: Boolean(contextSummary)
    });
    showJsonPanel(title, payload.text, payload.status, payload.isError);
    console.debug("[openfront-copilot-test] opened JSON panel", title, {
      hasSnapshot: Boolean(contextSummary),
      textLength: payload.text.length
    });
  }

  function selectVisibleJson() {
    const panel = ensureJsonPanel();
    if (!panel) {
      return;
    }

    const textarea = panel.querySelector('[data-role="json-textarea"]');
    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.select();
    setOverlayStatus("selected JSON");
  }

  function copyWithExecCommand(text) {
    return new Promise((resolve, reject) => {
      let textarea = null;
      try {
        textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "readonly");
        textarea.setAttribute("aria-hidden", "true");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "-9999px";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        if (document.execCommand("copy")) {
          resolve();
          return;
        }

        reject(new Error("execCommand copy returned false"));
      } catch (error) {
        reject(error);
      } finally {
        if (textarea && textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
      }
    });
  }

  async function copyJsonText(text, label) {
    const panelStatus = text
      ? `opened ${label} JSON`
      : label === "public snapshot"
        ? "No public snapshot available yet"
        : `opened ${label} JSON`;
    showJsonPanel(label, text, panelStatus, !text && label === "public snapshot");
    setOverlayStatus(`opened ${label} JSON`);

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        setOverlayStatus(`copied ${label} JSON`);
        return;
      } catch (clipboardError) {
        try {
          await copyWithExecCommand(text);
          setOverlayStatus(`copied ${label} JSON`);
          return;
        } catch (fallbackError) {
          const shortError = getShortErrorMessage(fallbackError || clipboardError);
          setOverlayStatus(`copy failed: ${shortError}`);
          return;
        }
      }
    }

    try {
      await copyWithExecCommand(text);
      setOverlayStatus(`copied ${label} JSON`);
    } catch (error) {
      const shortError = getShortErrorMessage(error);
      setOverlayStatus(`copy failed: ${shortError}`);
    }
  }

  function updateButtonDebug(kind, eventType) {
    state.buttonEvents += 1;
    state.lastButtonKind = kind;
    state.lastButtonEventType = eventType;
    ensureOverlay();
  }

  async function handleOverlayButtonAction(button) {
    if (button.hasAttribute("data-select-json")) {
      selectVisibleJson();
      return;
    }

    const copyKind = button.getAttribute("data-copy-kind");
    if (copyKind) {
      await copyJsonText(getJsonByKind(copyKind), copyKind);
      return;
    }

    const showKind = button.getAttribute("data-show-kind");
    if (showKind) {
      const text = getJsonByKind(showKind);
      const status =
        showKind === "public snapshot" && !text
          ? "No public snapshot available yet"
          : `opened ${showKind} JSON`;
      showJsonPanel(showKind, text, status, showKind === "public snapshot" && !text);
      setOverlayStatus(`opened ${showKind} JSON`);
    }
  }

  function handleOverlayButtonEvent(event) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(
      'button[data-copy-kind], button[data-show-kind], button[data-select-json]'
    );
    if (!button || !overlay.contains(button)) {
      return;
    }

    const kind =
      button.getAttribute("data-copy-kind") ||
      button.getAttribute("data-show-kind") ||
      "select JSON";
    console.debug("[openfront-copilot-test] button kind resolved", kind);

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    updateButtonDebug(kind, event.type);
    setOverlayStatus(`button pressed: ${kind}`);
    if (event.type !== "click") {
      return;
    }

    if (kind.includes("public snapshot")) {
      openJsonPanel("Public Snapshot JSON", state.latestContextSummary);
      setOverlayStatus("opened public snapshot JSON");
      return;
    }

    void handleOverlayButtonAction(button);
  }

  function applyButtonStyles(button) {
    button.style.display = "block";
    button.style.width = "100%";
    button.style.marginTop = "6px";
    button.style.padding = "6px 8px";
    button.style.border = "1px solid rgba(147, 197, 253, 0.45)";
    button.style.borderRadius = "6px";
    button.style.background = "rgba(30, 41, 59, 0.95)";
    button.style.color = "#dbeafe";
    button.style.cursor = "pointer";
    button.style.font = "inherit";
    button.style.textAlign = "left";
    button.style.pointerEvents = "auto";
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
      overlay.style.maxWidth = "320px";
      overlay.addEventListener("pointerdown", handleOverlayButtonEvent);
      overlay.addEventListener("mousedown", handleOverlayButtonEvent);
      overlay.addEventListener("click", handleOverlayButtonEvent);
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

      const statusLine = document.createElement("div");
      statusLine.setAttribute("data-role", "status");
      statusLine.style.marginTop = "8px";
      statusLine.style.color = "#bfdbfe";
      statusLine.style.userSelect = "text";
      statusLine.textContent = state.overlayStatus;
      overlay.appendChild(statusLine);

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.setAttribute("data-copy-kind", "discovery");
      copyButton.textContent = "copy discovery JSON";
      applyButtonStyles(copyButton);
      copyButton.style.marginTop = "8px";
      overlay.appendChild(copyButton);

      const copyPublicSnapshotButton = document.createElement("button");
      copyPublicSnapshotButton.type = "button";
      copyPublicSnapshotButton.setAttribute("data-copy-kind", "public snapshot");
      copyPublicSnapshotButton.textContent = "copy public snapshot JSON";
      applyButtonStyles(copyPublicSnapshotButton);
      overlay.appendChild(copyPublicSnapshotButton);

      const copyDomProbeButton = document.createElement("button");
      copyDomProbeButton.type = "button";
      copyDomProbeButton.setAttribute("data-copy-kind", "DOM probe");
      copyDomProbeButton.textContent = "copy DOM probe JSON";
      applyButtonStyles(copyDomProbeButton);
      overlay.appendChild(copyDomProbeButton);

      const showPublicJsonButton = document.createElement("button");
      showPublicJsonButton.type = "button";
      showPublicJsonButton.setAttribute("data-show-kind", "public snapshot");
      showPublicJsonButton.textContent = "show public snapshot JSON";
      applyButtonStyles(showPublicJsonButton);
      overlay.appendChild(showPublicJsonButton);

    }

    const lines = overlay.querySelector('[data-role="lines"]');
    if (lines) {
      lines.textContent = getOverlayLines().join("\n");
    }

    const statusLine = overlay.querySelector('[data-role="status"]');
    if (statusLine) {
      statusLine.textContent = state.overlayStatus;
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
    refreshPublicSnapshotPanel();
    renderOverlay();
  });

  if (state.activationKind === "unsupported") {
    return;
  }

  renderOverlay();
  injectPageProbe();
})();
