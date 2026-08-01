import { t } from '../i18n';

export function needsEventSubReconnect(debug, enabled) {
  if (!enabled || !debug) return null;
  if (debug.eventSubAlert) {
    return { message: t('twitch.reconnectMessage'), reason: 'event_sub_alert' };
  }
  if (debug.subscriptions?.some((s) => s.status === 'error')) {
    return { message: t('twitch.reconnectMessage'), reason: 'subscription_error' };
  }
  const hit = debug.logs?.some(
    (l) => l.key === 'twitch.debug.subscriptionRevoked' || l.key === 'twitch.debug.subscribeFailed',
  );
  if (hit) return { message: t('twitch.reconnectMessage'), reason: 'log_hint' };
  return null;
}
