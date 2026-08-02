import { useState, useEffect, useCallback } from 'react';
import {
  Tv,
  ChevronDown,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Trash2,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { api } from '../api';
import { useT, getLocaleTag } from '../i18n';
import { needsEventSubReconnect } from '../utils/twitch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { cn } from '@/lib/utils';

const TWITCH_EVENTS = [
  { id: 'follow' },
  { id: 'cheer' },
  { id: 'sub_t1' },
  { id: 'sub_t2' },
  { id: 'sub_t3' },
  { id: 'sub_prime' },
  { id: 'raid_incoming' },
];

const DEV_CONSOLE = 'https://dev.twitch.tv/console/apps';

const logLevelClass = {
  info: 'text-muted-foreground',
  warn: 'text-warning',
  error: 'text-destructive',
};

export default function TwitchPanel({ presets, onError }) {
  const t = useT();
  const [mappingOpen, setMappingOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [followers, setFollowers] = useState(null);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulatingRaid, setSimulatingRaid] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(null);
  const [debugSnapshot, setDebugSnapshot] = useState(null);
  const [oauthNotice, setOauthNotice] = useState(null);
  const [savedNotice, setSavedNotice] = useState(null);
  const [credsSavedNotice, setCredsSavedNotice] = useState(null);

  const loadConfig = useCallback(async () => {
    const data = await api.getTwitch();
    setConfig(data);
    return data;
  }, []);

  useEffect(() => {
    loadConfig().catch((e) => onError(e.message));
  }, [loadConfig, onError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('twitch');
    if (status === 'connected') {
      setOauthNotice(t('twitch.oauthConnected'));
      setTimeout(() => setOauthNotice(null), 3000);
      loadConfig().catch(() => {});
    } else if (status && status.startsWith('error:')) {
      onError(decodeURIComponent(status.slice('error:'.length)));
    }
    if (status) {
      const url = new URL(window.location.href);
      url.searchParams.delete('twitch');
      window.history.replaceState({}, '', url);
    }
  }, [t, onError, loadConfig]);

  useEffect(() => {
    const pollDebug = () => {
      api.getTwitchDebug().then((debug) => {
        setDebugSnapshot(debug);
        setConfig((c) => (c ? { ...c, debug } : c));
      }).catch(() => {});
    };
    pollDebug();
    const poll = setInterval(pollDebug, 5000);
    return () => clearInterval(poll);
  }, []);

  const update = (patch) => setConfig((c) => ({ ...c, ...patch }));

  const updateMapping = async (eventId, presetId) => {
    const mappings = { ...config.mappings, [eventId]: presetId };
    setConfig((c) => ({ ...c, mappings }));
    setMappingSaving(eventId);
    try {
      const saved = await api.updateTwitch({ mappings });
      setConfig((c) => ({ ...saved, debug: c?.debug ?? saved.debug }));
    } catch (err) {
      onError(err.message);
      loadConfig().catch(() => {});
    } finally {
      setMappingSaving(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await api.updateTwitch({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        channelName: config.channelName,
        enabled: config.enabled,
        reactionDurationSec: config.reactionDurationSec,
        raidReactionDurationSec: config.raidReactionDurationSec,
        mappings: config.mappings,
      });
      setConfig(saved);
      setSavedNotice(t('twitch.saved'));
      setTimeout(() => setSavedNotice(null), 3000);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.updateTwitch({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        channelName: config.channelName,
        mappings: config.mappings,
        reactionDurationSec: config.reactionDurationSec,
        raidReactionDurationSec: config.raidReactionDurationSec,
        enabled: config.enabled,
      });
      const saved = await api.testTwitch();
      setConfig(saved);
    } catch (err) {
      onError(err);
      try {
        setConfig(await loadConfig());
      } catch {
        /* ignore */
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCredentials = async () => {
    setSaving(true);
    try {
      const saved = await api.updateTwitch({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        channelName: config.channelName,
      });
      setConfig(saved);
      setCredsSavedNotice(t('twitch.saved'));
      setTimeout(() => setCredsSavedNotice(null), 3000);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOAuthConnect = async () => {
    try {
      await api.updateTwitch({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        channelName: config.channelName,
      });
    } catch (err) {
      onError(err.message);
      return;
    }
    window.location.href = '/api/twitch/auth';
  };

  const handleOAuthDisconnect = async () => {
    try {
      const saved = await api.deleteTwitchOAuth();
      setConfig(saved);
      setOauthNotice(null);
    } catch (err) {
      onError(err.message);
    }
  };

  const loadFollowers = async () => {
    setLoadingFollowers(true);
    try {
      const data = await api.getTwitchFollowers(25);
      setFollowers(data);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await api.simulateTwitchEvent('follow', 'debug_user');
      setConfig(await loadConfig());
    } catch (err) {
      onError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateRaid = async () => {
    setSimulatingRaid(true);
    try {
      await api.simulateTwitchEvent('raid_incoming', 'raider_test');
      setConfig(await loadConfig());
    } catch (err) {
      onError(err.message);
    } finally {
      setSimulatingRaid(false);
    }
  };

  const handleClearDebug = async () => {
    await api.clearTwitchDebug();
    setConfig((c) => (c ? { ...c, debug: { ...c.debug, logs: [] } } : c));
  };

  const statusClass = config?.connectionStatus || 'disconnected';
  const statusLabel = {
    connected: t('twitch.status.connected'),
    disconnected: t('twitch.status.disconnected'),
    error: t('twitch.status.error'),
  }[statusClass] || t('twitch.status.disconnected');

  const eventSubStatus = config?.debug?.eventSubStatus || debugSnapshot?.eventSubStatus || 'stopped';
  const reconnectAlert = needsEventSubReconnect(
    config?.debug || debugSnapshot,
    config?.enabled,
  );
  const toggleDotClass = reconnectAlert
    ? 'alert'
    : config?.connectionStatus === 'connected'
      ? 'connected'
      : '';
  const eventSubLabel = {
    listening: t('twitch.es.listening'),
    connecting: t('twitch.es.connecting'),
    connected: t('twitch.es.connected'),
    reconnecting: t('twitch.es.reconnecting'),
    error: t('twitch.es.error'),
    stopped: t('twitch.es.stopped'),
  }[eventSubStatus] || eventSubStatus;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="w-full cursor-pointer">
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
            open
              ? 'bg-card text-foreground border-border'
              : 'bg-card/60 text-muted-foreground border-transparent hover:bg-card hover:text-foreground'
          )}
        >
          <Tv className="text-primary size-4" />
          Twitch
          <span
            className={cn(
              'ml-1 inline-block size-2 rounded-full',
              toggleDotClass === 'alert' && 'bg-warning',
              toggleDotClass === 'connected' && 'bg-success',
              !toggleDotClass && 'bg-muted-foreground/40'
            )}
            title={reconnectAlert ? t('twitch.reconnectDotTitle') : undefined}
          />
          <ChevronDown
            className={cn('text-muted-foreground ml-auto size-4 transition-transform', open && 'rotate-180')}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        {config && (
          <Card className="gap-4">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t('twitch.title')}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={statusClass === 'connected' ? 'success' : statusClass === 'error' ? 'destructive' : 'secondary'}
                >
                  {statusLabel}
                </Badge>
                <Badge
                  variant={eventSubStatus === 'error' ? 'destructive' : eventSubStatus === 'listening' || eventSubStatus === 'connected' ? 'success' : 'secondary'}
                >
                  {eventSubLabel}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {reconnectAlert && config.enabled && (
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertTitle>{t('twitch.disconnectedAlert')}</AlertTitle>
                  <AlertDescription>
                    {reconnectAlert.message || t('twitch.reconnectMessage')}
                    <Button size="sm" variant="secondary" className="mt-2" onClick={handleTest} disabled={testing}>
                      {testing ? <Loader2 className="animate-spin" /> : null}
                      {testing ? t('twitch.testing') : t('twitch.testNow')}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {config.debug?.eventSubStatus === 'stopped' && config.enabled && !reconnectAlert && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>{t('twitch.stoppedAlert')}</AlertTitle>
                  <AlertDescription>
                    {t('twitch.stoppedDescription')}
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-muted-foreground text-sm">
                {t('twitch.recommended')} <strong className="text-foreground">{t('twitch.eventSubWebSocket')}</strong> {t('twitch.realtimeOfficial')}.
                <br />
                {t('twitch.scopesRequired')} <code className="bg-muted rounded px-1 py-0.5 text-xs">channel:read:subscriptions</code>,{' '}
                <code className="bg-muted rounded px-1 py-0.5 text-xs">bits:read</code>,{' '}
                <code className="bg-muted rounded px-1 py-0.5 text-xs">moderator:read:followers</code>,{' '}
                <code className="bg-muted rounded px-1 py-0.5 text-xs">user:read:chat</code> {t('twitch.subPrimeSuffix')}.
              </p>

              {config.scopeWarnings?.length > 0 && (
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertTitle>{t('twitch.scopeMissing')}</AlertTitle>
                  <AlertDescription>
                    <code className="bg-muted rounded px-1 py-0.5 text-xs">
                      {config.scopeWarnings.map((w) => w.scope).join(', ')}
                    </code>{' '}
                    {t('twitch.scopeWarningDesc', { scope: 'user:read:chat' })}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">{t('twitch.stepCredentials')}</h4>
                    <a href={DEV_CONSOLE} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-xs hover:underline">
                      {t('twitch.devConsole')} <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{t('twitch.clientId')}</Label>
                      <Input
                        value={config.clientId}
                        onChange={(e) => update({ clientId: e.target.value })}
                        placeholder={t('twitch.clientIdPlaceholder')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('twitch.clientSecret')}</Label>
                      <Input
                        type="password"
                        value={config.clientSecret || ''}
                        onChange={(e) => update({ clientSecret: e.target.value })}
                        placeholder={config.hasClientSecret ? t('twitch.secretKeepPlaceholder') : t('twitch.secretPlaceholder')}
                      />
                    </div>
                    {config.clientId && !config.hasClientSecret && (
                      <div className="sm:col-span-2 space-y-1.5">
                        <Alert variant="warning">
                          <AlertTriangle />
                          <AlertDescription className="text-xs">
                            {t('twitch.secretRegenerateNotice')}{' '}
                            <a
                              href={DEV_CONSOLE}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary font-medium hover:underline"
                            >
                              {t('twitch.devConsole')} ↗
                            </a>
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>{t('twitch.channelName')}</Label>
                      <Input
                        value={config.channelName}
                        onChange={(e) => update({ channelName: e.target.value })}
                        placeholder={t('twitch.channelPlaceholder')}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={handleSaveCredentials} disabled={saving}>
                      {saving ? <Loader2 className="animate-spin" /> : null}
                      {saving ? t('twitch.saving') : t('twitch.saveCredentials')}
                    </Button>
                    {credsSavedNotice && (
                      <span className="text-success text-sm">{credsSavedNotice}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">{t('twitch.stepConnect')}</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleOAuthConnect}>
                      {t('twitch.oauthConnect')}
                    </Button>
                    {config.hasRefreshToken && (
                      <Button variant="secondary" onClick={handleOAuthDisconnect}>
                        {t('twitch.oauthDisconnect')}
                      </Button>
                    )}
                  </div>
                  {config.hasRefreshToken ? (
                    <p className="text-muted-foreground text-xs">
                      {t('twitch.oauthActive')}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {t('twitch.oauthHint')}
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {t('twitch.oauthRedirectHint', { uri: config.oauthRedirectUri })}
                  </p>
                  {oauthNotice && (
                    <Alert variant="success">
                      <AlertDescription>{oauthNotice}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <Label className="cursor-pointer">{t('twitch.autoReactions')}</Label>
                  <Switch
                    checked={Boolean(config.enabled)}
                    onCheckedChange={(v) => update({ enabled: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {t('twitch.reactionDuration')}{' '}
                    <code className="bg-muted rounded px-1 py-0.5 text-xs">{t('twitch.followSubCheer')}</code>
                  </Label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    value={config.reactionDurationSec}
                    onChange={(e) => update({ reactionDurationSec: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {t('twitch.raidDuration')}{' '}
                    <code className="bg-muted rounded px-1 py-0.5 text-xs">{t('twitch.raidLabel')}</code>
                  </Label>
                  <Input
                    type="number"
                    min="5"
                    max="300"
                    value={config.raidReactionDurationSec ?? 60}
                    onChange={(e) => update({ raidReactionDurationSec: Number(e.target.value) })}
                  />
                </div>
              </div>

              {config.lastError && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>{config.lastError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {testing ? t('twitch.testing') : t('twitch.testConnection')}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : null}
                  {saving ? t('twitch.saving') : t('twitch.save')}
                </Button>
              </div>
            </CardContent>

            <Separator />

            <CardContent className="space-y-4">
              <Collapsible open={mappingOpen} onOpenChange={setMappingOpen}>
                <CollapsibleTrigger className="w-full cursor-pointer">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{t('twitch.mappingsTitle')}</h4>
                    <ChevronDown className={cn('text-muted-foreground size-4 transition-transform', mappingOpen && 'rotate-180')} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="space-y-3">
                    <p className="text-muted-foreground text-xs">
                      {t('twitch.mappingsHint', {
                        duration: config.reactionDurationSec,
                        raid: config.raidReactionDurationSec ?? 60,
                      })}
                    </p>
                    {presets.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{t('twitch.mappingsNoPresets')}</p>
                    ) : (
                      <div className="space-y-2">
                        {TWITCH_EVENTS.map((ev) => {
                          const health = config.mappingHealth?.[ev.id];
                          return (
                            <div key={ev.id} className="flex items-center justify-between gap-3">
                              <span className="text-sm">{t(`twitch.event.${ev.id}`)}</span>
                              <div className="flex items-center gap-2">
                                {health && !health.ok && config.mappings?.[ev.id] && (
                                  <AlertTriangle
                                    className="text-warning size-4"
                                    title={health.issues.join(' ')}
                                  />
                                )}
                                <Select
                                  value={config.mappings?.[ev.id] || 'none'}
                                  onValueChange={(v) => updateMapping(ev.id, v === 'none' ? '' : v)}
                                  disabled={mappingSaving === ev.id}
                                >
                                  <SelectTrigger size="sm" className="w-48">
                                    <SelectValue placeholder={t('twitch.none')} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">{t('twitch.none')}</SelectItem>
                                    {presets.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>

            <Separator />

            <CardContent className="space-y-4">
              <h4 className="text-sm font-semibold">{t('twitch.debugFollowers')}</h4>
              <p className="text-muted-foreground text-xs">
                {t('twitch.followersInfo', {
                  endpoint: 'GET /channels/followers',
                  scope: 'moderator:read:followers',
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={loadFollowers} disabled={loadingFollowers}>
                  {loadingFollowers ? <Loader2 className="animate-spin" /> : <UserRound />}
                  {loadingFollowers ? t('twitch.loading') : t('twitch.showFollowers')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSimulate} disabled={simulating}>
                  {simulating ? <Loader2 className="animate-spin" /> : null}
                  {simulating ? t('twitch.testing') : t('twitch.simulateFollow')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSimulateRaid} disabled={simulatingRaid}>
                  {simulatingRaid ? <Loader2 className="animate-spin" /> : null}
                  {simulatingRaid ? t('twitch.testing') : t('twitch.simulateRaid')}
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleClearDebug}>
                  <Trash2 /> {t('twitch.clearLogs')}
                </Button>
              </div>

              {followers && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">{t('twitch.followersRecent', { count: followers.total ?? followers.followers.length })}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setFollowers(null)}
                      aria-label={t('twitch.clearList')}
                    >
                      <Trash2 /> {t('twitch.clearList')}
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {followers.followers.map((f) => (
                      <li key={f.userId} className="flex items-center justify-between text-sm">
                        <strong>{f.login}</strong>
                        <span className="text-muted-foreground text-xs">{new Date(f.followedAt).toLocaleString(getLocaleTag())}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {config.debug?.subscriptions?.length > 0 && (
                <ul className="space-y-1">
                  {config.debug.subscriptions.map((s) => (
                    <li
                      key={s.type}
                      className={cn(
                        'text-xs',
                        s.status === 'error' ? 'text-destructive' : 'text-success'
                      )}
                    >
                      {s.type}: {s.status}{s.error ? ` â€” ${s.error}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              {config.debug?.logs?.length > 0 && (
                <ul className="bg-muted/40 max-h-48 space-y-1 overflow-y-auto rounded-md border p-3">
                  {config.debug.logs.slice(0, 20).map((log) => (
                    <li key={log.id} className={cn('text-xs', logLevelClass[log.level] || 'text-muted-foreground')}>
                      <span className="text-muted-foreground/70 mr-1">{new Date(log.at).toLocaleTimeString(getLocaleTag())}</span>
                      {log.key ? t(log.key, log.params) : log.message}
                      {log.detail?.ips?.length > 0 && (
                        <span className="text-muted-foreground/70"> â€” {log.detail.ips.join(', ')}</span>
                      )}
                      {log.detail?.user && (
                        <span className="text-primary"> @{log.detail.user}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
