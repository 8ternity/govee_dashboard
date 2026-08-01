import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
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

export default function PresetPanel({ devices, presets, onUpdate, onError, compact = false }) {
  const [applying, setApplying] = useState(null);

  const handleApply = async (id) => {
    setApplying(id);
    try {
      await api.applyPreset(id);
      onUpdate();
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

  const getTargetName = (preset) => {
    const t = preset.targets[0];
    if (!t) return '—';
    return devices.find((d) => d.id === t.id)?.label || t.id;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Presets ({presets.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {presets.length === 0 && (
          <p className="text-muted-foreground text-center text-sm">Aucun preset.</p>
        )}
        {presets.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                {getTargetName(p)} · {p.state.brightness}%
                <span
                  className="inline-block size-2.5 rounded-full border"
                  style={{
                    background: p.state.color
                      ? `rgb(${p.state.color.r},${p.state.color.g},${p.state.color.b})`
                      : '#fff',
                  }}
                  aria-hidden
                />
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                disabled={applying === p.id}
                onClick={() => handleApply(p.id)}
              >
                {applying === p.id ? <Loader2 className="animate-spin" /> : 'Appliquer'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive size-8"
                    aria-label={`Supprimer ${p.name}`}
                  >
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce preset ?</AlertDialogTitle>
                    <AlertDialogDescription>« {p.name} » sera définitivement supprimé.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => handleDelete(p.id)}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
