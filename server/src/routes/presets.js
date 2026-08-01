import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../storage/store.js';
import { applyPreset } from '../services/presetApply.js';
import { sendError, respondError } from '../errors.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(store.getPresets());
});

router.post('/', (req, res) => {
  const { name, targets, state } = req.body;
  if (!name || !targets || !state) {
    return sendError(req, res, 400, 'preset.nameTargetsStateRequired');
  }

  const presets = store.getPresets();
  const entry = {
    id: uuidv4(),
    name,
    targets,
    state,
    createdAt: new Date().toISOString(),
  };

  presets.push(entry);
  store.savePresets(presets);
  res.status(201).json(entry);
});

router.patch('/:id', (req, res) => {
  const presets = store.getPresets();
  const idx = presets.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return sendError(req, res, 404, 'common.notFound');

  const { name, targets, state } = req.body;
  if (name !== undefined) presets[idx].name = name;
  if (targets !== undefined) presets[idx].targets = targets;
  if (state !== undefined) presets[idx].state = state;

  store.savePresets(presets);
  res.json(presets[idx]);
});

router.delete('/:id', (req, res) => {
  let presets = store.getPresets();
  const before = presets.length;
  presets = presets.filter((p) => p.id !== req.params.id);
  if (presets.length === before) {
    return sendError(req, res, 404, 'common.notFound');
  }
  store.savePresets(presets);
  res.status(204).end();
});

router.post('/:id/apply', async (req, res) => {
  const presets = store.getPresets();
  const preset = presets.find((p) => p.id === req.params.id);
  if (!preset) return sendError(req, res, 404, 'preset.notFound');

  try {
    const applied = await applyPreset(preset);
    res.json({ ok: true, applied });
  } catch (err) {
    respondError(req, res, err);
  }
});

export default router;
