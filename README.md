# Govee Lighting Interaction for Twitch

Control **Govee H16C0** lights over your local network (UDP LAN) and react automatically to Twitch events — follows, cheers, subs, Prime subs and raids — with light effects, right from a web dashboard.

- No cloud dependency for light control (direct LAN UDP communication)
- Local web dashboard served from your machine
- Bilingual interface: English (`en_US`, default) / French (`fr_CA`)

## Features

- **Device management** — scan your LAN for Govee lights, control power, color and brightness
- **Effects** — apply built-in effects from the official H16C0 catalog
- **Presets** — save and apply named light presets instantly
- **Groups** — control multiple lights together
- **Twitch integration** — react to live Twitch events:
  - Follows
  - Cheers / Bits
  - Sub Tier 1 / 2 / 3
  - Sub Prime (requires optional `user:read:chat` scope)
  - Incoming raids
- **Twitch OAuth** — connect directly with the **Connect with Twitch** button: no external token generator, the access token is created and **refreshed automatically** (Client ID + Client Secret required)
- **Event mapping** — map each Twitch event to a device + preset with a custom effect duration
- **Backup** — one-click export/import of all local data (secrets are stripped from exports)

## How it works

```
Twitch (EventSub WebSocket)  ──►  Twitch listener (server)  ──►  Preset/effect engine  ──►  Govee lights (UDP LAN)
                                    │
Browser dashboard  ◄──────────  Express API (https://localhost:3001)
```

The server talks to your lights directly via UDP on your local network, then serves the web dashboard at `https://localhost:3001` (HTTPS with an auto-generated self-signed certificate — required for Twitch OAuth).

## Supported devices

This project was developed and tested with the **Govee H16C0 — Floor Lamp 3 Lite**, which is the current hardware in use. **It has not been tested with any other model.**

The communication protocol (LAN UDP) follows Govee's official LAN API, so other LAN-compatible models could likely be supported. However, **I can only implement and test against a device I physically own** — the packet formats and behaviors differ between models, and I will not ship code I cannot verify.

📋 Official list of Govee models supporting LAN Control: **https://app-h5.govee.com/user-manual/wlan-guide**

> If you would like support for your specific Govee model, you can send me a **donation** or an **Amazon gift (delivery of the device)** so I can develop and test compatibility for it. Reach out through the GitHub issues/discussions of this repository. You can also passing by on my Twitch channel **Twitch.TV/ET34N1TY**. 

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Radix UI |
| Backend | Node.js, Express 4 (ESM) |
| Devices | Govee H16C0 — UDP LAN protocol |
| Twitch | OAuth 2.0 (auto-refresh) + Helix API + EventSub (WebSocket) |
| HTTPS | Self-signed certificate (auto-generated via `selfsigned`) |

## Requirements

