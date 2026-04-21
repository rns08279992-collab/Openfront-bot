# Transport Scan

Pinned source of truth: commit `52033597efb09de6c8d724f6e2784c3c9e8a7511` in `C:\Users\bacht\Documents\Openfront\.tmp\OpenFrontIO-upstream`.

This scan is limited to confirmed client->server transport and execution surface from the pinned source. It does not propose implementation yet.

## Scope and source files

Read first, per request:

- `.tmp/OpenFrontIO-upstream/src/client/Transport.ts`
- `.tmp/OpenFrontIO-upstream/src/core/Schemas.ts`
- `.tmp/OpenFrontIO-upstream/src/server/GameServer.ts`
- `.tmp/OpenFrontIO-upstream/src/client/Auth.ts`
- `.tmp/OpenFrontIO-upstream/src/client/Api.ts`

Directly related files reviewed to confirm payloads, emitters, auth boundaries, and handling:

- `.tmp/OpenFrontIO-upstream/src/server/Worker.ts`
- `.tmp/OpenFrontIO-upstream/src/server/ClientMsgRateLimiter.ts`
- `.tmp/OpenFrontIO-upstream/src/client/ClientGameRunner.ts`
- `.tmp/OpenFrontIO-upstream/src/client/Main.ts`
- `.tmp/OpenFrontIO-upstream/src/client/LocalServer.ts`
- `.tmp/OpenFrontIO-upstream/src/core/execution/ExecutionManager.ts`
- `.tmp/OpenFrontIO-upstream/src/client/MultiTabDetector.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/MultiTabModal.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/PlayerActionHandler.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/PlayerPanel.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/EventsDisplay.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/AttacksDisplay.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/BuildMenu.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/StructureIconsLayer.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/UnitLayer.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/ChatModal.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/ChatIntegration.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/EmojiTable.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/SendResourceModal.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/GameRightSidebar.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/SettingsModal.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/PlayerModerationModal.ts`
- `.tmp/OpenFrontIO-upstream/src/client/graphics/layers/WinModal.ts`

## Boundary summary

- Client transport uses one top-level WebSocket message union: `ClientMessage`.
- Game commands are sent as top-level `{ type: "intent", intent: Intent }`.
- `Intent` is a discriminated union in `src/core/Schemas.ts`.
- Client never sends `clientID` inside intents. Server stamps `clientID` from the authenticated connection in `GameServer.addListeners`.
- Pre-join WebSocket traffic is restricted in `src/server/Worker.ts`: only `join`, `rejoin`, and `ping` are accepted before authentication.
- `join` and `rejoin` require `token`; client gets it from `getPlayToken()` in `src/client/Auth.ts`.
- `getPlayToken()` returns JWT when logged in, else a locally persisted UUID from `localStorage["player_persistent_id"]`.
- Join path is authenticated in `Worker.ts` via `verifyClientToken()`. That code accepts either JWT or UUID token, matching `TokenSchema` in `Schemas.ts`.
- `mark_disconnected` is present in the intent schema and execution path, but the server treats it as internal-only. `GameServer` logs and drops if a client sends it.

## Confirmed top-level client actions

These are top-level client->server WebSocket message types, not nested `intent.type` values.

