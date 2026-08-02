# Dependencies — Download Links

Complete list of third-party software required to run **Govee Lighting Interaction for Twitch**.

## Required

| Dependency | Version | Download |
|-----------|---------|----------|
| Node.js (LTS) | 20+, 22 recommended | https://nodejs.org/en/download |
| npm | bundled with Node.js | included in the Node.js installer |

> On Windows, you can also use **Laragon** (bundles Node.js and manages services): https://laragon.org/download/

## Optional

| Dependency | Purpose | Download |
|-----------|---------|----------|
| Git | Clone the repository | https://git-scm.com/downloads |
| Google Chrome | Auto-open the dashboard in your default browser detection | https://www.google.com/chrome/ |
| Twitch account + Developer Console app | OAuth credentials (Client ID / Client Secret) for the Twitch integration — see [INSTALLATION.md](INSTALLATION.md) | https://dev.twitch.tv/console/apps |
| Govee Home (mobile app) | Initial light setup / firmware updates | iOS: https://apps.apple.com/app/govee-home/id1395696823 · Android: https://play.google.com/store/apps/details?id=com.govee.home |

> No external token generator is needed — the dashboard obtains and refreshes the Twitch token itself via OAuth.
> Chrome is only used for auto-opening the dashboard URL. Any browser can access `https://localhost:3001` manually (self-signed certificate warning expected).
