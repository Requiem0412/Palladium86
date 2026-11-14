import {
  applyCustomArenaLayout,
  ArenaVisualStyle,
  ChallengeId,
  ConcertLightingMode,
  CrewNamesConfig,
  CustomArenaLayoutState,
  DEFAULT_80S_RADIO_PLAYLIST,
  DEFAULT_CREW_NAMES,
  DEFAULT_CUSTOM_ARENA_LAYOUT,
  DEFAULT_DJ_JINGLE_SLOTS,
  DEFAULT_DJ_NAME,
  DEFAULT_DJ_TICKER,
  DEFAULT_SPECIAL_SKATERS,
  DEFAULT_TWITCH_CHANNEL,
  DjJingleSlot,
  EditableModuleId,
  EditableModuleRect,
  GuestDjPreset,
  LEGACY_DEFAULT_GHOSTS,
  PALLADIUM_CHALLENGES,
  ProShopUpgradesState,
  RadioTrackItem,
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
  VISITOR_VOLUME: 'palladium_visitor_volume_v1',
  RADIO_PLAYLIST: 'palladium_radio_playlist_v1',
  STAMP_CARD: 'palladium_stamp_card_v1',
  CRT_FILTER: 'palladium_crt_filter_v1',
  CUSTOM_LAYOUT: 'palladium_custom_layout_v1',
  INTRO_TOUR: 'palladium_intro_tour_v1',
  LOCKER_SETTINGS: 'palladium_locker_settings_v1',
};

export type SingleplayerDifficulty = 'beginner' | 'intermediate' | 'pro';
export type FreeDrinkChoice = 'slush' | 'bloba' | 'combo';

export interface EntryPassData {
  active?: boolean;
  locked: boolean;
  difficulty: SingleplayerDifficulty;
  hasOwnSkates: boolean;
  hasRentedSkates: boolean;
  drinkChipAvailable: boolean;
  freeDrinkChoice?: FreeDrinkChoice;
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
  soloSessionsStarted: number;
  multiplayerSessionsStarted: number;
  totalMultiplayerVisitorsSeen: number;
  peakConcurrentMultiplayerPlayers: number;
  seenVisitorIds: string[];
}

export type IntroStepId =
  | 'open_locker'
  | 'fetch_drink'
  | 'skate_rink'
  | 'try_ballspiel';

export interface IntroTourState {
  open_locker: boolean;
  fetch_drink: boolean;
  skate_rink: boolean;
  try_ballspiel: boolean;
  bonusClaimed: boolean;
}

export interface LockerPlayerSettings {
  showAiNames: boolean;
  showOwnName: boolean;
  showSpeechBubbles: boolean;
  discoSoundEnabled: boolean;
  vipDiscoSkatesEquipped: boolean;
  drinksInLocker: number;
}