| Action | Confirmed payload shape | Emitted from | Validated / handled server-side | Notes |
| --- | --- | --- | --- | --- |
| `join` | `{ type: "join", token, gameID, username, clanTag, cosmetics?, turnstileToken }` | `Transport.joinGame()`; called from `joinLobby()` connect callback in `ClientGameRunner.ts` | Parsed by `ClientMessageSchema` in `Worker.ts`; token verified; turnstile and cosmetics checked; then `GameManager.joinClient()` -> `GameServer.joinClient()` | Confirmed |
| `rejoin` | `{ type: "rejoin", gameID, lastTurn, token }` | `Transport.rejoinGame()`; called from `ClientGameRunner.start()` and reconnect callback | Parsed in `Worker.ts`; token verified; then `GameManager.rejoinClient()` -> `GameServer.rejoinClient()` | Confirmed |
| `intent` | `{ type: "intent", intent: Intent }` | `Transport.sendIntent()` from many event handlers | Parsed by `ClientMessageSchema` in `GameServer.addListeners`; rate-limited; server stamps `clientID`; then either handled specially in `GameServer` or queued into turn history | Confirmed |
| `ping` | `{ type: "ping" }` | `Transport.startPing()` every 5s for remote games only | Pre-join ping ignored in `Worker.ts`; post-join ping updates `lastPing` in `GameServer.addListeners` | Confirmed |
| `hash` | `{ type: "hash", hash, turnNumber }` | `Transport.onSendHashEvent()` from `ClientGameRunner` hash updates | Parsed in `GameServer.addListeners`; stored in `client.hashes`; used by desync detection | Confirmed |
| `winner` | `{ type: "winner", winner, allPlayersStats }` | `Transport.onSendWinnerEvent()` from `WinModal` | Parsed in `GameServer.addListeners`; handled by `handleWinner()` with vote-by-active-IP logic | Confirmed |
| `log` | `{ type: "log", severity, log }` | No confirmed emitter found in reviewed pinned client files | In schema only; parsed by `ClientMessageSchema` if received; no explicit `case "log"` in `GameServer` or `Worker` post-join switch | Confirmed schema-only, no confirmed emitter |

## Confirmed intents

All payload shapes below are confirmed from `Intent` schemas in `src/core/Schemas.ts`.

