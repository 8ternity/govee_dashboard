import { Router } from 'express';
import { getEffectsForSku } from '../services/effects.js';

const router = Router();

router.get('/:sku', (req, res) => {
  res.json(getEffectsForSku(req.params.sku));
});

export default router;
