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

**Port app** : `3001` (HTTPS — l'auth OAuth Twitch l'exige)

---

## Installation rapide (Windows)

**1. Télécharger et décompresser**

Télécharge le zip de la dernière version depuis la page [Releases](https://github.com/8ternity/govee_dashboard/releases) et décompresse-le à un endroit de ton choix.

**2. Installer**

```powershell
cd chemin\vers\govee_dashboard
.\install.ps1
```

**3. Démarrer**

Double-clique sur **`start.bat`** (ou lance `.\start.ps1`) — il vérifie les dépendances, le build frontend et le port, puis lance le serveur.

Ou manuellement :

```powershell
cd server
npm run dev
```

Ouvrir : **https://localhost:3001**

> Le dashboard tourne en **HTTPS** avec un certificat auto-signé généré automatiquement au premier démarrage. Le navigateur affichera un avertissement de sécurité (« connexion non fiable ») — c'est **normal**, clique sur **Avancé → Continuer** (ou installe le certificat, voir [HTTPS & certificat auto-signé](#https--certificat-auto-signé)).

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
3. **Créer une application Twitch** (voir [Créer une application Twitch](#créer-une-application-twitch)) et récupérer le **Client ID** + **Client Secret**.
4. **Connecter Twitch dans le dashboard** — section **Twitch** :
   - **Étape 1 — Identifiants de l'application** : colle ton **Client ID**, ton **Client Secret** et ton **nom de chaîne**, puis clique **Sauvegarder les identifiants**.
   - **Étape 2 — Connexion à Twitch** : clique **Connecter avec Twitch** → autorise dans la fenêtre Twitch → le dashboard reçoit le **token + refresh token** (renouvellement automatique, plus de générateur externe).
   - Clique **Tester la connexion** pour confirmer.
5. **Mapper les événements** — associe chaque événement (Follow, Cheer, Subs, Raid) à un appareil + preset avec une durée d'effet.
6. **Vérifier** — bouton **Simuler Follow** pour déclencher l'effet manuellement.

---

## Créer une application Twitch

Le dashboard utilise l'**OAuth officiel de Twitch** — il obtient et renouvelle lui-même le token. Il faut d'abord créer une application dans la console développeur Twitch.

1. Va sur la **[Console développeur Twitch](https://dev.twitch.tv/console/apps)** et connecte-toi avec ton compte (le compte du **modérateur de la chaîne**).
2. Clique **Register Your Application** (ou **Créer votre application**) et remplis :
   - **Name** : un nom libre, par ex. `Govee Dashboard`.
   - **OAuth Redirect URLs** : ajoute **exactement** :
     ```
     https://localhost:3001/api/twitch/callback
     ```
     (`https`, pas `http`, sans `/` final — sinon erreur `redirect_mismatch`).
   - **Category / Type** : choisis **Chat Bot** (ou *Application Integration*).
3. Clique **Create**. Copie le **Client ID**.
4. Clique **New Secret** (ou **Nouveau secret**) pour afficher le **Client Secret** et copie-le.
5. Renseigne ces deux valeurs dans le dashboard (section Twitch → Étape 1), puis clique **Connecter avec Twitch**.

> 💡 Changer un de ces réglages sur Twitch (URI de redirection, etc.) peut mettre à jour le Client Secret — réactualise-le dans le dashboard si besoin.

### HTTPS & certificat auto-signé

L'OAuth Twitch **exige HTTPS** : c'est pourquoi le serveur sert le dashboard en `https://localhost:3001` avec un certificat auto-signé généré automatiquement au premier démarrage (`server/data/server.crt` + `server.key`, valide 10 ans, pour `localhost` et `127.0.0.1`).

- Au premier accès, le navigateur affiche un avertissement : clique **Avancé → Continuer vers localhost**.
- Pour supprimer définitivement l'avertissement, installe le certificat une fois en administrateur :

```powershell
certutil -addstore Root "C:\chemin\vers\govee_dashboard\server\data\server.crt"
```

> Si tu vois `redirect_mismatch` en cliquant « Connecter avec Twitch », c'est que l'URI enregistrée sur Twitch ne correspond pas **exactement** à `https://localhost:3001/api/twitch/callback`.

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
| `twitch.json` | Client ID, Client Secret, access + refresh token, mappings événements | **Oui — copier** |
| `server.crt` / `server.key` | Certificat auto-signé HTTPS | Re-généré automatiquement (ne pas copier) |
| `devices.json` | Lumières (IP, MAC, labels) | Copier — rescan si IPs changent |
| `presets.json` | Presets lumières | Copier avec `devices.json` |
| `settings.json` | État LINK, cache, langue active (`lang`) | Copier |
| `groups.json` | Groupes | Copier |
| `effects/H16C0.json` | Catalogue effets | Inclus dans le projet |

**Langue de l'interface** : sélectionnable dans le dashboard (menu **Paramètres → Langue**). Le choix (Français `fr_CA` ou English `en_US`) est enregistré dans `settings.json` ; par défaut `en_US`.

---

## Migrer vers un autre PC

### Les clés Twitch sont exportables

Les credentials sont dans `server/data/twitch.json` (fichier local, gitignored).

**Étapes :**

1. Sur l'ancien PC, copie le dossier `server/data/` entier.
2. Colle-le dans `server/data/` sur le nouveau PC (remplace les fichiers).
3. Installe le projet (`install.ps1` ou manuel).
4. Lance le serveur → section Twitch → **Tester la connexion** (le token se renouvelle automatiquement avec le refresh token).

**Script d'export (ancien PC) :**

```powershell
.\scripts\export-data.ps1
```

Génère `govee-dashboard-backup-AAAA-MM-JJ.zip` à copier sur l'autre machine, puis :

```powershell
.\scripts\import-data.ps1 -ZipFile chemin\vers\backup.zip
```

> ⚠️ **Les archives de sauvegarde ne contiennent plus les secrets Twitch** (`clientId`, `clientSecret`, `accessToken`, `refreshToken` sont retirés). Après import, reconnecte Twitch via **Connecter avec Twitch**, ou copie `server/data/twitch.json` directement.

### Points d'attention

- **Token Twitch** : renouvelé **automatiquement** par le refresh token (plus de générateur externe). Scopes demandés :
  - `channel:read:subscriptions`
  - `bits:read`
  - `moderator:read:followers`
  - `user:read:chat` (optionnel — Sub Prime)
- **Si le refresh échoue** : clique **Déconnecter Twitch** puis **Connecter avec Twitch** pour recréer un token.
- **IPs lumières** : si le réseau change, lance un **scan** dans le dashboard ou `POST /api/devices/sync-ips`.
- **Presets** : liés aux IDs dans `devices.json`. Migre **devices + presets ensemble**. Si tu rescanne et recrées les lumières, recrée aussi les presets ou remappe Twitch.
- **Ne partage pas** `twitch.json` publiquement (GitHub, Discord…) — contient ton access token, ton refresh token et ton Client Secret.
- **HTTPS** : sur le nouveau PC, la même URI `https://localhost:3001/api/twitch/callback` reste valable si le serveur tourne sur le port 3001.

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Lumière absente au scan | Active **LAN Control** dans l'app Govee Home (Paramètres appareil → LAN Control → On) |
| `EADDRINUSE :3001` | Un serveur tourne déjà : `netstat -ano \| findstr :3001` puis `taskkill /PID xxx /F` |
| Lumière hors ligne | Vérifie alimentation, même Wi-Fi, relance scan |
| Twitch connecté mais pas d'effet | Vérifie preset (⚠ dans mapping), bouton **Simuler Follow** |
| EventSub arrêté | Regarde les logs debug ; **Tester connexion → Sauvegarder**, puis redémarre le serveur |
| `redirect_mismatch` au connect | L'URI enregistrée sur Twitch doit être **exactement** `https://localhost:3001/api/twitch/callback` |
| `Client ID and OAuth token do not match` | Le token appartient à une autre app Twitch — clique **Connecter avec Twitch** pour en créer un nouveau |
| Avertissement navigateur « connexion non fiable » | Normal avec le certificat auto-signé — continue, ou installe le certificat (voir [HTTPS & certificat auto-signé](#https--certificat-auto-signé)) |

---

## Commandes utiles

```powershell
# Dev (auto-reload)
cd server
npm run dev

# Rebuild UI après modifs client
cd client
npm run build

# Santé API (certificat auto-signé → utiliser -k)
curl -k https://localhost:3001/api/health
```
