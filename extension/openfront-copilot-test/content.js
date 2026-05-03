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
    publicSnapshotVisible: false
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

  function copyDiscoveryJson() {
    const discoveryJson = getDiscoveryJson();
    copyJsonText(discoveryJson, "discovery JSON");
  }

  function getPublicSnapshotJson() {
    return JSON.stringify(state.latestContextSummary || {}, null, 2);
  }

  function copyPublicSnapshotJson() {
    const contextJson = getPublicSnapshotJson();
    copyJsonText(contextJson, "public snapshot JSON");
  }

  function getDomProbeJson() {
    const domProbe =
      state.latestDiscovery && state.latestDiscovery.domProbe
        ? state.latestDiscovery.domProbe
        : {};
    return JSON.stringify(domProbe, null, 2);
  }

  function copyDomProbeJson() {
    const domProbeJson = getDomProbeJson();
    copyJsonText(domProbeJson, "DOM probe JSON");
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

  function showManualCopyPanel(label, text) {
    const overlay = ensureOverlay();
    if (!overlay) {
      return;
    }

    const labelNode = overlay.querySelector('[data-role="manual-label"]');
    const textarea = overlay.querySelector('[data-role="manual-json"]');
    if (!labelNode || !textarea) {
      return;
    }

    labelNode.textContent = `manual copy: ${label}`;
    textarea.value = text;
    textarea.style.display = "block";
    textarea.focus();
    textarea.select();
  }

  function hideManualCopyPanel() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      return;
    }

    const textarea = overlay.querySelector('[data-role="manual-json"]');
    const labelNode = overlay.querySelector('[data-role="manual-label"]');
    if (textarea) {
      textarea.style.display = "none";
      textarea.value = "";
    }
    if (labelNode) {
      labelNode.textContent = "";
    }
  }

  function showPublicSnapshotPanel() {
    const overlay = ensureOverlay();
    if (!overlay) {
      return;
    }

    const panel = overlay.querySelector('[data-role="public-json-panel"]');
    const textarea = overlay.querySelector('[data-role="public-json"]');
    const button = overlay.querySelector('[data-role="toggle-public-json"]');
    if (!panel || !textarea || !button) {
      return;
    }

    state.publicSnapshotVisible = true;
    panel.style.display = "block";
    textarea.value = getPublicSnapshotJson();
    button.textContent = "hide public snapshot JSON";
  }

  function hidePublicSnapshotPanel() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      return;
    }

    const panel = overlay.querySelector('[data-role="public-json-panel"]');
    const button = overlay.querySelector('[data-role="toggle-public-json"]');
    if (!panel || !button) {
      return;
    }

    state.publicSnapshotVisible = false;
    panel.style.display = "none";
    button.textContent = "show public snapshot JSON";
  }

  function togglePublicSnapshotPanel() {
    if (state.publicSnapshotVisible) {
      hidePublicSnapshotPanel();
      return;
    }

    showPublicSnapshotPanel();
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
    hideManualCopyPanel();

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        setOverlayStatus(`copied ${label}`);
        return;
      } catch (clipboardError) {
        try {
          await copyWithExecCommand(text);
          setOverlayStatus(`copied ${label}`);
          return;
        } catch (fallbackError) {
          const shortError = getShortErrorMessage(fallbackError || clipboardError);
          showManualCopyPanel(label, text);
          setOverlayStatus(`copy failed: ${shortError}`);
          return;
        }
      }
    }

    try {
      await copyWithExecCommand(text);
      setOverlayStatus(`copied ${label}`);
    } catch (error) {
      const shortError = getShortErrorMessage(error);
      showManualCopyPanel(label, text);
      setOverlayStatus(`copy failed: ${shortError}`);
    }
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
      copyButton.textContent = "copy discovery JSON";
      applyButtonStyles(copyButton);
      copyButton.style.marginTop = "8px";
      copyButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyDiscoveryJson();
      });
      overlay.appendChild(copyButton);

      const copyPublicSnapshotButton = document.createElement("button");
      copyPublicSnapshotButton.type = "button";
      copyPublicSnapshotButton.textContent = "copy public snapshot JSON";
      applyButtonStyles(copyPublicSnapshotButton);
      copyPublicSnapshotButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyPublicSnapshotJson();
      });
      overlay.appendChild(copyPublicSnapshotButton);

      const copyDomProbeButton = document.createElement("button");
      copyDomProbeButton.type = "button";
      copyDomProbeButton.textContent = "copy DOM probe JSON";
      applyButtonStyles(copyDomProbeButton);
      copyDomProbeButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyDomProbeJson();
      });
      overlay.appendChild(copyDomProbeButton);

      const showPublicJsonButton = document.createElement("button");
      showPublicJsonButton.type = "button";
      showPublicJsonButton.setAttribute("data-role", "toggle-public-json");
      showPublicJsonButton.textContent = "show public snapshot JSON";
      applyButtonStyles(showPublicJsonButton);
      showPublicJsonButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        togglePublicSnapshotPanel();
      });
      overlay.appendChild(showPublicJsonButton);

      const publicJsonPanel = document.createElement("div");
      publicJsonPanel.setAttribute("data-role", "public-json-panel");
      publicJsonPanel.style.display = "none";
      publicJsonPanel.style.marginTop = "6px";
      overlay.appendChild(publicJsonPanel);

      const publicJsonLabel = document.createElement("div");
      publicJsonLabel.textContent = "public snapshot JSON";
      publicJsonLabel.style.marginBottom = "4px";
      publicJsonPanel.appendChild(publicJsonLabel);

      const publicJsonTextarea = document.createElement("textarea");
      publicJsonTextarea.setAttribute("data-role", "public-json");
      publicJsonTextarea.setAttribute("readonly", "readonly");
      publicJsonTextarea.style.width = "100%";
      publicJsonTextarea.style.minHeight = "120px";
      publicJsonTextarea.style.boxSizing = "border-box";
      publicJsonTextarea.style.border = "1px solid rgba(148, 163, 184, 0.5)";
      publicJsonTextarea.style.borderRadius = "6px";
      publicJsonTextarea.style.background = "rgba(2, 6, 23, 0.9)";
      publicJsonTextarea.style.color = "#f8fafc";
      publicJsonTextarea.style.font = "inherit";
      publicJsonTextarea.style.pointerEvents = "auto";
      publicJsonPanel.appendChild(publicJsonTextarea);

      const manualLabel = document.createElement("div");
      manualLabel.setAttribute("data-role", "manual-label");
      manualLabel.style.marginTop = "6px";
      manualLabel.style.marginBottom = "4px";
      manualLabel.style.color = "#fecaca";
      overlay.appendChild(manualLabel);

      const manualTextarea = document.createElement("textarea");
      manualTextarea.setAttribute("data-role", "manual-json");
      manualTextarea.setAttribute("readonly", "readonly");
      manualTextarea.style.display = "none";
      manualTextarea.style.width = "100%";
      manualTextarea.style.minHeight = "120px";
      manualTextarea.style.boxSizing = "border-box";
      manualTextarea.style.border = "1px solid rgba(248, 113, 113, 0.55)";
      manualTextarea.style.borderRadius = "6px";
      manualTextarea.style.background = "rgba(2, 6, 23, 0.9)";
      manualTextarea.style.color = "#f8fafc";
      manualTextarea.style.font = "inherit";
      manualTextarea.style.pointerEvents = "auto";
      overlay.appendChild(manualTextarea);
    }

    const lines = overlay.querySelector('[data-role="lines"]');
    if (lines) {
      lines.textContent = getOverlayLines().join("\n");
    }

    const statusLine = overlay.querySelector('[data-role="status"]');
    if (statusLine) {
      statusLine.textContent = state.overlayStatus;
    }

    const publicJsonTextarea = overlay.querySelector('[data-role="public-json"]');
    if (publicJsonTextarea && state.publicSnapshotVisible) {
      publicJsonTextarea.value = getPublicSnapshotJson();
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
