# OpenFront Source Index

Research basis:

- Confirmed upstream snapshot inspected in separate working area: `openfrontio/OpenFrontIO` at commit `52033597efb09de6c8d724f6e2784c3c9e8a7511`.
- Local `research/pinned-commit.txt` still says `TBD`, so this is a researched upstream snapshot, not yet a locally recorded pin.
- Trust levels below refer to how close each source is to executable truth.

| file/source | why it matters | trust level | priority order | notes |
| --- | --- | --- | --- | --- |
| `src/core/configuration/DefaultConfig.ts` | Primary mechanics source. Costs, durations, cooldowns, spawn immunity, troop/gold formulas, targeting ranges, and win thresholds live here. | High | 1 | Confirmed best extraction target for numeric mechanics. Large file; values are code truth, not prose. |
| `src/core/Schemas.ts` | Defines legal client messages, intent shapes, stamped intents, and turn payload contracts. | High | 2 | Confirmed source for protocol legality. Includes `join`, `rejoin`, `intent`, `update_game_config`, `toggle_pause`, `kick_player`, and `mark_disconnected`. |
| `src/server/GameServer.ts` | Server-side authority on websocket message handling, join/rejoin flow, intent stamping, lobby-only checks, pause behavior, and heartbeat disconnects. | High | 3 | Confirms which intents are accepted, ignored, or restricted after transport. |
| `src/client/Transport.ts` | Main client websocket/local-server transport, event-to-intent mapping, reconnect path, ping loop, and join/rejoin message construction. | High | 4 | Best client-side source for runtime protocol behavior. |
| `src/core/GameRunner.ts` | Converts game state into legal player actions exposed to the UI. | High | 5 | Useful for extracting "what actions are legal now" without hard-coding UI assumptions. |
| `src/core/game/Game.ts` | Declares player capability methods and `PlayerActions` / `PlayerInteraction` shapes used by UI and worker. | High | 6 | Important companion to `GameRunner.ts` for action semantics. |
| `docs/Architecture.md` | Short official summary of client/core/server/api boundaries and intent -> turn -> execution flow. | Medium | 7 | Good orientation doc, but much thinner than code. |
| `docs/Auth.md` | Official auth summary: refresh token, short-lived JWT, websocket authorization model, dev-mode fallback. | Medium | 8 | Helpful for intent, but closed-source API details are still undocumented here. |
| `src/client/Auth.ts` | Actual client auth behavior: refresh, JWT memory cache, audience/issuer checks, and persistent-ID fallback token path. | High | 9 | Confirms dev/runtime behavior more precisely than `docs/Auth.md`. |
| `README.md` | Project entry point, high-level structure, run modes, and replay note about matching `gitCommit`. | Medium | 10 | Confirms repo layout and operational context. |
| `docs/API.md` | Public HTTP API reference for game/player/clan data. | Medium | 11 | Useful for archival/stats integrations, not for websocket gameplay flow. |
| `src/client/MultiTabDetector.ts` | Detects same-browser multi-tab play using `localStorage` lock + heartbeat. | High | 12 | Key runtime brittleness source. Confirms no `BroadcastChannel`; uses storage events and timeouts. |
| `src/client/graphics/layers/MultiTabModal.ts` | User-facing penalty UI triggered by `MultiTabDetector`. | Medium | 13 | Confirms detector is active outside dev, replay, and singleplayer. |
| `src/client/Api.ts` | Client HTTP API host selection and bearer-authenticated fetches. | High | 14 | Useful boundary between open client and closed API worker. |
| `docs/API.md` + closed-source API worker note in `docs/Architecture.md` | Only direct documentation for the closed auth/stats/storage worker. | Low | 15 | Necessary, but incomplete. Treat as boundary documentation rather than implementation truth. |

Immediate extraction guidance:

- Mechanics should be extracted from `src/core/configuration/DefaultConfig.ts` first, then validated against `src/core/game/*` and `src/core/execution/*` usage sites.
- Legal intents/actions should be extracted from `src/core/Schemas.ts`, `src/core/GameRunner.ts`, and `src/core/game/Game.ts`.
- Auth and websocket behavior should be anchored in `docs/Auth.md`, `src/client/Auth.ts`, `src/client/Transport.ts`, and `src/server/GameServer.ts`.
- Multitab/runtime brittleness should be anchored in `src/client/MultiTabDetector.ts` and its use from `src/client/graphics/layers/MultiTabModal.ts`.
