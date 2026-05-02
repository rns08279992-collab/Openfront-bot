# OpenFront Copilot Test Extension

Minimal Manifest V3 extension for visually testing a read-only Copilot overlay and probing public pages for OpenFront-related runtime signals. It is intentionally independent from the TypeScript build.

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
  - `runtime: found` or `runtime: not found`
  - `globals: <count>`
  - `custom tags: <count>`
  - `canvas: <count>`
  - `scripts: <count>`
  - `path: <pathname>`
  - `runtime source: <global name>` or `runtime source: none`
  - `mode: read-only`
  - `no actions enabled`
  - `copy discovery JSON`
- Injects `page-probe.js` into the page world through `chrome.runtime.getURL(...)`
- Polls once per second for these known runtime globals without mutating them:
  - `globalThis.__OPENFRONT_BOT_RUNTIME__`
  - `globalThis.__OPENFRONT_RUNTIME__`
  - `globalThis.__OPENFRONT_CLIENT_GAME_RUNNER__`
  - `globalThis.currentGameRunner`
- Collects additional read-only discovery data:
  - `candidateGlobalKeys`
    - `Object.keys(globalThis)` filtered for keys containing `openfront`, `game`, `runner`, `client`, `lobby`, `map`, or `player`
    - limited to the first 30 matches
  - `customElements`
    - unique tag names from `document.querySelectorAll("*")` containing `game`, `lobby`, `map`, `modal`, `player`, or `canvas`
    - limited to the first 30 matches
  - `canvasCount`
    - `document.querySelectorAll("canvas").length`
  - `scriptSourceHints`
    - script `src` URLs or filenames containing `openfront`, `main`, `client`, `game`, or `index`
    - limited to the first 20 matches
  - `pageState`
    - `location.pathname`
    - `document.title`
    - `document.body.children.length`
- Posts runtime status and discovery data back to the content script with:
  - `runtimeFound`
  - `runtimeSource`
  - `checkedAtIso`
  - `pageUrl`
  - `availableGlobalNames`
  - `discovery`

## Copy discovery JSON

- Click `copy discovery JSON` in the overlay to copy the latest discovery snapshot to the clipboard.
- The copy payload is read-only JSON from the most recent page probe result.

## What it does not do

- Dispatch game actions
- Add hotkeys
- Click buttons
- Send network requests
- Modify game state
- Write to OpenFront runtime globals
- Patch runtime hooks
- Touch baseline or eval paths