export interface AdminPersistentSettings {
  activeDjName: string;
  twitchChannel: string;
  youtubeUrl: string;
  cinemaStreamSource: 'twitch' | 'youtube' | 'visualizer';
  djTickerText: string;
  isMaintenanceMode: boolean;
  maintenanceReopenText: string;
  cinemaScheduleEnabled: boolean;
  cinemaWeekday: string;
  cinemaWeekdays: string[];
  cinemaStartTime: string;
  cinemaEndTime: string;
  cinemaCountdownEnabled: boolean;
  cinemaCountdownTitle: string;
  cinemaCountdownTargetIso: string;
  autoBlacklightEnabled: boolean;
  ghostSkatersEnabled: boolean;
  fogMachineEnabled: boolean;
  npcVoicesEnabled: boolean;
  skateGuardWhistleEnabled: boolean;
  fullHallPutzlichtEnabled: boolean;
  pixel16BitFiguresEnabled: boolean;
  backgroundDancersEnabled?: boolean;
  concertLightingMode: ConcertLightingMode;
  liveArenaStyle: ArenaVisualStyle;
  crewNames: CrewNamesConfig;
  djJingleSlots: DjJingleSlot[];
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
      const rawName = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      return {
        name: rawName === 'Speedy 86' ? '' : rawName,
        isAnonymousGuest: Boolean(parsed.isAnonymousGuest),
      };
    }
  } catch {
    // fallback
  }
  return { name: '', isAnonymousGuest: false };
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
    wristbandsEnabled: false,
    wristbandColor: 'pink',
    unlockedMoves: {
      spin360: false,
      backward: false,
      flamingo: false,
      starjump: false,
    },
    unlockedCharms: {
      bell: false,
      teddy: false,
      pompons: false,
      dice: false,
    },
    activeCharm: null,
    spentPoints: 0,
    bonusPoints: 0,
  };
  try {
    const raw = localStorage.getItem(KEYS.UPGRADES);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        ...parsed,
        unlockedMoves: {
          ...defaults.unlockedMoves,
          ...(parsed.unlockedMoves || {}),
        },
        unlockedCharms: {
          ...defaults.unlockedCharms,
          ...(parsed.unlockedCharms || {}),
        },
      };
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
    totalSessions: 0,
    dailyCounts: {},
    hourlyHistogram: Array.from({ length: 24 }, () => 0),
    totalPlaySeconds: 0,
    bestLapRecord: 0,
    soloSessionsStarted: 0,
    multiplayerSessionsStarted: 0,
    totalMultiplayerVisitorsSeen: 0,
    peakConcurrentMultiplayerPlayers: 1,
    seenVisitorIds: [],
  };
  try {
    const raw = localStorage.getItem(KEYS.HALL_STATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed.hourlyHistogram) &&
        parsed.hourlyHistogram.length === 24
      ) {
        const isLegacyPreseeded =
          parsed.hourlyHistogram[17] === 4 &&
          parsed.hourlyHistogram[18] === 5 &&
          parsed.hourlyHistogram[19] === 7;
        if (!isLegacyPreseeded) {
          return {
            totalSessions: Number(parsed.totalSessions) || 1,
            dailyCounts: parsed.dailyCounts || {},
            hourlyHistogram: parsed.hourlyHistogram,
            totalPlaySeconds: Number(parsed.totalPlaySeconds) || 0,
            bestLapRecord: Number(parsed.bestLapRecord) || 0,
            soloSessionsStarted:
              typeof parsed.soloSessionsStarted === 'number'
                ? parsed.soloSessionsStarted
                : Math.max(1, Number(parsed.totalSessions) || 1),
            multiplayerSessionsStarted:
              Number(parsed.multiplayerSessionsStarted) || 0,
            totalMultiplayerVisitorsSeen:
              Number(parsed.totalMultiplayerVisitorsSeen) || 0,
            peakConcurrentMultiplayerPlayers: Math.max(
              1,
              Number(parsed.peakConcurrentMultiplayerPlayers) || 1
            ),
            seenVisitorIds: Array.isArray(parsed.seenVisitorIds)
              ? parsed.seenVisitorIds.map(String)
              : [],
          };
        }
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
  stats.soloSessionsStarted = (stats.soloSessionsStarted || 0) + 1;
  stats.dailyCounts[today] = (stats.dailyCounts[today] || 0) + 1;
  stats.hourlyHistogram[hour] = (stats.hourlyHistogram[hour] || 0) + 1;
  saveHallStats(stats);
  return stats;
}

export function recordSoloSessionStart(): HallStatsData {
  const stats = loadHallStats();
  stats.soloSessionsStarted = (stats.soloSessionsStarted || 0) + 1;
  saveHallStats(stats);
  return stats;
}

export function recordMultiplayerSessionStart(): HallStatsData {
  const stats = loadHallStats();
  stats.multiplayerSessionsStarted =
    (stats.multiplayerSessionsStarted || 0) + 1;
  stats.peakConcurrentMultiplayerPlayers = Math.max(
    1,
    stats.peakConcurrentMultiplayerPlayers || 1
  );
  saveHallStats(stats);
  return stats;
}

