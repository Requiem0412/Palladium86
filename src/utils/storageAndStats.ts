import {
  ArenaVisualStyle,
  ChallengeId,
  ConcertLightingMode,
  DEFAULT_DJ_NAME,
  DEFAULT_DJ_TICKER,
  DEFAULT_SPECIAL_SKATERS,
  DEFAULT_TWITCH_CHANNEL,
  GuestDjPreset,
  PALLADIUM_CHALLENGES,
  ProShopUpgradesState,
} from '../config/arenaConfig';

const KEYS = {
  HAS_ENTERED: 'palladium_has_entered_v1',
  HIDE_CHRONIK: 'palladium_hide_chronik',
  PLAYER_PROFILE: 'palladium_player_profile_v1',
  CHALLENGES: 'palladium_challenges_v1',
  UPGRADES: 'palladium_upgrades_v1',
  HALL_STATS: 'palladium_hall_stats_v1',
  SPECIAL_SKATERS: 'palladium_special_skaters_v1',
  ADMIN_SETTINGS: 'palladium_admin_settings_v1',
  ADMIN_SESSION: 'palladium_admin_session_v1',
  ENTRY_PASS: 'palladium_entry_pass',
  GUEST_DJS: 'palladium_guest_djs_v1',
};

export type SingleplayerDifficulty = 'beginner' | 'intermediate' | 'pro';

export interface EntryPassData {
  active?: boolean;
  locked: boolean;
  difficulty: SingleplayerDifficulty;
  hasOwnSkates: boolean;
  hasRentedSkates: boolean;
  drinkChipAvailable: boolean;
  stampedAt?: string;
}

export interface PlayerProfileStorage {
  name: string;
  isAnonymousGuest: boolean;
}

export type ChallengeProgressMap = Record<
  ChallengeId,
  { progress: number; completed: boolean }
>;

export interface HallStatsData {
  totalSessions: number;
  dailyCounts: Record<string, number>;
  hourlyHistogram: number[]; // 24 slots (0..23)
  totalPlaySeconds: number;
  bestLapRecord: number;
}

export interface AdminPersistentSettings {
  activeDjName: string;
  twitchChannel: string;
  djTickerText: string;
  isMaintenanceMode: boolean;
  cinemaScheduleEnabled: boolean;
  cinemaWeekday: string;
  cinemaStartTime: string;
  cinemaEndTime: string;
  autoBlacklightEnabled: boolean;
  ghostSkatersEnabled: boolean;
  fogMachineEnabled: boolean;
  npcVoicesEnabled: boolean;
  skateGuardWhistleEnabled: boolean;
  concertLightingMode: ConcertLightingMode;
  liveArenaStyle: ArenaVisualStyle;
}

function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function loadHasEnteredBefore(): boolean {
  try {
    return (
      localStorage.getItem(KEYS.HAS_ENTERED) === 'true' ||
      localStorage.getItem(KEYS.HIDE_CHRONIK) === 'true'
    );
  } catch {
    return false;
  }
}

