import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as govee from '../services/govee.js';
import { store } from '../storage/store.js';
import { sendError, respondError } from '../errors.js';

const router = Router();

function rgbToHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b]
      .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0'))
      .join('')
  );
}

router.post('/sync-ips', async (_req, res) => {
  try {
    const devices = store.getDevices();
    if (devices.length === 0) {
      return res.json({ updated: [], offline: [], devices });
    }

    const found = await govee.queryConfiguredDevices(
      devices.map((d) => d.ip),
      { timeout: 3500 }
    );
    const updated = [];
    const offline = [];

    for (const d of devices) {
      const match = found.find((f) => f.device === d.device);
      if (match) {
        if (match.ip !== d.ip) {
          updated.push({ id: d.id, label: d.label, oldIp: d.ip, newIp: match.ip });
          d.ip = match.ip;
        }
      } else {
        offline.push({ id: d.id, label: d.label, ip: d.ip });
      }
    }

    store.saveDevices(devices);
    res.json({ updated, offline, devices });
  } catch (err) {
    respondError(req, res, err);
  }
});

router.get('/scan', async (req, res) => {
  try {
    const extra = req.query.ips ? req.query.ips.split(',').map((s) => s.trim()) : [];
    const devices = await govee.scanNetwork({
      extraAddresses: extra,
      broadcastAll: req.query.broadcastAll !== 'false',
      useMulticast: req.query.multicast !== 'false',
    });
    res.json(devices);
  } catch (err) {
    respondError(req, res, err);
  }
});

router.post('/scan-ip', async (req, res) => {
  const { ip } = req.body;
  if (!ip) return sendError(req, res, 400, 'device.ipRequired');
  try {
    const device = await govee.scanIp(ip);
    res.json(device);
  } catch (err) {
    respondError(req, res, err);
  }
});

router.get('/', (_req, res) => {
  res.json(store.getDevices());
});

router.post('/', (req, res) => {
  const { device, sku, deviceName, ip, label } = req.body;
  if (!device || !ip) {
    return sendError(req, res, 400, 'device.deviceAndIpRequired');
  }

  const devices = store.getDevices();
  if (devices.some((d) => d.device === device)) {
    return sendError(req, res, 409, 'device.alreadyRegistered');
  }

  const entry = {
    id: uuidv4(),
    device,
    sku: sku || '',
    deviceName: deviceName || sku || device,
    ip,
    label: label || deviceName || device,
    addedAt: new Date().toISOString(),
  };

  devices.push(entry);
  store.saveDevices(devices);
  res.status(201).json(entry);
});

router.post('/reorder', (req, res) => {
  const { ids } = req.body;
  const devices = store.getDevices();
  if (
    !Array.isArray(ids) ||
    ids.length !== devices.length ||
    new Set(ids).size !== ids.length
  ) {
    return sendError(req, res, 400, 'device.reorderInvalid');
  }
  const byId = new Map(devices.map((d) => [d.id, d]));
  for (const id of ids) {
    if (!byId.has(id)) return sendError(req, res, 400, 'device.reorderInvalid');
  }
  const reordered = ids.map((id) => byId.get(id));
  store.saveDevices(reordered);
  res.json(reordered);
});

router.patch('/:id', (req, res) => {
  const devices = store.getDevices();
  const idx = devices.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return sendError(req, res, 404, 'common.notFound');

  const { label, deviceName, ip } = req.body;
  if (label !== undefined) devices[idx].label = label;
  if (deviceName !== undefined) devices[idx].deviceName = deviceName;
  if (ip !== undefined) devices[idx].ip = ip;

  store.saveDevices(devices);
  res.json(devices[idx]);
});

router.delete('/:id', (req, res) => {
  let devices = store.getDevices();
  const before = devices.length;
  devices = devices.filter((d) => d.id !== req.params.id);
  if (devices.length === before) {
    return sendError(req, res, 404, 'common.notFound');
  }
  store.saveDevices(devices);
  res.status(204).end();
});

router.post('/status', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return sendError(req, res, 400, 'device.idsRequired');
  }

  const devices = store.getDevices();
  const targets = devices.filter((d) => ids.includes(d.id));
  const byIp = await govee.queryStatuses(targets.map((d) => d.ip));

  const result = {};
  for (const d of targets) {
    const status = byIp[d.ip];
    result[d.id] = status
      ? {
          on: status.on,
          brightness: status.brightness,
          color: rgbToHex(status.color),
          kelvin: status.kelvin,
        }
      : null;
  }
  res.json(result);
});

router.get('/:id/status', async (req, res) => {
  const devices = store.getDevices();
  const device = devices.find((d) => d.id === req.params.id);
  if (!device) return sendError(req, res, 404, 'common.notFound');

  try {
    const status = await govee.queryStatus(device.ip);
    res.json({
      on: status.on,
      brightness: status.brightness,
      color: rgbToHex(status.color),
      kelvin: status.kelvin,
    });
  } catch (err) {
    respondError(req, res, err);
  }
});

router.post('/bulk-control', async (req, res) => {
  const { ids, ...body } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return sendError(req, res, 400, 'device.idsRequired');
  }

  const devices = store.getDevices();
  const targets = devices.filter((d) => ids.includes(d.id));
  if (targets.length === 0) {
    return sendError(req, res, 404, 'device.noLightsFound');
  }

  try {
    await govee.controlDevices(
      targets.map((d) => d.ip),
      body
    );
    res.json({ ok: true, count: targets.length });
  } catch (err) {
    respondError(req, res, err);
  }
});

router.post('/:id/control', async (req, res) => {
  const devices = store.getDevices();
  const device = devices.find((d) => d.id === req.params.id);
  if (!device) return sendError(req, res, 404, 'common.notFound');

  try {
    await govee.controlDevice(device.ip, req.body);
    res.json({ ok: true });
  } catch (err) {
    respondError(req, res, err);
  }
});

export default router;
