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
- **Event mapping** — map each Twitch event to a device + preset with a custom effect duration
- **Backup** — one-click export/import of all local data

## How it works

```
Twitch (EventSub WebSocket)  ──►  Twitch listener (server)  ──►  Preset/effect engine  ──►  Govee lights (UDP LAN)
                                    │
Browser dashboard  ◄──────────  Express API (localhost:3001)
```

The server talks to your lights directly via UDP on your local network, then serves the web dashboard at `http://localhost:3001`.

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
| Twitch | Helix API + EventSub (WebSocket) |

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
| 3001 | TCP/HTTP | Dashboard + API |
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

```powershell
cd server
npm run dev
```

Open **http://localhost:3001** (the browser usually opens automatically).

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

Run the API server in one terminal and the Vite dev server in another. The Vite dev server proxies `/api` requests to the backend.

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
2. **Twitch setup** — Dashboard → **Twitch**:
   - Get your **Client ID** from the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and your **OAuth access token** from the [Twitch Token Generator](https://twitchtokengenerator.com/) (these links also appear in the Twitch panel)
   - Enter your **channel name**
   - Click **Test connection**, then **Save**

> **HTTPS note:** Twitch OAuth authorization requires HTTPS. The token is generated on the external **twitchtokengenerator.com** (HTTPS), so **no local HTTPS/SSL setup is needed** — your dashboard stays on plain `http://localhost:3001` and the server only calls Twitch's APIs over HTTPS.
3. **Map events** — in the Twitch panel, map each event (Follow, Cheer, Subs, Raid) to a device + preset and set the effect duration.
4. **Verify** — click **Simulate Follow** to trigger the mapped effect manually.

## Twitch access token

Generate a token at [twitchtokengenerator.com](https://twitchtokengenerator.com/) with the following scopes:

- `channel:read:subscriptions` (required)
- `bits:read` (required)
- `moderator:read:followers` (required)
- `user:read:chat` (optional — enables Sub Prime detection)

> ⚠️ The token can expire. If you see "Token invalid", regenerate it with the same scopes. Never share `server/data/twitch.json` — it contains your access token.

> **HTTPS note:** Twitch OAuth authorization requires HTTPS. The token is generated externally on the **Twitch Token Generator** (HTTPS), so **no local HTTPS/SSL certificate is needed** — the dashboard runs on plain `http://localhost:3001` and the server calls Twitch's APIs over HTTPS. Never paste your token into a non-HTTPS site.

## Configuration (environment variables)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | HTTP port for the dashboard/API |
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
| `twitch.json` | Twitch credentials + event mappings (**gitignored, keep private**) |
| `settings.json` | App settings incl. language |
| `effects/H16C0.json` | Effect catalog (shipped with the project) |

## Backup & migration

Export everything (including Twitch credentials) from the old machine:

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
- Regenerate the Twitch token if it expired (see above).

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Light does not appear in scan | Enable **LAN Control** in the Govee Home app (device Settings → LAN Control → On) |
| `EADDRINUSE :3001` | A server is already running: `netstat -ano \| findstr :3001`, then `taskkill /PID <pid> /F` |
| Light shows offline | Check power and that the PC/lights are on the same Wi-Fi; re-run the scan |
| Twitch connected but no effect | Check the preset mapping (⚠ marker) and use **Simulate Follow** |
| EventSub stopped | Test connection → Save → restart the server |
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
│   │   └── index.js        # Server entry point
│   └── data/               # Local data (gitignored: twitch.json)
├── scripts/                # Backup/restore PowerShell scripts
├── install.ps1             # Windows one-shot installer
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
| GET/POST | `/api/backup/export` · `/import` | Backup / restore |

## License

[MIT](LICENSE) © 2026 8ternity
