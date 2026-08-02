import { AppError } from '../errors.js';
import { store } from '../storage/store.js';

export const TWITCH_EVENTS = [
  { id: 'follow', label: 'Follow', eventSub: 'channel.follow' },
  { id: 'cheer', label: 'Cheer / Bits', eventSub: 'channel.cheer' },
  { id: 'sub_t1', label: 'Sub Tier 1', eventSub: 'channel.subscribe' },
  { id: 'sub_t2', label: 'Sub Tier 2', eventSub: 'channel.subscribe' },
  { id: 'sub_t3', label: 'Sub Tier 3', eventSub: 'channel.subscribe' },
  { id: 'sub_prime', label: 'Sub Prime', eventSub: 'channel.chat.notification' },
  { id: 'raid_incoming', label: 'Raid entrant', eventSub: 'channel.raid' },
];

/** Scopes optionnels — absence = fonctionnalité réduite, pas d'échec EventSub global */
export const TWITCH_OPTIONAL_SCOPES = {
  'user:read:chat': 'Sub Prime (détection is_prime via channel.chat.notification)',
};

export function getTwitchScopeWarnings(scopes = []) {
  return Object.entries(TWITCH_OPTIONAL_SCOPES)
    .filter(([scope]) => !scopes.includes(scope))
    .map(([scope, detail]) => ({ scope, detail }));
}

export const DEFAULT_TWITCH = {
  clientId: '',
  clientSecret: '',
  accessToken: '',
  refreshToken: '',
  tokenExpiresAt: null,
  channelName: '',
  broadcasterId: '',
  moderatorUserId: '',
  enabled: false,
  reactionDurationSec: 30,
  raidReactionDurationSec: 60,
  connectionStatus: 'disconnected',
  lastError: null,
  mappings: Object.fromEntries(TWITCH_EVENTS.map((e) => [e.id, ''])),
};

export const TWITCH_OAUTH_SCOPES = [
  'channel:read:subscriptions',
  'bits:read',
  'moderator:read:followers',
  'user:read:chat',
];

const TWITCH_OAUTH_AUTHORIZE = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_OAUTH_TOKEN = 'https://id.twitch.tv/oauth2/token';

export function buildAuthorizeUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: TWITCH_OAUTH_SCOPES.join(' '),
  });
  return `${TWITCH_OAUTH_AUTHORIZE}?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(TWITCH_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const rawMessage = data.message || `${res.status} ${data.error || ''}`;
    const lowered = rawMessage.toLowerCase();
    const key =
      lowered.includes('invalid_client') ||
      lowered.includes('client id') ||
      lowered.includes('invalid client') ||
      lowered.includes('invalid oauth_client_credentials')
        ? body.grant_type === 'refresh_token'
          ? 'twitch.oauthInvalidClientRefresh'
          : 'twitch.oauthInvalidClientExchange'
        : body.grant_type === 'refresh_token'
          ? 'twitch.oauthRefreshFailed'
          : 'twitch.oauthExchangeFailed';
    throw new AppError(key, { message: rawMessage });
  }
  return data;
}

export async function exchangeCode(clientId, clientSecret, code, redirectUri) {
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
}

export async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
}

export async function ensureValidConfig(rawConfig) {
  const config = mergeTwitchConfig(rawConfig ?? store.getTwitch());
  if (!config.clientSecret || !config.refreshToken) return config;
  if (config.tokenExpiresAt && Date.now() < config.tokenExpiresAt) return config;
  const tokens = await refreshAccessToken(config.clientId, config.clientSecret, config.refreshToken);
  const next = mergeTwitchConfig({
    ...config,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || config.refreshToken,
    tokenExpiresAt: Date.now() + ((Number(tokens.expires_in) || 14400) - 60) * 1000,
  });
  store.saveTwitch(next);
  return next;
}

export async function helixFetch(rawConfig, path, { method = 'GET', body, query } = {}) {
  const config = await ensureValidConfig(rawConfig);
  const url = new URL(`https://api.twitch.tv/helix${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== '') url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Client-Id': config.clientId,
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || `Helix ${res.status}`;
    throw new AppError('twitch.helixError', { message: msg });
  }
  return data;
}

export async function fetchRecentFollowers(config, { first = 25, after } = {}) {
  const c = mergeTwitchConfig(config);
  if (!c.broadcasterId) throw new AppError('twitch.broadcasterIdMissing');
  const data = await helixFetch(c, '/channels/followers', {
    query: { broadcaster_id: c.broadcasterId, first: String(first), after },
  });
  return {
    followers: (data.data || []).map((f) => ({
      userId: f.user_id,
      login: f.user_login,
      name: f.user_name,
      followedAt: f.followed_at,
    })),
    total: data.total,
    cursor: data.pagination?.cursor || null,
  };
}

export function mergeTwitchConfig(raw) {
  return {
    ...DEFAULT_TWITCH,
    ...raw,
    mappings: { ...DEFAULT_TWITCH.mappings, ...(raw?.mappings || {}) },
  };
}

export function sanitizeTwitchForClient(config) {
  const c = mergeTwitchConfig(config);
  const { clientSecret: _cs, refreshToken: _rt, ...rest } = c;
  return {
    ...rest,
    accessToken: c.accessToken ? `••••${c.accessToken.slice(-4)}` : '',
    hasAccessToken: Boolean(c.accessToken),
    hasClientSecret: Boolean(c.clientSecret),
    hasRefreshToken: Boolean(c.refreshToken),
  };
}

export async function validateTwitchConnection(config) {
  const { clientId, accessToken, channelName } = config;
  if (!clientId || !accessToken || !channelName) {
    throw new AppError('twitch.credentialsRequired');
  }

  const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!validateRes.ok) {
    throw new AppError('twitch.invalidAccessToken');
  }
  const validate = await validateRes.json();

  const userRes = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelName)}`,
    {
      headers: {
        'Client-Id': clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!userRes.ok) {
    throw new AppError('twitch.cannotFetchChannel');
  }
  const userData = await userRes.json();
  const user = userData.data?.[0];
  if (!user) {
    throw new AppError('twitch.channelNotFound', { channel: channelName });
  }

  return {
    connectionStatus: 'connected',
    broadcasterId: user.id,
    channelName: user.login,
    moderatorUserId: validate.user_id,
    lastError: null,
    tokenLogin: validate.login,
    scopes: validate.scopes || [],
    scopeWarnings: getTwitchScopeWarnings(validate.scopes || []),
  };
}
