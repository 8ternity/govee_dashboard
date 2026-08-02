import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { useT } from '../i18n';
import { cn } from '@/lib/utils';
import { kelvinToHex } from '@/utils/kelvin';

const TABS = [
  { id: 'scenes', labelKey: 'fx.tab.scenes' },
  { id: 'lighting', labelKey: 'fx.tab.lighting' },
  { id: 'gradients', labelKey: 'fx.tab.gradients' },
  { id: 'effects', labelKey: 'fx.tab.effects' },
  { id: 'moreScenes', labelKey: 'fx.tab.moreScenes' },
];

const MORE_PAGE_SIZE = 12;

function EffectChip({ item, active, loading, isLighting, tabId, onApply }) {
  const t = useT();
  const localized =
    isLighting && item?.id
      ? (() => {
          const key = `fx.lighting.${item.id}`;
          const translated = t(key);
          return translated === key ? item.name : translated;
        })()
      : item.name;
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'secondary'}
      size="sm"
      className={cn(
        'h-8 justify-start gap-1.5 px-2.5 text-xs font-normal',
        isLighting && !active && 'bg-card text-foreground hover:bg-muted border'
      )}
      disabled={loading}
      onClick={() => onApply(tabId, item)}
      title={item.kelvin ? `${item.kelvin}K` : undefined}
    >      {isLighting && item.kelvin && (
        <span
          className="border-border size-3.5 shrink-0 rounded-full border"
          style={{ background: kelvinToHex(item.kelvin) }}
          aria-hidden
        />
      )}
      <span className="truncate">{localized}</span>
      {item.kelvin && (
        <span className="text-muted-foreground text-[10px]">{item.kelvin}K</span>
      )}
    </Button>
  );
}

function MoreScenesPager({ items, activeFx, loading, onApply }) {
  const t = useT();
  const [page, setPage] = useState(0);
  const total = Math.ceil(items.length / MORE_PAGE_SIZE);
  const safePage = Math.min(page, Math.max(total - 1, 0));
  const start = safePage * MORE_PAGE_SIZE;
  const slice = items.slice(start, start + MORE_PAGE_SIZE);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {slice.map((item) => (
          <EffectChip
            key={item.id}
            item={item}
            active={activeFx === `moreScenes-${item.id}`}
            loading={loading}
            tabId="moreScenes"
            onApply={onApply}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0"
          disabled={safePage === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          aria-label={t('fx.prevPage')}
        >
          <ChevronLeft />
        </Button>
        <span className="text-muted-foreground text-xs tabular-nums">
          {t('fx.pageCount', { current: safePage + 1, total })}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0"
          disabled={safePage >= total - 1}
          onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
          aria-label={t('fx.nextPage')}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export default function EffectPicker({ effects, activeFx, loading, onApply }) {
  const t = useT();
  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === 'moreScenes' && (effects.moreScenes || []).length === 0) return false;
    return (effects[tab.id] || []).length > 0;
  });

  return (
    <Tabs defaultValue={visibleTabs[0]?.id ?? 'scenes'} className="w-full">
      <TabsList className="h-auto w-full flex-wrap justify-start rounded-lg bg-transparent p-0">
        {visibleTabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:border-border">
            {t(tab.labelKey)}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleTabs.map((tab) => {
        const isLighting = tab.id === 'lighting';
        const isMore = tab.id === 'moreScenes';
        const items = effects[tab.id] || [];
        return (
          <TabsContent key={tab.id} value={tab.id} className="space-y-2">
            {isLighting && (
              <p className="text-muted-foreground text-xs">
                {t('fx.lightingHint')}
              </p>
            )}
            {isMore && (
              <p className="text-muted-foreground text-xs">
                {t('fx.moreHint')}
              </p>
            )}
            {items.length === 0 ? (
              <span className="text-muted-foreground text-sm">{t('fx.noneAvailable')}</span>
            ) : isMore ? (
              <MoreScenesPager
                items={items}
                activeFx={activeFx}
                loading={loading}
                onApply={onApply}
              />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((item) => (
                  <EffectChip
                    key={item.id}
                    item={item}
                    active={activeFx === `${tab.id}-${item.id}`}
                    loading={loading}
                    isLighting={isLighting}
                    tabId={tab.id}
                    onApply={onApply}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