export function recordMultiplayerVisitorSnapshot(
  activeConcurrentPlayers: number,
  remotePeerIds: string[]
): HallStatsData {
  const stats = loadHallStats();
  const seenSet = new Set(stats.seenVisitorIds || []);
  for (const pid of remotePeerIds) {
    if (pid && pid.trim()) {
      seenSet.add(pid.trim());
    }
  }
  stats.seenVisitorIds = Array.from(seenSet);
  stats.totalMultiplayerVisitorsSeen = Math.max(
    stats.totalMultiplayerVisitorsSeen || 0,
    stats.seenVisitorIds.length
  );
  stats.peakConcurrentMultiplayerPlayers = Math.max(
    stats.peakConcurrentMultiplayerPlayers || 1,
    activeConcurrentPlayers
  );
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
    soloSessionsStarted: 1,
    multiplayerSessionsStarted: 0,
    totalMultiplayerVisitorsSeen: 0,
    peakConcurrentMultiplayerPlayers: 1,
    seenVisitorIds: [],
  };
  saveHallStats(fresh);
  return fresh;
}

export function computePeakHourLabel(histogram: number[]): string {
  let maxVal = -1;
  let peakHour = new Date().getHours();
  for (let h = 0; h < 24; h++) {
    if (histogram[h] > maxVal) {
      maxVal = histogram[h];
      peakHour = h;
    }
  }
  if (maxVal <= 0) {
    peakHour = new Date().getHours();
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
      if (Array.isArray(arr)) {
        const cleaned = arr
          .map((s) => String(s).trim())
          .filter(
            (name) =>
              Boolean(name) &&
              !LEGACY_DEFAULT_GHOSTS.some(
                (legacy) => legacy.toLowerCase() === name.toLowerCase()
              )
          );
        return cleaned;
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
    youtubeUrl: '',
    cinemaStreamSource: 'twitch',
    djTickerText: DEFAULT_DJ_TICKER,
    isMaintenanceMode: false,
    maintenanceReopenText: '🚀 ALPHA STARTING SOON',
    cinemaScheduleEnabled: false,
    cinemaWeekday: 'Mittwoch',
    cinemaWeekdays: ['Mi', 'Sa'],
    cinemaStartTime: '20:00',
    cinemaEndTime: '22:00',
    cinemaCountdownEnabled: false,
    cinemaCountdownTitle: 'NÄCHSTER PALLADIUM LIVE-STREAM',
    cinemaCountdownTargetIso: '',
    autoBlacklightEnabled: false,
    ghostSkatersEnabled: true,
    fogMachineEnabled: true,
    npcVoicesEnabled: false,
    skateGuardWhistleEnabled: false,
    fullHallPutzlichtEnabled: false,
    pixel16BitFiguresEnabled: false,
    backgroundDancersEnabled: true,
    concertLightingMode: 'auto',
    liveArenaStyle: 'classic-neon',
    crewNames: { ...DEFAULT_CREW_NAMES },
    djJingleSlots: DEFAULT_DJ_JINGLE_SLOTS.map((s) => ({ ...s })),
  };
  try {
    const raw = localStorage.getItem(KEYS.ADMIN_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        !parsed.maintenanceReopenText ||
        parsed.maintenanceReopenText === 'Wir öffnen wieder um 20:00 Uhr'
      ) {
        parsed.maintenanceReopenText = '🚀 ALPHA STARTING SOON';
      }
      const mergedCrewNames: CrewNamesConfig = {
        ...DEFAULT_CREW_NAMES,
        ...(parsed.crewNames || {}),
      };
      const mergedJingleSlots: DjJingleSlot[] = DEFAULT_DJ_JINGLE_SLOTS.map(
        (defSlot) => {
          const found = Array.isArray(parsed.djJingleSlots)
            ? parsed.djJingleSlots.find(
                (item: DjJingleSlot) => item && item.id === defSlot.id
              )
            : null;
          return found ? { ...defSlot, ...found } : { ...defSlot };
        }
      );
      const mergedWeekdays =
        Array.isArray(parsed.cinemaWeekdays) && parsed.cinemaWeekdays.length > 0
          ? parsed.cinemaWeekdays
          : ['Mi', 'Sa'];
      return {
        ...defaults,
        ...parsed,
        cinemaWeekdays: mergedWeekdays,
        crewNames: mergedCrewNames,
        djJingleSlots: mergedJingleSlots,
      };
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

export function loadVisitorVolume(): number {
  try {
    const raw = localStorage.getItem(KEYS.VISITOR_VOLUME);
    if (raw !== null) {
      const val = Number(raw);
      if (!Number.isNaN(val)) {
        return Math.max(0, Math.min(1, val));
      }
    }
  } catch {
    // fallback
  }
  return 0.7;
}

export function saveVisitorVolume(vol: number): void {
  try {
    localStorage.setItem(
      KEYS.VISITOR_VOLUME,
      String(Math.max(0, Math.min(1, vol)))
    );
  } catch {
    // ignore
  }
}

export function loadRadioPlaylist(): RadioTrackItem[] {
  try {
    const raw = localStorage.getItem(KEYS.RADIO_PLAYLIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return [...DEFAULT_80S_RADIO_PLAYLIST];
}

export function saveRadioPlaylist(list: RadioTrackItem[]): void {
  try {
    localStorage.setItem(KEYS.RADIO_PLAYLIST, JSON.stringify(list));
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

export interface StampCardData {
  stamps: number; // 1..10
  stampedDates: string[]; // YYYY-MM-DD
  welcomeDrinkChoice: 'slush' | 'bloba';
  welcomeDrinkGranted: boolean;
  welcomeDrinkRedeemed: boolean;
  freeProShopVoucherAvailable: boolean;
  completedCardsCount: number;
}

export function loadStampCard(): StampCardData {
  const today = getTodayDateString();
  const fallback: StampCardData = {
    stamps: 1,
    stampedDates: [today],
    welcomeDrinkChoice: 'slush',
    welcomeDrinkGranted: true,
    welcomeDrinkRedeemed: false,
    freeProShopVoucherAvailable: false,
    completedCardsCount: 0,
  };
  try {
    const raw = localStorage.getItem(KEYS.STAMP_CARD);
    if (raw) {
      const parsed = JSON.parse(raw);
      const stamps = Math.max(1, Math.min(10, Number(parsed.stamps) || 1));
      const stampedDates = Array.isArray(parsed.stampedDates)
        ? parsed.stampedDates.map((d: unknown) => String(d))
        : [today];
      return {
        stamps,
        stampedDates,
        welcomeDrinkChoice:
          parsed.welcomeDrinkChoice === 'bloba' ? 'bloba' : 'slush',
        welcomeDrinkGranted:
          typeof parsed.welcomeDrinkGranted === 'boolean'
            ? parsed.welcomeDrinkGranted
            : true,
        welcomeDrinkRedeemed: Boolean(parsed.welcomeDrinkRedeemed),
        freeProShopVoucherAvailable:
          Boolean(parsed.freeProShopVoucherAvailable) || stamps >= 10,
        completedCardsCount: Number(parsed.completedCardsCount) || 0,
      };
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function saveStampCard(card: StampCardData): void {
  try {
    localStorage.setItem(KEYS.STAMP_CARD, JSON.stringify(card));
  } catch {
    // ignore
  }
}

export function recordDailyStampVisit(): StampCardData {
  const today = getTodayDateString();
  const card = loadStampCard();
  if (!card.stampedDates.includes(today)) {
    card.stampedDates.push(today);
    if (card.stamps < 10) {
      card.stamps += 1;
    }
    if (card.stamps >= 10) {
      card.stamps = 10;
      card.freeProShopVoucherAvailable = true;
    }
  }
  saveStampCard(card);
  return card;
}

export function resetStampCard(): StampCardData {
  const today = getTodayDateString();
  const fresh: StampCardData = {
    stamps: 1,
    stampedDates: [today],
    welcomeDrinkChoice: 'slush',
    welcomeDrinkGranted: true,
    welcomeDrinkRedeemed: false,
    freeProShopVoucherAvailable: false,
    completedCardsCount: 0,
  };
  saveStampCard(fresh);
  return fresh;
}

export function loadCrtFilterEnabled(): boolean {
  try {
    return localStorage.getItem(KEYS.CRT_FILTER) === 'true';
  } catch {
    return false;
  }
}

export function saveCrtFilterEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEYS.CRT_FILTER, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function cloneDefaultCustomArenaLayout(): CustomArenaLayoutState {
  const modules = {} as CustomArenaLayoutState['modules'];
  (Object.keys(DEFAULT_CUSTOM_ARENA_LAYOUT.modules) as EditableModuleId[]).forEach((key) => {
    modules[key] = { ...DEFAULT_CUSTOM_ARENA_LAYOUT.modules[key] };
  });
  return {
    modules,
    npcAnchors: { ...DEFAULT_CUSTOM_ARENA_LAYOUT.npcAnchors },
  };
}

export function loadCustomArenaLayout(): CustomArenaLayoutState {
  const fallback = cloneDefaultCustomArenaLayout();
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_LAYOUT);
    if (!raw) {
      applyCustomArenaLayout(fallback);
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<CustomArenaLayoutState> & {
      skaters?: Record<string, { name?: string; homeX?: number; homeY?: number }>;
    };
    if (parsed.modules && typeof parsed.modules === 'object') {
      (Object.keys(fallback.modules) as EditableModuleId[]).forEach((modId) => {
        const savedMod = parsed.modules?.[modId] as
          | (EditableModuleRect & { w?: number; h?: number })
          | undefined;
        if (
          savedMod &&
          typeof savedMod.x === 'number' &&
          typeof savedMod.y === 'number' &&
          Number.isFinite(savedMod.x) &&
          Number.isFinite(savedMod.y)
        ) {
          const rawW =
            typeof savedMod.width === 'number' && Number.isFinite(savedMod.width)
              ? savedMod.width
              : typeof savedMod.w === 'number' && Number.isFinite(savedMod.w)
              ? savedMod.w
              : fallback.modules[modId].width;
          const rawH =
            typeof savedMod.height === 'number' && Number.isFinite(savedMod.height)
              ? savedMod.height
              : typeof savedMod.h === 'number' && Number.isFinite(savedMod.h)
              ? savedMod.h
              : fallback.modules[modId].height;
          const rawRot =
            typeof savedMod.rot === 'number' && Number.isFinite(savedMod.rot)
              ? ((Math.round(savedMod.rot) % 360) + 360) % 360
              : fallback.modules[modId].rot || 0;
          // Migrate legacy V0.4 default baffle y=760 down to the lower barrier y=855
          const migratedY =
            (modId === 'baffleLeft' || modId === 'baffleRight') &&
            Math.round(savedMod.y) === 760
              ? 855
              : Math.round(savedMod.y);
          fallback.modules[modId] = {
            ...fallback.modules[modId],
            x: Math.round(savedMod.x),
            y: migratedY,
            width: Math.max(10, Math.round(rawW)),
            height: Math.max(8, Math.round(rawH)),
            rot: rawRot,
          };
        }
      });
    }
    const rawAnchors = parsed.npcAnchors || parsed.skaters;
    if (rawAnchors && typeof rawAnchors === 'object') {
      Object.entries(rawAnchors).forEach(([npcId, anchor]) => {
        if (
          anchor &&
          typeof anchor.homeX === 'number' &&
          typeof anchor.homeY === 'number' &&
          Number.isFinite(anchor.homeX) &&
          Number.isFinite(anchor.homeY)
        ) {
          const prev = fallback.npcAnchors[npcId];
          fallback.npcAnchors[npcId] = {
            ...prev,
            homeX: Math.round(anchor.homeX),
            homeY: Math.round(anchor.homeY),
            orbitAngle:
              typeof (anchor as { orbitAngle?: number }).orbitAngle === 'number' &&
              Number.isFinite((anchor as { orbitAngle?: number }).orbitAngle)
                ? (anchor as { orbitAngle?: number }).orbitAngle
                : prev?.orbitAngle,
            laneRadiusX:
              typeof (anchor as { laneRadiusX?: number }).laneRadiusX === 'number' &&
              Number.isFinite((anchor as { laneRadiusX?: number }).laneRadiusX)
                ? (anchor as { laneRadiusX?: number }).laneRadiusX
                : prev?.laneRadiusX,
            laneRadiusY:
              typeof (anchor as { laneRadiusY?: number }).laneRadiusY === 'number' &&
              Number.isFinite((anchor as { laneRadiusY?: number }).laneRadiusY)
                ? (anchor as { laneRadiusY?: number }).laneRadiusY
                : prev?.laneRadiusY,
          };
        }
      });
    }
  } catch {
    // ignore
  }
  applyCustomArenaLayout(fallback);
  return fallback;
}

export function saveCustomArenaLayout(layout: CustomArenaLayoutState): void {
  applyCustomArenaLayout(layout);
  try {
    localStorage.setItem(KEYS.CUSTOM_LAYOUT, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export function resetCustomArenaLayout(): CustomArenaLayoutState {
  const fresh = cloneDefaultCustomArenaLayout();
  applyCustomArenaLayout(fresh);
  try {
    localStorage.removeItem(KEYS.CUSTOM_LAYOUT);
  } catch {
    // ignore
  }
  return fresh;
}

export function loadIntroTourState(): IntroTourState {
  const defaults: IntroTourState = {
    open_locker: false,
    fetch_drink: false,
    skate_rink: false,
    try_ballspiel: false,
    bonusClaimed: false,
  };
  try {
    const raw = localStorage.getItem(KEYS.INTRO_TOUR);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        open_locker: Boolean(parsed.open_locker),
        fetch_drink: Boolean(parsed.fetch_drink),
        skate_rink: Boolean(parsed.skate_rink),
        try_ballspiel: Boolean(parsed.try_ballspiel),
        bonusClaimed: Boolean(parsed.bonusClaimed),
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function saveIntroTourState(state: IntroTourState): void {
  try {
    localStorage.setItem(KEYS.INTRO_TOUR, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function isIntroTourComplete(state: IntroTourState): boolean {
  return Boolean(
    state.open_locker &&
      state.fetch_drink &&
      state.skate_rink &&
      state.try_ballspiel
  );
}

export function loadLockerPlayerSettings(): LockerPlayerSettings {
  const defaults: LockerPlayerSettings = {
    showAiNames: false, // Standardmäßig AUS, damit die Bahn beim Start aufgeräumt ohne KI-Namensschilder ist
    showOwnName: true, // Standardmäßig AN
    showSpeechBubbles: true, // Standardmäßig AN
    discoSoundEnabled: true, // Standardmäßig AN
    vipDiscoSkatesEquipped: false,
    drinksInLocker: 1,
  };
  try {
    const raw = localStorage.getItem(KEYS.LOCKER_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        showAiNames:
          typeof parsed.showAiNames === 'boolean'
            ? parsed.showAiNames
            : defaults.showAiNames,
        showOwnName:
          typeof parsed.showOwnName === 'boolean'
            ? parsed.showOwnName
            : defaults.showOwnName,
        showSpeechBubbles:
          typeof parsed.showSpeechBubbles === 'boolean'
            ? parsed.showSpeechBubbles
            : defaults.showSpeechBubbles,
        discoSoundEnabled:
          typeof parsed.discoSoundEnabled === 'boolean'
            ? parsed.discoSoundEnabled
            : defaults.discoSoundEnabled,
        vipDiscoSkatesEquipped: Boolean(parsed.vipDiscoSkatesEquipped),
        drinksInLocker:
          typeof parsed.drinksInLocker === 'number' &&
          Number.isFinite(parsed.drinksInLocker)
            ? Math.max(0, Math.round(parsed.drinksInLocker))
            : defaults.drinksInLocker,
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function saveLockerPlayerSettings(settings: LockerPlayerSettings): void {
  try {
    localStorage.setItem(KEYS.LOCKER_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}



