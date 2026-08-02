import { t } from '../i18n';

export function needsEventSubReconnect(debug, enabled, buttonLabel) {
  const message = () => t('twitch.reconnectMessage', { button: buttonLabel || '' });
  if (!enabled || !debug) return null;
  if (debug.eventSubAlert) {
    return { message: message(), reason: 'event_sub_alert' };
  }
  if (debug.subscriptions?.some((s) => s.status === 'error')) {
    return { message: message(), reason: 'subscription_error' };
  }
  const hit = debug.logs?.some(
    (l) => l.key === 'twitch.debug.subscriptionRevoked' || l.key === 'twitch.debug.subscribeFailed',
  );
  if (hit) return { message: message(), reason: 'log_hint' };
  return null;
}
