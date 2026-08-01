import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as govee from '../services/govee.js';
import { store } from '../storage/store.js';
import { sendError, respondError, AppError } from '../errors.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(store.getGroups());
});

router.post('/', (req, res) => {
  const { name, deviceIds } = req.body;
  if (!name || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return sendError(req, res, 400, 'group.nameAndDeviceIdsRequired');
  }

  const groups = store.getGroups();
  const entry = {
    id: uuidv4(),
    name,
    deviceIds,
    createdAt: new Date().toISOString(),
  };

  groups.push(entry);
  store.saveGroups(groups);
  res.status(201).json(entry);
});

router.patch('/:id', (req, res) => {
  const groups = store.getGroups();
  const idx = groups.findIndex((g) => g.id === req.params.id);
  if (idx === -1) return sendError(req, res, 404, 'common.notFound');

  const { name, deviceIds } = req.body;
  if (name !== undefined) groups[idx].name = name;
  if (deviceIds !== undefined) groups[idx].deviceIds = deviceIds;

  store.saveGroups(groups);
  res.json(groups[idx]);
});

router.delete('/:id', (req, res) => {
  let groups = store.getGroups();
  const before = groups.length;
  groups = groups.filter((g) => g.id !== req.params.id);
  if (groups.length === before) {
    return sendError(req, res, 404, 'common.notFound');
  }
  store.saveGroups(groups);
  res.status(204).end();
});

router.post('/:id/control', async (req, res) => {
  const groups = store.getGroups();
  const group = groups.find((g) => g.id === req.params.id);
  if (!group) return sendError(req, res, 404, 'common.notFound');

  const devices = store.getDevices();
  const targets = devices.filter((d) => group.deviceIds.includes(d.id));
  if (targets.length === 0) {
    return sendError(req, res, 400, 'group.noLightsInGroup');
  }

  const { action, brightness, color, kelvin } = req.body;

  try {
    await Promise.all(
      targets.map(async (device) => {
        switch (action) {
          case 'on':
            await govee.turnOn(device.ip);
            break;
          case 'off':
            await govee.turnOff(device.ip);
            break;
          case 'brightness':
            await govee.setBrightness(device.ip, brightness);
            break;
          case 'color':
            await govee.setColor(device.ip, color.r, color.g, color.b);
            break;
          case 'kelvin':
            await govee.setColorTemperature(device.ip, kelvin);
            break;
          default:
            throw new AppError('common.invalidAction');
        }
      })
    );
    res.json({ ok: true, count: targets.length });
  } catch (err) {
    respondError(req, res, err);
  }
});

export default router;
