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
import { isSupabaseConfigured, supabase } from '../lib/supabaseCloud';

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
  customCrewMembers?: CustomCrewStationMember[];
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
  newspaperTips?: string;
  newspaperUpdatedAt?: string;
  hallPowerEnabled?: boolean;
  roleKeys?: RoleKeysConfig;
  rankThresholds?: number[];
}

export type RoleHandheldType = 'dj' | 'licht' | 'presse';

export interface RoleKeysConfig {
  dj: string;
  licht: string;
  presse: string;
}

export const DEFAULT_ROLE_KEYS: RoleKeysConfig = {
  dj: 'DJ-PALLADIUM',
  licht: 'LICHT-PALLADIUM',
  presse: 'PRESSE-PALLADIUM',
};

export const DEFAULT_NEWSPAPER_TIPS =
  '• 5 Pixel-Stationen [E]: Besuche Kasse, Verleih, Pro-Shop, Snack-Bar & DJ-Kanzel im 16-Bit-Arcade-Look.\n• Sonntags-Clique (2+1): Löse dein Duo- oder Trio-Ticket für +25% Cliquen-Punkte bei warmer Nachmittagsbeleuchtung.\n• Entdecker-Urkunde: Klicke oben links auf deinen Avatar-Kreis für dein persönliches Arena-Zertifikat.';

const ROLE_HANDHELD_SESSION_KEY = 'p86_unlocked_role_handheld_v1';

export function loadUnlockedRoleHandheldSession(): RoleHandheldType | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.sessionStorage.getItem(ROLE_HANDHELD_SESSION_KEY);
    if (val === 'dj' || val === 'licht' || val === 'presse') {
      return val;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveUnlockedRoleHandheldSession(
  role: RoleHandheldType | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (role) {
      window.sessionStorage.setItem(ROLE_HANDHELD_SESSION_KEY, role);
    } else {
      window.sessionStorage.removeItem(ROLE_HANDHELD_SESSION_KEY);
    }
  } catch {
    // ignore
  }
}

export type CustomCrewSpawnSpotId =
  | 'eingang'
  | 'bahnrand_nord'
  | 'bahnrand_sued'
  | 'buehne'
  | 'chill_lounge'
  | 'custom_xy';

export interface CustomCrewStationMember {
  id: string;
  stationTitle: string;
  crewName: string;
  quote: string;
  portraitDataUrl?: string;
  spawnSpot: CustomCrewSpawnSpotId;
  x: number;
  y: number;
  shirtColor?: string;
  accentColor?: string;
}

export const CUSTOM_CREW_SPAWN_PRESETS: Record<
  CustomCrewSpawnSpotId,
  { label: string; x: number; y: number }
> = {
  eingang: { label: '🚪 Eingang / Empfang', x: 1620, y: 895 },
  bahnrand_nord: { label: '⬆️ Bahnrand Nord', x: 960, y: 120 },
  bahnrand_sued: { label: '⬇️ Bahnrand Süd', x: 980, y: 865 },
  buehne: { label: '🎸 Bühne / Mittel-Insel', x: 1000, y: 485 },
  chill_lounge: { label: '🛋️ Chill-Lounge / Bistro', x: 465, y: 880 },
  custom_xy: { label: '📍 Frei auf der Karte (X/Y)', x: 1410, y: 510 },
};

export interface HandheldPosState {
  left: number | null;
  top: number | null;
  isPinned: boolean;
}

const HANDHELD_POS_STORAGE_KEY = 'p86_handheld_pos';

export function loadHandheldPosState(): HandheldPosState {
  try {
    const raw = localStorage.getItem(HANDHELD_POS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        left: typeof parsed.left === 'number' ? parsed.left : null,
        top: typeof parsed.top === 'number' ? parsed.top : null,
        isPinned: Boolean(parsed.isPinned),
      };
    }
  } catch {
    // ignore
  }
  return { left: null, top: null, isPinned: false };
}

