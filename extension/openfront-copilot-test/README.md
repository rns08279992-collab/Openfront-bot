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
  - `me: <displayName|name|smallID|id>` or `me: unknown`
  - `players: <count>` or `players: unknown`
  - `humans: <alive including me>/<total including me>` or `humans: unknown`
  - `human opponents: <alive>/<total>` or `human opponents: unknown`
  - `bots: <alive>/<total>` or `bots: unknown`
  - `nations: <alive>/<total>` or `nations: unknown`
  - `unknown: <count>` or `unknown: unknown`
  - `threat status: <safe|watch|danger|unknown>`
  - `threat urgency: <low|medium|high|unknown>`
  - `threat reasons: <first 2 reasons>` or `threat reasons: none`
  - `threat suggestions: <first 2 suggestions>` or `threat suggestions: none`
  - `config: found` or `config: not found`
  - `canvas: <count>`
  - `path: <pathname>`
  - `host: <hostname>`
  - `runtime source: <global name>` or `runtime source: none`
  - `mode: read-only`
  - `no actions enabled`
  - `copy discovery JSON`
  - `copy public snapshot JSON`
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
    - classifies sampled player views using only these read-only signals:
      - `player.type?.()`
      - `player.data?.playerType`
      - `player.isPlayer?.()`
      - `player.isHuman?.()`
      - `player.isBot?.()`
      - `player.id?.()`
      - `player.smallID?.()`
      - `player.displayName?.()`
      - `player.name?.()`
      - `player.isAlive?.()`
    - reads these additional guarded `myPlayer` fields when present:
      - `myPlayer.id?.()` or `myPlayer.id`
      - `myPlayer.smallID?.()` or `myPlayer.smallID`
      - `myPlayer.displayName?.()` or `myPlayer.displayName`
      - `myPlayer.name?.()` or `myPlayer.name`
      - `myPlayer.gold?.()` or `myPlayer.gold`
      - `myPlayer.troops?.()` or `myPlayer.troops`
      - `myPlayer.maxTroops?.()` or `myPlayer.maxTroops`
      - `myPlayer.numTilesOwned?.()` or `myPlayer.numTilesOwned`
      - `myPlayer.isAlive?.()` or `myPlayer.isAlive`
    - applies these classification rules in order:
      - same `id()` or `smallID()` as `myPlayer` => `me`
      - `type()` or `data.playerType` equals `NATION` => `nation_bot`
      - `type()` or `data.playerType` contains `BOT` or `AI` => `bot`
      - `isBot?.()` returns `true` => `bot`
      - `isHuman?.()` returns `true`, or `isPlayer?.()` returns `true` and the player is not already bot/nation => `human`
      - otherwise => `unknown`
    - builds `playersSample` by bucket instead of taking the first 20 players:
      - always includes `myPlayer` when found
      - up to 5 `human` opponents
      - up to 5 `bot`
      - up to 5 `nation_bot`
      - up to 5 `unknown`
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
  - `totalPlayerViews`
  - `aliveTotal`
  - `meFound`
  - `myPlayerFound`
  - `humanOpponentCount`
  - `aliveHumanOpponentCount`
  - `humanTotalIncludingMe`
  - `aliveHumanTotalIncludingMe`
  - `humanPlayerCount`
  - `aliveHumanPlayerCount`
  - `botPlayerCount`
  - `aliveBotPlayerCount`
  - `nationBotCount`
  - `aliveNationBotCount`
  - `unknownPlayerCount`
  - `playersSample`
  - `myPlayer`
  - `threatSummary`
    - `status`
    - `urgency`
    - `reasons`
    - `suggestions`
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
- Click `copy public snapshot JSON` to copy the compact safe-call public snapshot, including `threatSummary`.
- Click `copy DOM probe JSON` to copy the element/property scan and any usable DOM-derived context metadata.

## Threat summary rules

- `buildReadOnlyThreatSummary(snapshot)` uses only the existing public snapshot data already collected by the page probe.
- Returns `unknown` status and urgency when `myPlayer` is missing or either `troops` or `maxTroops` is unavailable.
- Returns `danger` with `high` urgency when `myPlayer.troops / myPlayer.maxTroops < 0.25`.
- Returns `watch` with `medium` urgency when `myPlayer.troops / myPlayer.maxTroops < 0.45`.
- Returns `watch` with `medium` urgency when `humanOpponentCount > 0`.
- Returns `safe` with `low` urgency when `myPlayer.troops / myPlayer.maxTroops >= 0.45` and `humanOpponentCount === 0`.
- Adds `grow before fighting` when troop ratio is below `0.45`.
- Adds `monitor human opponents` when `humanOpponentCount > 0`.
- Adds `bot-only match: economy focus` when `humanOpponentCount === 0` and `botPlayerCount > 0`.

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
