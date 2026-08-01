import { Lightbulb } from 'lucide-react';
import { useT } from '../i18n';
import DeviceCard from './DeviceCard';
import GroupPresetCard from './GroupPresetCard';
import { Card } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';

export default function DeviceList({ devices, presets, loading, onUpdate, onError }) {
  const t = useT();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="text-primary size-4" />
        <h2 className="text-sm font-semibold tracking-wide">
          {t('deviceList.title')}
        </h2>
        {devices.length > 0 && <Badge>{devices.length}</Badge>}
      </div>

      {loading ? (
        <div className="grid grid-cols-12 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="col-span-12 md:col-span-6">
              <Card className="gap-4">
                <div className="space-y-2 px-6">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="space-y-3 px-6">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <Card>
          <p className="text-muted-foreground px-6 py-8 text-center text-sm">
            {t('deviceList.empty')}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-4">
            {devices.map((device) => (
              <div key={device.id} className="col-span-12 md:col-span-6">
                <DeviceCard
                  device={device}
                  presets={presets}
                  onUpdate={onUpdate}
                  onError={onError}
                />
              </div>
            ))}
          </div>
          <GroupPresetCard
            devices={devices}
            presets={presets}
            onUpdate={onUpdate}
            onError={onError}
          />
        </>
      )}
    </section>
  );
}