export function saveHandheldPosState(state: HandheldPosState): void {
  try {
    localStorage.setItem(HANDHELD_POS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
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
    customCrewMembers: [],
    djJingleSlots: DEFAULT_DJ_JINGLE_SLOTS.map((s) => ({ ...s })),
    newspaperEnabled: true,
    newspaperIssueId: 1,
    newspaperHeadline:
      'SONDERAUSGABE: NEON-LIGHTSHOW, 5 PIXEL-STATIONEN & SONNTAGS-CLIQUE LIVE!',
    newspaperBody:
      'Willkommen im Palladium Hanau ’86! Ab sofort erwarten euch unsere 5 interaktiven 16-Bit-Stationen (Kasse, Verleih, Pro-Shop, Snack-Bar & DJ-Kanzel), das echte 3x3-Sampler-Launchpad für DJ Magic Force sowie der neue Sonntags-Clique-Modus (2+1-Regel) mit +25% Gruppen-Bonus.\n\nTipp der Redaktion: Klicke oben im HUD auf deinen mittleren Avatar-Kreis für deine persönliche „Entdecker auf acht Rollen“-Urkunde – und lies regelmäßig den Palladium-Kurier, um dir nach 5 Ausgaben die Gold-Urkunde „Vielleser auf Rollen“ zu sichern!',
    newspaperTips: DEFAULT_NEWSPAPER_TIPS,
    newspaperUpdatedAt: '15.11.2026',
    hallPowerEnabled: true,
    roleKeys: { ...DEFAULT_ROLE_KEYS },
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
      const rawDjKey =
        typeof parsed.roleKeys?.dj === 'string'
          ? parsed.roleKeys.dj.trim()
          : '';
      const rawLichtKey =
        typeof parsed.roleKeys?.licht === 'string'
          ? parsed.roleKeys.licht.trim()
          : '';
      const rawPresseKey =
        typeof parsed.roleKeys?.presse === 'string'
          ? parsed.roleKeys.presse.trim()
          : '';
      const mergedRoleKeys: RoleKeysConfig = {
        dj:
          rawDjKey && rawDjKey !== 'DJ-BEAT-86'
            ? rawDjKey
            : DEFAULT_ROLE_KEYS.dj,
        licht:
          rawLichtKey && rawLichtKey !== 'LICHT-NEON-86'
            ? rawLichtKey
            : DEFAULT_ROLE_KEYS.licht,
        presse:
          rawPresseKey && rawPresseKey !== 'PRESSE-KURIER-86'
            ? rawPresseKey
            : DEFAULT_ROLE_KEYS.presse,
      };
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
        customCrewMembers: Array.isArray(parsed.customCrewMembers)
          ? parsed.customCrewMembers
          : [],
        djJingleSlots: mergedJingleSlots,
        roleKeys: mergedRoleKeys,
      };
    }
  } catch {
    // fallback
  }
  return defaults;
}

const cachedProceduralPortraits: Record<string, string> = {};

/**
 * Generates an authentic 16-Bit Arcade Pixel Portrait (48x48 upscaled to 192x192)
 * for each of the 5 Palladium '86 stations (or any custom crew member ID) when no custom photo is uploaded.
 */
