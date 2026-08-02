# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] — 2026-08-01

### Added
- **Full Twitch OAuth flow** — the dashboard now obtains and manages its own Twitch access token, replacing the external token generator.
  - New **Connect with Twitch** button in the Twitch panel (`GET /api/twitch/auth` → Twitch authorization → `GET /api/twitch/callback`).
  - **Client Secret** field added alongside Client ID.
  - **Disconnect Twitch** button (`DELETE /api/twitch/oauth`) removes the refresh token.
  - The OAuth redirect URI is exposed to the UI (`oauthRedirectUri`) so it can be registered in the Twitch Developer Console.
- **Automatic token refresh** — when the token expires, the server refreshes it transparently via the stored refresh token (`ensureValidConfig()`, called on every Helix request and on connection test).
- **HTTPS dashboard** — the server now serves the app over HTTPS with an auto-generated self-signed certificate.
  - Certificate auto-generated on first run in `server/data/server.crt` / `server.key` (SAN: `localhost`, `127.0.0.1`, valid 10 years) — no manual step required.
  - Optional one-time trust: `certutil -addstore Root "server\data\server.crt"` (admin) to silence the browser warning.
- **Readable EventSub errors** — subscription failures now show the real Twitch error message (e.g. *"Client ID and OAuth token do not match"*) instead of a generic message.
- **Step-based Twitch panel UI** — the panel is organized in two clear steps: *1. Application credentials* (Client ID / Client Secret / Channel name + save) and *2. Connect to Twitch* (connect button, status, redirect URI hint), with the save notification next to its button.

### Changed
- Dashboard URL is now **`https://localhost:3001`** (was `http://localhost:3001`).
- Backup export (`GET /api/backup/export` and `scripts/export-data.ps1`) **strips secrets** (`clientId`, `clientSecret`, `accessToken`, `refreshToken`, `tokenExpiresAt`) — exported archives no longer contain Twitch credentials.
- Removed all references to **twitchtokengenerator.com** from the UI and documentation.

### Fixed
- EventSub subscriptions now fail with the real reason instead of a generic `twitch.helixError`, making mismatches (e.g. token belonging to another Client ID) easy to diagnose.

### Security notes
- `server/data/twitch.json` contains the access token, refresh token and client secret — **never share or commit it** (it is gitignored).
- Secrets are never sent to the client (masked as `••••`).

---

## [1.0.x] — previous releases

Token generated externally via **twitchtokengenerator.com**; dashboard served over plain HTTP. See git history for details.