| Dependency | Minimum | Notes |
|-----------|---------|-------|
| [Node.js](https://nodejs.org/) | 20 | v22 recommended |
| npm | bundled with Node | |
| Network | — | PC and Govee lights on the **same LAN** |
| Govee Home app (mobile) | — | **LAN Control must be enabled per device** (see below) |

> **LAN Control (required per device):** in the [Govee Home app](https://play.google.com/store/apps/details?id=com.govee.home), open the device **Settings** page and switch **LAN Control** to **On**. Your lights will not appear in the scan until this is enabled. If the switch does not appear, the device model is not LAN-compatible (see [Supported devices](#supported-devices)).

See [DEPENDENCIES.md](DEPENDENCIES.md) for direct download links to every dependency.

### Network ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 3001 | TCP/HTTPS | Dashboard + API |
| 4001 | UDP | Outgoing device scan |
| 4002 | UDP | Scan responses (listen) |
| 4003 | UDP | Light control |

---

## Installation

> Choose **Option A** (Windows, one script) or **Option B** (manual, any OS).

### Option A — Quick install (Windows)

**1. Download & extract**

Download the latest release zip from the [Releases page](https://github.com/8ternity/govee_dashboard/releases) and unzip it to a location of your choice.

**2. Run the installer**

```powershell
cd path\to\govee_dashboard
.\install.ps1
```

If your PowerShell execution policy blocks the script:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

The script installs server + client dependencies and builds the frontend.

**3. Start the server**

Double-click **`start.bat`** (or run `.\start.ps1`) — it checks the dependencies, the frontend build and the port, then launches the server.

Or start it manually:

```powershell
cd server
npm run dev
```

Open **https://localhost:3001** (the browser usually opens automatically).

> The dashboard runs over **HTTPS** with an auto-generated self-signed certificate. Your browser will warn that the connection is not trusted — this is expected; proceed anyway (or install the certificate, see [HTTPS & the self-signed certificate](#https--the-self-signed-certificate)).

> **Next step:** once the dashboard is open, follow the [First-run configuration](#first-run-configuration) section below to enable LAN Control, scan your lights and set up Twitch.

### Option B — Manual install (Windows / macOS / Linux)

**1. Get the code**

```bash
git clone https://github.com/8ternity/govee_dashboard.git
cd govee_dashboard
```

> If you downloaded the project as a zip, unzip it and `cd` into the folder.

**2. Install server dependencies**

```bash
cd server
npm install
```

**3. Install client dependencies and build the UI**

```bash
cd ../client
npm install
npm run build
```

**4. Start the server**

```bash
cd ../server
npm run dev
```

The `dist/` folder built in step 3 is served automatically by the server.

### Production / "always on" mode

```bash
cd server
npm start
```

### Developer mode (hot-reload UI)

Run the API server in one terminal and the Vite dev server in another. The Vite dev server proxies `/api` requests to the HTTPS backend (`secure: false`, since the backend uses the self-signed certificate).

```bash
# Terminal 1 — API server
cd server
npm run dev

# Terminal 2 — Vite dev server (http://localhost:5173)
cd client
npm run dev
```

---

## First-run configuration

0. **Enable LAN Control** — In the Govee Home mobile app, open each light's **Device Settings** and toggle **LAN Control** to **On** (required for the scan to detect it).
1. **Scan your lights** — Dashboard → **Devices → Scan LAN**. Your Govee lights should appear. Turn them on first.
2. **Create a Twitch application** — in the [Twitch Developer Console](https://dev.twitch.tv/console/apps) click **Register Your Application**:
   - **Name**: any name, e.g. `Govee Dashboard`
   - **OAuth Redirect URLs**: add **`https://localhost:3001/api/twitch/callback`** (exactly — `https`, no trailing slash)
   - **Category / Type**: choose **Chat Bot** (or *Application Integration*)
   - Click **Create**, then copy the **Client ID** and click **New Secret** to reveal the **Client Secret**
3. **Connect Twitch in the dashboard** — Dashboard → **Twitch**:
   - **Step 1 — Application credentials**: paste your **Client ID**, **Client Secret** and **channel name**, then click **Save credentials**
   - **Step 2 — Connect to Twitch**: click **Connect with Twitch** → authorize on Twitch → the dashboard receives a token + refresh token
   - Click **Test connection** to confirm
4. **Map events** — in the Twitch panel, map each event (Follow, Cheer, Subs, Raid) to a device + preset and set the effect duration.
5. **Verify** — click **Simulate Follow** to trigger the mapped effect manually.

## Twitch OAuth & the access token

The dashboard now handles OAuth entirely on its own — **no external token generator needed**.

- The **Connect with Twitch** button starts the OAuth authorization-code flow (`/api/twitch/auth` → Twitch → `/api/twitch/callback`).
- The server stores the **access token + refresh token** in `server/data/twitch.json` and **refreshes the token automatically** before each API call when it expires (~4 h).
- The token is created with these scopes:
  - `channel:read:subscriptions` (required)
  - `bits:read` (required)
  - `moderator:read:followers` (required)
  - `user:read:chat` (optional — enables Sub Prime detection)
- Use **Disconnect Twitch** to remove the refresh token (the app will then require a new connection).

> ⚠️ **Never share or commit `server/data/twitch.json`** — it contains your access token, refresh token and client secret. It is gitignored, and backup exports strip all secrets.

### HTTPS & the self-signed certificate

Twitch OAuth requires HTTPS, so the dashboard is served over **`https://localhost:3001`** with a self-signed certificate generated automatically on first start (`server/data/server.crt` + `server.key`, SAN: `localhost` + `127.0.0.1`, valid 10 years).

- Your browser will show a security warning on first visit — this is expected for a self-signed certificate. Click **Advanced → Proceed**.
- To silence the warning permanently, install the certificate once (as administrator):

```powershell
certutil -addstore Root "C:\path\to\govee_dashboard\server\data\server.crt"
```

> If you see `redirect_mismatch` when connecting Twitch, the redirect URL in your Twitch app settings must match **exactly** `https://localhost:3001/api/twitch/callback`.

## Configuration (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | HTTPS port for the dashboard/API |
| `NO_BROWSER` | unset | Set to `1` to prevent the server from auto-opening a browser |

Example:

```powershell
$env:PORT = 8080
$env:NO_BROWSER = 1
npm start
```

## Language

The interface language is selectable in **Settings → Language** (`English` / `Français`). Your choice is stored in `server/data/settings.json`. Default is English.

## Data & storage

All data lives in `server/data/` (JSON files):

| File | Contents |
|------|----------|
| `devices.json` | Lights (IP, MAC, labels) |
| `groups.json` | Light groups |
| `presets.json` | Light presets |
| `twitch.json` | Twitch Client ID/Secret, access + refresh token, event mappings (**gitignored, keep private**) |
| `settings.json` | App settings incl. language |
| `effects/H16C0.json` | Effect catalog (shipped with the project) |
| `server.crt` / `server.key` | Auto-generated self-signed certificate (**gitignored**) |

## Backup & migration

Export all data from the old machine (Twitch **secrets are stripped** from the archive):

```powershell
.\scripts\export-data.ps1
```

This creates `govee-dashboard-backup-YYYY-MM-DD.zip`. Import it on the new machine:

```powershell
.\scripts\import-data.ps1 -ZipFile path\to\backup.zip
```

**Notes when moving machines:**

- Presets are tied to device IDs. Migrate `devices.json` + `presets.json` together.
- If your LAN changes, re-scan devices (`POST /api/devices/sync-ips`) and remap Twitch events if presets were recreated.
- Backup archives and `scripts/export-data.ps1` **strip Twitch secrets**. On the new machine, reconnect Twitch (**Connect with Twitch**), or copy `server/data/twitch.json` directly if you want to keep the same credentials.

> 💡 When moving machines, the redirect URI stays the same (`https://localhost:3001/api/twitch/callback`) as long as you run the server on port 3001.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Light does not appear in scan | Enable **LAN Control** in the Govee Home app (device Settings → LAN Control → On) |
| `EADDRINUSE :3001` | A server is already running: `netstat -ano \| findstr :3001`, then `taskkill /PID <pid> /F` |
| Light shows offline | Check power and that the PC/lights are on the same Wi-Fi; re-run the scan |
| Twitch connected but no effect | Check the preset mapping (⚠ marker) and use **Simulate Follow** |
| EventSub stopped | Check the debug logs; **Test connection → Save**, then restart the server |
| `redirect_mismatch` on connect | The redirect URL in your Twitch app must be **exactly** `https://localhost:3001/api/twitch/callback` |
| `Client ID and OAuth token do not match` | The token belongs to another Twitch app — click **Connect with Twitch** to get a fresh token for the current Client ID |
| Browser warning "connection not trusted" | Expected with the self-signed certificate — proceed, or install it (see [HTTPS & the self-signed certificate](#https--the-self-signed-certificate)) |
| Script blocked by PowerShell | Use `powershell -ExecutionPolicy Bypass -File .\install.ps1` |

## Project structure

```
govee_dashboard/
├── client/                 # React + Vite dashboard
│   ├── src/components/     # UI components
│   └── src/i18n/           # Translations (en_US, fr_CA)
├── server/
│   ├── src/
│   │   ├── routes/         # Express API routes
│   │   ├── services/       # Govee UDP, Twitch, presets, backup
│   │   ├── storage/        # JSON persistence
│   │   ├── ssl.js          # Self-signed certificate generation
│   │   └── index.js        # Server entry point (HTTPS)
│   └── data/               # Local data (gitignored: twitch.json, *.crt, *.key)
├── scripts/                # Backup/restore PowerShell scripts
├── install.ps1             # Windows one-shot installer
├── CHANGELOG.md            # Release notes
├── INSTALLATION.md         # French install guide
└── DEPENDENCIES.md         # Dependency download links
```

## API overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| GET/POST | `/api/devices` | List / scan devices |
| POST | `/api/devices/sync-ips` | Re-sync device IPs |
| CRUD | `/api/groups` | Light groups |
| CRUD | `/api/presets` | Presets |
| CRUD | `/api/effects` | Effects |
| GET/PATCH | `/api/settings` | Settings (incl. language) |
| CRUD | `/api/twitch` | Twitch config + event mappings |
| GET | `/api/twitch/auth` | Start Twitch OAuth (redirects to Twitch) |
| GET | `/api/twitch/callback` | OAuth callback (token exchange) |
| DELETE | `/api/twitch/oauth` | Disconnect OAuth (clear refresh token) |
| GET/POST | `/api/twitch/followers` · `/simulate` | Recent followers / test a Twitch event |
| GET/POST | `/api/backup/export` · `/import` | Backup / restore (secrets stripped) |

## License

[MIT](LICENSE) © 2026 8ternity