export function getStation16BitPortraitDataUrl(
  stationId: StationDialogId | string,
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

  const fallbackKeys: StationDialogId[] = [
    'kasse',
    'verleih',
    'proshop',
    'snackbar',
    'dj',
  ];
  let idHash = 0;
  for (let i = 0; i < stationId.length; i++) {
    idHash = (idHash * 31 + stationId.charCodeAt(i)) | 0;
  }
  const resolvedKey =
    stationId in palettes
      ? (stationId as StationDialogId)
      : fallbackKeys[Math.abs(idHash) % fallbackKeys.length];
  const pal = palettes[resolvedKey] || palettes.kasse;

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
        sCtx.clearRect(0, 0, pixelRes, pixelRes);

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
            if (d[idx + 3] < 128) {
              d[idx] = 0;
              d[idx + 1] = 0;
              d[idx + 2] = 0;
              d[idx + 3] = 0;
              continue;
            }
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
            d[idx + 3] = 255;
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
        oCtx.clearRect(0, 0, 192, 192);
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

/**
 * 5. 1-KLICK FACEBOOK-EDITION DER ZEITUNG (1200 x 1200 px Offscreen-Canvas PNG)
 * Reine Social-Media-Ausgabe ohne Buttons, ohne "×", ohne "Gelesen ✓" und ohne Urkunden-Box.
 */
export function exportNewspaperFacebookEditionPng(opts: {
  issueId: number;
  updatedAt: string;
  headline: string;
  body: string;
  tips?: string;
  versionLabel: string;
}): void {
  if (typeof document === 'undefined') return;
  const W = 1200;
  const H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Vintage Parchment Background (1200x1200)
  ctx.fillStyle = '#f5ecd7';
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createRadialGradient(
    W / 2,
    H / 2,
    120,
    W / 2,
    H / 2,
    W * 0.72
  );
  grad.addColorStop(0, 'rgba(255, 251, 240, 0.45)');
  grad.addColorStop(1, 'rgba(205, 180, 138, 0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle vintage paper grain rules
  ctx.strokeStyle = 'rgba(90, 65, 38, 0.06)';
  ctx.lineWidth = 1;
  for (let y = 18; y < H; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Outer thick vintage frame + inner hairline frame
  ctx.strokeStyle = '#3a2817';
  ctx.lineWidth = 10;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = '#6b4c2b';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // 2. Top Masthead Bar
  ctx.fillStyle = '#4a3520';
  ctx.font = 'bold 17px "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`HANAU-GRIMM CENTER • AUSGABE #${opts.issueId}`, 60, 56);

  ctx.fillStyle = '#9f1239';
  ctx.textAlign = 'center';
  ctx.fillText('★ OFFIZIELLES HALLENBLATT ★', W / 2, 56);

  ctx.fillStyle = '#4a3520';
  ctx.textAlign = 'right';
  ctx.fillText(`STAND: ${opts.updatedAt || '15.11.2026'}`, W - 60, 56);

  ctx.strokeStyle = '#8a6d4b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 86);
  ctx.lineTo(W - 60, 86);
  ctx.stroke();

  // Main Masthead Title
  ctx.fillStyle = '#1a1109';
  ctx.font = '900 58px "Outfit", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('PALLADIUM KURIER – HANAU ’86', W / 2, 100);

  ctx.fillStyle = '#6b4c2b';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(
    `DIE UNABHÄNGIGE ROLLSCHUH-, MUSIK- & UPDATE-ZEITUNG AUF ACHT ROLLEN • ${opts.versionLabel}`,
    W / 2,
    168
  );

  // Double divider below Masthead
  ctx.strokeStyle = '#2b1d10';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, 198);
  ctx.lineTo(W - 60, 198);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 205);
  ctx.lineTo(W - 60, 205);
  ctx.stroke();

  // Helper for word-wrapping lines
  const wrapTextLines = (
    text: string,
    maxWidth: number,
    fontSpec: string
  ): string[] => {
    ctx.font = fontSpec;
    const paragraphs = (text || '').split(/\r?\n/);
    const lines: string[] = [];
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) {
        lines.push('');
        continue;
      }
      const words = trimmed.split(/\s+/);
      let cur = '';
      for (const word of words) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && cur) {
          lines.push(cur);
          cur = word;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  };

  // 3. Bold Main Headline Banner Box
  const headlineText = (
    opts.headline ||
    'SONDERAUSGABE: NEON-LIGHTSHOW, 5 PIXEL-STATIONEN & SONNTAGS-CLIQUE LIVE!'
  ).toUpperCase();
  const headlineLines = wrapTextLines(
    headlineText,
    W - 180,
    '900 32px "Outfit", Georgia, serif'
  ).slice(0, 3);
  const bannerTop = 222;
  const bannerHeight = 64 + headlineLines.length * 38;

  ctx.fillStyle = '#e8dcc2';
  ctx.fillRect(60, bannerTop, W - 120, bannerHeight);
  ctx.strokeStyle = '#2b1d10';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, bannerTop);
  ctx.lineTo(W - 60, bannerTop);
  ctx.moveTo(60, bannerTop + bannerHeight);
  ctx.lineTo(W - 60, bannerTop + bannerHeight);
  ctx.stroke();

  // Red Tag inside Headline Banner
  const badgeW = 340;
  const badgeH = 26;
  ctx.fillStyle = '#be123c';
  ctx.fillRect((W - badgeW) / 2, bannerTop + 14, badgeW, badgeH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('+++ AKTUELLE HAUPTSCHLAGZEILE +++', W / 2, bannerTop + 20);

  ctx.fillStyle = '#140d06';
  ctx.font = '900 32px "Outfit", Georgia, serif';
  headlineLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, bannerTop + 50 + idx * 38);
  });

  // 4. Two-Column Body Area
  const colTop = bannerTop + bannerHeight + 28;
  const footerTop = H - 104;
  const colLeftX = 60;
  const colWidth = 510;
  const colRightX = 630;

  // Center vertical column rule
  ctx.strokeStyle = '#9c8260';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, colTop);
  ctx.lineTo(W / 2, footerTop - 22);
  ctx.stroke();

  // LEFT COLUMN: REDAKTIONS-MELDUNG & UPDATE-NEWS
  ctx.textAlign = 'left';
  ctx.fillStyle = '#881337';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('📰 REDAKTIONS-MELDUNG & UPDATE-NEWS', colLeftX, colTop);

  ctx.strokeStyle = '#b89f7d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(colLeftX, colTop + 28);
  ctx.lineTo(colLeftX + colWidth, colTop + 28);
  ctx.stroke();

  const bodyLines = wrapTextLines(
    opts.body ||
      'Willkommen im Palladium Hanau ’86! Ab sofort erwarten euch unsere 5 interaktiven 16-Bit-Stationen, das echte 3x3-Sampler-Launchpad für DJ Magic Force sowie der neue Sonntags-Clique-Modus (2+1-Regel) mit +25% Gruppen-Bonus.',
    colWidth,
    '21px Georgia, serif'
  );

  ctx.fillStyle = '#241a10';
  ctx.font = '21px Georgia, serif';
  let curLeftY = colTop + 44;
  for (const line of bodyLines) {
    if (curLeftY > footerTop - 48) break;
    if (!line) {
      curLeftY += 16;
      continue;
    }
    ctx.fillText(line, colLeftX, curLeftY);
    curLeftY += 31;
  }

  // RIGHT COLUMN: PALLADIUM-TIPPS & HALLEN-GUIDE ’86 (NO CERTIFICATE BOX!)
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText('🛼 PALLADIUM-TIPPS & HALLEN-GUIDE ’86', colRightX, colTop);

  ctx.strokeStyle = '#b89f7d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(colRightX, colTop + 28);
  ctx.lineTo(colRightX + colWidth, colTop + 28);
  ctx.stroke();

  const tipsSource = (opts.tips && opts.tips.trim()) || DEFAULT_NEWSPAPER_TIPS;
  const tipsLines = wrapTextLines(tipsSource, colWidth, '20px Georgia, serif');

  ctx.fillStyle = '#2c2013';
  ctx.font = '20px Georgia, serif';
  let curRightY = colTop + 44;
  for (const line of tipsLines) {
    if (curRightY > footerTop - 210) break;
    if (!line) {
      curRightY += 14;
      continue;
    }
    ctx.fillText(line, colRightX, curRightY);
    curRightY += 30;
  }

  // Authentic 1986 Palladium Roller Disco Callout Box in lower right column (pure editorial graphic, no buttons/certificates)
  const promoTop = Math.max(curRightY + 18, footerTop - 190);
  const promoH = footerTop - 26 - promoTop;
  if (promoH >= 110) {
    ctx.fillStyle = '#e4d5b7';
    ctx.fillRect(colRightX, promoTop, colWidth, promoH);
    ctx.strokeStyle = '#3a2817';
    ctx.lineWidth = 3;
    ctx.strokeRect(colRightX, promoTop, colWidth, promoH);

    ctx.fillStyle = '#2b1d10';
    ctx.font = '900 22px "Outfit", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '★ ROLLER DISCO PALLADIUM HANAU ’86 ★',
      colRightX + colWidth / 2,
      promoTop + 20
    );

    ctx.fillStyle = '#881337';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(
      'HOLZPARKETT • 80ER-SOUND • NEON-LIGHTSHOW • MULTIPLAYER',
      colRightX + colWidth / 2,
      promoTop + 54
    );

    ctx.fillStyle = '#241a10';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText(
      'JETZT KOSTENLOS IM BROWSER MITROLLEN:',
      colRightX + colWidth / 2,
      promoTop + 86
    );
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText(
      'palladium-arena-s94k2.vercel.app',
      colRightX + colWidth / 2,
      promoTop + 114
    );
  }

  // 5. Print Footer (Strictly NO buttons, NO Gelesen ✓, NO ×, with 100% kostenloses Fan-Projekt notice)
  ctx.strokeStyle = '#2b1d10';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(60, footerTop);
  ctx.lineTo(W - 60, footerTop);
  ctx.stroke();

  ctx.fillStyle = '#2b1d10';
  ctx.font = 'bold 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'DRUCK & VERLAG: PALLADIUM ROLLER DISCO HANAU • JETZT MITROLLEN: palladium-arena-s94k2.vercel.app',
    W / 2,
    footerTop + 14
  );

  ctx.fillStyle = '#881337';
  ctx.font = 'bold 13.5px "JetBrains Mono", monospace';
  ctx.fillText(
    '★ 100 % kostenloses Fan-Projekt – hier wird ausschließlich mit gesammelten Spiel-Pixeln bezahlt, echtes Geld gibt es hier nicht! ★',
    W / 2,
    footerTop + 38
  );

  // Trigger PNG Download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `palladium-kurier-ausgabe-${opts.issueId}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Copy matching Facebook Post text with link to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    const postText = `📰 PALLADIUM KURIER – HANAU ’86 (Ausgabe #${opts.issueId})\n🔥 ${
      opts.headline ||
      'SONDERAUSGABE: NEON-LIGHTSHOW, 5 PIXEL-STATIONEN & SONNTAGS-CLIQUE LIVE!'
    }\n\n${
      opts.body || ''
    }\n\n👾 100 % kostenloses Fan-Projekt – hier wird ausschließlich mit gesammelten Spiel-Pixeln bezahlt, echtes Geld gibt es hier nicht!\n🛼 Jetzt direkt im Browser mitrollen: https://palladium-arena-s94k2.vercel.app`;
    navigator.clipboard.writeText(postText).catch(() => {
      // ignore clipboard permissions error
    });
  }
}

