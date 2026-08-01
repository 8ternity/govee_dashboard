import { useState } from 'react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
import { api } from '../api';

export default function GroupPanel({ devices, groups, onUpdate, onError }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);

  const toggleDevice = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || selected.length === 0) return;
    try {
      await api.addGroup({ name: name.trim(), deviceIds: selected });
      setName('');
      setSelected([]);
      setCreating(false);
      onUpdate();
    } catch (err) {
      onError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteGroup(id);
      onUpdate();
    } catch (err) {
      onError(err.message);
    }
  };

  const handleControl = async (id, action, extra = {}) => {
    try {
      await api.controlGroup(id, { action, ...extra });
    } catch (err) {
      onError(err.message);
    }
  };

  const getDeviceLabel = (id) =>
    devices.find((d) => d.id === id)?.label || id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Groupes ({groups.length})</CardTitle>
        <Button size="sm" variant={creating ? 'secondary' : 'default'} onClick={() => setCreating(!creating)}>
          {creating ? 'Annuler' : '+ Nouveau groupe'}
        </Button>
      </CardHeader>

      {creating && (
        <CardContent className="space-y-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              placeholder="Nom du groupe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {devices.length === 0 ? (
              <p className="text-muted-foreground text-sm">Ajoute des lumières d'abord.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {devices.map((d) => (
                  <Label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                    <Checkbox
                      checked={selected.includes(d.id)}
                      onCheckedChange={() => toggleDevice(d.id)}
                    />
                    <span className="truncate">{d.label}</span>
                  </Label>
                ))}
              </div>
            )}
            <Button type="submit" disabled={selected.length === 0}>
              Créer le groupe
            </Button>
          </form>
        </CardContent>
      )}

      {groups.length === 0 && !creating && (
        <CardContent>
          <p className="text-muted-foreground text-center text-sm">Aucun groupe. Lie plusieurs lumières ensemble.</p>
        </CardContent>
      )}

      {groups.length > 0 && (
        <CardContent className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {g.deviceIds.map(getDeviceLabel).join(', ')}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" onClick={() => handleControl(g.id, 'on')}>ON</Button>
                <Button size="sm" variant="secondary" onClick={() => handleControl(g.id, 'off')}>OFF</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">Supprimer</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce groupe ?</AlertDialogTitle>
                      <AlertDialogDescription>« {g.name} » sera définitivement supprimé.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => handleDelete(g.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
