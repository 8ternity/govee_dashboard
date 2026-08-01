export const LOCALES = ['fr_CA', 'en_US'];

export const DEFAULT_LOCALE = 'en_US';

const messages = {
  fr_CA: {
    'server.internal': 'Erreur interne du serveur.',
    'common.notFound': 'Introuvable',
    'common.invalidAction': 'Action invalide',
    'api.genericError': 'Erreur API',
    'device.ipRequired': 'ip requis',
    'device.deviceAndIpRequired': 'device et ip requis',
    'device.alreadyRegistered': 'Appareil déjà enregistré',
    'device.idsRequired': 'ids requis',
    'device.noLightsFound': 'Aucune lumière trouvée',
    'group.nameAndDeviceIdsRequired': 'name et deviceIds requis',
    'group.noLightsInGroup': 'Aucune lumière dans le groupe',
    'preset.nameTargetsStateRequired': 'name, targets et state requis',
    'preset.notFound': 'Preset introuvable',
    'preset.missingTargets': '{count} cible(s) introuvable(s) — rescanne tes lumières et recrée le preset.',
    'preset.noReachableLights': 'Aucune lumière joignable pour ce preset.',
    'preset.effectWithoutCommands': 'Effet enregistré sans commandes ptReal.',
    'preset.oldLinkedLights': 'Preset lié à d\'anciennes lumières — recrée-le après scan.',
    'preset.noTargetLights': 'Aucune lumière cible pour ce preset.',
    'backup.invalidBackup': 'Sauvegarde invalide',
    'backup.missingField': 'Champ manquant: {key}',
    'twitch.broadcasterIdMissing': 'Broadcaster ID manquant.',
    'twitch.credentialsRequired': 'Client ID, Access Token et nom de chaîne requis.',
    'twitch.invalidAccessToken': 'Access Token invalide ou expiré.',
    'twitch.cannotFetchChannel': 'Impossible de récupérer la chaîne Twitch.',
    'twitch.channelNotFound': 'Chaîne « {channel} » introuvable.',
    'twitch.helixError': 'Erreur Twitch: {message}',
    'twitch.presetDeleted': 'Preset supprimé',
    'govee.udpPortInUse': 'Port UDP 4002 déjà utilisé. Ferme Govee LAN Control ou homebridge-govee.',
    'govee.noResponse': 'Aucune réponse de {ip}. Vérifie que l\'API LAN est activée dans l\'app Govee.',
  },
  en_US: {
    'server.internal': 'Internal server error.',
    'common.notFound': 'Not found',
    'common.invalidAction': 'Invalid action',
    'api.genericError': 'API error',
    'device.ipRequired': 'IP is required',
    'device.deviceAndIpRequired': 'device and IP are required',
    'device.alreadyRegistered': 'Device already registered',
    'device.idsRequired': 'IDs are required',
    'device.noLightsFound': 'No lights found',
    'group.nameAndDeviceIdsRequired': 'name and deviceIds are required',
    'group.noLightsInGroup': 'No lights in the group',
    'preset.nameTargetsStateRequired': 'name, targets and state are required',
    'preset.notFound': 'Preset not found',
    'preset.missingTargets': '{count} missing target(s) — rescan your lights and recreate the preset.',
    'preset.noReachableLights': 'No reachable lights for this preset.',
    'preset.effectWithoutCommands': 'Effect saved without ptReal commands.',
    'preset.oldLinkedLights': 'Preset linked to old lights — recreate it after a scan.',
    'preset.noTargetLights': 'No target lights for this preset.',
    'backup.invalidBackup': 'Invalid backup',
    'backup.missingField': 'Missing field: {key}',
    'twitch.broadcasterIdMissing': 'Broadcaster ID is missing.',
    'twitch.credentialsRequired': 'Client ID, Access Token and channel name are required.',
    'twitch.invalidAccessToken': 'Invalid or expired Access Token.',
    'twitch.cannotFetchChannel': 'Unable to fetch the Twitch channel.',
    'twitch.channelNotFound': 'Channel "{channel}" not found.',
    'twitch.helixError': 'Twitch error: {message}',
    'twitch.presetDeleted': 'Preset deleted',
    'govee.udpPortInUse': 'UDP port 4002 already in use. Close Govee LAN Control or homebridge-govee.',
    'govee.noResponse': 'No response from {ip}. Make sure the LAN API is enabled in the Govee app.',
  },
};

export function getLocale(req) {
  const value =
    (typeof req?.get === 'function' && req.get('x-lang')) ||
    req?.headers?.['x-lang'] ||
    '';
  return LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

export function t(locale, key, params = {}) {
  let str = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    str = str.split(`{${k}}`).join(String(v));
  }
  return str;
}
