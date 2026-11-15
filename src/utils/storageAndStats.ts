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
  StationDialogId,
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
  ALPHA_BETA_CONFIG: 'palladium_alpha_beta_config_v1',
  ALPHA_BETA_SESSION: 'palladium_alpha_beta_session_v1',
  ALPHA_BROWSER_ID: 'palladium_alpha_browser_id_v1',
  TESTER_FEEDBACK: 'palladium_tester_feedback_v1',
  CERTIFICATES: 'palladium_certificates_v1',
  FIRST_VISIT_SLUSH: 'palladium_first_visit_slush_v1',
};

export const PALLADIUM_SPIND_COLLECTIBLES = [
  {
    id: 'palladium_tshirt',
    label: 'Original Palladium-Hanau T-Shirt',
    icon: '👕',
  },
  {
    id: 'neon_cap_80s',
    label: '80er-Neon-Mütze',
    icon: '🧢',
  },
  {
    id: 'skate_bell',
    label: 'Rollschuh-Glöckchen',
    icon: '🔔',
  },
] as const;

export function loadFirstVisitSlushClaimed(): boolean {
  try {
    return localStorage.getItem(KEYS.FIRST_VISIT_SLUSH) === 'true';
  } catch {
    return false;
  }
}

export function saveFirstVisitSlushClaimed(claimed: boolean = true): void {
  try {
    if (claimed) {
      localStorage.setItem(KEYS.FIRST_VISIT_SLUSH, 'true');
    } else {
      localStorage.removeItem(KEYS.FIRST_VISIT_SLUSH);
    }
  } catch {
    // ignore
  }
}

export const MASTER_ADMIN_KEY = 'BOSS-PALLADIUM';

export interface AlphaBetaKeyEntry {
  key: string;
  status: 'free' | 'redeemed';
  redeemedBy?: string;
  redeemedAt?: string;
  redeemedByBrowserId?: string;
  blocked?: boolean;
}

export type TesterFeedbackCategory = 'Bug' | 'Idee' | 'Lob';

export interface TesterFeedbackItem {
  id: string;
  category: TesterFeedbackCategory;
  text: string;
  author: string;
  keyUsed?: string;
  createdAt: string;
}

export interface AlphaBetaAccessConfig {
  enabled: boolean;
  keys: AlphaBetaKeyEntry[];
}

export interface LocalAlphaBetaSession {
  activatedKey: string;
  testerName: string;
  browserId: string;
  isMasterKey: boolean;
  activatedAt: string;
}

export type SingleplayerDifficulty = 'beginner' | 'intermediate' | 'pro';
export type FreeDrinkChoice = 'slush' | 'bloba' | 'combo';

export type AvatarCliqueRole = 'standard' | 'kid' | 'stammgast';
export type SundayCliqueTicket = 'duo' | 'trio';
export type MobilityChoice = 'own-skates' | 'rental-skates' | 'wheelchair';