// ============================================================================
// 6. PIXEL-WÄHRUNG, SLALOM-REKORD & 80ER-ARCADE-BESTENLISTE ("HALLEN-EHRENTAFEL")
// ============================================================================

const PIXEL_CURRENCY_STORAGE_KEY = 'palladium_player_pixels_v1';
const SLALOM_RECORD_STORAGE_KEY = 'palladium_slalom_record_v1';
const HALL_LEADERBOARD_STORAGE_KEY = 'palladium_hall_leaderboard_v1';

export function loadPlayerPixels(): number {
  if (typeof window === 'undefined') return 30;
  try {
    const raw = window.localStorage.getItem(PIXEL_CURRENCY_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  } catch {
    // ignore
  }
  return 30;
}

export function savePlayerPixels(pixels: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PIXEL_CURRENCY_STORAGE_KEY,
      String(Math.max(0, Math.floor(pixels)))
    );
  } catch {
    // ignore
  }
}

export function loadSlalomRecord(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(SLALOM_RECORD_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

export function saveSlalomRecord(rounds: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SLALOM_RECORD_STORAGE_KEY,
      String(Math.max(0, Math.floor(rounds)))
    );
  } catch {
    // ignore
  }
}

export interface HallLeaderboardEntry {
  id: string;
  name: string;
  shirtColor: string;
  slalomRounds: number;
  hallPoints: number;
  pixelsCollected: number;
  ballspielBestTimeSec?: number | null;
  updatedAt: string;
}

