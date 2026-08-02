import { store } from '../storage/store.js';
import { applyPresetWithRestore } from './presetApply.js';
import { helixFetch, mergeTwitchConfig, TWITCH_OPTIONAL_SCOPES } from './twitch.js';
import { AppError } from '../errors.js';
import { t, DEFAULT_LOCALE } from '../i18n.js';

function readableError(err) {
  if (err instanceof AppError) {
    return t(DEFAULT_LOCALE, err.errorKey, err.errorParams);
  }
  return err?.message || String(err);
}

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const MAX_LOG = 80;
const DEFAULT_ALERT_MESSAGE = t(DEFAULT_LOCALE, 'twitch.debug.alertReconnect');
const AUTH_ERROR_RE = /401|403|invalid|expired|unauthorized|token|scope/i;

const debug = {
  eventSubStatus: 'stopped',
  sessionId: null,
  subscriptions: [],
  lastStartedAt: null,
  reconnectCount: 0,
  eventSubAlert: null,
  logs: [],
};

let ws = null;
let reconnectTimer = null;
let reactionBusy = false;
let intentionalStop = false;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeWebSocketIntentionally() {
  if (!ws) return;
  intentionalStop = true;
  const socket = ws;
  ws = null;
  socket.addEventListener('close', () => {
    intentionalStop = false;
  }, { once: true });
  socket.close();
}

function pushLog(level, message, detail = {}) {
  let text = message;
  let key = null;
  let params = {};
  if (message && typeof message === 'object' && message.key) {
    key = message.key;
    params = message.params || {};
    text = t(DEFAULT_LOCALE, key, params);
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    level,
    message: text,
    detail,
  };
  if (key) {
    entry.key = key;
    entry.params = params;
  }
  debug.logs.unshift(entry);
  if (debug.logs.length > MAX_LOG) debug.logs.length = MAX_LOG;
  const prefix = `[Twitch ${level}]`;
  console.log(prefix, text, Object.keys(detail).length ? detail : '');
}

export function getTwitchDebug() {
  return { ...debug, logs: [...debug.logs], eventSubAlert: debug.eventSubAlert ? { ...debug.eventSubAlert } : null };
}

export function clearTwitchDebugLogs() {
  debug.logs = [];
}

function setEventSubAlert(reason, message = DEFAULT_ALERT_MESSAGE) {
  debug.eventSubAlert = {
    reason,
    message,
    at: new Date().toISOString(),
  };
}

function clearEventSubAlert() {
  debug.eventSubAlert = null;
}

function isAuthRelatedError(message) {
  return AUTH_ERROR_RE.test(message || '');
}

function syncSubscriptionAlert(subs) {
  const hasRequiredError = subs.some((s) => s.status === 'error' && !s.optional);
  if (hasRequiredError) {
    setEventSubAlert('subscription_error');
  } else if (subs.some((s) => s.status === 'ok' || s.status === 'created' || s.status === 'enabled')) {
    clearEventSubAlert();
  }
}

function hasChatNotificationScope(config) {
  return (config.scopes || []).includes('user:read:chat');
}

function getConfig() {
  return mergeTwitchConfig(store.getTwitch());
}

async function createSubscription(sessionId, type, version, condition) {
  const config = getConfig();
  const res = await helixFetch(config, '/eventsub/subscriptions', {
    method: 'POST',
    body: {
      type,
      version,
      condition,
      transport: { method: 'websocket', session_id: sessionId },
    },
  });
  return res.data?.[0];
}

