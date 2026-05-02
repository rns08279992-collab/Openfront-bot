(function () {
  const OVERLAY_ID = "openfront-copilot-test-overlay";
  const PROBE_MESSAGE_TYPE = "OPENFRONT_COPILOT_RUNTIME_STATUS";
  const PROBE_SCRIPT_ID = "openfront-copilot-test-page-probe";

  const state = {
    bridgeLoaded: false,
    runtimeFound: false,
    runtimeSource: null
  };

  function getOverlayText() {
    return [
      "OpenFront Copilot Test",
      "extension loaded",
      state.bridgeLoaded ? "page bridge loaded" : "page bridge loading",
      state.runtimeFound ? "runtime found" : "runtime not found",
      `runtime source: ${state.runtimeSource || "none"}`,
      "mode: read-only",
      "no actions enabled"
    ].join("\n");
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
      overlay.style.pointerEvents = "none";
      overlay.style.whiteSpace = "pre-line";
      document.body.appendChild(overlay);
    }

    overlay.textContent = getOverlayText();
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
    renderOverlay();
  });

  renderOverlay();
  injectPageProbe();
})();
