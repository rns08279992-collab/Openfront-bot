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
    latestContextSummary: null,
    overlayStatus: "status: ready",
    jsonPanelVisible: false,
    jsonPanelKind: null,
    buttonEvents: 0,
    lastButtonKind: "none",
    lastButtonEventType: "none",
    lastHandledButtonSignature: null
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
    return JSON.stringify(state.latestContextSummary || {}, null, 2);
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

  function showJsonPanel(kind, text) {
    const overlay = ensureOverlay();
    if (!overlay) {
      return;
    }

    const panel = overlay.querySelector('[data-role="json-panel"]');
    const labelNode = overlay.querySelector('[data-role="json-label"]');
    const textarea = overlay.querySelector('[data-role="json-textarea"]');
    if (!panel || !labelNode || !textarea) {
      return;
    }

    state.jsonPanelVisible = true;
    state.jsonPanelKind = kind;
    panel.style.display = "block";
    labelNode.textContent = `${kind} JSON`;
    textarea.value = text;
    textarea.focus();
    textarea.select();
  }

  function selectVisibleJson() {
    const overlay = ensureOverlay();
    if (!overlay) {
      return;
    }

    const textarea = overlay.querySelector('[data-role="json-textarea"]');
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
    showJsonPanel(label, text);
    setOverlayStatus(`showing ${label} JSON`);

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

  function shouldHandleButtonAction(button) {
    const kind =
      button.getAttribute("data-copy-kind") ||
      button.getAttribute("data-show-kind") ||
      button.getAttribute("data-select-json") ||
      "unknown";
    const signature = `${kind}:${button.textContent || ""}`;
    if (state.lastHandledButtonSignature === signature) {
      return false;
    }

    state.lastHandledButtonSignature = signature;
    window.setTimeout(() => {
      if (state.lastHandledButtonSignature === signature) {
        state.lastHandledButtonSignature = null;
      }
    }, 0);
    return true;
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
      showJsonPanel(showKind, getJsonByKind(showKind));
      setOverlayStatus(`showing ${showKind} JSON`);
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

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    updateButtonDebug(kind, event.type);
    setOverlayStatus(`button pressed: ${kind}`);

    if (!shouldHandleButtonAction(button)) {
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

      const jsonPanel = document.createElement("div");
      jsonPanel.setAttribute("data-role", "json-panel");
      jsonPanel.style.display = "none";
      jsonPanel.style.marginTop = "6px";
      jsonPanel.style.pointerEvents = "auto";
      overlay.appendChild(jsonPanel);

      const jsonLabel = document.createElement("div");
      jsonLabel.setAttribute("data-role", "json-label");
      jsonLabel.style.marginBottom = "4px";
      jsonPanel.appendChild(jsonLabel);

      const jsonTextarea = document.createElement("textarea");
      jsonTextarea.setAttribute("data-role", "json-textarea");
      jsonTextarea.setAttribute("readonly", "readonly");
      jsonTextarea.style.width = "100%";
      jsonTextarea.style.minHeight = "120px";
      jsonTextarea.style.boxSizing = "border-box";
      jsonTextarea.style.border = "1px solid rgba(148, 163, 184, 0.5)";
      jsonTextarea.style.borderRadius = "6px";
      jsonTextarea.style.background = "rgba(2, 6, 23, 0.9)";
      jsonTextarea.style.color = "#f8fafc";
      jsonTextarea.style.font = "inherit";
      jsonTextarea.style.pointerEvents = "auto";
      jsonPanel.appendChild(jsonTextarea);

      const selectJsonButton = document.createElement("button");
      selectJsonButton.type = "button";
      selectJsonButton.setAttribute("data-select-json", "true");
      selectJsonButton.textContent = "select JSON";
      applyButtonStyles(selectJsonButton);
      jsonPanel.appendChild(selectJsonButton);
    }

    const lines = overlay.querySelector('[data-role="lines"]');
    if (lines) {
      lines.textContent = getOverlayLines().join("\n");
    }

    const statusLine = overlay.querySelector('[data-role="status"]');
    if (statusLine) {
      statusLine.textContent = state.overlayStatus;
    }

    const jsonPanel = overlay.querySelector('[data-role="json-panel"]');
    const jsonLabel = overlay.querySelector('[data-role="json-label"]');
    const jsonTextarea = overlay.querySelector('[data-role="json-textarea"]');
    if (jsonPanel) {
      jsonPanel.style.display = state.jsonPanelVisible ? "block" : "none";
    }
    if (jsonLabel) {
      jsonLabel.textContent = state.jsonPanelKind ? `${state.jsonPanelKind} JSON` : "";
    }
    if (jsonTextarea && state.jsonPanelVisible && state.jsonPanelKind) {
      jsonTextarea.value = getJsonByKind(state.jsonPanelKind);
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