export interface EntryPassData {
  active?: boolean;
  locked: boolean;
  difficulty: SingleplayerDifficulty;
  hasOwnSkates: boolean;
  hasRentedSkates: boolean;
  mobilityChoice?: MobilityChoice | null;
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
  collectibles?: string[];
  avatarRole?: AvatarCliqueRole;
  sundayCliqueTicket?: SundayCliqueTicket;
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
  skateDirection?: 'ccw' | 'cw';
  neonLightboxesEnabled?: boolean;
  neonLightboxLine1?: string;
  neonLightboxLine2?: string;
  neonLightboxLine3?: string;
  familyDayActive?: boolean;
  sundayCliqueMode?: boolean;
  sundayCliqueAutoSunday?: boolean;
  liveEventActive?: boolean;
  vipGuestListOnly?: boolean;
  handheldActionIds?: string[];
  concertLightingMode: ConcertLightingMode;
  liveArenaStyle: ArenaVisualStyle;
  crewNames: CrewNamesConfig;
  crewPortraits?: Partial<Record<StationDialogId, string>>;
  crewQuotes?: Partial<Record<StationDialogId, string>>;
  djJingleSlots: DjJingleSlot[];
  songRequests?: {
    id: string;
    trackTitle: string;
    requestedBy: string;
    createdAt: string;
    played?: boolean;
  }[];
  newspaperEnabled?: boolean;
  newspaperIssueId?: number;
  newspaperHeadline?: string;
  newspaperBody?: string;
  newspaperUpdatedAt?: string;
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
    skateDirection: 'ccw',
    neonLightboxesEnabled: true,
    neonLightboxLine1: 'RESIDENT DJ',
    neonLightboxLine2: 'DJ MAGIC FORCE',
    neonLightboxLine3: 'AB 21:00 UHR',
    familyDayActive: false,
    sundayCliqueMode: new Date().getDay() === 0,
    sundayCliqueAutoSunday: true,
    liveEventActive: false,
    vipGuestListOnly: false,
    handheldActionIds: [
      'light_disco',
      'light_blacklight',
      'fog_burst',
      'direction',
      'mode_ball',
      'putzlicht',
    ],
    concertLightingMode: 'auto',
    liveArenaStyle: 'classic-neon',
    crewNames: { ...DEFAULT_CREW_NAMES },
    crewPortraits: {},
    crewQuotes: {},
    djJingleSlots: DEFAULT_DJ_JINGLE_SLOTS.map((s) => ({ ...s })),
    newspaperEnabled: true,
    newspaperIssueId: 1,
    newspaperHeadline:
      'SONDERAUSGABE: NEON-LIGHTSHOW, 5 PIXEL-STATIONEN & SONNTAGS-CLIQUE LIVE!',
    newspaperBody:
      'Willkommen im Palladium Hanau ’86! Ab sofort erwarten euch unsere 5 interaktiven 16-Bit-Stationen (Kasse, Verleih, Pro-Shop, Snack-Bar & DJ-Kanzel), das echte 3x3-Sampler-Launchpad für DJ Magic Force sowie der neue Sonntags-Clique-Modus (2+1-Regel) mit +25% Gruppen-Bonus.\n\nTipp der Redaktion: Klicke oben im HUD auf deinen mittleren Avatar-Kreis für deine persönliche „Entdecker auf acht Rollen“-Urkunde – und lies regelmäßig den Palladium-Kurier, um dir nach 5 Ausgaben die Gold-Urkunde „Vielleser auf Rollen“ zu sichern!',
    newspaperUpdatedAt: '15.11.2026',
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
      if (parsed.neonLightboxLine3 === 'AB 20:00 UHR') {
        parsed.neonLightboxLine3 = 'AB 21:00 UHR';
      }
      const rawCrew = parsed.crewNames || {};
      if (rawCrew.nurse === 'SANI-SANDRA') {
        rawCrew.nurse = 'Schwester Gudrun';
      }
      const mergedCrewNames: CrewNamesConfig = {
        ...DEFAULT_CREW_NAMES,
        ...rawCrew,
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
        crewPortraits:
          parsed.crewPortraits && typeof parsed.crewPortraits === 'object'
            ? parsed.crewPortraits
            : {},
        crewQuotes:
          parsed.crewQuotes && typeof parsed.crewQuotes === 'object'
            ? parsed.crewQuotes
            : {},
        djJingleSlots: mergedJingleSlots,
      };
    }
  } catch {
    // fallback
  }
  return defaults;
}

const cachedProceduralPortraits: Partial<Record<StationDialogId, string>> = {};

/**
 * Generates an authentic 16-Bit Arcade Pixel Portrait (48x48 upscaled to 192x192)
 * for each of the 5 Palladium '86 stations when no custom photo is uploaded.
 */