| Intent name | Confirmed payload shape | Confirmed client emitters | Server validation / handling | Execution path | Notes |
| --- | --- | --- | --- | --- | --- |
| `allianceExtension` | `{ type: "allianceExtension", recipient }` | `EventsDisplay.ts`, `PlayerActionHandler.ts` -> `SendAllianceExtensionIntentEvent` -> `Transport.onSendAllianceExtensionIntent()` | Parsed by `ClientMessageSchema` and accepted in `GameServer` default intent path | `ExecutionManager` -> `AllianceExtensionExecution` | Confirmed |
| `allianceReject` | `{ type: "allianceReject", requestor }` | `EventsDisplay.ts` -> `SendAllianceRejectIntentEvent` -> `Transport.onAllianceRejectUIEvent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `AllianceRejectExecution` | Confirmed |
| `allianceRequest` | `{ type: "allianceRequest", recipient }` | `PlayerPanel.ts`, `EventsDisplay.ts`, `PlayerActionHandler.ts` -> `SendAllianceRequestIntentEvent` -> `Transport.onSendAllianceRequest()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `AllianceRequestExecution` | Confirmed |
| `attack` | `{ type: "attack", targetID: ID \| null, troops: number \| null }` | `ClientGameRunner.ts`, `AttacksDisplay.ts`, `PlayerActionHandler.ts` -> `SendAttackIntentEvent` -> `Transport.onSendAttackIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `AttackExecution` | Confirmed |
| `boat` | `{ type: "boat", troops: number, dst: number }` | `ClientGameRunner.ts`, `PlayerActionHandler.ts` -> `SendBoatAttackIntentEvent` -> `Transport.onSendBoatAttackIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `TransportShipExecution` | Confirmed |
| `breakAlliance` | `{ type: "breakAlliance", recipient }` | `PlayerPanel.ts`, `PlayerActionHandler.ts` -> `SendBreakAllianceIntentEvent` -> `Transport.onBreakAllianceRequestUIEvent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `BreakAllianceExecution` | Confirmed |
| `build_unit` | `{ type: "build_unit", unit, tile, rocketDirectionUp? }` | `BuildMenu.ts`, `StructureIconsLayer.ts` -> `BuildUnitIntentEvent` -> `Transport.onBuildUnitIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `ConstructionExecution` | Confirmed |
| `cancel_attack` | `{ type: "cancel_attack", attackID: string }` | `AttacksDisplay.ts` -> `CancelAttackIntentEvent` -> `Transport.onCancelAttackIntentEvent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `RetreatExecution` | Confirmed |
| `cancel_boat` | `{ type: "cancel_boat", unitID: number }` | `AttacksDisplay.ts` -> `CancelBoatIntentEvent` -> `Transport.onCancelBoatIntentEvent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `BoatRetreatExecution` | Confirmed |
| `delete_unit` | `{ type: "delete_unit", unitId: number }` | `PlayerActionHandler.ts` -> `SendDeleteUnitIntentEvent` -> `Transport.onSendDeleteUnitIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `DeleteUnitExecution` | Confirmed |
| `donate_gold` | `{ type: "donate_gold", recipient, gold: number \| null }` | `SendResourceModal.ts`, `PlayerActionHandler.ts` -> `SendDonateGoldIntentEvent` -> `Transport.onSendDonateGoldIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `DonateGoldExecution` | Confirmed |
| `donate_troops` | `{ type: "donate_troops", recipient, troops: number \| null }` | `SendResourceModal.ts`, `PlayerActionHandler.ts` -> `SendDonateTroopsIntentEvent` -> `Transport.onSendDonateTroopIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `DonateTroopsExecution` | Confirmed |
| `embargo` | `{ type: "embargo", targetID, action: "start" \| "stop" }` | `PlayerPanel.ts`, `PlayerActionHandler.ts` -> `SendEmbargoIntentEvent` -> `Transport.onSendEmbargoIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `EmbargoExecution` | Confirmed |
| `embargo_all` | `{ type: "embargo_all", action: "start" \| "stop" }` | `PlayerPanel.ts` -> `SendEmbargoAllIntentEvent` -> `Transport.onSendEmbargoAllIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `EmbargoAllExecution` | Confirmed |
| `emoji` | `{ type: "emoji", recipient: ID \| AllPlayers, emoji: number }` | `PlayerPanel.ts`, `EmojiTable.ts`, `PlayerActionHandler.ts` -> `SendEmojiIntentEvent` -> `Transport.onSendEmojiIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `EmojiExecution` | Confirmed |
| `kick_player` | `{ type: "kick_player", target }` | `PlayerModerationModal.ts`, `Main.ts` -> `SendKickPlayerIntentEvent` -> `Transport.onSendKickPlayerIntent()` | Special-cased in `GameServer.addListeners`: only lobby creator; cannot kick self; not queued into turn history | Direct `GameServer.kickClient()`; no `ExecutionManager` case | Confirmed |
| `mark_disconnected` | `{ type: "mark_disconnected", clientID, isDisconnected }` | No confirmed client emitter; server internally generates it in `GameServer.markClientDisconnected()` every disconnect-status check | Client-sent value explicitly rejected in `GameServer.addListeners` | `ExecutionManager` -> `MarkDisconnectedExecution` | Confirmed internal-only intent |
| `move_warship` | `{ type: "move_warship", unitId, tile }` | `UnitLayer.ts` -> `MoveWarshipIntentEvent` -> `Transport.onMoveWarshipEvent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `MoveWarshipExecution` | Confirmed |
| `quick_chat` | `{ type: "quick_chat", recipient, quickChatKey, target? }` | `ChatModal.ts`, `ChatIntegration.ts` -> `SendQuickChatEvent` -> `Transport.onSendQuickChatIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `QuickChatExecution` | Confirmed |
| `spawn` | `{ type: "spawn", tile: number }` | `ClientGameRunner.ts`, `PlayerActionHandler.ts` -> `SendSpawnIntentEvent` -> `Transport.onSendSpawnIntentEvent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `SpawnExecution` | Confirmed |
| `targetPlayer` | `{ type: "targetPlayer", target }` | `PlayerPanel.ts`, `PlayerActionHandler.ts` -> `SendTargetPlayerIntentEvent` -> `Transport.onSendTargetPlayerIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `TargetPlayerExecution` | Confirmed |
| `toggle_pause` | `{ type: "toggle_pause", paused: boolean }` | `GameRightSidebar.ts`, `SettingsModal.ts` -> `PauseGameIntentEvent` -> `Transport.onPauseGameIntent()` | Special-cased in `GameServer.addListeners`: only lobby creator; if pausing/unpausing, server adds intent and ends current turn immediately | `ExecutionManager` -> `PauseExecution` | Confirmed |
| `update_game_config` | `{ type: "update_game_config", config: Partial<GameConfig> }` | `Main.ts` -> `SendUpdateGameConfigIntentEvent` -> `Transport.onSendUpdateGameConfigIntent()` | Special-cased in `GameServer.addListeners`: only lobby creator; rejected for public games, after start, or if new config sets `gameType: Public`; not queued into turn history | Direct `GameServer.updateGameConfig()`; no `ExecutionManager` case | Confirmed |
| `upgrade_structure` | `{ type: "upgrade_structure", unit, unitId }` | `ClientGameRunner.ts`, `BuildMenu.ts`, `StructureIconsLayer.ts` -> `SendUpgradeStructureIntentEvent` -> `Transport.onSendUpgradeStructureIntent()` | Parsed and queued in `GameServer` default path | `ExecutionManager` -> `UpgradeStructureExecution` | Confirmed |

