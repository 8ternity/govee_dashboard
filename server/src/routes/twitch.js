import { Router } from 'express';
import { store } from '../storage/store.js';
import { getLocale, t } from '../i18n.js';
import { respondError, errorPayload } from '../errors.js';
import {
  mergeTwitchConfig,
  sanitizeTwitchForClient,
  validateTwitchConnection,
  fetchRecentFollowers,
  getTwitchScopeWarnings,
} from '../services/twitch.js';
import { validatePresetTargets } from '../services/presetApply.js';
import {
  getTwitchDebug,
  clearTwitchDebugLogs,
  restartTwitchListener,
  simulateTwitchEvent,
} from '../services/twitchListener.js';

const router = Router();

function keepSecret(incoming, existing) {
  if (!incoming || incoming.startsWith('••••')) return existing;
  return incoming;
}

function withDebug(config, locale) {
  const presets = store.getPresets();
  const mappingHealth = {};
  for (const [eventKey, presetId] of Object.entries(config.mappings || {})) {
    if (!presetId) continue;
    const preset = presets.find((p) => p.id === presetId);
    mappingHealth[eventKey] = preset
      ? { presetName: preset.name, ...validatePresetTargets(preset, locale) }
      : { ok: false, issues: [t(locale, 'twitch.presetDeleted')], ips: [] };
  }
  return {
    ...sanitizeTwitchForClient(config),
    scopeWarnings: getTwitchScopeWarnings(config.scopes || []),
    debug: getTwitchDebug(),
    mappingHealth,
  };
}

router.get('/', (req, res) => {
  res.json(withDebug(store.getTwitch(), getLocale(req)));
});

router.get('/debug', (_req, res) => {
  res.json(getTwitchDebug());
});

router.delete('/debug', (_req, res) => {
  clearTwitchDebugLogs();
  res.json({ ok: true });
});

router.get('/followers', async (req, res) => {
  const config = mergeTwitchConfig(store.getTwitch());
  try {
    const result = await fetchRecentFollowers(config, {
      first: Number(req.query.first) || 25,
      after: req.query.after,
    });
    res.json(result);
  } catch (err) {
    respondError(req, res, err, 400);
  }
});

router.post('/simulate', async (req, res) => {
  const { eventKey = 'follow', user = 'debug_user' } = req.body || {};
  try {
    const result = await simulateTwitchEvent(eventKey, user);
    res.json({ ...result, debug: getTwitchDebug() });
  } catch (err) {
    respondError(req, res, err);
  }
});

router.patch('/', (req, res) => {
  const current = mergeTwitchConfig(store.getTwitch());
  const next = mergeTwitchConfig({
    ...current,
    ...req.body,
    accessToken: keepSecret(req.body.accessToken, current.accessToken),
    mappings: { ...current.mappings, ...(req.body.mappings || {}) },
  });
  store.saveTwitch(next);

  const onlyMappings =
    req.body.mappings &&
    !req.body.clientId &&
    !req.body.accessToken &&
    !req.body.channelName &&
    req.body.enabled === undefined &&
    req.body.reactionDurationSec === undefined &&
    req.body.raidReactionDurationSec === undefined;

  if (!onlyMappings) {
    restartTwitchListener();
  }

  res.json(withDebug(next, getLocale(req)));
});

router.post('/test', async (req, res) => {
  const config = mergeTwitchConfig(store.getTwitch());
  const locale = getLocale(req);
  try {
    const result = await validateTwitchConnection(config);
    const next = mergeTwitchConfig({ ...config, ...result });
    store.saveTwitch(next);
    restartTwitchListener();
    res.json(withDebug(next, locale));
  } catch (err) {
    const payload = errorPayload(req, err);
    const next = mergeTwitchConfig({
      ...config,
      connectionStatus: 'error',
      lastError: payload.error,
    });
    store.saveTwitch(next);
    res.status(400).json({ ...payload, config: withDebug(next, locale) });
  }
});

export default router;
