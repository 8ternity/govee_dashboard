# Installation — Govee Lighting Interaction for Twitch

Application locale pour contrôler des lumières Govee H16C0 (UDP LAN) + intégration Twitch.

## Prérequis

| Outil | Version min. |
|-------|----------------|
| [Node.js](https://nodejs.org/) | 20+ (22 recommandé) |
| npm | inclus avec Node |
| Réseau | PC et lumières Govee sur le **même LAN** |
| App Govee Home (mobile) | — |

**Windows** : Laragon, ou Node.js seul suffit.

> **LAN Control (requis par appareil) :** dans l'app [Govee Home](https://play.google.com/store/apps/details?id=com.govee.home), ouvre les **Paramètres** de chaque lumière et active **LAN Control**. Sans ça, la lumière n'apparaîtra pas au scan.

**Ports réseau (Govee LAN)** :
- UDP 4001 — scan sortant
- UDP 4002 — écoute scan
- UDP 4003 — contrôle

**Port app** : `3001` (HTTP)

---

## Installation rapide (Windows)

```powershell
cd chemin\vers\govee_dashboard
.\install.ps1
```

Puis démarrer :

```powershell
cd server
npm run dev
```

Ouvrir : **http://localhost:3001**

---

## Installation manuelle

### 1. Copier le projet

Copie le dossier `govee_dashboard` sur le nouveau PC (sans `node_modules/` si possible — plus léger).

### 2. Installer les dépendances

```powershell
cd server
npm install

cd ..\client
npm install
npm run build
```

### 3. Lancer le serveur

```powershell
cd server
npm run dev
```

En production locale :

```powershell
npm start
```

---

## Première configuration

1. **Activer LAN Control** — dans l'app Govee Home, ouvre les **Paramètres** de chaque lumière et active **LAN Control** (sinon la lumière n'apparaîtra pas au scan).
2. **Scanner les lumières** — Dashboard → **Lumières → Scan LAN**.
3. **Twitch** — section **Twitch** : renseigne Client ID + token (voir plus bas), nom de chaîne, puis **Tester la connexion** → **Sauvegarder**.
4. **Mapper les événements** — associe chaque événement (Follow, Cheer, Subs, Raid) à un appareil + preset avec une durée d'effet.
5. **Vérifier** — bouton **Simuler Follow** pour déclencher l'effet manuellement.

---

## Modèles supportés

Ce projet a été développé et testé avec la **Govee H16C0 — Floor Lamp 3 Lite** (modèle actuellement en main). **Il n'a pas été testé avec d'autres modèles.**

Le protocole suit l'API LAN officielle de Govee, donc d'autres modèles compatibles LAN pourraient être pris en charge. Cependant, **je ne peux implémenter et tester que sur un appareil physique que je possède** — les formats de paquets varient entre modèles et je ne publie pas de code non vérifié.

📋 Liste officielle des modèles Govee compatibles LAN Control : **https://app-h5.govee.com/user-manual/wlan-guide**

> Pour ajouter le support de ton modèle Govee, tu peux m'envoyer une **donation** ou un **cadeau Amazon (livraison de l'appareil)** afin que je développe et teste la compatibilité.

---

## Structure des données (`server/data/`)

| Fichier | Contenu | Migration |
|---------|---------|-----------|
| `twitch.json` | Client ID, token OAuth, mappings événements | **Oui — copier** |
| `devices.json` | Lumières (IP, MAC, labels) | Copier — rescan si IPs changent |
| `presets.json` | Presets lumières | Copier avec `devices.json` |
| `settings.json` | État LINK, cache, langue active (`lang`) | Copier |
| `groups.json` | Groupes | Copier |
| `effects/H16C0.json` | Catalogue effets | Inclus dans le projet |

**Langue de l'interface** : sélectionnable dans le dashboard (menu **Paramètres → Langue**). Le choix (Français `fr_CA` ou English `en_US`) est enregistré dans `settings.json` ; par défaut `en_US`.

---

## Migrer vers un autre PC

### Oui — les clés Twitch sont exportables

Les credentials sont dans `server/data/twitch.json` (fichier local, gitignored).

**Étapes :**

1. Sur l'ancien PC, copie le dossier `server/data/` entier.
2. Colle-le dans `server/data/` sur le nouveau PC (remplace les fichiers).
3. Installe le projet (`install.ps1` ou manuel).
4. Lance le serveur → section Twitch → **Tester la connexion**.

**Script d'export (ancien PC) :**

```powershell
.\scripts\export-data.ps1
```

Génère `govee-dashboard-backup-AAAA-MM-JJ.zip` à copier sur l'autre machine, puis :

```powershell
.\scripts\import-data.ps1 -ZipFile chemin\vers\backup.zip
```

### Points d'attention

- **Token Twitch** : peut expirer. Si « Token invalide », régénère sur [twitchtokengenerator.com](https://twitchtokengenerator.com/) avec les scopes :
  - `channel:read:subscriptions`
  - `bits:read`
  - `moderator:read:followers`
  - `user:read:chat` (optionnel — Sub Prime)
- **IPs lumières** : si le réseau change, lance un **scan** dans le dashboard ou `POST /api/devices/sync-ips`.
- **Presets** : liés aux IDs dans `devices.json`. Migre **devices + presets ensemble**. Si tu rescanne et recrées les lumières, recrée aussi les presets ou remappe Twitch.
- **Ne partage pas** `twitch.json` publiquement (GitHub, Discord…) — contient ton access token.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Lumière absente au scan | Active **LAN Control** dans l'app Govee Home (Paramètres appareil → LAN Control → On) |
| `EADDRINUSE :3001` | Un serveur tourne déjà : `netstat -ano \| findstr :3001` puis `taskkill /PID xxx /F` |
| Lumière hors ligne | Vérifie alimentation, même Wi-Fi, relance scan |
| Twitch connecté mais pas d'effet | Vérifie preset (⚠ dans mapping), bouton **Simuler Follow** |
| EventSub arrêté | Tester connexion → Sauvegarder → redémarrer serveur |

---

## Commandes utiles

```powershell
# Dev (auto-reload)
cd server
npm run dev

# Rebuild UI après modifs client
cd client
npm run build

# Santé API
curl http://localhost:3001/api/health
```