## WebSocket and auth boundaries

### 1. Client token source

- `Auth.getPlayToken()` returns:
  - logged-in JWT, or
  - fallback persistent UUID from `localStorage["player_persistent_id"]`.
- `Schemas.TokenSchema` explicitly allows either JWT or UUID.

### 2. Connection establishment

- `Transport.connectRemote()` opens `ws(s)://<host>/<workerPath>`.
- After socket open, `joinLobby()` always calls `transport.joinGame()`.
- Once a live game runner exists, `ClientGameRunner.start()` also calls `transport.rejoinGame(0)` and uses `transport.rejoinGame(this.turnsSeen)` on reconnect.

### 3. Pre-join message boundary in `Worker.ts`

- Worker-level pre-join parser uses `ClientMessageSchema`.
- Before a successful join/rejoin, only:
  - `ping`
  - `join`
  - `rejoin`
  are accepted.
- Any other message before join is logged as invalid and ignored.

### 4. Auth and admission checks in `Worker.ts`

- `verifyClientToken(clientMsg.token, config)` validates token and extracts persistent ID.
- `claims?.role === "banned"` closes the socket.
- On `join` only, server also performs:
  - username/clanTag censoring
  - auto-rejoin attempt by persistent ID
  - `getUserMe()` privilege/flares check for authenticated users
  - cosmetics permission check
  - Cloudflare Turnstile verification outside dev
- Only after those checks does the worker create a `Client` and call `GameManager.joinClient()`.

### 5. Post-join intent boundary in `GameServer.ts`

- `GameServer.addListeners()` parses each message again with `ClientMessageSchema`.
- Server stamps `clientID` from authenticated connection into a `StampedIntent`.
- Client-supplied `clientID` is therefore not part of legal client intent payloads.

## Action-rate, legality, and multitab constraints

### Rate and payload constraints

Confirmed in `src/server/ClientMsgRateLimiter.ts`:

- `intent` messages only:
  - max `10` intents per second
  - max `150` intents per minute
- Per-client total incoming bytes across session:
  - `2 MB` -> `kick`
- Max serialized message size:
  - regular intents: `500` bytes
  - `update_game_config`: `2000` bytes
- Oversized intent -> `kick`
- Exceed rate bucket -> `limit` (drop message, do not kick)

Confirmed in `src/server/Worker.ts`:

- Pre-join unauthenticated WebSocket IP limiter:
  - `5` tokens per second
  - over limit closes socket with `1008`
- WebSocket server `maxPayload` is `1 MB`

### Legality constraints enforced in `GameServer.ts`

- `kick_player`
  - only lobby creator may send it
  - lobby creator cannot target self
  - handled immediately, not stored in turn history
- `update_game_config`
  - only lobby creator may send it
  - rejected for public games
  - rejected after game start
  - rejected if new partial config sets `gameType` to `Public`
  - handled immediately, not stored in turn history