async function subscribeAll(sessionId) {
  const config = getConfig();
  const { broadcasterId, moderatorUserId } = config;
  if (!broadcasterId || !moderatorUserId) {
    const err = new Error('broadcasterId ou moderatorUserId manquant — relance « Tester la connexion ».');
    setEventSubAlert('missing_ids', readableError(err));
    throw err;
  }

  const subs = [];
  const defs = [
    {
      type: 'channel.follow',
      version: '2',
      condition: { broadcaster_user_id: broadcasterId, moderator_user_id: moderatorUserId },
    },
    {
      type: 'channel.cheer',
      version: '1',
      condition: { broadcaster_user_id: broadcasterId },
    },
    {
      type: 'channel.subscribe',
      version: '1',
      condition: { broadcaster_user_id: broadcasterId },
    },
    {
      type: 'channel.raid',
      version: '1',
      condition: { to_broadcaster_user_id: broadcasterId },
    },
  ];

  if (hasChatNotificationScope(config)) {
    defs.splice(3, 0, {
      type: 'channel.chat.notification',
      version: '1',
      condition: { broadcaster_user_id: broadcasterId, user_id: moderatorUserId },
      optional: true,
    });
  } else {
    pushLog(
      'warn',
      { key: 'twitch.debug.subPrimeDisabled', params: { scope: 'user:read:chat' } },
      { missingScope: 'user:read:chat', hint: TWITCH_OPTIONAL_SCOPES['user:read:chat'] },
    );
  }

  for (const def of defs) {
    try {
      const sub = await createSubscription(sessionId, def.type, def.version, def.condition);
      subs.push({ type: def.type, status: sub?.status || 'created', id: sub?.id, optional: def.optional });
      pushLog('info', { key: 'twitch.debug.subscribeOk', params: { type: def.type } }, { id: sub?.id });
    } catch (err) {
      subs.push({ type: def.type, status: 'error', error: readableError(err), optional: def.optional });
      const level = def.optional ? 'warn' : 'error';
      pushLog(level, { key: 'twitch.debug.subscribeFailed', params: { type: def.type } }, { error: readableError(err) });
      if (!def.optional && isAuthRelatedError(readableError(err))) {
        setEventSubAlert('auth_error', DEFAULT_ALERT_MESSAGE);
      }
    }
  }
  debug.subscriptions = subs;
  syncSubscriptionAlert(subs);
}

function mapSubscribeTier(tier, { isPrime = false } = {}) {
  if (isPrime) return 'sub_prime';
  if (tier === '2000') return 'sub_t2';
  if (tier === '3000') return 'sub_t3';
  return 'sub_t1';
}

const SUB_DEDUPE_MS = 8000;
const SUB_FALLBACK_MS = 1500;
const recentSubByUser = new Map();
const pendingSubFallbacks = new Map();

function wasSubRecentlyHandled(userId) {
  const at = recentSubByUser.get(userId);
  if (!at) return false;
  if (Date.now() - at > SUB_DEDUPE_MS) {
    recentSubByUser.delete(userId);
    return false;
  }
  return true;
}

function markSubHandled(userId) {
  recentSubByUser.set(userId, Date.now());
}

function cancelSubFallback(userId) {
  const timer = pendingSubFallbacks.get(userId);
  if (timer) {
    clearTimeout(timer);
    pendingSubFallbacks.delete(userId);
  }
}

async function handleSubscribeEvent(userId, tier, isPrime, meta) {
  if (wasSubRecentlyHandled(userId)) return;
  markSubHandled(userId);
  const key = mapSubscribeTier(tier, { isPrime });
  await handleReaction(key, { ...meta, tier, isPrime });
}

function scheduleSubscribeFallback(userId, tier, meta) {
  cancelSubFallback(userId);
  const timer = setTimeout(() => {
    pendingSubFallbacks.delete(userId);
    if (wasSubRecentlyHandled(userId)) return;
    handleSubscribeEvent(userId, tier, false, meta).catch((err) => pushLog('error', readableError(err)));
  }, SUB_FALLBACK_MS);
  pendingSubFallbacks.set(userId, timer);
}

