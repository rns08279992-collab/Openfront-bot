# OpenFront Copilot Test Extension

Minimal Manifest V3 extension for visually testing a read-only Copilot overlay and probing whether the page world exposes known OpenFront runtime globals. It is intentionally independent from the TypeScript build.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `extension/openfront-copilot-test`
5. Open `https://openfront.io/` or `http://localhost:9000/?openfront_copilot=1`

## What it does

- Injects a small fixed overlay with:
  - `OpenFront Copilot Test`
  - `extension loaded`
  - `page bridge loaded`
  - `runtime found` or `runtime not found`
  - `runtime source: <global name>` or `runtime source: none`
  - `mode: read-only`
  - `no actions enabled`
- Injects `page-probe.js` into the page world through `chrome.runtime.getURL(...)`
- Polls once per second for these globals without mutating them:
  - `globalThis.__OPENFRONT_BOT_RUNTIME__`
  - `globalThis.__OPENFRONT_RUNTIME__`
  - `globalThis.__OPENFRONT_CLIENT_GAME_RUNNER__`
  - `globalThis.currentGameRunner`
- Posts runtime status back to the content script with:
  - `runtimeFound`
  - `runtimeSource`
  - `checkedAtIso`
  - `pageUrl`
  - `availableGlobalNames`

## What it does not do

- Dispatch game actions
- Add hotkeys
- Click buttons
- Send network requests
- Modify game state
- Write to OpenFront runtime globals
- Patch runtime hooks
- Touch baseline or eval paths
