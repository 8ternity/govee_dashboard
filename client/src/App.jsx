import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Link2, Unlink, AlertTriangle, X, RefreshCw, Loader2 } from 'lucide-react';import { api } from './api';
import { LinkProvider, useLink } from './context/LinkContext';
import { needsEventSubReconnect } from './utils/twitch';
import { useT } from './i18n';
import DeviceList from './components/DeviceList';
import TwitchPanel from './components/TwitchPanel';
import SettingsMenu from './components/SettingsMenu';
import AppFooter from './components/AppFooter';
import { Button } from './components/ui/button';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { cn } from '@/lib/utils';

function Dashboard({ onDeviceIdsChange }) {
  const t = useT();
  const [devices, setDevices] = useState([]);
  const [presets, setPresets] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [error, setError] = useState(null);
  const [errorKind, setErrorKind] = useState('destructive');
  const { groupLinked, linkedIds, handleHeaderLink } = useLink();
  const [showLinkBanner, setShowLinkBanner] = useState(false);
  const [twitchAlert, setTwitchAlert] = useState(null);
  const [reauthing, setReauthing] = useState(false);

  const closeError = useCallback(() => {
    setError(null);
    setErrorKind('destructive');
  }, []);

  useEffect(() => {
    if (groupLinked) {
      setShowLinkBanner(true);
      const timer = setTimeout(() => setShowLinkBanner(false), 4000);
      return () => clearTimeout(timer);
    }
    setShowLinkBanner(false);
  }, [groupLinked, linkedIds.size]);

  const applySyncResult = useCallback((sync) => {
    if (sync.updated.length > 0) {
      const msg = sync.updated.map((u) => `${u.label}: ${u.oldIp} → ${u.newIp}`).join(', ');
      setError(t('app.ipsUpdated', { detail: msg }));
      setErrorKind('warning');
    } else if (sync.offline.length > 0) {
      const labels = sync.offline.map((o) => o.label).join(', ');
      setError(t('app.offlineLights', { labels }));
      setErrorKind('warning');
    }
  }, [t]);

  const load = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoadingDevices(true);
    try {
      const [d, p] = await Promise.all([api.getDevices(), api.getPresets()]);
      setDevices(d);
      const nextIds = d.map((x) => x.id);
      onDeviceIdsChange((prev) =>
        prev.length === nextIds.length && prev.every((id, i) => id === nextIds[i])
          ? prev
          : nextIds
      );
      setPresets(p);
      if (showLoading) setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoading) setLoadingDevices(false);
    }

    api.syncIps()
      .then(async (sync) => {
        if (sync.devices) {
          setDevices(sync.devices);
          const syncedIds = sync.devices.map((x) => x.id);
          onDeviceIdsChange((prev) =>
            prev.length === syncedIds.length && prev.every((id, i) => id === syncedIds[i])
              ? prev
              : syncedIds
          );
        } else {
          const refreshed = await api.getDevices();
          setDevices(refreshed);
          const refreshedIds = refreshed.map((x) => x.id);
          onDeviceIdsChange((prev) =>
            prev.length === refreshedIds.length && prev.every((id, i) => id === refreshedIds[i])
              ? prev
              : refreshedIds
          );
        }
        applySyncResult(sync);
      })
      .catch(() => {});
  }, [onDeviceIdsChange, applySyncResult]);

  const handleReorder = async (ids) => {
    try {
      const ordered = await api.reorderDevices(ids);
      setDevices(ordered);
      const orderedIds = ordered.map((x) => x.id);
      onDeviceIdsChange((prev) =>
        prev.length === orderedIds.length && prev.every((id, i) => id === orderedIds[i])
          ? prev
          : orderedIds
      );
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load({ showLoading: true }); }, [load]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const data = await api.getTwitch();
        if (!active) return;
        setTwitchAlert(needsEventSubReconnect(data?.debug, data?.enabled));
      } catch {
        /* serveur indisponible — on ignore */
      }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const handleReauth = async () => {
    setReauthing(true);
    try {
      await api.testTwitch();
      const data = await api.getTwitch();
      setTwitchAlert(needsEventSubReconnect(data?.debug, data?.enabled));
    } catch (err) {
      setError(err.message);
    } finally {
      setReauthing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-card/80 border-b sticky top-0 z-10 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-lg">
              <Lightbulb className="size-4" />
            </span>
            <h1 className="text-base font-semibold tracking-tight">Govee Lighting Interaction for Twitch</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={groupLinked ? 'default' : 'outline'}
              size="sm"
              className={cn(groupLinked && 'bg-success text-success-foreground hover:bg-success/90')}
              onClick={handleHeaderLink}
              title={groupLinked ? t('app.unlinkTitle') : t('app.linkTitle')}
            >
              {groupLinked ? <Unlink /> : <Link2 />}
              {t('app.linkLights')}
              {groupLinked && (
                <span className="bg-background text-success rounded-full px-1.5 text-xs font-semibold">
                  {linkedIds.size}
                </span>
              )}
            </Button>
            <SettingsMenu devices={devices} onAdded={load} onError={setError} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {error && (
          <Alert variant={errorKind}>
            <AlertTriangle />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 hover:bg-transparent"
                onClick={closeError}
                aria-label={t('app.close')}
              >
                <X />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showLinkBanner && (
          <Alert variant="success">
            <Link2 />
            <AlertDescription>
              {t('app.lightsLinked', { count: linkedIds.size })}
            </AlertDescription>
          </Alert>
        )}

        {twitchAlert && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>{t('app.eventSubReauthTitle')}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{twitchAlert.message}</span>
              <Button size="sm" variant="secondary" onClick={handleReauth} disabled={reauthing}>
                {reauthing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {reauthing ? t('app.reeauthButtonBusy') : t('app.reeauthButton')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <DeviceList
          devices={devices}
          presets={presets}
          loading={loadingDevices}
          onUpdate={load}
          onError={setError}
          onReorder={handleReorder}
        />

        <TwitchPanel presets={presets} onError={setError} />

        <AppFooter />
      </main>
    </div>
  );
}

export default function App() {
  const [deviceIds, setDeviceIds] = useState([]);

  return (
    <LinkProvider deviceIds={deviceIds}>
      <Dashboard onDeviceIdsChange={setDeviceIds} />
    </LinkProvider>
  );
}
