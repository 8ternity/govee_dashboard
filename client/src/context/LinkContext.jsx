import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { kelvinToHex } from '../utils/kelvin';

const LinkContext = createContext(null);

export const DEFAULT_UI_STATE = {
  on: false,
  brightness: 50,
  color: '#ffffff',
  activeFx: null,
  online: true,
};

function stateFromLive(status, activeFx = null) {
  if (!status) return { ...DEFAULT_UI_STATE, activeFx, online: false };
  return {
    on: Boolean(status.on),
    brightness: status.brightness ?? 50,
    color: status.color ?? '#ffffff',
    activeFx,
    online: true,
  };
}

function isGroupLinked(ids) {
  return ids.size >= 2;
}

export function LinkProvider({ children, deviceIds = [] }) {
  const [linkedIds, setLinkedIds] = useState(new Set());
  const [deviceStates, setDeviceStates] = useState({});
  const [linkedState, setLinkedState] = useState(DEFAULT_UI_STATE);
  const [ready, setReady] = useState(false);
  const persistTimer = useRef(null);
  const activeFxRef = useRef({ linked: null, devices: {} });
  const deviceIdsRef = useRef(deviceIds);
  deviceIdsRef.current = deviceIds;

  const persist = useCallback((patch) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      api.updateSettings(patch).catch(() => {});
    }, 250);
  }, []);

  const persistLink = useCallback(
    (ids) => {
      persist({
        link: {
          enabled: ids.size >= 2,
          deviceIds: [...ids],
        },
      });
    },
    [persist]
  );

  const persistActiveFx = useCallback(() => {
    persist({
      linkedState: { activeFx: activeFxRef.current.linked },
      deviceStates: activeFxRef.current.devices,
    });
  }, [persist]);

  const applyLiveToState = useCallback((live, validIds) => {
    const ids = deviceIdsRef.current;
    const perDevice = {};
    for (const id of ids) {
      const fx = activeFxRef.current.devices[id] ?? null;
      perDevice[id] = stateFromLive(live[id], fx);
    }
    setDeviceStates(perDevice);

    if (validIds.length >= 2) {
      const primary = validIds[0];
      const fx =
        activeFxRef.current.linked ??
        activeFxRef.current.devices[primary] ??
        null;
      const allOnline = validIds.every((id) => live[id]);
      const base = stateFromLive(live[primary], fx);
      setLinkedState({ ...base, online: allOnline });
    }
  }, []);

  const refreshLiveStatus = useCallback(
    async (ids) => {
      try {
        const live = await api.getDevicesStatus(ids);
        setDeviceStates((prev) => {
          const next = { ...prev };
          for (const id of ids) {
            if (live[id]) {
              next[id] = stateFromLive(live[id], prev[id]?.activeFx ?? null);
            }
          }
          return next;
        });

        if (isGroupLinked(linkedIds) && ids.some((id) => linkedIds.has(id))) {
          const primary = [...linkedIds][0];
          const allOnline = [...linkedIds].every((id) => live[id]);
          if (live[primary]) {
            setLinkedState((prev) => ({
              ...stateFromLive(live[primary], prev.activeFx),
              online: allOnline,
            }));
          } else {
            setLinkedState((prev) => ({ ...prev, online: false }));
          }
        }
      } catch {
        /* ignore */
      }
    },
    [linkedIds]
  );

  useEffect(() => {
    if (deviceIds.length === 0) {
      setReady(true);
      return;
    }

    let cancelled = false;

    async function init() {
      setReady(false);
      try {
        const settings = await api.getSettings();
        const savedIds = settings.link?.deviceIds || [];
        const validIds = savedIds.filter((id) => deviceIds.includes(id));

        activeFxRef.current = {
          linked: settings.linkedState?.activeFx ?? null,
          devices: Object.fromEntries(
            Object.entries(settings.deviceStates || {}).map(([id, s]) => [
              id,
              s?.activeFx ?? null,
            ])
          ),
        };

        const live = await api.getDevicesStatus(deviceIds);
        if (cancelled) return;

        if (validIds.length >= 2) {
          setLinkedIds(new Set(validIds));
        }

        applyLiveToState(live, validIds);
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [deviceIds.join(',')]);

  const groupLinked = isGroupLinked(linkedIds);

  const isLinked = useCallback(
    (id) => groupLinked && linkedIds.has(id),
    [groupLinked, linkedIds]
  );

  const getState = useCallback(
    (deviceId) => {
      if (isLinked(deviceId)) return linkedState;
      return deviceStates[deviceId] || DEFAULT_UI_STATE;
    },
    [isLinked, linkedState, deviceStates]
  );

  const patchState = useCallback(
    (deviceId, patch) => {
      const fxPatch = patch.activeFx !== undefined ? { activeFx: patch.activeFx } : null;

      if (isLinked(deviceId)) {
        setLinkedState((prev) => {
          const next = { ...prev, ...patch };
          if (fxPatch) {
            activeFxRef.current.linked = patch.activeFx;
            persistActiveFx();
          }
          return next;
        });
        setDeviceStates((prev) => {
          const next = { ...prev };
          for (const id of linkedIds) {
            next[id] = { ...(next[id] || DEFAULT_UI_STATE), ...patch };
            if (fxPatch) activeFxRef.current.devices[id] = patch.activeFx;
          }
          if (fxPatch) persistActiveFx();
          return next;
        });
      } else {
        setDeviceStates((prev) => {
          const next = {
            ...prev,
            [deviceId]: { ...(prev[deviceId] || DEFAULT_UI_STATE), ...patch },
          };
          if (fxPatch) {
            activeFxRef.current.devices[deviceId] = patch.activeFx;
            persistActiveFx();
          }
          return next;
        });
      }
    },
    [isLinked, linkedIds, persistActiveFx]
  );

  const unlinkAll = useCallback(() => {
    setLinkedIds(new Set());
    persistLink(new Set());
  }, [persistLink]);

  const handleHeaderLink = () => {
    if (groupLinked) unlinkAll();
  };

  const toggleLinked = (id) => {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      if (isGroupLinked(next)) {
        const primary = [...next][0];
        setLinkedState(deviceStates[primary] || DEFAULT_UI_STATE);
      }

      persistLink(next);
      return next;
    });
  };

  const getTargetIds = useCallback(
    (deviceId) => {
      if (!groupLinked || !linkedIds.has(deviceId)) return [deviceId];
      return [...linkedIds];
    },
    [groupLinked, linkedIds]
  );

  const control = useCallback(
    async (deviceId, body) => {
      const ids = getTargetIds(deviceId);
      const offline = ids.filter((id) => deviceStates[id]?.online === false);
      if (offline.length > 0) {
        throw new Error(t('link.offlineError'));
      }
      const { effectId, ...payload } = body;

      if (payload.action === 'on') patchState(deviceId, { on: true });
      if (payload.action === 'off') patchState(deviceId, { on: false });
      if (payload.action === 'brightness') patchState(deviceId, { brightness: payload.brightness });
      if (payload.action === 'color') {
        const { r, g, b } = payload.color;
        const hex =
          '#' +
          [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
        patchState(deviceId, { color: hex });
      }
      if (payload.action === 'ptReal' && effectId) {
        patchState(deviceId, { activeFx: effectId });
      }
      if (payload.action === 'kelvin' && effectId) {
        patchState(deviceId, {
          activeFx: effectId,
          color: kelvinToHex(payload.kelvin),
        });
      }
      if (payload.action === 'lighting') {
        patchState(deviceId, {
          on: true,
          color: kelvinToHex(payload.kelvin),
          activeFx: effectId ?? null,
        });
      }

      if (ids.length === 1) {
        await api.controlDevice(ids[0], payload);
      } else {
        await api.controlDevices(ids, payload);
      }

      await refreshLiveStatus(ids);
    },
    [getTargetIds, patchState, refreshLiveStatus, deviceStates, linkedState]
  );

  return (
    <LinkContext.Provider
      value={{
        groupLinked,
        linkedIds,
        ready,
        handleHeaderLink,
        unlinkAll,
        toggleLinked,
        getState,
        patchState,
        control,
        isLinked,
        refreshLiveStatus,
        getTargetIds,
      }}
    >
      {children}
    </LinkContext.Provider>
  );
}

export function useLink() {
  const ctx = useContext(LinkContext);
  if (!ctx) throw new Error('useLink hors LinkProvider');
  return ctx;
}
