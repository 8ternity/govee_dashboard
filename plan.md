# Plan — Govee Dashboard

> App locale pour gérer les lumières Govee (H16C0) via API LAN + intégration Twitch.
> Doc Govee : https://app-h5.govee.com/user-manual/wlan-guide

## Stack

| Couche | Choix |
|--------|-------|
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Persistance | JSON local (`server/data/`) |
| Protocole Govee | UDP multicast scan + UDP contrôle LAN |

## Structure

```
govee_dashboard/
├── plan.md
├── projet.md
├── server/          # API REST + Govee LAN
│   ├── src/
│   └── data/        # devices, groups, presets, twitch
└── client/          # Dashboard React
    └── src/
```

---

## Phase I — Dashboard Govee

### 1. Fondations ✅ en cours
- [x] Structure projet (server + client)
- [x] Module API Govee LAN (scan, contrôle H16C0)
- [x] Modèle de données : Device, Group, Preset
- [x] API REST de base

### 2. Découverte & gestion des lumières
- [x] Scan réseau automatique (multicast UDP)
- [x] Ajout manuel des lumières découvertes
- [x] Renommage + label personnalisé
- [ ] Persistance et rechargement au démarrage (partiel)

### 3. Groupes (Link)
- [x] CRUD groupes (API)
- [ ] UI sélection multi-lumières
- [ ] Contrôle groupé depuis le dashboard

### 4. Effets & scènes
- [ ] Bibliothèque d'effets / dégradés
- [ ] Application sur lumière ou groupe
- [ ] Scènes prédéfinies Govee

### 5. Presets
- [x] CRUD presets (API)
- [ ] UI création preset (luminosité %, couleur, scène)
- [ ] Déclenchement manuel depuis le dashboard

---

## Phase II — Twitch

### Recommandation suivi chat
- **EventSub WebSocket** (API officielle Twitch, temps réel)
- Alternative IRC : plus simple mais moins fiable pour subs/bits
- À chaque événement : appliquer preset mappé pendant 30s puis restaurer état

### UI (section repliable, pas de page séparée)
- [x] Lien Console développeur + générateur token
- [x] Client ID, Secret, Access Token, chaîne
- [x] Test connexion + badge état
- [x] Select preset par événement (Follow, Cheer, Sub T1/T2/T3, Prime, Raid entrant)
- [x] Durée raid configurable séparément (raidReactionDurationSec)
- [x] Listener EventSub actif au démarrage serveur
- [x] Déclenchement preset + log événements (follow, cheer, sub, raid)

---

## Ordre de développement

| Étape | Contenu | Statut |
|-------|---------|--------|
| 1 | Setup + scan LAN + contrôle basique | 🔄 |
| 2 | CRUD lumières + renommage UI | 🔄 |
| 3 | Groupes + contrôle groupé | ⏳ |
| 4 | Effets/scènes + presets UI | ⏳ |
| 5 | Twitch config + EventSub | ⏳ |
| 6 | Tests + polish | ⏳ |

## Commandes

```bash
# Build frontend + lancer (tout sur port 3001)
cd client && npm run build
cd ../server && npm run dev

# Dev frontend séparé (hot reload, port 5173)
cd client && npm run dev
```