function extractChatSubInfo(event) {
  if (event.notice_type === 'sub' && event.sub) {
    return {
      userId: event.chatter_user_id,
      user: event.chatter_user_login || event.chatter_user_name,
      tier: event.sub.sub_tier,
      isPrime: Boolean(event.sub.is_prime),
    };
  }
  if (event.notice_type === 'shared_chat_sub' && event.shared_chat_sub) {
    return {
      userId: event.chatter_user_id,
      user: event.chatter_user_login || event.chatter_user_name,
      tier: event.shared_chat_sub.sub_tier,
      isPrime: Boolean(event.shared_chat_sub.is_prime),
    };
  }
  return null;
}

async function handleReaction(eventKey, meta) {
  const config = getConfig();

  if (!config.enabled) {
    pushLog('warn', { key: 'twitch.debug.eventIgnoredDisabled', params: { eventKey } }, meta);
    return { ok: false, reason: 'disabled' };
  }

  const presetId = config.mappings?.[eventKey];
  if (!presetId) {
    pushLog('warn', { key: 'twitch.debug.eventNoPreset', params: { eventKey } }, meta);
    return { ok: false, reason: 'no_mapping' };
  }

  if (reactionBusy) {
    pushLog('warn', { key: 'twitch.debug.eventReactionBusy', params: { eventKey } }, meta);
    return { ok: false, reason: 'busy' };
  }

  reactionBusy = true;
  const durationSec = eventKey === 'raid_incoming'
    ? config.raidReactionDurationSec
    : config.reactionDurationSec;

  try {
    const preset = store.getPresets().find((p) => p.id === presetId);
    const result = await applyPresetWithRestore(presetId, durationSec);
    if (!result.applied.length) {
      reactionBusy = false;
      pushLog('error', { key: 'twitch.debug.presetNoLights', params: { eventKey } }, {
        ...meta,
        presetId,
        presetName: preset?.name,
      });
      return { ok: false, reason: 'no_devices' };
    }
    pushLog('action', { key: 'twitch.debug.presetApplied', params: { eventKey } }, {
      ...meta,
      presetId,
      presetName: preset?.name,
      ips: result.applied,
      durationSec: result.durationSec,
    });
    setTimeout(() => { reactionBusy = false; }, durationSec * 1000);
    return { ok: true, ...result };
  } catch (err) {
    reactionBusy = false;
    pushLog('error', { key: 'twitch.debug.presetFailed', params: { eventKey } }, { ...meta, error: readableError(err) });
    return { ok: false, reason: 'apply_error', error: readableError(err) };
  }
}

async function onNotification(msg) {
  const subType = msg.payload.subscription.type;
  const event = msg.payload.event;
  const base = {
    subType,
    user: event.user_login || event.user_name || event.from_broadcaster_user_login,
  };

  pushLog('event', { key: 'twitch.debug.notification', params: { subType } }, base);

  if (subType === 'channel.follow') {
    await handleReaction('follow', { ...base, followedAt: event.followed_at });
  } else if (subType === 'channel.cheer') {
    await handleReaction('cheer', { ...base, bits: event.bits });
  } else if (subType === 'channel.subscribe') {
    scheduleSubscribeFallback(event.user_id, event.tier, {
      ...base,
      tier: event.tier,
      isGift: event.is_gift,
    });
  } else if (subType === 'channel.chat.notification') {
    const subInfo = extractChatSubInfo(event);
    if (subInfo) {
      cancelSubFallback(subInfo.userId);
      await handleSubscribeEvent(subInfo.userId, subInfo.tier, subInfo.isPrime, {
        ...base,
        user: subInfo.user,
        tier: subInfo.tier,
        isPrime: subInfo.isPrime,
        noticeType: event.notice_type,
      });
    }
  } else if (subType === 'channel.raid') {
    await handleReaction('raid_incoming', {
      ...base,
      user: event.from_broadcaster_user_login,
      viewers: event.viewers,
      from: event.from_broadcaster_user_login,
    });
  }
}