export const DEFAULT_RANK_THRESHOLDS: number[] = [
  0, 250, 600, 1200, 2200, 3500,
];

export type LicensePaperTheme =
  | 'gray'
  | 'rose'
  | 'gold-parchment'
  | 'royal-black-gold';

export interface HallRankInfo {
  level: number; // 1..6
  title: string;
  shortBadge: string;
  icon: string;
  minXp: number;
  nextXp: number | null;
  progressPercent: number;
  paperTheme: LicensePaperTheme;
  paperLabel: string;
}

export function computeHallRankInfo(
  xp: number,
  customThresholds?: number[]
): HallRankInfo {
  const raw =
    Array.isArray(customThresholds) && customThresholds.length >= 6
      ? customThresholds
      : DEFAULT_RANK_THRESHOLDS;
  const thresholds = [
    0,
    Math.max(50, Number(raw[1]) || 250),
    Math.max(150, Number(raw[2]) || 600),
    Math.max(300, Number(raw[3]) || 1200),
    Math.max(600, Number(raw[4]) || 2200),
    Math.max(1000, Number(raw[5]) || 3500),
  ];

  const defs: {
    level: number;
    title: string;
    shortBadge: string;
    icon: string;
    paperTheme: LicensePaperTheme;
    paperLabel: string;
  }[] = [
    {
      level: 1,
      title: 'Bahn-Neuling',
      shortBadge: 'Rang 1 • Bahn-Neuling',
      icon: '🛼',
      paperTheme: 'gray',
      paperLabel: 'Klassisches 80er-Behördengrau (Stufe I)',
    },
    {
      level: 2,
      title: 'Kurven-Flitzer',
      shortBadge: 'Rang 2 • Kurven-Flitzer',
      icon: '⚡',
      paperTheme: 'gray',
      paperLabel: 'Klassisches 80er-Behördengrau (Stufe II)',
    },
    {
      level: 3,
      title: 'Disco-Skater',
      shortBadge: 'Rang 3 • Disco-Skater',
      icon: '🪩',
      paperTheme: 'rose',
      paperLabel: '80er Rosé / Altrosa Sonderpapier (Stufe III)',
    },
    {
      level: 4,
      title: 'Stammgast ’86',
      shortBadge: 'Rang 4 • Stammgast ’86',
      icon: '⭐',
      paperTheme: 'rose',
      paperLabel: '80er Rosé / Altrosa Stammgast-Schein (Stufe IV)',
    },
    {
      level: 5,
      title: 'Hallen-Legende',
      shortBadge: 'Rang 5 • Hallen-Legende',
      icon: '🏆',
      paperTheme: 'gold-parchment',
      paperLabel: 'Goldgelb / Ehren-Pergament (Stufe V)',
    },
    {
      level: 6,
      title: '👑 König der Halle',
      shortBadge: 'Rang 6 • 👑 König der Halle',
      icon: '👑',
      paperTheme: 'royal-black-gold',
      paperLabel: 'Edles Gold-Schwarz Königspapier (Höchstrang VI)',
    },
  ];

  const safeXp = Math.max(0, Math.floor(xp || 0));
  let idx = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (safeXp >= thresholds[i]) {
      idx = i;
      break;
    }
  }

  const cur = defs[idx];
  const minXp = thresholds[idx];
  const nextXp = idx < thresholds.length - 1 ? thresholds[idx + 1] : null;
  const progressPercent =
    nextXp !== null && nextXp > minXp
      ? Math.min(100, Math.max(0, Math.round(((safeXp - minXp) / (nextXp - minXp)) * 100)))
      : 100;

  return {
    ...cur,
    minXp,
    nextXp,
    progressPercent,
  };
}

