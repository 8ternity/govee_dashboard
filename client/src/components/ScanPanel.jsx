import { useState, useEffect, useRef } from 'react';
import { Loader2, Radio, Plus } from 'lucide-react';
import { api } from '../api';
import { useT } from '../i18n';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

function withAddedStatus(results, devices) {
  const registered = new Set(devices.map((d) => d.device));
  return results.map((d) => ({
    ...d,
    alreadyAdded: registered.has(d.device),
  }));
}

export default function ScanPanel({
  devices,
  onAdded,
  onError,
  open,
  onOpenChange,
  anchorRef,
  embedded = false,
}) {
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState([]);
  const [scanned, setScanned] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open || embedded) return undefined;
    const onOutside = (e) => {
      if (anchorRef?.current?.contains(e.target)) return;
      onOpenChange?.(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, onOpenChange, anchorRef, embedded]);

  const handleScan = async () => {
    setScanning(true);
    setFound([]);
    setScanned(false);
    try {
      await api.syncIps();
      const results = await api.scan();
      setFound(withAddedStatus(results, devices));
      setScanned(true);
      onAdded();
    } catch (err) {
      onError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleScanIp = async (e) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    setScanning(true);
    setScanned(false);
    try {
      const device = await api.scanIp(manualIp.trim());
      setFound(withAddedStatus([device], devices));
      setScanned(true);
    } catch (err) {
      onError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleAdd = async (device) => {
    try {
      await api.addDevice({
        device: device.device,
        sku: device.sku,
        deviceName: device.deviceName,
        ip: device.ip,
        label: device.deviceName,
      });
      setFound((prev) => prev.filter((d) => d.device !== device.device));
      onAdded();
    } catch (err) {
      onError(err.message);
    }
  };

  if (!open) return null;

  const hasNew = found.some((d) => !d.alreadyAdded);
  const allAlreadyAdded = scanned && found.length > 0 && !hasNew;

  const panel = (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-4" /> {t('scan.title')}
        </CardTitle>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? <Loader2 className="animate-spin" /> : null}
          {scanning ? t('scan.scanning') : t('scan.scanNetwork')}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {scanning && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-3.5 animate-spin" /> {t('scan.searching')}
          </p>
        )}

        {!scanning && !scanned && found.length === 0 && (
          <p className="text-muted-foreground text-center text-sm">
            {t('scan.startHint')}
          </p>
        )}

        {!scanning && scanned && found.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {t('scan.noneFound')}
          </p>
        )}

        {!scanning && allAlreadyAdded && (
          <p className="text-success text-sm">{t('scan.allAdded')}</p>
        )}

        {found.length > 0 && (
          <ul className="space-y-2">
            {found.map((d) => (
              <li key={d.device} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.deviceName}</p>
                  <p className="text-muted-foreground text-xs">{d.sku} · {d.ip}</p>
                </div>
                {d.alreadyAdded ? (
                  <Badge variant="secondary">{t('scan.alreadyAdded')}</Badge>
                ) : (
                  <Button size="sm" onClick={() => handleAdd(d)}>
                    <Plus /> {t('scan.add')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleScanIp} className="flex gap-2">
          <Input
            placeholder={t('scan.ipPlaceholder')}
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" disabled={scanning}>
            {t('scan.scanIp')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return <div className="pt-2">{panel}</div>;
  }

  return (
    <div
      className={cn(
        'fixed inset-x-4 top-20 z-50 sm:inset-x-auto sm:right-6 sm:w-96',
        'border rounded-xl bg-popover shadow-xl p-2'
      )}
      ref={panelRef}
    >
      {panel}
    </div>
  );
}
