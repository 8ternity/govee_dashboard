import { getLocale, t } from './i18n';

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-Lang': getLocale() },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || t('api.genericError'));
  return data;
}

export const api = {
  scan: () => request('/devices/scan'),
  scanIp: (ip) =>
    request('/devices/scan-ip', { method: 'POST', body: JSON.stringify({ ip }) }),
  getDevices: () => request('/devices'),
  syncIps: () => request('/devices/sync-ips', { method: 'POST' }),
  reorderDevices: (ids) =>
    request('/devices/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  addDevice: (body) => request('/devices', { method: 'POST', body: JSON.stringify(body) }),
  updateDevice: (id, body) =>
    request(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDevice: (id) => request(`/devices/${id}`, { method: 'DELETE' }),
  controlDevice: (id, body) =>
    request(`/devices/${id}/control`, { method: 'POST', body: JSON.stringify(body) }),
  controlDevices: (ids, body) =>
    request('/devices/bulk-control', {
      method: 'POST',
      body: JSON.stringify({ ids, ...body }),
    }),

  getEffects: (sku) => request(`/effects/${sku}`),

  getSettings: () => request('/settings'),
  updateSettings: (body) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  getDevicesStatus: (ids) =>
    request('/devices/status', { method: 'POST', body: JSON.stringify({ ids }) }),

  getPresets: () => request('/presets'),
  addPreset: (body) => request('/presets', { method: 'POST', body: JSON.stringify(body) }),
  deletePreset: (id) => request(`/presets/${id}`, { method: 'DELETE' }),
  applyPreset: (id) => request(`/presets/${id}/apply`, { method: 'POST' }),

  getTwitch: () => request('/twitch'),
  updateTwitch: (body) =>
    request('/twitch', { method: 'PATCH', body: JSON.stringify(body) }),
  testTwitch: () => request('/twitch/test', { method: 'POST' }),
  getTwitchDebug: () => request('/twitch/debug'),
  clearTwitchDebug: () => request('/twitch/debug', { method: 'DELETE' }),
  getTwitchFollowers: (first = 25) => request(`/twitch/followers?first=${first}`),
  simulateTwitchEvent: (eventKey, user) =>
    request('/twitch/simulate', {
      method: 'POST',
      body: JSON.stringify({ eventKey, user }),
    }),

  exportBackup: () => request('/backup/export'),
  importBackup: (body) =>
    request('/backup/import', { method: 'POST', body: JSON.stringify(body) }),
};
