import { AppError } from '../errors.js';

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
  accessToken: '',
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

export async function helixFetch(config, path, { method = 'GET', body, query } = {}) {
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
  const { clientSecret: _ignored, ...rest } = c;
  return {
    ...rest,
    accessToken: c.accessToken ? `••••${c.accessToken.slice(-4)}` : '',
    hasAccessToken: Boolean(c.accessToken),
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
