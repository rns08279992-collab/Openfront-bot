# OpenFront Copilot Test Extension

Minimal Manifest V3 extension for visually testing a read-only Copilot overlay and probing public pages for OpenFront-related runtime signals and safe context metadata. It is intentionally independent from the TypeScript build.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `extension/openfront-copilot-test`
5. Open any supported OpenFront page:
   - `https://openfront.io/`
   - `https://*.openfront.io/*`
   - `http://localhost/*`
   - `http://127.0.0.1/*`

No query parameter is required. The overlay loads on every matched OpenFront route, including menu, lobby, settings, public games, private/custom games, single-player, and localhost dev pages.

On localhost only, `localStorage["openfront-copilot-enabled"] = "1"` remains available as an optional manual dev flag. It is not required for activation and does not expand the extension onto non-OpenFront websites.

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
  - `host: <hostname>`
  - `runtime source: <global name>` or `runtime source: none`
  - `mode: read-only`
  - `no actions enabled`
  - `copy discovery JSON`
  - `copy context JSON`
  - `copy DOM probe JSON`
- Injects `page-probe.js` into the page world through `chrome.runtime.getURL(...)`
- Activates on every matched OpenFront or localhost route without requiring a query parameter
- Polls once per second for these known runtime globals without mutating them:
  - `globalThis.__OPENFRONT_BOT_RUNTIME__`
  - `globalThis.__OPENFRONT_RUNTIME__`
  - `globalThis.__OPENFRONT_CLIENT_GAME_RUNNER__`
  - `globalThis.currentGameRunner`
- Collects additional read-only discovery data:
  - `domProbe`
    - scans these selectors directly:
      - `player-info-overlay`
      - `player-panel`
      - `emoji-table`
      - `leader-board`
      - `team-stats`
      - `game-left-sidebar`
      - `game-right-sidebar`
      - `build-menu`
      - `spawn-timer`
      - `unit-display`
      - `control-panel`
      - `canvas`
      - `map-display`
      - `single-player-modal`
      - `host-lobby-modal`
      - `game-starting-modal`
      - `game-info-modal`
    - also scans all DOM elements for property names:
      - `game`
      - `g`
      - `transform`
      - `transformHandler`
    - records for each candidate element:
      - `tagName`
      - `id`
      - `className`
      - `ownPropertyNames`
      - `prototypePropertyNames`
      - `hasGameProperty`
      - `hasGProperty`
      - `hasTransformProperty`
      - `hasTransformHandlerProperty`
      - `gameSummary`
      - `transformSummary`
    - marks a usable DOM context when a candidate game object exposes `playerViews()` and a candidate transform exposes `worldToScreenCoordinates()`
    - only then makes these guarded read-only calls once on the first usable pair:
      - `game.playerViews()`
      - `game.myPlayer()`
      - `game.ticks()`
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
    - `location.hostname`
    - `location.pathname`
    - `document.title`
    - `document.body.children.length`
- Builds a compact read-only `contextSummary` from the safe call results:
  - `contextFound`
  - `sourceElementTag`
  - `gameSourceProperty`
  - `transformSourceProperty`
  - `playerCount`
  - `myPlayerFound`
  - `currentTick`
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
- Click `copy DOM probe JSON` to copy the element/property scan and any usable DOM-derived context metadata.

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