export interface LicenseStampsState {
  slalomExam: boolean;
  ballspielChamp: boolean;
  kurierReader: boolean;
  fiveStationsVisited: boolean;
  visitedStations: string[];
}

const LICENSE_STAMPS_STORAGE_KEY = 'palladium_license_stamps_v1';
const BALLSPIEL_BEST_TIME_STORAGE_KEY = 'palladium_ballspiel_best_time_v1';

export function loadLicenseStamps(): LicenseStampsState {
  const defaults: LicenseStampsState = {
    slalomExam: false,
    ballspielChamp: false,
    kurierReader: false,
    fiveStationsVisited: false,
    visitedStations: [],
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(LICENSE_STAMPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        slalomExam: Boolean(parsed.slalomExam),
        ballspielChamp: Boolean(parsed.ballspielChamp),
        kurierReader: Boolean(parsed.kurierReader),
        fiveStationsVisited: Boolean(parsed.fiveStationsVisited),
        visitedStations: Array.isArray(parsed.visitedStations)
          ? parsed.visitedStations
          : [],
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

export function saveLicenseStamps(state: LicenseStampsState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LICENSE_STAMPS_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // ignore
  }
}

export function loadBallspielBestTimeSec(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BALLSPIEL_BEST_TIME_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed * 10) / 10;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveBallspielBestTimeSec(sec: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      BALLSPIEL_BEST_TIME_STORAGE_KEY,
      String(Math.round(sec * 10) / 10)
    );
  } catch {
    // ignore
  }
}

