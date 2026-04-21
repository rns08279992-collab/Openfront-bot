# API Notes

Research basis:

- Confirmed docs reviewed: `docs/API.md`, `docs/Architecture.md`, `README.md`.
- Confirmed code reviewed for API boundary behavior: `src/client/Api.ts`, `src/client/Auth.ts`, `src/core/ApiSchemas.ts`.
- Closed-source limitation remains in effect for the Cloudflare Worker implementation.

## Confirmed Public HTTP API Documentation

`docs/API.md` documents public endpoints for:

- Game metadata listing: `GET https://api.openfront.io/public/games`
- Full game info: `GET https://api.openfront.io/public/game/:gameId`
- Player info: `GET https://api.openfront.io/public/player/:playerId`
- Player sessions: `GET https://api.openfront.io/public/player/:playerId/sessions`
- Clan leaderboard: `GET https://api.openfront.io/public/clans/leaderboard`
- Clan stats: `GET https://api.openfront.io/public/clan/:clanTag`
- Clan sessions: `GET https://api.openfront.io/public/clan/:clanTag/sessions`

Confirmed scope note:

- This document is about public HTTP endpoints, not gameplay websocket intents.

## Confirmed Client API Boundary Behavior

- `src/client/Api.ts` builds the API host and attaches bearer auth where needed.
- `src/client/Auth.ts` provides the JWT used by authenticated HTTP calls.
- `src/core/ApiSchemas.ts` contains typed schemas for API payloads used by the open client.

## Where Websocket Behavior Is Actually Defined

Not in `docs/API.md`.

Confirmed websocket behavior sources are:

- `docs/Architecture.md`
- `docs/Auth.md`
- `src/client/Transport.ts`
- `src/core/Schemas.ts`
- `src/server/GameServer.ts`

## What To Use For Future Extraction

- Use `docs/API.md` only for public REST/reporting/archive-facing integrations.
- Do not use `docs/API.md` as a source for gameplay mechanics, legal intents, or real-time transport behavior.
- For those areas, prefer `src/core/Schemas.ts`, `src/client/Transport.ts`, `src/server/GameServer.ts`, and `src/core/configuration/DefaultConfig.ts`.

## Confirmed vs Inferred Gaps

Confirmed:

- The public API surface in `docs/API.md` is narrower than the overall platform boundary described in `docs/Architecture.md`.
- Auth, stats, game storage, cosmetics, and monetization are handled by a closed-source API worker.

Inferred:

- Additional private/internal API routes likely exist behind the client auth flow, but they are not documented in `docs/API.md` and were not directly inspected in this task.