async function handleWsMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.data ?? raw);
  } catch {
    return;
  }

  const type = msg.metadata?.message_type;

  if (type === 'session_welcome') {
    clearReconnectTimer();
    debug.sessionId = msg.payload.session.id;
    debug.eventSubStatus = 'listening';
    debug.lastStartedAt = new Date().toISOString();
    pushLog('info', { key: 'twitch.debug.sessionOpened' }, { sessionId: debug.sessionId });
    try {
      await subscribeAll(debug.sessionId);
    } catch (err) {
      debug.eventSubStatus = 'error';
      pushLog('error', readableError(err));
      if (!debug.eventSubAlert) {
        setEventSubAlert('subscribe_failed', readableError(err));
      }
    }
  } else if (type === 'session_keepalive') {
    /* noop */
  } else if (type === 'session_reconnect') {
    pushLog('warn', { key: 'twitch.debug.reconnectRequested' });
    debug.reconnectCount += 1;
    const url = msg.payload.session.reconnect_url;
    clearReconnectTimer();
    closeWebSocketIntentionally();
    reconnectTimer = setTimeout(() => {
      if (url) openWebSocket(url);
      else connect();
    }, 1000);
  } else if (type === 'notification') {
    await onNotification(msg);
  } else if (type === 'revocation') {
    pushLog('warn', { key: 'twitch.debug.subscriptionRevoked' }, msg.payload);
    setEventSubAlert('revocation', DEFAULT_ALERT_MESSAGE);
  }
}

function openWebSocket(url = WS_URL) {
  const config = getConfig();
  if (!config.enabled || intentionalStop) return;

  ws = new WebSocket(url);

  ws.addEventListener('open', () => {
    debug.eventSubStatus = 'connected';
  });

  ws.addEventListener('message', (raw) => {
    handleWsMessage(raw).catch((err) => pushLog('error', readableError(err)));
  });

  ws.addEventListener('close', () => {
    if (intentionalStop) return;
    ws = null;
    clearReconnectTimer();
    if (debug.eventSubStatus === 'listening' || debug.eventSubStatus === 'connected') {
      debug.eventSubStatus = 'reconnecting';
      pushLog('warn', { key: 'twitch.debug.wsClosed' });
      reconnectTimer = setTimeout(connect, 5000);
    }
  });

  ws.addEventListener('error', () => {
    debug.eventSubStatus = 'error';
    pushLog('error', { key: 'twitch.debug.wsError' });
    setEventSubAlert('websocket_error', DEFAULT_ALERT_MESSAGE);
  });
}

function connect() {
  const config = getConfig();
  if (!config.enabled || !config.accessToken || !config.clientId || !config.broadcasterId) {
    debug.eventSubStatus = 'stopped';
    pushLog('info', { key: 'twitch.debug.notStarted' });
    return;
  }

  clearReconnectTimer();
  closeWebSocketIntentionally();

  debug.eventSubStatus = 'connecting';
  pushLog('info', { key: 'twitch.debug.connecting' });
  openWebSocket(WS_URL);
}

export function stopTwitchListener() {
  intentionalStop = true;
  clearReconnectTimer();
  if (ws) {
    const socket = ws;
    ws = null;
    socket.close();
  }
  debug.eventSubStatus = 'stopped';
  debug.sessionId = null;
  debug.subscriptions = [];
  pushLog('info', { key: 'twitch.debug.stopped' });
  setTimeout(() => { intentionalStop = false; }, 50);
}

export function restartTwitchListener() {
  stopTwitchListener();
  reconnectTimer = setTimeout(connect, 800);
}

export async function simulateTwitchEvent(eventKey, user = 'test_user') {
  pushLog('info', { key: 'twitch.debug.simulated', params: { eventKey } }, { user });
  return handleReaction(eventKey, { user, simulated: true });
}

export function startTwitchListener() {
  const config = getConfig();
  if (config.enabled) {
    connect();
  } else {
    pushLog('info', { key: 'twitch.debug.waitingDisabled' });
  }
}
