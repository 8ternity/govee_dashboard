import { useState, useEffect, useRef } from 'react';
import { Link2, Unlink, Pencil, Check, Trash2, Loader2, X, AlertTriangle, Plus, GripVertical } from 'lucide-react';
import { api } from '../api';
import { useLink } from '../context/LinkContext';
import { useT } from '../i18n';
import EffectPicker from './EffectPicker';
import DevicePresetSection from './DevicePresetSection';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Skeleton } from './ui/skeleton';
import { Label } from './ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { cn } from '@/lib/utils';

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export default function DeviceCard({ device, presets, onUpdate, onError, isDragging, onDragStart, onDragEnd }) {
  const t = useT();
  const {
    linkedIds,
    toggleLinked,
    control,
    getState,
    isLinked,
    groupLinked,
    patchState,
    ready,
  } = useLink();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(device.label);
  const [loading, setLoading] = useState(false);
  const [effects, setEffects] = useState(null);
  const [localBrightness, setLocalBrightness] = useState(null);
  const [lastCommands, setLastCommands] = useState(null);
  const [presetToast, setPresetToast] = useState(null);
  const presetSectionRef = useRef(null);

  useEffect(() => {
    if (!presetToast) return undefined;
    const timer = setTimeout(() => setPresetToast(null), 3000);
    return () => clearTimeout(timer);
  }, [presetToast]);

  const state = getState(device.id);
  const linked = isLinked(device.id);
  const selected = linkedIds.has(device.id);
  const brightness = localBrightness ?? state.brightness ?? 100;

  useEffect(() => {
    setLabel(device.label);
  }, [device.label]);

  useEffect(() => {
    api.getEffects(device.sku || 'H16C0')
      .then(setEffects)
      .catch(() => setEffects({ scenes: [], gradients: [], effects: [], lighting: [], moreScenes: [] }));
  }, [device.sku]);

  const runControl = async (body) => {
    setLoading(true);
    try {
      await control(device.id, body);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    await runControl({ action: state.on ? 'off' : 'on' });
  };

  const handleSaveLabel = async () => {
    try {
      await api.updateDevice(device.id, { label });
      setEditing(false);
      onUpdate();
    } catch (err) {
      onError(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteDevice(device.id);
      onUpdate();
    } catch (err) {
      onError(err.message);
    }
  };

  const applyEffect = async (category, item) => {
    if (category === 'lighting') {
      setLastCommands(null);
      await runControl({
        action: 'lighting',
        kelvin: item.kelvin,
        effectId: `lighting-${item.id}`,
      });
      return;
    }
    setLastCommands(item.commands);
    await runControl({
      action: 'ptReal',
      commands: item.commands,
      effectId: `${category}-${item.id}`,
    });
  };

  const presetState = {
    ...state,
    commands: lastCommands,
  };

  if (!ready) {
    return (
      <Card className="gap-4">
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-6 w-full" />
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'relative gap-4 transition-colors',
        selected && 'border-primary/60',
        isDragging && 'opacity-40'
      )}
    >
      {presetToast && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="success">{t('device.presetApplied', { name: presetToast })}</Badge>
        </div>
      )}

      <CardHeader className="flex flex-row items-start gap-3">
        <button
          type="button"
          draggable
          disabled={editing}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className={cn(
            'mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing',
            editing && 'cursor-default opacity-30'
          )}
          title={t('device.drag')}
          aria-label={t('device.drag')}
        >
          <GripVertical className="size-4" />
        </button>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              className="h-8 w-40"
            />
            <Button size="icon" variant="ghost" className="size-8" onClick={handleSaveLabel} aria-label={t('device.save')}>
              <Check />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(false)} aria-label={t('device.cancel')}>
              <X />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-1">
              <CardTitle className="text-base">{device.label}</CardTitle>
              <p className="text-muted-foreground text-xs">
                {device.sku} · {device.ip}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              {linked && linkedIds.size > 1 && (
                <Badge variant="success" className="mr-1">{t('device.linkedCount', { count: linkedIds.size })}</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className={cn('size-8', selected && 'text-primary')}
                onClick={() => toggleLinked(device.id)}
                title={selected ? t('device.unlinkTitle') : t('device.linkTitle')}
                aria-label={selected ? t('device.unlinkTitle') : t('device.linkTitle')}
              >
                {linked ? <Unlink /> : <Link2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setEditing(true)}
                title={t('device.rename')}
                aria-label={t('device.rename')}
              >
                <Pencil />
              </Button>
              {!linked && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-8"
                  title={t('device.createPreset')}
                  aria-label={t('device.createPreset')}
                  onClick={() => presetSectionRef.current?.openCreate()}
                >
                  <Plus />
                </Button>
              )}
            </div>
          </>
        )}
      </CardHeader>

      {selected && !groupLinked && (
        <div className="px-6">
          <Badge variant="warning" title={t('device.linkSelectionWarningTitle')}>
            <AlertTriangle /> {t('device.linkSelectionWarning')}
          </Badge>
        </div>
      )}

      {state.online === false && (
        <div className="px-6">
          <Badge variant="destructive">{t('device.offline', { ip: device.ip })}</Badge>
        </div>
      )}

      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={`power-${device.id}`} className="cursor-pointer">{t('device.power')}</Label>
          <Switch
            id={`power-${device.id}`}
            checked={Boolean(state.on)}
            disabled={loading}
            onCheckedChange={handleToggle}
            aria-pressed={state.on}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('device.brightness')}</Label>
            <span className="text-muted-foreground text-xs tabular-nums">{brightness}%</span>
          </div>
          <Slider
            min={1}
            max={100}
            value={[brightness]}
            disabled={loading}
            onValueChange={(v) => setLocalBrightness(v[0])}
            onValueCommit={(v) => {
              runControl({ action: 'brightness', brightness: v[0] });
              setLocalBrightness(null);
            }}
            aria-label={t('device.brightness')}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label>{t('device.color')}</Label>
          <div className="flex items-center gap-2">
            <span
              className="size-6 rounded-full border"
              style={{ background: state.color }}
              aria-hidden
            />
            <input
              type="color"
              value={state.color}
              disabled={loading}
              onChange={(e) => {
                setLastCommands(null);
                runControl({ action: 'color', color: hexToRgb(e.target.value) });
              }}
              className="h-8 w-10 cursor-pointer rounded-md border border-border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('device.color')}
            />
          </div>
        </div>

        {effects && (
          <EffectPicker
            effects={effects}
            activeFx={state.activeFx}
            loading={loading}
            onApply={applyEffect}
          />
        )}
      </CardContent>

      {!linked && (
        <>
          <Separator />
          <CardContent>
            <DevicePresetSection
              ref={presetSectionRef}
              device={device}
              presets={presets}
              state={presetState}
              linkedIds={linkedIds}
              groupLinked={groupLinked}
              isLinked={isLinked}
              onApplyState={(patch) => patchState(device.id, patch)}
              onCommandsChange={setLastCommands}
              onPresetApplied={setPresetToast}
              onError={onError}
              onUpdate={onUpdate}
            />
          </CardContent>
        </>
      )}

      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 /> {t('device.delete')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('device.deleteTitle', { name: device.label })}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('device.deleteDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('device.cancel')}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete}>
                {loading ? <Loader2 className="animate-spin" /> : null} {t('device.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
