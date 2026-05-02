(function () {
  const STORAGE_KEY = "openfront-copilot-enabled";
  const OVERLAY_ID = "openfront-copilot-test-overlay";

  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch (error) {
    console.warn("[openfront-copilot-test] failed to set localStorage flag", error);
  }

  if (!document.body || document.getElementById(OVERLAY_ID)) {
    return;
  }

  const overlay = document.createElement("div");
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
  overlay.textContent = [
    "OpenFront Copilot Test",
    "status: loaded",
    "mode: read-only",
    "no actions enabled"
  ].join("\n");

  document.body.appendChild(overlay);
})();
