import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');

const FILES = {
  devices: 'devices.json',
  groups: 'groups.json',
  presets: 'presets.json',
  twitch: 'twitch.json',
  settings: 'settings.json',
};

const DEFAULT_SETTINGS = {
  lang: 'en_US',
  link: { enabled: false, deviceIds: [] },
  linkedState: null,
  deviceStates: {},
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function read(key) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, FILES[key]);
  if (!fs.existsSync(filePath)) {
    if (key === 'twitch') return {};
    if (key === 'settings') return { ...DEFAULT_SETTINGS };
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function write(key, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, FILES[key]);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export const store = {
  getDevices: () => read('devices'),
  saveDevices: (data) => write('devices', data),
  getGroups: () => read('groups'),
  saveGroups: (data) => write('groups', data),
  getPresets: () => read('presets'),
  savePresets: (data) => write('presets', data),
  getTwitch: () => read('twitch'),
  saveTwitch: (data) => write('twitch', data),
  getSettings: () => read('settings'),
  saveSettings: (data) => write('settings', data),
};