export const DEFAULT_SEED_LEADERBOARD: HallLeaderboardEntry[] = [
  {
    id: 'seed-marco-86',
    name: 'Marco ’86 (HU)',
    shirtColor: '#00f0ff',
    slalomRounds: 9,
    hallPoints: 3650,
    pixelsCollected: 148,
    ballspielBestTimeSec: 28.4,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-sabine-disco',
    name: 'Sabine_Neon',
    shirtColor: '#ff007f',
    slalomRounds: 8,
    hallPoints: 2480,
    pixelsCollected: 132,
    ballspielBestTimeSec: 31.2,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-tobi-quad',
    name: 'Tobi_Quad86',
    shirtColor: '#39ff14',
    slalomRounds: 7,
    hallPoints: 1940,
    pixelsCollected: 118,
    ballspielBestTimeSec: 34.6,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-jenny-star',
    name: 'Jenny_Starlight',
    shirtColor: '#fde047',
    slalomRounds: 6,
    hallPoints: 1760,
    pixelsCollected: 104,
    ballspielBestTimeSec: 38.9,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-sven-speed',
    name: 'Sven_Speedster',
    shirtColor: '#a855f7',
    slalomRounds: 6,
    hallPoints: 1320,
    pixelsCollected: 96,
    ballspielBestTimeSec: 42.5,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-kerstin-86',
    name: 'Kerstin_Main',
    shirtColor: '#fb923c',
    slalomRounds: 5,
    hallPoints: 990,
    pixelsCollected: 88,
    ballspielBestTimeSec: 46.0,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-ralf-bembel',
    name: 'Ralf_Hanau',
    shirtColor: '#38bdf8',
    slalomRounds: 4,
    hallPoints: 680,
    pixelsCollected: 74,
    ballspielBestTimeSec: 51.8,
    updatedAt: '1986-11-15',
  },
  {
    id: 'seed-nadine-wave',
    name: 'Nadine_Synth',
    shirtColor: '#f43f5e',
    slalomRounds: 4,
    hallPoints: 420,
    pixelsCollected: 68,
    ballspielBestTimeSec: 55.4,
    updatedAt: '1986-11-15',
  },
];

export function loadLocalHallLeaderboard(): HallLeaderboardEntry[] {
  if (typeof window === 'undefined') return [...DEFAULT_SEED_LEADERBOARD];
  try {
    const raw = window.localStorage.getItem(HALL_LEADERBOARD_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_SEED_LEADERBOARD];
}

export function saveLocalHallLeaderboard(entries: HallLeaderboardEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      HALL_LEADERBOARD_STORAGE_KEY,
      JSON.stringify(entries.slice(0, 40))
    );
  } catch {
    // ignore
  }
}

export async function fetchHallLeaderboard(): Promise<HallLeaderboardEntry[]> {
  const localList = loadLocalHallLeaderboard();
  const byId = new Map<string, HallLeaderboardEntry>();
  for (const item of localList) {
    if (item && item.id) {
      byId.set(item.id, item);
    }
  }

  if (supabase && isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('player_id, name, outfit_color, highscore, settings, updated_at')
        .order('highscore', { ascending: false })
        .limit(25);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const pid = String(row.player_id || row.name || '');
          if (!pid) continue;
          const s = (row.settings || {}) as Record<string, unknown>;
          const slalomRounds = Number(s.slalomRecord || 0);
          const pixelsCollected = Number(s.pixelsCollected || 30);
          const rawBestTime = Number(s.ballspielBestTimeSec || 0);
          const hallPoints = Number(row.highscore || 0);
          const existing = byId.get(pid);
          const prevBest = existing?.ballspielBestTimeSec || null;
          const mergedBestTime =
            rawBestTime > 0 && prevBest !== null
              ? Math.min(rawBestTime, prevBest)
              : rawBestTime > 0
              ? rawBestTime
              : prevBest;
          byId.set(pid, {
            id: pid,
            name: String(row.name || 'Gast-Skater').slice(0, 24),
            shirtColor: String(row.outfit_color || '#00f0ff'),
            slalomRounds: Math.max(slalomRounds, existing?.slalomRounds || 0),
            hallPoints: Math.max(hallPoints, existing?.hallPoints || 0),
            pixelsCollected: Math.max(
              pixelsCollected,
              existing?.pixelsCollected || 0
            ),
            ballspielBestTimeSec: mergedBestTime,
            updatedAt: String(row.updated_at || new Date().toISOString()),
          });
        }
      }
    } catch {
      // fallback to local
    }
  }

  const merged = Array.from(byId.values());
  saveLocalHallLeaderboard(merged);
  return merged;
}