export function getStation16BitPortraitDataUrl(
  stationId: StationDialogId,
  customPortraitUrl?: string
): string {
  if (customPortraitUrl && customPortraitUrl.trim().length > 0) {
    return customPortraitUrl;
  }
  if (cachedProceduralPortraits[stationId]) {
    return cachedProceduralPortraits[stationId]!;
  }
  if (typeof document === 'undefined') return '';

  const grid = 24;
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = grid;
  smallCanvas.height = grid;
  const sCtx = smallCanvas.getContext('2d');
  if (!sCtx) return '';
  sCtx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    sCtx.fillStyle = color;
    sCtx.fillRect(x, y, w, h);
  };

  const palettes: Record<
    StationDialogId,
    {
      bgTop: string;
      bgBot: string;
      hair: string;
      skin: string;
      skinShadow: string;
      shirt: string;
      accent: string;
      visorOrBand: string;
      accessory: 'visor' | 'headband' | 'sunglasses' | 'cap' | 'headphones';
    }
  > = {
    kasse: {
      bgTop: '#1e1b4b',
      bgBot: '#4c1d95',
      hair: '#f59e0b',
      skin: '#fed7aa',
      skinShadow: '#fdba74',
      shirt: '#ec4899',
      accent: '#fde047',
      visorOrBand: '#00f0ff',
      accessory: 'visor',
    },
    verleih: {
      bgTop: '#172554',
      bgBot: '#0f766e',
      hair: '#9a3412',
      skin: '#fde68a',
      skinShadow: '#f59e0b',
      shirt: '#fb923c',
      accent: '#39ff14',
      visorOrBand: '#ff2a85',
      accessory: 'headband',
    },
    proshop: {
      bgTop: '#090d16',
      bgBot: '#0e7490',
      hair: '#1e293b',
      skin: '#fed7aa',
      skinShadow: '#fb923c',
      shirt: '#00f0ff',
      accent: '#fde047',
      visorOrBand: '#ff2a85',
      accessory: 'sunglasses',
    },
    snackbar: {
      bgTop: '#3b0764',
      bgBot: '#831843',
      hair: '#d97706',
      skin: '#ffedd5',
      skinShadow: '#fdba74',
      shirt: '#ff2a85',
      accent: '#00f0ff',
      visorOrBand: '#39ff14',
      accessory: 'cap',
    },
    dj: {
      bgTop: '#0f172a',
      bgBot: '#581c87',
      hair: '#111827',
      skin: '#f5d0fe',
      skinShadow: '#d8b4fe',
      shirt: '#a855f7',
      accent: '#00f0ff',
      visorOrBand: '#fde047',
      accessory: 'headphones',
    },
  };

  const pal = palettes[stationId] || palettes.kasse;

  // 16-Bit Arcade Background with Horizon Grid Stripes
  px(0, 0, grid, 12, pal.bgTop);
  px(0, 12, grid, 12, pal.bgBot);
  px(0, 11, grid, 1, pal.accent);
  for (let y = 14; y < grid; y += 3) {
    px(0, y, grid, 1, 'rgba(255,255,255,0.12)');
  }

  // Shoulders & 80s Neon Jacket / Shirt
  px(4, 17, 16, 7, '#090d16'); // 1px dark outline
  px(5, 18, 14, 6, pal.shirt);
  px(9, 18, 6, 6, pal.accent); // Inner collar / V-neck

  // Neck & Head Outline
  px(9, 15, 6, 3, pal.skinShadow);
  px(6, 5, 12, 11, '#090d16');
  px(7, 6, 10, 9, pal.skin);
  px(7, 13, 10, 2, pal.skinShadow);

  // 80s Hair Volume
  px(5, 3, 14, 4, pal.hair);
  px(5, 6, 2, 7, pal.hair);
  px(17, 6, 2, 7, pal.hair);

  // Eyes & Smile
  px(9, 9, 2, 2, '#090d16');
  px(13, 9, 2, 2, '#090d16');
  px(9, 9, 1, 1, '#ffffff');
  px(13, 9, 1, 1, '#ffffff');
  px(10, 12, 4, 1, '#be123c');

  // Station-Specific 80s Accessory
  if (pal.accessory === 'visor') {
    px(6, 6, 12, 2, pal.visorOrBand);
    px(5, 7, 14, 1, '#00f0ff');
  } else if (pal.accessory === 'headband') {
    px(6, 6, 12, 2, pal.visorOrBand);
    px(7, 6, 10, 1, '#fde047');
  } else if (pal.accessory === 'sunglasses') {
    px(7, 8, 10, 3, '#090d16');
    px(8, 9, 3, 1, '#00f0ff');
    px(13, 9, 3, 1, '#ff2a85');
  } else if (pal.accessory === 'cap') {
    px(6, 2, 12, 4, pal.visorOrBand);
    px(6, 5, 14, 1, pal.accent);
  } else if (pal.accessory === 'headphones') {
    px(4, 3, 16, 2, pal.visorOrBand);
    px(3, 5, 3, 6, pal.accent);
    px(18, 5, 3, 6, pal.accent);
    px(7, 8, 10, 2, '#090d16');
  }

  // Upscale to 192x192 with crisp nearest-neighbor pixels
  const outCanvas = document.createElement('canvas');
  outCanvas.width = 192;
  outCanvas.height = 192;
  const oCtx = outCanvas.getContext('2d');
  if (!oCtx) return smallCanvas.toDataURL('image/png');
  oCtx.imageSmoothingEnabled = false;
  oCtx.drawImage(smallCanvas, 0, 0, 192, 192);

  // Subtle 16-bit CRT scanline overlay
  oCtx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 0; y < 192; y += 4) {
    oCtx.fillRect(0, y, 192, 1);
  }

  const dataUrl = outCanvas.toDataURL('image/png');
  cachedProceduralPortraits[stationId] = dataUrl;
  return dataUrl;
}

