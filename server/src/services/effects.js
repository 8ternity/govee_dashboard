import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EFFECTS_DIR = path.join(__dirname, '../../data/effects');

const FALLBACK_SKU = 'H16C0';

function loadEffectsFile(sku) {
  const file = path.join(EFFECTS_DIR, `${sku}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function getEffectsForSku(sku) {
  return (
    loadEffectsFile(sku) ||
    loadEffectsFile(FALLBACK_SKU) || { scenes: [], gradients: [], effects: [], lighting: [], moreScenes: [] }
  );
}

export function findEffect(sku, category, id) {
  const catalog = getEffectsForSku(sku);
  const list = catalog[category] || [];
  return list.find((e) => e.id === id) || null;
}

const EFFECT_CATEGORIES = ['moreScenes', 'lighting', 'gradients', 'effects', 'scenes'];

export function parseEffectKey(effectKey) {
  if (!effectKey || typeof effectKey !== 'string') return null;
  for (const category of EFFECT_CATEGORIES) {
    const prefix = `${category}-`;
    if (effectKey.startsWith(prefix)) {
      return { category, id: effectKey.slice(prefix.length) };
    }
  }
  return null;
}

export function resolveEffectByKey(sku, effectKey) {
  const parsed = parseEffectKey(effectKey);
  if (!parsed) return null;
  const effect = findEffect(sku, parsed.category, parsed.id);
  if (!effect) return null;
  return { ...effect, category: parsed.category, effectKey };
}
