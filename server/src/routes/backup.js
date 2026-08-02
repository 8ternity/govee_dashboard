import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { store } from '../storage/store.js';
import { sendError } from '../errors.js';

const require = createRequire(import.meta.url);

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const APP_VERSION = require('../../package.json').version;

const FILE_MAP = {
  devices: 'devices.json',
  presets: 'presets.json',
  twitch: 'twitch.json',
  settings: 'settings.json',
  groups: 'groups.json',
};

const TWITCH_SENSITIVE_FIELDS = [
  'clientId',
  'clientSecret',
  'accessToken',
  'refreshToken',
  'tokenExpiresAt',
];

function sanitizeTwitchForBackup(config) {
  const out = { ...(config || {}) };
  for (const key of TWITCH_SENSITIVE_FIELDS) {
    delete out[key];
  }
  return out;
}

router.get('/export', (_req, res) => {
  res.json({
    version: '1.0',
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    devices: store.getDevices(),
    presets: store.getPresets(),
    twitch: sanitizeTwitchForBackup(store.getTwitch()),
    settings: store.getSettings(),
    groups: store.getGroups(),
  });
});

router.post('/import', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return sendError(req, res, 400, 'backup.invalidBackup');
  }

  for (const key of Object.keys(FILE_MAP)) {
    if (body[key] === undefined) {
      return sendError(req, res, 400, 'backup.missingField', { key });
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(DATA_DIR, `_backup-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const fileName of Object.values(FILE_MAP)) {
    const src = path.join(DATA_DIR, fileName);
    if (fs.existsSync(src)) {
      const dest = path.join(backupDir, fileName);
      if (fileName === 'twitch.json') {
        const content = JSON.parse(fs.readFileSync(src, 'utf-8'));
        fs.writeFileSync(dest, JSON.stringify(sanitizeTwitchForBackup(content), null, 2), 'utf-8');
      } else {
        fs.copyFileSync(src, dest);
      }
    }
  }

  store.saveDevices(body.devices);
  store.savePresets(body.presets);
  store.saveTwitch(body.twitch);
  store.saveSettings(body.settings);
  store.saveGroups(body.groups);

  const importedVersion =
    typeof body.appVersion === 'string' && body.appVersion ? body.appVersion : null;
  const compatibility =
    importedVersion && importedVersion !== APP_VERSION
      ? {
          imported: importedVersion,
          current: APP_VERSION,
          needsMigration: true,
        }
      : null;

  res.json({
    ok: true,
    backupDir: path.basename(backupDir),
    importedVersion,
    compatibility,
  });
});

export default router;
