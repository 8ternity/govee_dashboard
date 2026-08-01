import express from 'express';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import devicesRouter from './routes/devices.js';
import groupsRouter from './routes/groups.js';
import presetsRouter from './routes/presets.js';
import effectsRouter from './routes/effects.js';
import settingsRouter from './routes/settings.js';
import twitchRouter from './routes/twitch.js';
import backupRouter from './routes/backup.js';
import { errorMiddleware } from './errors.js';
import { startTwitchListener } from './services/twitchListener.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: pkg.version });
});

app.use('/api/devices', devicesRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/effects', effectsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/twitch', twitchRouter);
app.use('/api/backup', backupRouter);

app.use(express.static(CLIENT_DIST));
app.get('*', (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Govee Lighting Interaction for Twitch → http://localhost:${PORT}`);
  startTwitchListener();
  openBrowser(`http://localhost:${PORT}`);
});

function findChrome() {
  if (process.platform !== 'win32') return null;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function openBrowser(url) {
  if (process.env.NO_BROWSER === '1') return;
  try {
    const marker = path.join(os.tmpdir(), 'govee-twitch-browser-open');
    const last = fs.existsSync(marker) ? Number(fs.readFileSync(marker, 'utf8')) || 0 : 0;
    if (Date.now() - last < 60000) return;
    fs.writeFileSync(marker, String(Date.now()));
  } catch {
    /* ignore */
  }

  const chrome = findChrome();
  let cmd;
  if (chrome) {
    cmd = `"${chrome}" "${url}"`;
  } else if (process.platform === 'win32') {
    cmd = `cmd /c start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  setTimeout(() => {
    try {
      exec(cmd);
      console.log(`Navigateur ouvert → ${url}`);
    } catch {
      console.log('Impossible d\'ouvrir le navigateur automatiquement.');
    }
  }, 500);
}
