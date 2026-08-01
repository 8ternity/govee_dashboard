import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { store } from '../storage/store.js';
import { sendError } from '../errors.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

const FILE_MAP = {
  devices: 'devices.json',
  presets: 'presets.json',
  twitch: 'twitch.json',
  settings: 'settings.json',
  groups: 'groups.json',
};

router.get('/export', (_req, res) => {
  res.json({
    version: '1.0',
    exportedAt: new Date().toISOString(),
    devices: store.getDevices(),
    presets: store.getPresets(),
    twitch: store.getTwitch(),
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
      fs.copyFileSync(src, path.join(backupDir, fileName));
    }
  }

  store.saveDevices(body.devices);
  store.savePresets(body.presets);
  store.saveTwitch(body.twitch);
  store.saveSettings(body.settings);
  store.saveGroups(body.groups);

  res.json({ ok: true, backupDir: path.basename(backupDir) });
});

export default router;
