import { galleryCopy } from '../i18n/galleryCopy';

/**
 * Stable device IDs and code locations. Player text and Russian documentation
 * use the same reviewed locale catalog, so the device map cannot drift from
 * the gallery or repeat obsolete claims about nitrogen, sonar or plate size.
 */
export type DeviceKey = 'frame' | 'cryo' | 'mix' | 'sonar' | 'plate' | 'gel' | 'cross' | 'cards' | 'baro';

export type DeviceInfo = {
  key: DeviceKey;
  name: string;
  tab: string;
  sub: string;
  file: string;
  purpose: string;
};

const deviceFiles: Record<DeviceKey, string> = {
  frame: 'src/ui/forge/kit.tsx',
  cryo: 'src/components/farm/LabHero.tsx',
  mix: 'src/pages/tools/ToolsHome.tsx',
  sonar: 'src/pages/farm/FarmDashboard.tsx, src/pages/market/MarketHome.tsx, src/pages/market/ListingPage.tsx',
  plate: 'src/pages/farm/FarmDashboard.tsx',
  gel: 'src/pages/economy/ResourceOverview.tsx',
  cross: 'src/pages/inbox/InboxHome.tsx',
  cards: 'src/pages/quests/QuestsHome.tsx',
  baro: 'src/components/farm/WeatherRecorder.tsx, src/pages/farm/WellPanel.tsx',
};

const deviceKeys = ['frame', 'cryo', 'mix', 'sonar', 'plate', 'gel', 'cross', 'cards', 'baro'] as const;
export const DEVICE_MAP: DeviceInfo[] = deviceKeys.map(key => ({
  key, ...galleryCopy.ru.devices[key], file: deviceFiles[key],
}));

export const DEVICE_BY_KEY: Record<DeviceKey, DeviceInfo> = Object.fromEntries(
  DEVICE_MAP.map(device => [device.key, device]),
) as Record<DeviceKey, DeviceInfo>;

export const INSTRUMENTS = DEVICE_MAP.filter(device => device.key !== 'frame');
