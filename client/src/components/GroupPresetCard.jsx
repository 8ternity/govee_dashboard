import { useEffect, useRef, useState } from 'react';
import { Link2, Plus } from 'lucide-react';
import { useLink } from '../context/LinkContext';
import { useT } from '../i18n';
import DevicePresetSection from './DevicePresetSection';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function GroupPresetCard({ devices, presets, onError, onUpdate }) {
  const t = useT();
  const { linkedIds, groupLinked, isLinked, getState, patchState } = useLink();
  const [lastCommands, setLastCommands] = useState(null);
  const [toast, setToast] = useState(null);
  const presetSectionRef = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!groupLinked || linkedIds.size < 2) return null;

  const primaryId = [...linkedIds][0];
  const device = devices.find((d) => d.id === primaryId);
  if (!device) return null;

  const state = getState(primaryId);
  const labels = [...linkedIds]
    .map((id) => devices.find((d) => d.id === id)?.label)
    .filter(Boolean)
    .join(' + ');

  return (
    <Card className="w-full gap-4">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="text-primary size-4" />
          {t('groupPreset.title')}
          <Badge variant="success" title={labels}>{linkedIds.size}</Badge>
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {toast && <Badge variant="success">{t('groupPreset.presetApplied', { name: toast })}</Badge>}
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            title={t('groupPreset.createPreset')}
            aria-label={t('groupPreset.createPreset')}
            onClick={() => presetSectionRef.current?.openCreate()}
          >
            <Plus />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <DevicePresetSection
          ref={presetSectionRef}
          device={device}
          presets={presets}
          state={{ ...state, commands: lastCommands }}
          linkedIds={linkedIds}
          groupLinked={groupLinked}
          isLinked={isLinked}
          onApplyState={(patch) => patchState(primaryId, patch)}
          onCommandsChange={setLastCommands}
          onPresetApplied={setToast}
          onError={onError}
          onUpdate={onUpdate}
        />
      </CardContent>
    </Card>
  );
}
