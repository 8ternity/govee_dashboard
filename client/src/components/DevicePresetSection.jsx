import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { api } from '../api';
import { t, useT } from '../i18n';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
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

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function colorName(hex) {
  const key = `color.${(hex || '').toLowerCase()}`;
  const name = t(key);
  return name === key ? null : name;
}
function describeCurrent(activeFx, color, effects) {
  if (activeFx) {
    const dash = activeFx.indexOf('-');
    if (dash > 0) {
      const tab = activeFx.slice(0, dash);
      const id = activeFx.slice(dash + 1);
      const item = (effects?.[tab] || []).find((i) => i.id === id);
      if (item) {
        return {
          kind: tab,
          name: item.kelvin ? `${item.name} · ${item.kelvin}K` : item.name,
          isEffect: true,
        };
      }
    }
    return { kind: 'fx', name: activeFx, isEffect: true };
  }
  const hex = (color || '#ffffff').toUpperCase();
  return { kind: 'color', name: colorName(color) || hex, hex, isEffect: false };
}

function buildPresetName(state, effects) {
  const desc = describeCurrent(state.activeFx, state.color, effects);
  return `${desc.name} - ${state.brightness ?? 50}%`;
}

function resolveCommandsForState(state, effects) {
  if (state.commands?.length) return state.commands;
  if (state.activeFx) {
    const dash = state.activeFx.indexOf('-');
    if (dash > 0) {
      const tab = state.activeFx.slice(0, dash);
      const id = state.activeFx.slice(dash + 1);
      const item = (effects?.[tab] || []).find((i) => i.id === id);
      if (item?.commands?.length) return item.commands;
    }
  }
  return null;
}

function targetKey(targets) {
  return targets
    .filter((t) => t.type === 'device')
    .map((t) => t.id)
    .sort()
    .join(',');
}

function getPresetsForCard(device, presets, linkedIds, groupLinked, isLinked) {
  if (groupLinked && isLinked(device.id)) {
    const groupKey = [...linkedIds].sort().join(',');
    return presets.filter((p) => targetKey(p.targets) === groupKey);
  }
  return presets.filter(
    (p) =>
      p.targets.length === 1 &&
      p.targets[0].type === 'device' &&
      p.targets[0].id === device.id
  );
}

const DevicePresetSection = forwardRef(function DevicePresetSection(
  {
    device,
    presets,
    state,
    linkedIds,
    groupLinked,
    isLinked,
    onApplyState,
    onCommandsChange,
    onPresetApplied,
    onError,
    onUpdate,
  },
  ref
) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [applying, setApplying] = useState(null);
  const [appliedId, setAppliedId] = useState(null);
  const [effects, setEffects] = useState(null);

  useImperativeHandle(ref, () => ({
    openCreate: () => setCreateOpen(true),
  }));

  useEffect(() => {
    if (!appliedId) return undefined;
    const timer = setTimeout(() => setAppliedId(null), 4000);
    return () => clearTimeout(timer);
  }, [appliedId]);

  useEffect(() => {
    api
      .getEffects(device.sku || 'H16C0')
      .then(setEffects)
      .catch(() => {});
  }, [device.sku]);

  const visiblePresets = getPresetsForCard(
    device,
    presets,
    linkedIds,
    groupLinked,
    isLinked
  );

  const activeCommands = state.commands?.length
    ? JSON.stringify(state.commands)
    : null;

  const isPresetActive = (p) => {
    if (!state.activeFx || p.state?.activeFx !== state.activeFx) return false;
    if (
      p.state?.brightness != null &&
      state.brightness != null &&
      p.state.brightness !== state.brightness
    ) {
      return false;
    }
    return true;
  };

  const activePresetId =
    visiblePresets.find(isPresetActive)?.id ??
    visiblePresets.find(
      (p) =>
        p.state.commands?.length &&
        activeCommands &&
        JSON.stringify(p.state.commands) === activeCommands
    )?.id ??
    null;

  const desc = describeCurrent(state.activeFx, state.color, effects);
  const suggestedName = buildPresetName(state, effects);

  const handleCreate = async () => {
    const presetName = name.trim() || suggestedName;
    if (!presetName) return;

    const targets =
      groupLinked && isLinked(device.id)
        ? [...linkedIds].map((id) => ({ type: 'device', id }))
        : [{ type: 'device', id: device.id }];

    setCreating(true);
    try {
      await api.addPreset({
        name: presetName,
        targets,
        state: {
          on: state.on,
          brightness: state.brightness,
          color: hexToRgb(state.color),
          activeFx: state.activeFx,
          commands: resolveCommandsForState(state, effects),
        },
      });
      setName('');
      setCreateOpen(false);
      onUpdate();
    } catch (err) {
      onError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async (preset) => {
    setApplying(preset.id);
    try {
      await api.applyPreset(preset.id);
      const patch = {};
      if (preset.state.on !== undefined) patch.on = preset.state.on;
      if (preset.state.brightness !== undefined) patch.brightness = preset.state.brightness;
      if (preset.state.color) {
        const { r, g, b } = preset.state.color;
        patch.color =
          '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
      }
      if (preset.state.activeFx) patch.activeFx = preset.state.activeFx;
      if (Object.keys(patch).length) onApplyState(patch);
      if (preset.state.commands?.length) onCommandsChange?.(preset.state.commands);
      onPresetApplied?.(preset.name);
      setAppliedId(preset.id);
    } catch (err) {
      onError(err.message);
    } finally {
      setApplying(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deletePreset(id);
      onUpdate();
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <div className="space-y-2">
      {visiblePresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visiblePresets.map((p) => (
            <div
              key={p.id}
              className={cn(
                'bg-secondary/60 hover:bg-secondary group relative flex items-center gap-1 overflow-hidden rounded-md border px-2 py-1 transition-colors',
                activePresetId === p.id && 'border-primary bg-primary/10',
                appliedId === p.id && 'preset-glow'
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-1 text-xs font-normal',
                  activePresetId === p.id && 'font-medium text-primary'
                )}
                disabled={applying === p.id}
                onClick={() => handleApply(p)}
              >
                {applying === p.id ? <Loader2 className="size-3 animate-spin" /> : p.name}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-6 opacity-60 hover:opacity-100"
                    aria-label={`${t('preset.delete')} ${p.name}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('preset.deleteTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('preset.deleteDescription', { name: p.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('preset.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => handleDelete(p.id)}
                    >
                      {t('preset.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) setName('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('preset.createTitle')}</DialogTitle>
            <DialogDescription>
              {t('preset.createDescription')}
              {groupLinked && isLinked(device.id)
                ? t('preset.createDescriptionLinked')
                : t('preset.createDescriptionSingle')}.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/40 space-y-2 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('preset.level')}</span>
              <span className="tabular-nums font-medium">{state.brightness ?? 50}%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t('preset.modeSceneColor')}</span>
              <span className="flex min-w-0 items-center gap-2 font-medium">
                {desc.hex && (
                  <span
                    className="border-border size-3.5 shrink-0 rounded-full border"
                    style={{ background: desc.hex }}
                    aria-hidden
                  />
                )}
                <span className="truncate">{desc.name}</span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preset-name">{t('preset.nameOptional')}</Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedName}
              maxLength={60}
            />
            <p className="text-muted-foreground text-xs">
              {t('preset.nameHint', { name: suggestedName })}
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t('preset.cancel')}</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="animate-spin" /> : <Check />}
              {creating ? t('preset.creating') : t('preset.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default DevicePresetSection;
