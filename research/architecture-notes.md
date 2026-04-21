# Architecture Notes

Research basis:

- Confirmed upstream snapshot: `openfrontio/OpenFrontIO@52033597efb09de6c8d724f6e2784c3c9e8a7511`.
- Confirmed docs reviewed: `README.md`, `docs/Architecture.md`, `src/client/Transport.ts`, `src/core/configuration/DefaultConfig.ts`, `src/client/MultiTabDetector.ts`.
- Additional confirming code reviewed for this note: `src/core/Schemas.ts`, `src/core/GameRunner.ts`, `src/core/game/Game.ts`, `src/server/GameServer.ts`, `src/client/Auth.ts`, `src/client/graphics/layers/MultiTabModal.ts`.

## Confirmed Architecture

- The upstream docs define four components: `client`, `core`, `server`, and a closed-source `api` worker.
- `core` is intended to be deterministic and dependency-light. `docs/Architecture.md` states each client runs its own simulation and the server coordinates turns rather than simulating game state directly.
- Client actions are represented as `Intent` messages, collected by the server into a turn, then replayed by core as executions.
- `src/client/Transport.ts` is the client runtime bridge. It maps UI/game events to intents, opens the websocket, sends pings, and also swaps to `LocalServer` for replay/singleplayer.
- `src/server/GameServer.ts` is the authoritative websocket coordinator. It parses client messages, stamps `clientID` onto intents, enforces lobby-owner restrictions for some intents, and manages join/rejoin/heartbeat lifecycle.
- `src/core/Schemas.ts` is the shared protocol contract between client and server.
- `src/core/GameRunner.ts` and `src/core/game/Game.ts` define the player-facing legal action surface that UI can query before emitting intents.

## Mechanics Extraction Targets

Confirmed best sources:

- `src/core/configuration/DefaultConfig.ts`
- `src/core/game/`
- `src/core/execution/`

Why:

- `DefaultConfig.ts` contains the numeric mechanics directly: build costs, construction durations, cooldowns, alliance durations, embargo durations, spawn immunity, win thresholds, combat loss formulas, troop growth, gold growth, nuke radii, and unit ranges.
- `GameRunner.ts` and `Game.ts` tell you which actions are legal from a given state, but they are not the main numeric mechanics store.
- `docs/Architecture.md` explains the intent/execution pattern, but it is too thin to use as a mechanics source.

Practical extraction rule:

- Prefer extracting mechanics from `src/core/configuration/DefaultConfig.ts` and validating against the execution/game logic that consumes those values.
- Do not extract mechanics from UI labels, modal text, or client-layer event names unless the same rule is confirmed in core.

## Legal Intents And Actions

Confirmed intent definitions:

- `src/core/Schemas.ts` defines the legal intent union and client message schemas.
- Confirmed intents in the reviewed snapshot include `attack`, `spawn`, `boat`, `allianceRequest`, `allianceReject`, `breakAlliance`, `targetPlayer`, `emoji`, `donate_gold`, `donate_troops`, `build_unit`, `upgrade_structure`, `embargo`, `embargo_all`, `quick_chat`, `allianceExtension`, `delete_unit`, `move_warship`, `kick_player`, `toggle_pause`, `update_game_config`, and `mark_disconnected`.

Confirmed action-availability surface:

- `src/core/GameRunner.ts` returns `PlayerActions`.
- `src/core/game/Game.ts` defines `PlayerInteraction` fields such as `canSendAllianceRequest`, `canBreakAlliance`, `canTarget`, `canDonateGold`, `canDonateTroops`, and `canEmbargo`.

Important distinction:

- `Schemas.ts` tells you what message shapes are legal on the wire.
- `GameRunner.ts` and `Game.ts` tell you what actions are legal in the current game state.
- `GameServer.ts` adds server-side authority checks for restricted intents such as `kick_player`, `toggle_pause`, and `update_game_config`.

## Websocket And Runtime Flow

Confirmed flow in code:

- `Transport.ts` computes websocket URL from browser origin plus worker path, opens the socket, buffers unsent messages, validates inbound server messages with `ServerMessageSchema`, and reconnects on non-`1000` closes.
- `Transport.ts` sends `join` and `rejoin` messages with a play token from `getPlayToken()`.
- `GameServer.ts` validates client JSON, parses it through `ClientMessageSchema`, rate-limits by message type and size, and stamps `clientID` onto incoming intents before processing.
- `GameServer.ts` closes stale clients after missing heartbeats for 60 seconds.
- `docs/Architecture.md` documents the high-level turn pipeline, but the concrete runtime rules are mainly visible in `Transport.ts` and `GameServer.ts`.

## Multitab / Runtime Brittleness

Confirmed brittle areas:

- `src/client/MultiTabDetector.ts` uses a single `localStorage` lock key plus a 1-second heartbeat and 3-second stale threshold. This is a timing-sensitive browser-only coordination scheme.
- `MultiTabDetector.stopMonitoring()` removes listeners using fresh `bind(this)` calls rather than the same bound references used during registration. Confirmed implication: those listeners will not be removed correctly.
- The detector does not use `BroadcastChannel`; cross-tab coordination is entirely storage-event based.
- `src/client/graphics/layers/MultiTabModal.ts` only enables the detector outside spawn phase, singleplayer, replay, and dev mode. This means the feature is runtime-conditional and can be easy to miss in limited local testing.

Inference, not confirmed by explicit comment:

- Storage-event timing, stale-threshold tuning, and listener cleanup make this area a likely source of false positives, sticky penalties, or browser-specific behavior differences.