- `toggle_pause`
  - only lobby creator may send it
  - handled immediately by adding pause intent and forcing `endTurn()`
- While paused
  - non-pause intents are dropped in `GameServer`
  - `LocalServer` mirrors the same behavior
- `mark_disconnected`
  - client-sent value is explicitly rejected
  - server synthesizes it every 5 turns based on heartbeat timeout state

### Session and multitab-related constraints

- Duplicate authenticated session handling in prod:
  - `GameServer.joinClient()` looks for another active client with same `persistentID`
  - if found, existing session is kicked with `kick_reason.duplicate_session`
  - this is server-enforced session uniqueness, not just UI-level
- Public lobby anti-stacking:
  - max 3 active clients from same IP in public games
- Lobby size:
  - `maxPlayers` enforced at join
- Multitab UI penalty:
  - `MultiTabDetector.ts` uses `localStorage["multi-tab-lock"]`
  - heartbeat every `1s`, stale threshold `3s`
  - competing tab triggers local penalty callback for `10s`
  - `MultiTabModal.ts` shows warning/punishment UI
  - no confirmed WebSocket message is sent for multitab detection itself
- Rejoin semantics:
  - join path first attempts `gm.rejoinClient(...)` using persistent ID
  - explicit `rejoin` also resolves via persistent ID
  - this means protocol identity is bound to token-derived persistent ID, not a client-chosen `clientID`

## Confirmed vs inferred notes

### Confirmed

- The complete `Intent` discriminated union names and payload shapes.
- The complete top-level `ClientMessage` discriminated union names and payload shapes.
- Client emission path for all reviewed intents listed above.
- Server-side special handling for `kick_player`, `update_game_config`, `toggle_pause`, `mark_disconnected`.
- Execution mapping for all turn-stored intents handled by `ExecutionManager`.
- Token source and fallback UUID behavior in `Auth.ts`.
- Pre-join vs post-join WebSocket boundaries in `Worker.ts` and `GameServer.ts`.
- Rate limits and size limits in `ClientMsgRateLimiter.ts`.
- Local multitab penalty exists only as local UI/localStorage behavior in reviewed files.

### Inferred, but still grounded in reviewed code

- `shared/protocol/actions.ts` should probably model top-level client WebSocket messages separately from game intents, because the codebase already treats `intent` as a nested union under `ClientMessage`.
  - This is an architectural inference from the existing split between `ClientMessage` and `Intent`.
- `kick_player` and `update_game_config` should probably remain in the protocol surface even though they are not turn-executed gameplay intents, because they are still sent through `{ type: "intent" }` today.
  - This is a protocol-shape inference, not a claim about desired future design.

### Not confirmed

- No confirmed emitter for `ClientLogMessage`.
- No confirmed server-side consumer beyond schema parsing for top-level `log`.
- No claim here about hidden payload fields beyond the schemas.

## Proposed file shape

The goal here is only to propose a safe extraction shape that matches the pinned source split.

### `shared/protocol/intents.ts`

Recommended contents:

- literal intent name constants or a readonly list
- one schema/type per intent payload
- a discriminated union `IntentSchema`
- a `StampedIntentSchema` that adds `clientID`
- exported `IntentType` string union
- optional helpers:
  - `isIntentType(value)`
  - `isTurnStoredIntentType(value)`
  - `isServerOnlyIntentType(value)` for `mark_disconnected`
  - `isImmediateControlIntentType(value)` for `kick_player`, `toggle_pause`, `update_game_config`

Suggested shape:

