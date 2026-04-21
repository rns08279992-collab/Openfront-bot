# Auth Notes

Research basis:

- Confirmed docs reviewed: `docs/Auth.md`, `README.md`.
- Confirmed code reviewed for auth/runtime behavior: `src/client/Auth.ts`, `src/client/Transport.ts`, `src/server/GameServer.ts`, `src/server/jwt.ts`, `src/client/Api.ts`, `src/core/Schemas.ts`.
- The API worker itself is described as closed source in `docs/Architecture.md`, so some server-side auth details are boundary-only, not fully inspectable.

## Confirmed From Docs

- `docs/Auth.md` describes a 30-day refresh token stored as an HTTP-only cookie.
- The client exchanges that refresh token for a short-lived JWT with a 15-minute TTL.
- The JWT contains the `persistentID` and is intended to live in memory only.
- Websocket authorization happens once at connection time; after that, server-side authorization relies on the established `clientID => persistentID` mapping.
- In development mode, auth falls back to persistent-ID checks instead of JWT validation.

## Confirmed From Client Code

- `src/client/Auth.ts` stores JWT only in module memory (`__jwt`), not in localStorage.
- `userAuth()` decodes the JWT client-side and checks `iss` and `aud`.
- `doRefreshJwt()` POSTs to `/auth/refresh` with cookies and updates in-memory expiry state.
- `getPlayToken()` returns the JWT if available; otherwise it falls back to a locally generated/stored persistent ID.
- `getPersistentIDFromLocalStorage()` creates and persists a local ID under `player_persistent_id` when no JWT is available.
- `src/client/Transport.ts` uses `getPlayToken()` for both `join` and `rejoin`.

## Confirmed From Server Code

- `src/server/jwt.ts` accepts either a JWT or, in dev, a plain persistent ID matching `PersistentIdSchema`.
- `src/server/GameServer.ts` maintains `persistentIdToClientId` for reconnect lookup.
- Join/rejoin authority is effectively tied to the token-derived persistent identity, not to a client-supplied `clientID`.
- `src/core/Schemas.ts` explicitly documents that `clientID` is not sent by the client for `join` or `rejoin`; the server derives identity from the token.

## Open / Closed Boundary

Confirmed closed boundary:

- `docs/Architecture.md` states the `api` component is a closed-source Cloudflare Worker handling auth, stats, storage, cosmetics, and monetization.

Implication:

- Refresh-token issuance, cookie policy details, exact auth endpoints, and JWKS publishing behavior can only be partially confirmed from open client/server boundary code.
- For this task, the best inspectable auth truth is the combination of `docs/Auth.md`, `src/client/Auth.ts`, `src/server/jwt.ts`, and `src/server/GameServer.ts`.

## Auth-Relevant Risks / Brittleness

Confirmed:

- Dev mode falls back to persistent ID tokens, which `docs/Auth.md` explicitly says is less secure.
- `getPlayToken()` can return a persistent ID instead of a JWT, so any downstream logic must treat the token field as a mixed-mode auth credential depending on environment/runtime state.

Inference, not confirmed by explicit comment:

- Any future adapter or bot logic that assumes JWT-only auth will be brittle in dev/replay-like flows.