export async function upsertHallLeaderboardPlayer(entry: {
  id: string;
  name: string;
  shirtColor: string;
  slalomRounds: number;
  hallPoints: number;
  pixelsCollected: number;
  ballspielBestTimeSec?: number | null;
}): Promise<HallLeaderboardEntry[]> {
  const list = loadLocalHallLeaderboard();
  const cleanName = (entry.name || 'Gast-Skater').trim().slice(0, 24);
  const idx = list.findIndex(
    (e) =>
      e.id === entry.id ||
      e.name.toLowerCase() === cleanName.toLowerCase()
  );
  const nowStr = new Date().toISOString();

  if (idx >= 0) {
    const prev = list[idx];
    const prevBest = prev.ballspielBestTimeSec ?? null;
    const nextBest = entry.ballspielBestTimeSec ?? null;
    const bestTime =
      prevBest !== null && nextBest !== null
        ? Math.min(prevBest, nextBest)
        : nextBest !== null
        ? nextBest
        : prevBest;
    list[idx] = {
      ...prev,
      id: entry.id,
      name: cleanName,
      shirtColor: entry.shirtColor || prev.shirtColor || '#00f0ff',
      slalomRounds: Math.max(prev.slalomRounds || 0, entry.slalomRounds || 0),
      hallPoints: Math.max(prev.hallPoints || 0, entry.hallPoints || 0),
      pixelsCollected: Math.max(
        prev.pixelsCollected || 0,
        entry.pixelsCollected || 0
      ),
      ballspielBestTimeSec: bestTime,
      updatedAt: nowStr,
    };
  } else {
    list.push({
      id: entry.id,
      name: cleanName,
      shirtColor: entry.shirtColor || '#00f0ff',
      slalomRounds: Math.max(0, entry.slalomRounds || 0),
      hallPoints: Math.max(0, entry.hallPoints || 0),
      pixelsCollected: Math.max(0, entry.pixelsCollected || 0),
      ballspielBestTimeSec: entry.ballspielBestTimeSec ?? null,
      updatedAt: nowStr,
    });
  }

  saveLocalHallLeaderboard(list);

  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase.from('players').upsert(
        {
          player_id: entry.id,
          name: cleanName,
          outfit_color: entry.shirtColor || '#00f0ff',
          highscore: Math.max(0, Math.floor(entry.hallPoints || 0)),
          settings: {
            slalomRecord: Math.max(0, Math.floor(entry.slalomRounds || 0)),
            pixelsCollected: Math.max(0, Math.floor(entry.pixelsCollected || 0)),
            ballspielBestTimeSec: entry.ballspielBestTimeSec ?? null,
          },
          updated_at: nowStr,
        },
        { onConflict: 'player_id' }
      );
    } catch {
      // ignore offline
    }
  }

  return list;
}

export async function resetHallLeaderboardSeason(): Promise<
  HallLeaderboardEntry[]
> {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SLALOM_RECORD_STORAGE_KEY, '0');
      window.localStorage.removeItem(BALLSPIEL_BEST_TIME_STORAGE_KEY);
      window.localStorage.setItem(HALL_LEADERBOARD_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
  }
  if (supabase && isSupabaseConfigured()) {
    try {
      await supabase
        .from('players')
        .update({
          highscore: 0,
          settings: {
            slalomRecord: 0,
            pixelsCollected: 0,
            ballspielBestTimeSec: null,
          },
        })
        .neq('player_id', '');
    } catch {
      // ignore
    }
  }
  return [];
}




