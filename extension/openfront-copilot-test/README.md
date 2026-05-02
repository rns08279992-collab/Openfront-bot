# OpenFront Copilot Test Extension

Minimal Manifest V3 extension for visually testing a read-only Copilot overlay and probing public pages for OpenFront-related runtime signals and safe context metadata. It is intentionally independent from the TypeScript build.

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
  - `context: found` or `context: not found`
  - `players: <count>` or `players: unknown`
  - `config: found` or `config: not found`
  - `canvas: <count>`
  - `path: <pathname>`
  - `runtime source: <global name>` or `runtime source: none`
  - `mode: read-only`
  - `no actions enabled`
  - `copy discovery JSON`
  - `copy context JSON`
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
  - `functionInventory`
    - inspects candidate page-world globals by name without calling them
    - records `name`, `typeof`, `function.length`, and the first 300 chars of `Function.prototype.toString.call(fn)` when callable
    - candidate names:
      - `getOpenFrontGameContext`
      - `findOpenFrontGameContextInDom`
      - `isUsableOpenFrontGameContext`
      - `getGameConfig`
      - `getAliveHumanPlayers`
      - `getPlayerGoldNumber`
      - `getPlayerDisplayName`
      - `getPlayerRelationToMyPlayer`
      - `isAllowedTradePartnerForMyPlayer`
      - `ensureSelectiveTradePolicyPatchForPlayer`
      - `rememberOpenFrontGameContext`
  - `safeCallResults`
    - only calls allowlisted zero-argument functions inside `try/catch`
    - allowlist:
      - `getOpenFrontGameContext`
      - `findOpenFrontGameContextInDom`
      - `getGameConfig`
      - `getAliveHumanPlayers`
    - never calls a function if:
      - it is not on the allowlist
      - its name contains `patch`, `set`, `update`, `send`, `click`, `attack`, `spawn`, `alliance`, `request`, `mutate`, `dispatch`, `remember`, or `ensure`
      - its declared `function.length` is not `0`
  - `blockedFunctions`
    - lists candidate functions blocked by name before any call attempt
  - `pageState`
    - `location.pathname`
    - `document.title`
    - `document.body.children.length`
- Builds a compact read-only `contextSummary` from the safe call results:
  - `contextFound`
  - `contextKeys`
  - `gameConfigFound`
  - `gameConfigKeys`
  - `aliveHumanPlayersCount`
  - `aliveHumanPlayerKeySample`
  - `typeNames`
  - `valueSummaries`
  - `errors`
- Posts runtime status, discovery data, and context summary back to the content script with:
  - `runtimeFound`
  - `runtimeSource`
  - `checkedAtIso`
  - `pageUrl`
  - `availableGlobalNames`
  - `discovery`
  - `contextSummary`

## Copy buttons

- Click `copy discovery JSON` in the overlay to copy the latest discovery snapshot to the clipboard.
- The copy payload is read-only JSON from the most recent page probe result.
- Click `copy context JSON` to copy the compact safe-call context summary.

## What it does not do

- Dispatch game actions
- Add hotkeys
- Click buttons
- Send network requests
- Modify game state
- Write to OpenFront runtime globals
- Patch runtime hooks
- Call non-allowlisted candidate functions
- Call any candidate function that declares required arguments
- Touch baseline or eval paths
