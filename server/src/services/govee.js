import dgram from 'dgram';
import os from 'os';
import { AppError } from '../errors.js';

const MULTICAST_ADDR = '239.255.255.250';
const SCAN_PORT = 4001;
const LISTEN_PORT = 4002;
const CONTROL_PORT = 4003;
const DEFAULT_TIMEOUT = 5000;

let udpLock = Promise.resolve();

function withUdpLock(fn) {
  const run = udpLock.then(() => fn());
  udpLock = run.catch(() => {});
  return run;
}

function parseOnOff(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return value === '1' || value.toLowerCase() === 'true';
  }
  return false;
}

function parseDeviceStatus(raw) {
  const payload = raw.data ?? raw;
  const color = payload.color || { r: 255, g: 255, b: 255 };

  return {
    on: parseOnOff(payload.onOff ?? payload.on),
    brightness: payload.brightness ?? 50,
    color: {
      r: color.r ?? 255,
      g: color.g ?? 255,
      b: color.b ?? 255,
    },
    kelvin: payload.colorTemInKelvin ?? 0,
  };
}

const SCAN_PAYLOAD = Buffer.from(
  JSON.stringify({
    msg: {
      cmd: 'scan',
      data: { account_topic: 'reserve' },
    },
  })
);

function getBroadcastAddresses() {
  const addresses = new Set();
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.internal || addr.family !== 'IPv4') continue;
      const ip = addr.address.split('.').map(Number);
      const mask = addr.netmask.split('.').map(Number);
      const broadcast = ip.map((o, i) => (o | (~mask[i] & 255)) & 255).join('.');
      addresses.add(broadcast);
    }
  }
  return [...addresses];
}

function getScanTargets(options = {}) {
  const {
    useMulticast = true,
    broadcastAll = true,
    globalBroadcast = true,
    extraAddresses = [],
  } = options;

  const targets = new Set(extraAddresses);
  if (useMulticast) targets.add(MULTICAST_ADDR);
  if (globalBroadcast) targets.add('255.255.255.255');
  if (broadcastAll) {
    for (const addr of getBroadcastAddresses()) targets.add(addr);
  }
  return [...targets];
}

function parseScanResponse(msg, rinfo) {
  const data = JSON.parse(msg.toString());
  const m = data.msg;
  if (!m || m.cmd !== 'scan') return null;

  const d = m.data ?? m;
  const ip = d.ip || rinfo.address;
  const device = d.device;
  if (!device && !ip) return null;

  return {
    device: d.device,
    sku: d.sku || '',
    deviceName: d.deviceName || d.sku || d.device || ip,
    ip,
    bleVersionHard: d.bleVersionHard,
    bleVersionSoft: d.bleVersionSoft,
    wifiVersionHard: d.wifiVersionHard,
    wifiVersionSoft: d.wifiVersionSoft,
  };
}

function scanNetwork(options = {}) {
  return withUdpLock(() => scanNetworkInner(options));
}

function scanNetworkInner(options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const targets = getScanTargets(options);

  return new Promise((resolve, reject) => {
    const devices = new Map();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('message', (msg, rinfo) => {
      try {
        const device = parseScanResponse(msg, rinfo);
        if (device) {
          const key = device.device || device.ip;
          devices.set(key, device);
        }
      } catch {
        // ignore invalid packets
      }
    });

    socket.on('error', (err) => {
      socket.close();
      if (err.code === 'EADDRINUSE') {
        reject(new AppError('govee.udpPortInUse', {}, 500));
      } else {
        reject(err);
      }
    });

    socket.bind(LISTEN_PORT, () => {
      socket.setBroadcast(true);
      try {
        socket.addMembership(MULTICAST_ADDR);
      } catch {
        // multicast optionnel selon l'interface réseau
      }

      const sendScan = () => {
        for (const target of targets) {
          socket.send(SCAN_PAYLOAD, SCAN_PORT, target, () => {});
        }
      };

      sendScan();
      const retry = setInterval(sendScan, 2000);

      setTimeout(() => {
        clearInterval(retry);
        socket.close();
        resolve([...devices.values()]);
      }, timeout);
    });
  });
}

function scanIp(ip) {
  return scanNetwork({
    extraAddresses: [ip],
    useMulticast: false,
    broadcastAll: false,
    globalBroadcast: false,
    timeout: 10000,
  }).then((devices) => {
    const match = devices.find((d) => d.ip === ip);
    if (match) return match;
    throw new AppError('govee.noResponse', { ip });
  });
}

