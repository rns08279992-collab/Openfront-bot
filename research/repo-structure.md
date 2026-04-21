# OpenFront Repo Structure

Research basis:

- Upstream repo inspected at commit `52033597efb09de6c8d724f6e2784c3c9e8a7511`.
- This map is confirmed from the cloned tree, not inferred from docs alone.

## Top-Level Directories

| directory | purpose | confirmed vs inferred |
| --- | --- | --- |
| `.github/` | CI/workflow and repo automation metadata. | Confirmed from tree; contents not reviewed in this task. |
| `.husky/` | Local git hook scripts. | Confirmed from tree; behavior not reviewed. |
| `.vscode/` | Editor workspace settings. | Confirmed from tree. |
| `docs/` | Short human-written docs for architecture, auth, and public API. | Confirmed and reviewed. |
| `map-generator/` | Separate map-generation area. | Confirmed from tree; purpose inferred from name only. |
| `proprietary/` | Non-open pieces or integration boundaries kept outside normal OSS paths. | Confirmed from tree; contents not reviewed. |
| `resources/` | Static assets such as maps, images, fonts, and other client resources. | Confirmed from tree and README. |
| `src/` | Main application source tree. | Confirmed. |
| `tests/` | Test suite. | Confirmed from tree; not reviewed in this task. |
| `__mocks__/` | Test/mock fixtures. | Confirmed from tree. |

## `src/` Map

| directory | purpose | why it matters for future extraction |
| --- | --- | --- |
| `src/client/` | Browser client, UI, rendering, auth, networking, runtime guards, and local replay/singleplayer support. | Transport, auth, multitab, and client-side intent emission all start here. |
| `src/core/` | Deterministic simulation shared by client/worker/server contracts. | This is the mechanics center. Prefer extracting mechanics from here instead of UI code. |
| `src/server/` | Game server coordination, websocket session handling, worker orchestration, rate limiting, and archival flow. | Server rules around join/rejoin, intent validation, and authority checks live here. |

## `src/client/` Important Areas

| directory/file area | purpose |
| --- | --- |
| `src/client/Transport.ts` | Websocket/local transport and event-to-intent bridge. |
| `src/client/Auth.ts` | JWT refresh, persistent ID fallback, and login/logout logic. |
| `src/client/MultiTabDetector.ts` | Same-browser multi-tab detection and punishment timing. |
| `src/client/graphics/` | Rendering layers, overlays, and runtime UI including the multi-tab modal. |
| `src/client/components/` | Reusable UI pieces. |
| `src/client/utilities/` | Browser/runtime utilities and diagnostics. |
| `src/client/sound/` | Client audio. |
| `src/client/styles/` | CSS/Tailwind-oriented styling assets. |

## `src/core/` Important Areas

| directory/file area | purpose |
| --- | --- |
| `src/core/configuration/` | Default and environment-specific config. `DefaultConfig.ts` is the strongest mechanics source reviewed. |
| `src/core/game/` | Core game entities, player capability methods, and data structures such as `PlayerActions`. |
| `src/core/execution/` | Execution layer that applies intents to mutate deterministic game state. |
| `src/core/worker/` | Worker-thread bridge between client and deterministic core simulation. |
| `src/core/pathfinding/` | Movement/pathing support. |
| `src/core/validations/` | Validation helpers for shared models. |
| `src/core/Schemas.ts` | Shared protocol/message schema definitions. |
| `src/core/GameRunner.ts` | High-level game orchestration and player action derivation. |

## `src/server/` Important Areas

| directory/file area | purpose |
| --- | --- |
| `src/server/GameServer.ts` | Main websocket game server logic and authority checks. |
| `src/server/GameManager.ts` | Game join/rejoin routing across games. |
| `src/server/jwt.ts` | Server-side token verification and dev fallback handling. |
| `src/server/ClientMsgRateLimiter.ts` | Rate limiting for client websocket messages and large intents. |
| `src/server/Master.ts` / `Worker.ts` | Multi-worker server setup and routing. |

## Study Priorities

1. `src/core/configuration/` for mechanics extraction.
2. `src/core/Schemas.ts` plus `src/server/GameServer.ts` for legal intents and websocket authority.
3. `src/client/Transport.ts` plus `src/client/Auth.ts` for client runtime behavior.
4. `src/client/MultiTabDetector.ts` plus `src/client/graphics/layers/MultiTabModal.ts` for multitab/runtime brittleness.
