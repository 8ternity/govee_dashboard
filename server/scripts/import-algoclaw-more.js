/**
 * Importe les scènes AlgoClaw H61A8 absentes du catalogue H16C0 → moreScenes
 * Source: https://github.com/AlgoClaw/Govee/blob/main/decoded/v1.2/JSONs/H61A8_final.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EFFECTS_DIR = path.join(__dirname, '../data/effects');
const SOURCE_URL =
  'https://raw.githubusercontent.com/AlgoClaw/Govee/main/decoded/v1.2/JSONs/H61A8_final.json';

function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function collectCommands(catalog) {
  const set = new Set();
  for (const key of ['scenes', 'gradients', 'effects', 'moreScenes']) {
    for (const item of catalog[key] || []) {
      set.add(JSON.stringify(item.commands));
    }
  }
  return set;
}

async function main() {
  const catalogPath = path.join(EFFECTS_DIR, 'H16C0.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const existing = collectCommands(catalog);

  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const algoclaw = await res.json();

  const usedIds = new Set();
  const moreScenes = [];

  for (const entry of algoclaw) {
    const commands = entry.cmd_b64 || entry.commands;
    if (!commands?.length) continue;
    const key = JSON.stringify(commands);
    if (existing.has(key)) continue;

    let id = slug(entry.name);
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);
    moreScenes.push({ id, name: entry.name, commands, source: 'AlgoClaw/H61A8' });
  }

  moreScenes.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  catalog.moreScenes = moreScenes;

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Import terminé: ${moreScenes.length} scènes dans moreScenes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