export function queryConfiguredDevices(ips, options = {}) {
  const timeout = options.timeout ?? 3000;
  const uniqueIps = [...new Set(ips)];
  return withUdpLock(
    () =>
      new Promise((resolve) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const found = new Map();
        const responded = new Set();
        const deadline = Date.now() + timeout;
        let closed = false;

        const cleanup = () => {
          if (closed) return;
          closed = true;
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        };

        const finish = () => {
          cleanup();
          resolve([...found.values()]);
        };

        socket.on('message', (msg, rinfo) => {
          try {
            const device = parseScanResponse(msg, rinfo);
            if (device) {
              found.set(device.device || device.ip, device);
            }
            responded.add(rinfo.address);
            if (uniqueIps.every((ip) => responded.has(ip))) {
              finish();
            }
          } catch {
            /* ignore */
          }
        });

        socket.on('error', () => finish());

        socket.bind(LISTEN_PORT, () => {
          for (const ip of uniqueIps) {
            socket.send(SCAN_PAYLOAD, SCAN_PORT, ip, () => {});
          }
          const poll = () => {
            if (closed) return;
            if (Date.now() >= deadline) {
              finish();
              return;
            }
            for (const ip of uniqueIps) {
              if (!responded.has(ip)) {
                socket.send(SCAN_PAYLOAD, SCAN_PORT, ip, () => {});
              }
            }
            setTimeout(poll, 500);
          };
          setTimeout(poll, 500);
        });
      })
  );
}

function sendUdp(message, host, port) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const payload = Buffer.from(JSON.stringify(message));

    client.on('error', reject);
    client.send(payload, port, host, (err) => {
      client.close();
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function queryStatus(ip, timeout = 4000) {
  return withUdpLock(
    () =>
      new Promise((resolve, reject) => {
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const payload = Buffer.from(
          JSON.stringify({ msg: { cmd: 'devStatus', data: {} } })
        );
        const deadline = Date.now() + timeout;
        let closed = false;

        const cleanup = () => {
          if (closed) return;
          closed = true;
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        };

        socket.on('message', (msg, rinfo) => {
          if (rinfo.address !== ip) return;
          try {
            const data = JSON.parse(msg.toString());
            if (data.msg?.cmd === 'devStatus') {
              cleanup();
              resolve(parseDeviceStatus(data.msg));
            }
          } catch {
            /* ignore */
          }
        });

        socket.on('error', (err) => {
          cleanup();
          reject(err);
        });

        socket.bind(LISTEN_PORT, () => {
          const send = () => {
            if (closed || Date.now() > deadline) {
              cleanup();
              reject(new Error(`Timeout status pour ${ip}`));
              return;
            }
            socket.send(payload, CONTROL_PORT, ip, () => {
              setTimeout(send, 350);
            });
          };
          send();
        });
      })
  );
}

export async function queryStatuses(ips) {
  const entries = await Promise.all(
    ips.map(async (ip) => {
      try {
        return [ip, await queryStatus(ip)];
      } catch {
        return [ip, null];
      }
    })
  );
  return Object.fromEntries(entries);
}

async function sendCommand(ip, cmd, data) {
  const message = { msg: { cmd, data } };
  for (let i = 0; i < 3; i++) {
    await sendUdp(message, ip, CONTROL_PORT);
    if (i < 2) await new Promise((r) => setTimeout(r, 150));
  }
}

export async function sendPtReal(ip, commands) {
  await sendCommand(ip, 'ptReal', { command: commands });
}

async function applyControl(ip, body) {
  const { action, brightness, color, kelvin, commands } = body;
  switch (action) {
    case 'on':
      await turnOn(ip);
      break;
    case 'off':
      await turnOff(ip);
      break;
    case 'brightness':
      await setBrightness(ip, brightness);
      break;
    case 'color':
      await setColor(ip, color.r, color.g, color.b);
      break;
    case 'kelvin':
      await setColorTemperature(ip, kelvin);
      break;
    case 'lighting': {
      await turnOn(ip);
      await setColorTemperature(ip, body.kelvin);
      break;
    }
    case 'ptReal':
      await sendPtReal(ip, commands);
      break;
    default:
      throw new AppError('common.invalidAction');
  }
}

export async function controlDevice(ip, body) {
  await applyControl(ip, body);
}

export async function controlDevices(ips, body) {
  await Promise.all(ips.map((ip) => applyControl(ip, body)));
}

export async function turnOn(ip) {
  await sendCommand(ip, 'turn', { value: 1 });
}

export async function turnOff(ip) {
  await sendCommand(ip, 'turn', { value: 0 });
}

export async function setBrightness(ip, value) {
  const clamped = Math.max(0, Math.min(100, value));
  await sendCommand(ip, 'brightness', { value: clamped });
}

export async function setColor(ip, r, g, b) {
  await sendCommand(ip, 'colorwc', {
    color: { r, g, b },
    colorTemInKelvin: 0,
  });
}

export async function setColorTemperature(ip, kelvin) {
  await sendCommand(ip, 'colorwc', {
    color: { r: 0, g: 0, b: 0 },
    colorTemInKelvin: kelvin,
  });
}

export { scanNetwork, scanIp, sendCommand, getScanTargets };
