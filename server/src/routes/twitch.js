import { Router } from 'express';
import { store } from '../storage/store.js';
import { getLocale, t } from '../i18n.js';
import { AppError, respondError, errorPayload } from '../errors.js';
import {
  mergeTwitchConfig,
  sanitizeTwitchForClient,
  validateTwitchConnection,
  fetchRecentFollowers,
  getTwitchScopeWarnings,
  buildAuthorizeUrl,
  exchangeCode,
  ensureValidConfig,
} from '../services/twitch.js';
import { validatePresetTargets } from '../services/presetApply.js';
import {
  getTwitchDebug,
  clearTwitchDebugLogs,
  restartTwitchListener,
  simulateTwitchEvent,
} from '../services/twitchListener.js';

const router = Router();

const OAUTH_CALLBACK_PATH = '/api/twitch/callback';

function getOAuthRedirectUri() {
  const port = process.env.PORT || 3001;
  return `https://localhost:${port}${OAUTH_CALLBACK_PATH}`;
}

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
    oauthRedirectUri: getOAuthRedirectUri(),
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

router.get('/auth', (req, res) => {
  const config = mergeTwitchConfig(store.getTwitch());
  if (!config.clientId || !config.clientSecret) {
    return respondError(req, res, new AppError('twitch.oauthNeedCredentials'), 400);
  }
  res.redirect(buildAuthorizeUrl(config.clientId, getOAuthRedirectUri()));
});

router.get('/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error || !code) {
    return res.redirect(`/?twitch=error:${encodeURIComponent(error_description || error || 'denied')}`);
  }
  try {
    const config = mergeTwitchConfig(store.getTwitch());
    const tokens = await exchangeCode(config.clientId, config.clientSecret, code, getOAuthRedirectUri());
    let next = mergeTwitchConfig({
      ...config,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || config.refreshToken,
      tokenExpiresAt: Date.now() + ((Number(tokens.expires_in) || 14400) - 60) * 1000,
      lastError: null,
    });
    const result = await validateTwitchConnection(next);
    next = mergeTwitchConfig({ ...next, ...result });
    store.saveTwitch(next);
    restartTwitchListener();
    res.redirect('/?twitch=connected');
  } catch (err) {
    const msg = err instanceof AppError ? errorPayload(req, err).error : err?.message || 'OAuth failed';
    res.redirect(`/?twitch=error:${encodeURIComponent(msg)}`);
  }
});

router.delete('/oauth', (_req, res) => {
  const config = mergeTwitchConfig(store.getTwitch());
  const next = mergeTwitchConfig({
    ...config,
    refreshToken: '',
    tokenExpiresAt: null,
    connectionStatus: 'disconnected',
    scopes: [],
    scopeWarnings: [],
    lastError: null,
  });
  store.saveTwitch(next);
  restartTwitchListener();
  res.json(withDebug(next, getLocale(_req)));
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
    clientSecret: keepSecret(req.body.clientSecret, current.clientSecret),
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
  const locale = getLocale(req);
  let config = mergeTwitchConfig(store.getTwitch());
  try {
    config = await ensureValidConfig(store.getTwitch());
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
