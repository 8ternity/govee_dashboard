import { Router } from 'express';
import { store } from '../storage/store.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(store.getSettings());
});

router.patch('/', (req, res) => {
  const current = store.getSettings();
  const next = {
    ...current,
    ...req.body,
    link: { ...current.link, ...req.body.link },
  };
  store.saveSettings(next);
  res.json(next);
});

export default router;