export function saveHasEnteredBefore(val: boolean): void {
  try {
    if (val) {
      localStorage.setItem(KEYS.HAS_ENTERED, 'true');
    } else {
      localStorage.removeItem(KEYS.HAS_ENTERED);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function loadHideChronik(): boolean {
  try {
    return localStorage.getItem(KEYS.HIDE_CHRONIK) === 'true';
  } catch {
    return false;
  }
}

export function saveHideChronik(val: boolean): void {
  try {
    if (val) {
      localStorage.setItem(KEYS.HIDE_CHRONIK, 'true');
    } else {
      localStorage.removeItem(KEYS.HIDE_CHRONIK);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPlayerProfile(): PlayerProfileStorage {
  try {
    const raw = localStorage.getItem(KEYS.PLAYER_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: typeof parsed.name === 'string' ? parsed.name : 'Speedy 86',
        isAnonymousGuest: Boolean(parsed.isAnonymousGuest),
      };
    }
  } catch {
    // fallback
  }
  return { name: 'Speedy 86', isAnonymousGuest: false };
}

export function savePlayerProfile(profile: PlayerProfileStorage): void {
  try {
    localStorage.setItem(KEYS.PLAYER_PROFILE, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function loadChallengesProgress(): ChallengeProgressMap {
  const initial = {} as ChallengeProgressMap;
  for (const ch of PALLADIUM_CHALLENGES) {
    initial[ch.id] = { progress: 0, completed: false };
  }
  try {
    const raw = localStorage.getItem(KEYS.CHALLENGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const ch of PALLADIUM_CHALLENGES) {
        if (parsed[ch.id]) {
          initial[ch.id] = {
            progress: Number(parsed[ch.id].progress) || 0,
            completed: Boolean(parsed[ch.id].completed),
          };
        }
      }
    }
  } catch {
    // fallback
  }
  return initial;
}

export function saveChallengesProgress(map: ChallengeProgressMap): void {
  try {
    localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadProShopUpgrades(): ProShopUpgradesState {
  const defaults: ProShopUpgradesState = {
    bearingsAbec9: false,
    highGripWheels: false,
    aluPlatesHighTop: false,
    underglowEnabled: false,
    underglowColor: 'cyan',
  };
  try {
    const raw = localStorage.getItem(KEYS.UPGRADES);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return defaults;
}

export function saveProShopUpgrades(state: ProShopUpgradesState): void {
  try {
    localStorage.setItem(KEYS.UPGRADES, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadHallStats(): HallStatsData {
  const defaultStats: HallStatsData = {
    totalSessions: 14,
    dailyCounts: { [getTodayDateString()]: 3 },
    // Pre-seeded realistic 80s evening curve so the bar chart looks rich immediately
    hourlyHistogram: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 7, 9, 6, 3, 1,
    ],
    totalPlaySeconds: 1680,
    bestLapRecord: 12,
  };
  try {
    const raw = localStorage.getItem(KEYS.HALL_STATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed.hourlyHistogram) &&
        parsed.hourlyHistogram.length === 24
      ) {
        return {
          totalSessions: Number(parsed.totalSessions) || 1,
          dailyCounts: parsed.dailyCounts || {},
          hourlyHistogram: parsed.hourlyHistogram,
          totalPlaySeconds: Number(parsed.totalPlaySeconds) || 0,
          bestLapRecord: Number(parsed.bestLapRecord) || 0,
        };
      }
    }
  } catch {
    // fallback
  }
  return defaultStats;
}

export function recordSessionVisit(): HallStatsData {
  const stats = loadHallStats();
  const today = getTodayDateString();
  const hour = new Date().getHours();
  stats.totalSessions += 1;
  stats.dailyCounts[today] = (stats.dailyCounts[today] || 0) + 1;
  stats.hourlyHistogram[hour] = (stats.hourlyHistogram[hour] || 0) + 1;
  saveHallStats(stats);
  return stats;
}

export function saveHallStats(stats: HallStatsData): void {
  try {
    localStorage.setItem(KEYS.HALL_STATS, JSON.stringify(stats));
  } catch {
    // ignore
  }
}

export function resetHallStats(): HallStatsData {
  const today = getTodayDateString();
  const hour = new Date().getHours();
  const fresh: HallStatsData = {
    totalSessions: 1,
    dailyCounts: { [today]: 1 },
    hourlyHistogram: Array.from({ length: 24 }, (_, idx) =>
      idx === hour ? 1 : 0
    ),
    totalPlaySeconds: 0,
    bestLapRecord: 0,
  };
  saveHallStats(fresh);
  return fresh;
}

export function computePeakHourLabel(histogram: number[]): string {
  let maxVal = -1;
  let peakHour = 20;
  for (let h = 0; h < 24; h++) {
    if (histogram[h] > maxVal) {
      maxVal = histogram[h];
      peakHour = h;
    }
  }
  const nextHour = (peakHour + 1) % 24;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(peakHour)}:00 – ${pad(nextHour)}:00 Uhr`;
}

export function loadSpecialSkaters(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.SPECIAL_SKATERS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((s) => String(s).trim()).filter(Boolean);
      }
    }
  } catch {
    // fallback
  }
  return [...DEFAULT_SPECIAL_SKATERS];
}

export function saveSpecialSkaters(list: string[]): void {
  try {
    localStorage.setItem(KEYS.SPECIAL_SKATERS, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function loadAdminSettings(): AdminPersistentSettings {
  const defaults: AdminPersistentSettings = {
    activeDjName: DEFAULT_DJ_NAME,
    twitchChannel: DEFAULT_TWITCH_CHANNEL,
    djTickerText: DEFAULT_DJ_TICKER,
    isMaintenanceMode: false,
    cinemaScheduleEnabled: false,
    cinemaWeekday: 'Mittwoch',
    cinemaStartTime: '20:00',
    cinemaEndTime: '22:00',
    autoBlacklightEnabled: false,
    ghostSkatersEnabled: true,
    fogMachineEnabled: true,
    npcVoicesEnabled: true,
    skateGuardWhistleEnabled: false,
    concertLightingMode: 'auto',
    liveArenaStyle: 'classic-neon',
  };
  try {
    const raw = localStorage.getItem(KEYS.ADMIN_SETTINGS);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return defaults;
}

export function saveAdminSettings(settings: AdminPersistentSettings): void {
  try {
    localStorage.setItem(KEYS.ADMIN_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export const RESIDENT_DJ_PRESET: GuestDjPreset = {
  id: 'resident_dj_magic_force',
  name: DEFAULT_DJ_NAME,
  twitchChannel: DEFAULT_TWITCH_CHANNEL,
  tickerText: DEFAULT_DJ_TICKER,
  isResident: true,
};

export function loadGuestDjPresets(): GuestDjPreset[] {
  try {
    const raw = localStorage.getItem(KEYS.GUEST_DJS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const custom = parsed
          .filter(
            (item) =>
              item &&
              typeof item.name === 'string' &&
              typeof item.twitchChannel === 'string' &&
              item.id !== RESIDENT_DJ_PRESET.id
          )
          .map((item) => ({
            id: String(item.id || `dj_${Date.now()}`),
            name: String(item.name).trim(),
            twitchChannel: String(item.twitchChannel).trim(),
            tickerText:
              typeof item.tickerText === 'string' && item.tickerText.trim()
                ? item.tickerText.trim()
                : `+++ ON AIR: ${String(item.name)
                    .trim()
                    .toUpperCase()} +++ KLECKNIX TWIN-DECKS +++ LIVE IM PALLADIUM HANAU +++`,
            isResident: false,
          }));
        return [RESIDENT_DJ_PRESET, ...custom];
      }
    }
  } catch {
    // fallback
  }
  return [RESIDENT_DJ_PRESET];
}

export function saveGuestDjPresets(presets: GuestDjPreset[]): void {
  try {
    const customOnly = presets.filter((p) => !p.isResident);
    localStorage.setItem(KEYS.GUEST_DJS, JSON.stringify(customOnly));
  } catch {
    // ignore
  }
}

export function loadEntryPass(): EntryPassData | null {
  try {
    const raw = localStorage.getItem(KEYS.ENTRY_PASS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.locked === true || parsed.active === true)) {
        const diff: SingleplayerDifficulty =
          parsed.difficulty === 'beginner' ||
          parsed.difficulty === 'intermediate' ||
          parsed.difficulty === 'pro'
            ? parsed.difficulty
            : 'intermediate';
        return {
          active: true,
          locked: true,
          difficulty: diff,
          hasOwnSkates: Boolean(parsed.hasOwnSkates),
          hasRentedSkates: Boolean(parsed.hasRentedSkates),
          drinkChipAvailable:
            typeof parsed.drinkChipAvailable === 'boolean'
              ? parsed.drinkChipAvailable
              : true,
          stampedAt:
            typeof parsed.stampedAt === 'string'
              ? parsed.stampedAt
              : new Date().toISOString(),
        };
      }
    }
  } catch {
    // fallback
  }
  return null;
}

export function saveEntryPass(pass: EntryPassData): void {
  try {
    localStorage.setItem(KEYS.ENTRY_PASS, JSON.stringify(pass));
  } catch {
    // ignore
  }
}

export function resetEntryPass(): void {
  try {
    localStorage.removeItem(KEYS.ENTRY_PASS);
  } catch {
    // ignore
  }
}

export function loadAdminUnlockedSession(): boolean {
  try {
    return sessionStorage.getItem(KEYS.ADMIN_SESSION) === 'true';
  } catch {
    return false;
  }
}

export function saveAdminUnlockedSession(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(KEYS.ADMIN_SESSION, 'true');
    } else {
      sessionStorage.removeItem(KEYS.ADMIN_SESSION);
    }
  } catch {
    // ignore
  }
}