```ts
// shared/protocol/intents.ts
import { z } from "zod";

export const INTENT_TYPES = [
  "allianceExtension",
  "allianceReject",
  "allianceRequest",
  "attack",
  "boat",
  "breakAlliance",
  "build_unit",
  "cancel_attack",
  "cancel_boat",
  "delete_unit",
  "donate_gold",
  "donate_troops",
  "embargo",
  "embargo_all",
  "emoji",
  "kick_player",
  "mark_disconnected",
  "move_warship",
  "quick_chat",
  "spawn",
  "targetPlayer",
  "toggle_pause",
  "update_game_config",
  "upgrade_structure",
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export const AllianceExtensionIntentSchema = z.object({ ... });
// ... one schema per confirmed intent

export const IntentSchema = z.discriminatedUnion("type", [
  AllianceExtensionIntentSchema,
  // ...
]);

export type Intent = z.infer<typeof IntentSchema>;

export const StampedIntentSchema = IntentSchema.and(
  z.object({ clientID: IDSchema }),
);

export type StampedIntent = z.infer<typeof StampedIntentSchema>;
```

Why this split is safer:

- It preserves the pinned source distinction between a pure intent payload and a server-stamped intent.
- It avoids hiding that some legal `intent.type` values are not regular turn gameplay actions.

### `shared/protocol/actions.ts`

Recommended contents:

- top-level client WebSocket actions only
- separate `ClientActionSchema` from `IntentSchema`
- explicit `IntentEnvelopeSchema` for `{ type: "intent", intent: Intent }`
- optionally split:
  - `PreJoinActionSchema`
  - `PostJoinActionSchema`

Suggested shape:

```ts
// shared/protocol/actions.ts
import { z } from "zod";
import { IntentSchema } from "./intents";

export const ClientPingActionSchema = z.object({
  type: z.literal("ping"),
});

export const ClientJoinActionSchema = z.object({
  type: z.literal("join"),
  token: TokenSchema,
  gameID: IDSchema,
  username: UsernameSchema,
  clanTag: ClanTagSchema,
  cosmetics: PlayerCosmeticRefsSchema.optional(),
  turnstileToken: z.string().nullable(),
});

export const ClientRejoinActionSchema = z.object({
  type: z.literal("rejoin"),
  gameID: IDSchema,
  lastTurn: z.number(),
  token: TokenSchema,
});

export const ClientIntentActionSchema = z.object({
  type: z.literal("intent"),
  intent: IntentSchema,
});

export const ClientHashActionSchema = z.object({
  type: z.literal("hash"),
  hash: z.number(),
  turnNumber: z.number(),
});

export const ClientWinnerActionSchema = z.object({
  type: z.literal("winner"),
  winner: WinnerSchema,
  allPlayersStats: AllPlayersStatsSchema,
});

export const ClientLogActionSchema = z.object({
  type: z.literal("log"),
  severity: z.enum(LogSeverity),
  log: IDSchema,
});

export const ClientActionSchema = z.discriminatedUnion("type", [
  ClientPingActionSchema,
  ClientJoinActionSchema,
  ClientRejoinActionSchema,
  ClientIntentActionSchema,
  ClientHashActionSchema,
  ClientWinnerActionSchema,
  ClientLogActionSchema,
]);
```

Why this split is safer:

- It preserves the pinned distinction between transport actions and nested gameplay/control intents.
- It keeps auth-bearing actions (`join`, `rejoin`) separate from game command payloads.
- It makes pre-join boundary checks representable without overloading the intent layer.

## Risks for future `intent` adapter

- `kick_player`, `toggle_pause`, and `update_game_config` are transported as intents today, but they are not all normal turn-stored gameplay actions. Flattening them into one generic adapter without capability metadata risks illegal replay/execution assumptions.
- `mark_disconnected` is in the intent union but is server-internal. Treating every schema-listed intent as client-sendable would create a bad protocol contract.
- Top-level `join` / `rejoin` are auth-bearing transport actions, not intents. Mixing them into one adapter surface would blur critical auth boundaries.
- `clientID` is server-stamped. Any shared client-side protocol model that treats it as client-provided would be wrong.
- `update_game_config` uses `Partial<GameConfig>` and has a larger size limit than other intents. Reusing a single generic size/validation profile for all intents would not match server behavior.
- There is a schema-defined `log` action with no confirmed emitter/handler in reviewed code. Promoting schema-only actions into supported adapter behavior without confirming usage could lock in dead surface area.