/**
 * Automatic 16-Bit Pixel-Art Filter for Admin-Crew-Galerie photo uploads:
 * Center-crops the image, downscales to 48x48 pixels, applies 16-bit retro color
 * quantization + ordered Bayer dithering, and upscales to a crisp 192x192 PNG DataURL.
 */
export function convertImageFileTo16BitPixelDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
      img.onload = () => {
        const pixelRes = 48;
        const small = document.createElement('canvas');
        small.width = pixelRes;
        small.height = pixelRes;
        const sCtx = small.getContext('2d');
        if (!sCtx) {
          resolve(String(reader.result || ''));
          return;
        }
        sCtx.imageSmoothingEnabled = false;

        // Center-crop square
        const side = Math.min(img.width, img.height);
        const sx = Math.max(0, Math.floor((img.width - side) / 2));
        const sy = Math.max(0, Math.floor((img.height - side) / 2));
        sCtx.drawImage(img, sx, sy, side, side, 0, 0, pixelRes, pixelRes);

        const imgData = sCtx.getImageData(0, 0, pixelRes, pixelRes);
        const d = imgData.data;
        const bayer2x2 = [
          [-6, 6],
          [10, -2],
        ];
        for (let y = 0; y < pixelRes; y++) {
          for (let x = 0; x < pixelRes; x++) {
            const idx = (y * pixelRes + x) * 4;
            const dither = bayer2x2[y % 2][x % 2];
            // Boost contrast slightly + quantize to 16-bit arcade steps (step 32)
            const quantize = (v: number) => {
              const contrasted = (v - 128) * 1.18 + 128 + dither;
              const clamped = Math.max(0, Math.min(255, contrasted));
              return Math.min(255, Math.round(clamped / 36) * 36);
            };
            d[idx] = quantize(d[idx]);
            d[idx + 1] = quantize(d[idx + 1]);
            d[idx + 2] = quantize(d[idx + 2]);
          }
        }
        sCtx.putImageData(imgData, 0, 0);

        const out = document.createElement('canvas');
        out.width = 192;
        out.height = 192;
        const oCtx = out.getContext('2d');
        if (!oCtx) {
          resolve(small.toDataURL('image/png'));
          return;
        }
        oCtx.imageSmoothingEnabled = false;
        oCtx.drawImage(small, 0, 0, 192, 192);

        // Add crisp 16-bit scanlines
        oCtx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        for (let y = 0; y < 192; y += 4) {
          oCtx.fillRect(0, y, 192, 1);
        }

        resolve(out.toDataURL('image/png'));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
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
        const mobilityChoice: MobilityChoice | null =
          parsed.mobilityChoice === 'own-skates' ||
          parsed.mobilityChoice === 'rental-skates' ||
          parsed.mobilityChoice === 'wheelchair'
            ? parsed.mobilityChoice
            : null;
        return {
          active: true,
          locked: true,
          difficulty: diff,
          hasOwnSkates: Boolean(parsed.hasOwnSkates),
          hasRentedSkates: Boolean(parsed.hasRentedSkates),
          mobilityChoice,
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
    collectibles: [],
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
        collectibles: Array.isArray(parsed.collectibles)
          ? parsed.collectibles.map(String)
          : [],
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

export function getOrCreateAlphaBrowserId(): string {
  try {
    let existing = localStorage.getItem(KEYS.ALPHA_BROWSER_ID);
    if (!existing) {
      existing = `brw-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      localStorage.setItem(KEYS.ALPHA_BROWSER_ID, existing);
    }
    return existing;
  } catch {
    return 'brw-fallback';
  }
}

export function loadAlphaBetaConfig(): AlphaBetaAccessConfig {
  const defaults: AlphaBetaAccessConfig = {
    enabled: false,
    keys: [],
  };
  try {
    const raw = localStorage.getItem(KEYS.ALPHA_BETA_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      const keys: AlphaBetaKeyEntry[] = Array.isArray(parsed.keys)
        ? parsed.keys
            .filter(
              (k: unknown): k is Record<string, unknown> =>
                Boolean(k) &&
                typeof k === 'object' &&
                typeof (k as { key?: unknown }).key === 'string'
            )
            .map((k: Record<string, unknown>): AlphaBetaKeyEntry => ({
              key: String(k.key).trim().toUpperCase(),
              status: k.status === 'redeemed' ? 'redeemed' : 'free',
              redeemedBy:
                typeof k.redeemedBy === 'string' ? k.redeemedBy : undefined,
              redeemedAt:
                typeof k.redeemedAt === 'string' ? k.redeemedAt : undefined,
              redeemedByBrowserId:
                typeof k.redeemedByBrowserId === 'string'
                  ? k.redeemedByBrowserId
                  : undefined,
              blocked: Boolean(k.blocked),
            }))
        : [];
      return {
        enabled: Boolean(parsed.enabled),
        keys,
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function saveAlphaBetaConfig(config: AlphaBetaAccessConfig): void {
  try {
    localStorage.setItem(KEYS.ALPHA_BETA_CONFIG, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function generateAlphaBetaKeys(
  count: number,
  current: AlphaBetaAccessConfig
): AlphaBetaAccessConfig {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existingSet = new Set(current.keys.map((k) => k.key.toUpperCase()));
  const added: AlphaBetaKeyEntry[] = [];
  for (let i = 0; i < count; i++) {
    let candidate = '';
    let guard = 0;
    do {
      let suffix = '';
      for (let j = 0; j < 4; j++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      candidate = `BETA-${suffix}`;
      guard++;
    } while (existingSet.has(candidate) && guard < 100);
    existingSet.add(candidate);
    added.push({
      key: candidate,
      status: 'free',
      blocked: false,
    });
  }
  const next: AlphaBetaAccessConfig = {
    ...current,
    keys: [...added, ...current.keys],
  };
  saveAlphaBetaConfig(next);
  return next;
}

export function loadLocalAlphaBetaSession(): LocalAlphaBetaSession | null {
  try {
    const raw = localStorage.getItem(KEYS.ALPHA_BETA_SESSION);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.activatedKey === 'string') {
        return {
          activatedKey: parsed.activatedKey.trim().toUpperCase(),
          testerName:
            typeof parsed.testerName === 'string' ? parsed.testerName : '',
          browserId:
            typeof parsed.browserId === 'string'
              ? parsed.browserId
              : getOrCreateAlphaBrowserId(),
          isMasterKey: Boolean(parsed.isMasterKey),
          activatedAt:
            typeof parsed.activatedAt === 'string' ? parsed.activatedAt : '',
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveLocalAlphaBetaSession(
  session: LocalAlphaBetaSession | null
): void {
  try {
    if (!session) {
      localStorage.removeItem(KEYS.ALPHA_BETA_SESSION);
    } else {
      localStorage.setItem(KEYS.ALPHA_BETA_SESSION, JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

export function loadTesterFeedback(): TesterFeedbackItem[] {
  try {
    const raw = localStorage.getItem(KEYS.TESTER_FEEDBACK);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            (it: unknown): it is Record<string, unknown> =>
              Boolean(it) &&
              typeof it === 'object' &&
              typeof (it as { text?: unknown }).text === 'string'
          )
          .map((it: Record<string, unknown>): TesterFeedbackItem => ({
            id:
              typeof it.id === 'string'
                ? it.id
                : `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category:
              it.category === 'Bug' ||
              it.category === 'Idee' ||
              it.category === 'Lob'
                ? it.category
                : 'Idee',
            text: String(it.text),
            author: typeof it.author === 'string' ? it.author : 'Tester',
            createdAt: typeof it.createdAt === 'string' ? it.createdAt : '',
          }));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveTesterFeedback(list: TesterFeedbackItem[]): void {
  try {
    localStorage.setItem(KEYS.TESTER_FEEDBACK, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export type CertificateId =
  | 'stammgast_7'
  | 'treue_14'
  | 'family_day'
  | 'fuehrerschein'
  | 'koenig_der_luefte'
  | 'fleiss_25'
  | 'allrounder_50'
  | 'legende_100'
  | 'dj_livestream'
  | 'liveband_abend'
  | 'vielleser_5';

export interface CertificateDefinition {
  id: CertificateId;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'extreme-gold';
  hasRedWaxSeal?: boolean;
  isMultiTierEvent?: boolean;
}

export const PALLADIUM_CERTIFICATES: CertificateDefinition[] = [
  {
    id: 'stammgast_7',
    title: 'Stammgast-Urkunde (7 Tage)',
    subtitle: '7 Besuchstage im Palladium Hanau',
    description:
      'Verliehen für regelmäßige Besuche an 7 Tagen in der Palladium Roller-Disco Hanau.',
    icon: '🎟️',
    tier: 'silver',
  },
  {
    id: 'treue_14',
    title: 'Treue-Urkunde (14 Tage)',
    subtitle: '14 Besuchstage im Palladium Hanau',
    description:
      'Verliehen für unerschütterliche 80er-Rollschuh-Treue an 14 Besuchstagen.',
    icon: '🏅',
    tier: 'gold',
  },
  {
    id: 'family_day',
    title: 'Palladium Family-Day-Urkunde',
    subtitle: 'Sonntags- & Family-Day-Ehrengast',
    description:
      'Freigeschaltet für eine gemeinsame Fahrt am großen Palladium Family-Day oder an einem Sonntag.',
    icon: '👨‍👩‍👧‍👦',
    tier: 'silver',
  },
  {
    id: 'fuehrerschein',
    title: 'Palladium-Rollschuh-Führerschein',
    subtitle: 'Offizielle Bahn-Prüfung (Slalom & Sprung)',
    description:
      'Amtlich geprüfte Beherrschung einer fehlerfreien Slalom- und Hindernissprung-Runde.',
    icon: '🪪',
    tier: 'gold',
  },
  {
    id: 'koenig_der_luefte',
    title: 'König der Lüfte',
    subtitle: 'Extrem-Gold-Urkunde • Hochsprung-Rekord bei Volltempo',
    description:
      'Höchste Auszeichnung mit goldenem Ehrenrahmen und rotem Wachssiegel für das Meistern eines extrem schweren Hochsprung-Rekords bei voller Geschwindigkeit!',
    icon: '👑',
    tier: 'extreme-gold',
    hasRedWaxSeal: true,
  },
  {
    id: 'fleiss_25',
    title: 'Palladium-Fleißbienchen (25 Aufgaben)',
    subtitle: 'Meilenstein: 25 Aufgaben gemeistert',
    description:
      'Ausgezeichnet für 25 erfolgreich abgeschlossene Hallen-Aufgaben und Rundgang-Stationen.',
    icon: '🐝',
    tier: 'bronze',
  },
  {
    id: 'allrounder_50',
    title: 'Hallen-Allrounder (50 Aufgaben)',
    subtitle: 'Meilenstein: 50 Aufgaben gemeistert',
    description:
      'Ausgezeichnet für 50 erfolgreich abgeschlossene Aufgaben auf Parkett, Bühne und im Ballspiel.',
    icon: '🌟',
    tier: 'silver',
  },
  {
    id: 'legende_100',
    title: 'Palladium-Legende (100 Aufgaben)',
    subtitle: 'Gold-Urkunde • 100 Aufgaben gemeistert',
    description:
      'Ehren-Gold-Urkunde für 100 abgeschlossene Aufgaben – wahrer Meister des Palladium Hanau!',
    icon: '🏆',
    tier: 'gold',
    hasRedWaxSeal: true,
  },
  {
    id: 'dj_livestream',
    title: 'DJ-Livestream-Teilnahme',
    subtitle: 'Mehrstufige Event-Urkunde • Bronze (1x), Silber (3x), Gold (5x)',
    description:
      'Verliehen für deine Live-Teilnahme am DJ-Livestream ab 21:00 Uhr oder bei aktivem Live-Event im Palladium Hanau.',
    icon: '🎧',
    tier: 'gold',
    isMultiTierEvent: true,
  },
  {
    id: 'liveband_abend',
    title: 'Liveband-Abend',
    subtitle: 'Mehrstufige Event-Urkunde • Bronze (1x), Silber (3x), Gold (5x)',
    description:
      'Verliehen für deine Teilnahme an legendären 80er-Liveband-Konzertabenden vor der geschlossenen Mittelbühne.',
    icon: '🎸',
    tier: 'gold',
    isMultiTierEvent: true,
  },
  {
    id: 'vielleser_5',
    title: 'Vielleser auf Rollen',
    subtitle: 'Offizieller Stammleser des Palladium-Kuriers',
    description:
      'Verliehen für das Lesen von 5 verschiedenen Ausgaben der offiziellen 80er-Hallenzeitung „Der Palladium-Kurier – Hanau ’86“.',
    icon: '📰',
    tier: 'gold',
    hasRedWaxSeal: true,
  },
];

export interface PalladiumCertificatesState {
  visitDates: string[];
  totalTasksCompleted: number;
  cleanSlalomDone: boolean;
  cleanJumpDone: boolean;
  highSpeedJumpDone: boolean;
  djLivestreamCount?: number;
  livebandCount?: number;
  djLivestreamSessions?: string[];
  livebandSessions?: string[];
  readNewspaperIssues?: number[];
  unlocked: Partial<
    Record<
      CertificateId,
      {
        unlocked?: boolean;
        unlockedAt: string;
        holderName?: string;
        tierLevel?: 'bronze' | 'silver' | 'gold';
      }
    >
  >;
}

export function loadCertificatesState(): PalladiumCertificatesState {
  const today = getTodayDateString();
  const stampCard = loadStampCard();
  const defaultDates = Array.from(
    new Set([...(stampCard.stampedDates || []), today])
  );
  const fallback: PalladiumCertificatesState = {
    visitDates: defaultDates,
    totalTasksCompleted: 0,
    cleanSlalomDone: false,
    cleanJumpDone: false,
    highSpeedJumpDone: false,
    djLivestreamCount: 0,
    livebandCount: 0,
    djLivestreamSessions: [],
    livebandSessions: [],
    readNewspaperIssues: [],
    unlocked: {},
  };
  try {
    const raw = localStorage.getItem(KEYS.CERTIFICATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      const mergedDates = Array.from(
        new Set([
          ...defaultDates,
          ...(Array.isArray(parsed.visitDates)
            ? parsed.visitDates.map(String)
            : []),
        ])
      );
      return {
        visitDates: mergedDates,
        totalTasksCompleted: Math.max(
          0,
          Number(parsed.totalTasksCompleted) || 0
        ),
        cleanSlalomDone: Boolean(parsed.cleanSlalomDone),
        cleanJumpDone: Boolean(parsed.cleanJumpDone),
        highSpeedJumpDone: Boolean(parsed.highSpeedJumpDone),
        djLivestreamCount: Math.max(0, Number(parsed.djLivestreamCount) || 0),
        livebandCount: Math.max(0, Number(parsed.livebandCount) || 0),
        djLivestreamSessions: Array.isArray(parsed.djLivestreamSessions)
          ? parsed.djLivestreamSessions.map(String)
          : [],
        livebandSessions: Array.isArray(parsed.livebandSessions)
          ? parsed.livebandSessions.map(String)
          : [],
        readNewspaperIssues: Array.isArray(parsed.readNewspaperIssues)
          ? Array.from(
              new Set(
                parsed.readNewspaperIssues
                  .map((n: unknown) => Number(n))
                  .filter((n: number) => Number.isFinite(n) && n > 0)
              )
            )
          : [],
        unlocked:
          parsed.unlocked && typeof parsed.unlocked === 'object'
            ? parsed.unlocked
            : {},
      };
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function saveCertificatesState(state: PalladiumCertificatesState): void {
  try {
    localStorage.setItem(KEYS.CERTIFICATES, JSON.stringify(state));
  } catch {
    // ignore
  }
}


