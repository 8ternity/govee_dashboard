import * as govee from './govee.js';
import { store } from '../storage/store.js';
import { resolveEffectByKey } from './effects.js';
import { AppError } from '../errors.js';
import { t, DEFAULT_LOCALE } from '../i18n.js';

export function resolvePresetIps(preset) {
  const devices = store.getDevices();
  const groups = store.getGroups();
  const ips = new Set();
  const missingTargets = [];

  for (const target of preset.targets) {
    if (target.type === 'device') {
      const d = devices.find((dev) => dev.id === target.id);
      if (d) ips.add(d.ip);
      else missingTargets.push(target.id);
    } else if (target.type === 'group') {
      const g = groups.find((gr) => gr.id === target.id);
      if (g) {
        for (const d of devices.filter((dev) => g.deviceIds.includes(dev.id))) {
          ips.add(d.ip);
        }
      } else {
        missingTargets.push(target.id);
      }
    }
  }
  return { ips: [...ips], missingTargets };
}

export function validatePresetTargets(preset, locale = DEFAULT_LOCALE) {
  const { ips, missingTargets } = resolvePresetIps(preset);
  const issues = [];
  if (missingTargets.length) {
    issues.push(t(locale, 'preset.missingTargets', { count: missingTargets.length }));
  }
  if (!ips.length) {
    issues.push(t(locale, 'preset.noReachableLights'));
  }
  if (preset.state?.activeFx && !preset.state?.commands?.length) {
    issues.push(t(locale, 'preset.effectWithoutCommands'));
  }
  return { ok: issues.length === 0, ips, missingTargets, issues };
}

export async function applyPreset(preset) {
  const { ips, missingTargets } = resolvePresetIps(preset);
  if (!ips.length) {
    throw missingTargets.length
      ? new AppError('preset.oldLinkedLights')
      : new AppError('preset.noTargetLights');
  }

  const results = [];
  for (const ip of ips) {
    if (preset.state.on !== undefined) {
      await (preset.state.on ? govee.turnOn(ip) : govee.turnOff(ip));
    }
    if (preset.state.brightness !== undefined) {
      await govee.setBrightness(ip, preset.state.brightness);
    }
    if (preset.state.commands?.length) {
      await govee.sendPtReal(ip, preset.state.commands);
    } else {
      if (preset.state.color) {
        const { r, g, b } = preset.state.color;
        await govee.setColor(ip, r, g, b);
      }
      if (preset.state.kelvin !== undefined) {
        await govee.setColorTemperature(ip, preset.state.kelvin);
      }
    }
    results.push(ip);
  }
  return results;
}

function getActiveFxForDevice(deviceId) {
  const settings = store.getSettings();
  const { link, linkedState, deviceStates } = settings;
  const perDevice = deviceStates?.[deviceId];
  if (perDevice) return perDevice;
  if (link?.enabled && link.deviceIds?.includes(deviceId) && linkedState?.activeFx) {
    return linkedState.activeFx;
  }
  return null;
}

async function captureDeviceSnapshot(ip) {
  const device = store.getDevices().find((d) => d.ip === ip);
  let live = null;
  try {
    live = await govee.queryStatus(ip);
  } catch {
    live = null;
  }

  const activeFx = device ? getActiveFxForDevice(device.id) : null;
  const effect = device && activeFx
    ? resolveEffectByKey(device.sku || 'H16C0', activeFx)
    : null;

  return {
    ...live,
    activeFx,
    commands: effect?.commands?.length ? effect.commands : null,
    kelvinLighting: effect?.kelvin ?? null,
  };
}

async function restoreSnapshot(ip, snap) {
  if (!snap) return;
  if (snap.on) await govee.turnOn(ip);
  else await govee.turnOff(ip);
  if (snap.brightness !== undefined) await govee.setBrightness(ip, snap.brightness);

  if (snap.commands?.length) {
    await govee.sendPtReal(ip, snap.commands);
    return;
  }
  if (snap.kelvinLighting) {
    await govee.setColorTemperature(ip, snap.kelvinLighting);
    return;
  }

  if (snap.color) await govee.setColor(ip, snap.color.r, snap.color.g, snap.color.b);
  if (snap.kelvin) await govee.setColorTemperature(ip, snap.kelvin);
}

export async function applyPresetWithRestore(presetId, durationSec) {
  const preset = store.getPresets().find((p) => p.id === presetId);
  if (!preset) throw new AppError('preset.notFound', {}, 404);

  const { ips } = resolvePresetIps(preset);
  const snapshots = {};
  for (const ip of ips) {
    try {
      snapshots[ip] = await captureDeviceSnapshot(ip);
    } catch {
      snapshots[ip] = null;
    }
  }

  const applied = await applyPreset(preset);

  setTimeout(async () => {
    for (const ip of ips) {
      try {
        await restoreSnapshot(ip, snapshots[ip]);
      } catch {
        /* ignore restore errors */
      }
    }
  }, durationSec * 1000);

  return { applied, ips, durationSec };
}
