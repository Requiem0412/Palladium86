import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_PIN,
  APP_VERSION_LABEL,
  ArenaVisualStyle,
  BandGenderMode,
  BandSkinToneMode,
  CameraViewMode,
  CenterStageMode,
  ChallengeDefinition,
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
  DjSoundboardEffectId,
  EditableModuleId,
  formatLayoutConfigCodeBlock,
  GuestDjPreset,
  HallGameMode,
  LightingMode,
  NameDisplayMode,
  NeonUnderglowColor,
  NeonWristbandColor,
  PALLADIUM_CHALLENGES,
  PARODY_BANDS,
  PlayerCharacterMode,
  ProShopUpgradesState,
  RadioTrackItem,
  SkateCharmId,
  TrickMoveId,
} from './config/arenaConfig';
import Peer, { DataConnection } from 'peerjs';
import {
  ArenaLiveTelemetry,
  buildTrackNpcsForDifficulty,
  MultiplayerPlayerState,
  RollerArenaEngine,
} from './components/RollerArenaEngine';
import { soundFX } from './utils/soundEffects';
import {
  AdminPersistentSettings,
  ChallengeProgressMap,
  computePeakHourLabel,
  EntryPassData,
  FreeDrinkChoice,
  HallStatsData,
  IntroStepId,
  IntroTourState,
  isIntroTourComplete,
  loadAdminSettings,
  loadAdminUnlockedSession,
  loadChallengesProgress,
  loadCrtFilterEnabled,
  loadCustomArenaLayout,
  loadEntryPass,
  loadGuestDjPresets,
  loadHallStats,
  loadHasEnteredBefore,
  loadHideChronik,
  loadIntroTourState,
  loadLockerPlayerSettings,
  loadPlayerProfile,
  loadProShopUpgrades,
  loadRadioPlaylist,
  loadSpecialSkaters,
  loadStampCard,
  loadVisitorVolume,
  LockerPlayerSettings,
  recordDailyStampVisit,
  recordMultiplayerSessionStart,
  recordMultiplayerVisitorSnapshot,
  recordSessionVisit,
  recordSoloSessionStart,
  resetCustomArenaLayout,
  resetEntryPass,
  resetHallStats,
  resetStampCard,
  saveAdminSettings,
  saveAdminUnlockedSession,
  saveChallengesProgress,
  saveCrtFilterEnabled,
  saveCustomArenaLayout,
  saveEntryPass,
  saveGuestDjPresets,
  saveHallStats,
  saveHasEnteredBefore,
  saveHideChronik,
  saveIntroTourState,
  saveLockerPlayerSettings,
  savePlayerProfile,
  saveProShopUpgrades,
  saveRadioPlaylist,
  saveSpecialSkaters,
  saveStampCard,
  saveVisitorVolume,
  SingleplayerDifficulty,
  StampCardData,
} from './utils/storageAndStats';

const MULTIPLAYER_OUTFIT_COLORS = [
  { id: 'neon-pink', label: 'Neon-Pink', hex: '#ff2a85' },
  { id: 'cyber-cyan', label: 'Cyber-Cyan', hex: '#00f0ff' },
  { id: 'laser-green', label: 'Laser-Grün', hex: '#39ff14' },
  { id: 'sunset-gold', label: 'Sunset-Gold', hex: '#f59e0b' },
  { id: 'electric-violet', label: 'Electric-Violett', hex: '#a855f7' },
  { id: 'turbo-red', label: 'Turbo-Rot', hex: '#ef4444' },
] as const;

// Cross-browser (Safari, iOS, Chrome, Firefox) WebRTC configuration with explicit STUN servers
const PEER_ICE_CONFIG = {
  secure: true,
  pingInterval: 4000,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  },
};

const TAB_SESSION_STORAGE_KEY = 'palladium_tab_session_id_v1';

function getOrCreateTabSessionId(): string {
  if (typeof window === 'undefined') return 'server-tab';
  try {
    let existing = window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
    if (!existing) {
      existing = `tab-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, existing);
    }
    return existing;
  } catch {
    return `tab-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
  }
}

interface AdminSyncPayload {
  lightingMode: LightingMode;
  blacklightTimerSec?: number;
  autoBlacklightEnabled?: boolean;
  centerStageMode: CenterStageMode;
  activeBandName: string;
  customBandInput: string;
  bandSkinTone: BandSkinToneMode;
  bandGender: BandGenderMode;
  hallGameMode: HallGameMode;
  concertLightingMode: ConcertLightingMode;
  fogMachineEnabled: boolean;
  fogBurstCount: number;
  activeDjName: string;
  djTickerText: string;
  twitchChannel: string;
  youtubeUrl?: string;
  cinemaStreamSource?: 'twitch' | 'youtube' | 'visualizer';
  cinemaCountdownEnabled?: boolean;
  cinemaCountdownTitle?: string;
  cinemaCountdownTargetIso?: string;
  cinemaWeekdays?: string[];
  cinemaStartTime?: string;
  fullHallPutzlichtEnabled?: boolean;
  pixel16BitFiguresEnabled?: boolean;
  backgroundDancersEnabled?: boolean;
  crewNames?: CrewNamesConfig;
  isMaintenanceMode: boolean;
  maintenanceReopenText: string;
  liveArenaStyle: ArenaVisualStyle;
  customLayout?: CustomArenaLayoutState;
}

type MultiplayerPacket =
  | {
      type: 'guest-hello';
      state: MultiplayerPlayerState;
      freeDrinkChoice?: FreeDrinkChoice;
      tabSessionId?: string;
      joinedAt?: number;
      isAdmin?: boolean;
    }
  | {
      type: 'join-accepted';
      welcomeAnnouncement?: string;
    }
  | {
      type: 'join-rejected';
      reason: string;
    }
  | {
      type: 'hall-radio';
      message: string;
    }
  | {
      type: 'player-state';
      state: MultiplayerPlayerState;
    }
  | {
      type: 'world-players';
      players: MultiplayerPlayerState[];
      timestamp?: number;
    }
  | {
      type: 'heartbeat';
      tabSessionId: string;
      timestamp: number;
      isTabHidden?: boolean;
      isAdmin?: boolean;
    }
  | {
      type: 'guest-leave';
      peerId: string;
      tabSessionId: string;
    }
  | {
      type: 'host-handover';
      nextHostPeerId: string;
      nextHostTabSessionId?: string;
      roomId: string;
      adminSync: AdminSyncPayload;
      players: MultiplayerPlayerState[];
    }
  | {
      type: 'admin-takeover-request';
      adminTabSessionId: string;
      adminSync: AdminSyncPayload;
    }
  | {
      type: 'admin-sync';
      payload: AdminSyncPayload;
    }
  | {
      type: 'kicked';
      reason?: string;
    }
  | {
      type: 'room-closed';
    }
  | {
      type: 'controller-pad';
      dx: number;
      dy: number;
      jump?: boolean;
      spin?: boolean;
      interact?: boolean;
      boost?: boolean;
      trickMove?: TrickMoveId | null;
    };

export function App() {
  // First-visit curtain & chronicle state (cookie-free localStorage)
  const [hideChronik, setHideChronik] = useState<boolean>(() =>
    loadHideChronik()
  );
  const [, setHasEnteredBefore] = useState<boolean>(() =>
    loadHasEnteredBefore()
  );
  const [isCurtainOpen, setIsCurtainOpen] = useState<boolean>(
    () => loadHasEnteredBefore() || loadHideChronik()
  );
  const [showChronicleModal, setShowChronicleModal] = useState<boolean>(
    () => !loadHasEnteredBefore() && !loadHideChronik()
  );

  // Player Profile & Cashier Guest Mode (starts empty without pre-filled "Speedy 86")
  const initialProfile = useMemo(() => loadPlayerProfile(), []);
  const [playerName, setPlayerName] = useState<string>(initialProfile.name);
  const [isAnonymousGuest, setIsAnonymousGuest] = useState<boolean>(
    initialProfile.isAnonymousGuest
  );
  // Spind-Menü (SPINDE) Einstellungen & Pflicht-Einführung (Palladium-Rundgang)
  const [lockerSettings, setLockerSettings] = useState<LockerPlayerSettings>(
    () => loadLockerPlayerSettings()
  );
  const [showLockerModal, setShowLockerModal] = useState<boolean>(false);
  const [lockerDrinkBoostTrigger, setLockerDrinkBoostTrigger] =
    useState<number>(0);
  const [introTour, setIntroTour] = useState<IntroTourState>(() =>
    loadIntroTourState()
  );
  const introTourRef = useRef<IntroTourState>(introTour);
  useEffect(() => {
    introTourRef.current = introTour;
  }, [introTour]);
  const [introBannerText, setIntroBannerText] = useState<string | null>(null);
  const [isIntroBoxMinimized, setIsIntroBoxMinimized] =
    useState<boolean>(false);

  const [nameDisplayMode, setNameDisplayMode] =
    useState<NameDisplayMode>('focus');
  const showNames =
    lockerSettings.showAiNames || lockerSettings.showOwnName;
  const [freeDrinkChoice, setFreeDrinkChoice] = useState<FreeDrinkChoice>(() => {
    const sc = loadStampCard();
    return sc.welcomeDrinkChoice === 'bloba' ? 'bloba' : 'slush';
  });
  const [hallRadioBanner, setHallRadioBanner] = useState<string | null>(null);

  // 10er-Stempelkarte (localStorage) & 80er-CRT-Filter (Scanlines)
  const [stampCard, setStampCard] = useState<StampCardData>(() =>
    recordDailyStampVisit()
  );
  const [showStampCardModal, setShowStampCardModal] = useState<boolean>(false);
  const [crtFilterEnabled, setCrtFilterEnabled] = useState<boolean>(() =>
    loadCrtFilterEnabled()
  );
  const [showPhoneControllerModal, setShowPhoneControllerModal] =
    useState<boolean>(false);
  const [phonePadConnected, setPhonePadConnected] = useState<boolean>(false);

  // Core Gameplay Modes
  const [characterMode, setCharacterMode] =
    useState<PlayerCharacterMode>('skater');
  const [kengolHatEnabled, setKengolHatEnabled] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('top-down');
  const [lightingMode, setLightingMode] = useState<LightingMode>('disco');
  const [centerStageMode, setCenterStageMode] =
    useState<CenterStageMode>('islands');
  const [activeBandName, setActiveBandName] = useState<string>(PARODY_BANDS[0]);
  const [customBandInput, setCustomBandInput] = useState<string>('');
  const [bandSkinTone, setBandSkinTone] = useState<BandSkinToneMode>('mixed');
  const [bandGender, setBandGender] = useState<BandGenderMode>('mixed');
  const [hallGameMode, setHallGameMode] = useState<HallGameMode>('free-skate');

  // Singleplayer Experience Level, Own Skates vs. Rental Skates & Anti-Cheat Entry Pass
  const initialEntryPass = useMemo(() => loadEntryPass(), []);
  const [entryPass, setEntryPass] = useState<EntryPassData | null>(
    initialEntryPass
  );
  const [difficulty, setDifficulty] = useState<SingleplayerDifficulty>(
    initialEntryPass?.difficulty || 'intermediate'
  );
  const [hasOwnSkates, setHasOwnSkates] = useState<boolean>(
    initialEntryPass ? initialEntryPass.hasOwnSkates : true
  );
  const [hasRentedSkates, setHasRentedSkates] = useState<boolean>(
    initialEntryPass ? initialEntryPass.hasRentedSkates : false
  );
  const [drinkChipAvailable, setDrinkChipAvailable] = useState<boolean>(
    initialEntryPass ? initialEntryPass.drinkChipAvailable : true
  );

  // Public Visitor Volume & Mute Control (linked with Spind Disco-Sound toggle)
  const [visitorVolume, setVisitorVolume] = useState<number>(() => {
    const v = loadVisitorVolume();
    soundFX.setVolume(v);
    return v;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const ls = loadLockerPlayerSettings();
    const muted = !ls.discoSoundEnabled;
    soundFX.setMuted(muted);
    return muted;
  });

  // 80s Webradio & Mix-Manager State
  const [radioPlaylist, setRadioPlaylist] = useState<RadioTrackItem[]>(() =>
    loadRadioPlaylist()
  );
  const [currentTrackIdx, setCurrentTrackIdx] = useState<number>(0);
  const [isRadioPlaying, setIsRadioPlaying] = useState<boolean>(false);
  const [radioStreamStatus, setRadioStreamStatus] = useState<
    'stopped' | 'streaming' | 'synth-fallback'
  >('stopped');
  const [radioShuffle, setRadioShuffle] = useState<boolean>(false);
  const [radioRepeat, setRadioRepeat] = useState<boolean>(true);
  const [newTrackTitle, setNewTrackTitle] = useState<string>('');
  const [newTrackUrl, setNewTrackUrl] = useState<string>('');
  const [newTrackStyle, setNewTrackStyle] =
    useState<RadioTrackItem['synthStyle']>('electro-boogie');

  // External Trick Trigger for HUD Clickable Move Badges
  const [externalTrickTrigger, setExternalTrickTrigger] = useState<{
    move: TrickMoveId;
    seq: number;
  } | null>(null);

  // Admin & Persistent Settings
  const initialAdminSettings = useMemo(() => loadAdminSettings(), []);
  const [adminSettings, setAdminSettings] =
    useState<AdminPersistentSettings>(initialAdminSettings);
  const [specialSkaters, setSpecialSkaters] = useState<string[]>(() =>
    loadSpecialSkaters()
  );
  const [newGhostName, setNewGhostName] = useState<string>('');

  // Guest-DJ Presets & Form State
  const [guestDjPresets, setGuestDjPresets] = useState<GuestDjPreset[]>(() =>
    loadGuestDjPresets()
  );
  const [newGuestDjName, setNewGuestDjName] = useState<string>('');
  const [newGuestDjChannel, setNewGuestDjChannel] = useState<string>('');
  const [newGuestDjTicker, setNewGuestDjTicker] = useState<string>('');

  // Arena Visual Style (Admin Preview vs. Live Unlocked Style)
  const [selectedStyleTile, setSelectedStyleTile] = useState<ArenaVisualStyle>(
    initialAdminSettings.liveArenaStyle || 'classic-neon'
  );
  const [adminPreviewStyle, setAdminPreviewStyle] =
    useState<ArenaVisualStyle | null>(null);
  const [styleFeedbackToast, setStyleFeedbackToast] = useState<string | null>(
    null
  );

  // 🛠️ Baumenü (Admin Layout & AI Skater Anchor Editor) State
  const [customLayout, setCustomLayout] = useState<CustomArenaLayoutState>(() =>
    loadCustomArenaLayout()
  );
  const [buildModeEnabled, setBuildModeEnabled] = useState<boolean>(false);
  const [selectedBuildItemId, setSelectedBuildItemId] = useState<string | null>(
    'mod:proShop'
  );
  const [coordsCopiedToast, setCoordsCopiedToast] = useState<boolean>(false);

  const handleUpdateCustomLayout = useCallback(
    (nextLayout: CustomArenaLayoutState) => {
      setCustomLayout(nextLayout);
      saveCustomArenaLayout(nextLayout);
    },
    []
  );

  const handleResetCustomLayout = useCallback(() => {
    const fresh = resetCustomArenaLayout();
    setCustomLayout(fresh);
    setStyleFeedbackToast(
      '↩️ Standard-Layout wiederhergestellt (alle Raum-Module & KI-Skater zurückgesetzt)!'
    );
    window.setTimeout(() => setStyleFeedbackToast(null), 4000);
  }, []);

  const editableNpcList = useMemo(
    () => buildTrackNpcsForDifficulty(difficulty, customLayout.npcAnchors),
    [difficulty, customLayout.npcAnchors]
  );

  const handleCopyCustomCoordinatesJson = useCallback(() => {
    const snippet = formatLayoutConfigCodeBlock(customLayout);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(snippet);
      setCoordsCopiedToast(true);
      window.setTimeout(() => setCoordsCopiedToast(false), 3000);
    }
  }, [customLayout]);

  const handleAdjustSelectedModuleSizeOrRot = useCallback(
    (dw: number, dh: number, dRot = 0) => {
      if (!selectedBuildItemId || !selectedBuildItemId.startsWith('mod:'))
        return;
      const modId = selectedBuildItemId.slice(4) as EditableModuleId;
      const curMod =
        customLayout.modules[modId] || DEFAULT_CUSTOM_ARENA_LAYOUT.modules[modId];
      if (!curMod) return;
      const minW = modId === 'baffleLeft' || modId === 'baffleRight' ? 24 : 32;
      const minH = modId === 'baffleLeft' || modId === 'baffleRight' ? 8 : 20;
      const nextW = Math.max(minW, Math.min(960, Math.round(curMod.width + dw)));
      const nextH = Math.max(minH, Math.min(640, Math.round(curMod.height + dh)));
      const nextRot = (((curMod.rot || 0) + dRot) % 360 + 360) % 360;
      const nextLayout: CustomArenaLayoutState = {
        ...customLayout,
        modules: {
          ...customLayout.modules,
          [modId]: {
            ...curMod,
            width: nextW,
            height: nextH,
            rot: nextRot,
          },
        },
      };
      handleUpdateCustomLayout(nextLayout);
    },
    [customLayout, handleUpdateCustomLayout, selectedBuildItemId]
  );

  // DJ-Jingle & Sprachmemo-Pult State (No speechSynthesis!)
  const [externalDjJingleBubble, setExternalDjJingleBubble] = useState<{
    text: string;
    seq: number;
  } | null>(null);
  const [activeJingleSlotId, setActiveJingleSlotId] = useState<string | null>(
    null
  );
  const [editingJingleSlotId, setEditingJingleSlotId] = useState<string | null>(
    null
  );

  // Lighting & Schedule Automation States
  const [blacklightTimerSec, setBlacklightTimerSec] = useState<number>(0);
  const preBlacklightModeRef = useRef<LightingMode>('disco');
  const wasCinemaScheduledRef = useRef<boolean>(false);

  // URL parameter bypass for Maintenance mode (?access=palladium) & Multiplayer Room (?room=<RAUM_ID>)
  const hasUrlBackstageBypass = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('access')?.toLowerCase() === 'palladium';
  }, []);

  const initialUrlRoomId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room')?.trim();
    return r && r.length > 0 ? r : null;
  }, []);

  const initialControllerRoomId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const c = params.get('controller')?.trim();
    return c && c.length > 0 ? c : null;
  }, []);

  const remoteControllerInputRef = useRef<{
    dx: number;
    dy: number;
    jump: boolean;
    spin: boolean;
    interact: boolean;
    boost: boolean;
    trickMove: TrickMoveId | null;
  }>({
    dx: 0,
    dy: 0,
    jump: false,
    spin: false,
    interact: false,
    boost: false,
    trickMove: null,
  });

  const [controllerHostId] = useState<string>(() => {
    const suffix = getOrCreateTabSessionId()
      .replace(/[^a-z0-9]/gi, '')
      .slice(-6)
      .toLowerCase();
    return `palladium-pad-${suffix || '86'}`;
  });
  const controllerHostPeerRef = useRef<Peer | null>(null);

  // Admin PIN Authentication (sessionStorage) — hidden for invited guests unless they unlock with Admin-PIN
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() =>
    initialUrlRoomId ? false : loadAdminUnlockedSession()
  );
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [showAdminTerminal, setShowAdminTerminal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const logoClickTimestampsRef = useRef<number[]>([]);

  // ============================================================================
  // PEERJS / WEBRTC REAL-TIME MULTIPLAYER STATE (HOST & GUEST)
  // ============================================================================
  const [playerShirtColor, setPlayerShirtColor] = useState<string>(
    initialUrlRoomId ? '#ff2a85' : '#1e1b4b'
  );
  const [mpRole, setMpRole] = useState<'solo' | 'host' | 'guest'>('solo');
  const [mpRoomId, setMpRoomId] = useState<string | null>(initialUrlRoomId);
  const [mpStatus, setMpStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle');
  const [mpNotice, setMpNotice] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState<boolean>(false);
  const [remotePlayers, setRemotePlayers] = useState<MultiplayerPlayerState[]>(
    []
  );
  const [showGuestJoinModal, setShowGuestJoinModal] = useState<boolean>(() =>
    Boolean(initialUrlRoomId)
  );
  // Start name field completely empty (no pre-filled "Speedy 86")
  const [guestJoinNameInput, setGuestJoinNameInput] = useState<string>('');
  const [guestJoinError, setGuestJoinError] = useState<string | null>(null);

  const tabSessionIdRef = useRef<string>(getOrCreateTabSessionId());
  const myJoinedAtRef = useRef<number>(Date.now());
  const peerInstanceRef = useRef<Peer | null>(null);
  const hostConnectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostGuestsStateRef = useRef<Map<string, MultiplayerPlayerState>>(
    new Map()
  );
  const hostGuestHeartbeatRef = useRef<
    Map<string, { lastSeen: number; isTabHidden: boolean; tabSessionId?: string }>
  >(new Map());
  const guestConnRef = useRef<DataConnection | null>(null);
  const lastHostPacketAtRef = useRef<number>(Date.now());
  const isTabHiddenRef = useRef<boolean>(false);
  const isHandingOverHostRef = useRef<boolean>(false);
  const isApplyingRemoteAdminSyncRef = useRef<boolean>(false);

  const playerNameRef = useRef<string>(playerName);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  const playerShirtColorRef = useRef<string>(playerShirtColor);
  useEffect(() => {
    playerShirtColorRef.current = playerShirtColor;
  }, [playerShirtColor]);

  const isAdminUnlockedRef = useRef<boolean>(isAdminUnlocked);
  useEffect(() => {
    isAdminUnlockedRef.current = isAdminUnlocked;
  }, [isAdminUnlocked]);

  const mpRoleRef = useRef<'solo' | 'host' | 'guest'>(mpRole);
  useEffect(() => {
    mpRoleRef.current = mpRole;
  }, [mpRole]);

  const mpRoomIdRef = useRef<string | null>(mpRoomId);
  useEffect(() => {
    mpRoomIdRef.current = mpRoomId;
  }, [mpRoomId]);

  const remotePlayersRef = useRef<MultiplayerPlayerState[]>(remotePlayers);
  useEffect(() => {
    remotePlayersRef.current = remotePlayers;
  }, [remotePlayers]);

  const localSkaterSnapshotRef = useRef<MultiplayerPlayerState>({
    peerId: 'local',
    tabSessionId: tabSessionIdRef.current,
    joinedAt: myJoinedAtRef.current,
    isAdmin: isAdminUnlocked,
    name: playerName || 'Skater',
    shirtColor: playerShirtColor,
    x: 1320,
    y: 725,
    vx: 0,
    vy: 0,
    headingRad: -Math.PI / 2,
    spinAngleOffset: 0,
    isSpinning: false,
    jumpZ: 0,
    isJumping: false,
    characterMode: 'skater',
    kengolHat: false,
    crashTimer: 0,
    speechBubble: null,
    activeTrickMove: null,
    wristbandColor: undefined,
  });

  const isMultiplayerActive = mpRole === 'host' || mpRole === 'guest';

  // Challenges & Pro-Shop Upgrades
  const [challengesProgress, setChallengesProgress] =
    useState<ChallengeProgressMap>(() => loadChallengesProgress());
  const [upgrades, setUpgrades] = useState<ProShopUpgradesState>(() =>
    loadProShopUpgrades()
  );
  const [unlockedToast, setUnlockedToast] =
    useState<ChallengeDefinition | null>(null);

  // Modals & Drawers
  const [showChallengesModal, setShowChallengesModal] =
    useState<boolean>(false);
  const [showProShopModal, setShowProShopModal] = useState<boolean>(false);
  const [showHallGamesModal, setShowHallGamesModal] = useState<boolean>(false);
  const [isTwitchOnline, setIsTwitchOnline] = useState<boolean>(false);
  const [, setIsCinemaScheduleActive] = useState<boolean>(false);
  const [twitchMuted, setTwitchMuted] = useState<boolean>(false);
  const [fogBurstCount, setFogBurstCount] = useState<number>(0);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] =
    useState<boolean>(false);

  // Hall Statistics (localStorage)
  const [hallStats, setHallStats] = useState<HallStatsData>(() =>
    recordSessionVisit()
  );

  // Live Telemetry from Canvas Engine
  const [telemetry, setTelemetry] = useState<ArenaLiveTelemetry>({
    x: 245,
    y: 890,
    speed: 0,
    laps: 0,
    cleanLapsStreak: 0,
    crashes: 0,
    isSlipstreamActive: false,
    isOnWaxPatch: false,
    slushTimerSec: 0,
    blobaColaTimerSec: 0,
    freeSlushCount: 1,
    freeBlobaCount: 1,
    nearProShop: false,
    nearSkateRental: false,
    nearBistroCounter: false,
    nearDjTower: false,
    hasSkatesEquipped: true,
    djAudioProximity: 0.35,
    gamepadConnected: false,
    gamepadName: '',
    activeSpeech: null,
    ballspielScore: 0,
    ballspielRemaining: 15,
    ballspielTotal: 15,
    slalomCombo: 0,
  });

  // Clean Audio Autoplay Unlock on First User Interaction
  useEffect(() => {
    const unlock = () => {
      soundFX.unlockAudioContext();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Subscribe to Webradio / Mix-Player status updates
  useEffect(() => {
    const syncRadio = () => {
      const st = soundFX.getRadioState();
      setIsRadioPlaying(st.isPlaying);
      setRadioStreamStatus(st.streamStatus);
    };
    syncRadio();
    return soundFX.onStatusChange(syncRadio);
  }, []);

  const showHallAnnouncement = useCallback((msg: string) => {
    setHallRadioBanner(msg);
    window.setTimeout(() => {
      setHallRadioBanner((curr) => (curr === msg ? null : curr));
    }, 6000);
  }, []);

  // Save profile whenever changed
  useEffect(() => {
    savePlayerProfile({ name: playerName, isAnonymousGuest });
  }, [playerName, isAnonymousGuest]);

  // Save upgrades whenever changed
  useEffect(() => {
    saveProShopUpgrades(upgrades);
  }, [upgrades]);

  // Save CRT filter whenever changed
  useEffect(() => {
    saveCrtFilterEnabled(crtFilterEnabled);
  }, [crtFilterEnabled]);

  // Save Spind (Locker) settings whenever changed
  useEffect(() => {
    saveLockerPlayerSettings(lockerSettings);
  }, [lockerSettings]);

  // Record Multiplayer sessions & visitor snapshots for exclusive Admin Hallen-Statistik
  const prevMpActiveRef = useRef<boolean>(false);
  useEffect(() => {
    if (isMultiplayerActive && !prevMpActiveRef.current) {
      prevMpActiveRef.current = true;
      setHallStats(recordMultiplayerSessionStart());
    } else if (!isMultiplayerActive) {
      prevMpActiveRef.current = false;
    }
  }, [isMultiplayerActive]);

  useEffect(() => {
    if (!isMultiplayerActive) return;
    const visitorIds = remotePlayers.map(
      (p) => p.tabSessionId || p.peerId || p.name
    );
    const concurrentCount = remotePlayers.length + 1;
    setHallStats(recordMultiplayerVisitorSnapshot(concurrentCount, visitorIds));
  }, [isMultiplayerActive, remotePlayers]);

  // Dedicated Smartphone-Controller PeerJS Receiver so ?controller=<ID> works in both Solo and Multiplayer
  useEffect(() => {
    if (initialControllerRoomId) return;
    if (!showPhoneControllerModal && !phonePadConnected) return;
    if (controllerHostPeerRef.current && !controllerHostPeerRef.current.destroyed) {
      return;
    }
    const padPeer = new Peer(controllerHostId, PEER_ICE_CONFIG);
    controllerHostPeerRef.current = padPeer;
    padPeer.on('connection', (conn) => {
      setPhonePadConnected(true);
      conn.on('data', (raw) => {
        const pkt = raw as MultiplayerPacket;
        if (pkt && pkt.type === 'controller-pad') {
          remoteControllerInputRef.current.dx = pkt.dx || 0;
          remoteControllerInputRef.current.dy = pkt.dy || 0;
          if (pkt.jump) remoteControllerInputRef.current.jump = true;
          if (pkt.spin) remoteControllerInputRef.current.spin = true;
          if (pkt.interact) remoteControllerInputRef.current.interact = true;
          if (pkt.trickMove) {
            remoteControllerInputRef.current.trickMove = pkt.trickMove;
          }
        }
      });
      conn.on('close', () => {
        remoteControllerInputRef.current.dx = 0;
        remoteControllerInputRef.current.dy = 0;
        setPhonePadConnected(false);
      });
    });
    return () => {
      try {
        padPeer.destroy();
      } catch {
        // ignore
      }
      controllerHostPeerRef.current = null;
    };
  }, [controllerHostId, initialControllerRoomId, phonePadConnected, showPhoneControllerModal]);

  // Save admin settings whenever changed
  useEffect(() => {
    saveAdminSettings(adminSettings);
  }, [adminSettings]);

  // Save radio playlist whenever changed
  useEffect(() => {
    saveRadioPlaylist(radioPlaylist);
  }, [radioPlaylist]);

  // 15-Minute Blacklight UV Countdown Timer
  const handleStart15MinBlacklight = useCallback(() => {
    setLightingMode((curr) => {
      if (curr !== 'blacklight') {
        preBlacklightModeRef.current = curr;
      }
      return 'blacklight';
    });
    setBlacklightTimerSec(15 * 60);
  }, []);

  useEffect(() => {
    if (blacklightTimerSec <= 0) return;
    const timer = window.setInterval(() => {
      setBlacklightTimerSec((prev) => {
        if (prev <= 1) {
          setLightingMode(preBlacklightModeRef.current || 'disco');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [blacklightTimerSec]);

  // Auto-Blacklight-Timer (15 Min.): automatically starts a 15-min Blacklight session when enabled
  useEffect(() => {
    if (
      adminSettings.autoBlacklightEnabled &&
      blacklightTimerSec === 0 &&
      hallGameMode !== 'ballspiel'
    ) {
      handleStart15MinBlacklight();
    }
  }, [
    adminSettings.autoBlacklightEnabled,
    blacklightTimerSec,
    hallGameMode,
    handleStart15MinBlacklight,
  ]);

  // Check whether the configured Twitch channel is LIVE / online
  useEffect(() => {
    const channel = (adminSettings.twitchChannel || '').trim();
    if (!channel) {
      setIsTwitchOnline(false);
      return;
    }
    let cancelled = false;
    const checkTwitchLive = async () => {
      try {
        const res = await fetch(
          `https://decapi.me/twitch/uptime/${encodeURIComponent(channel)}`
        );
        if (!res.ok) {
          if (!cancelled) setIsTwitchOnline(false);
          return;
        }
        const text = (await res.text()).trim().toLowerCase();
        const isLive =
          text.length > 0 &&
          !text.includes('offline') &&
          !text.includes('error') &&
          !text.includes('not found');
        if (!cancelled) {
          setIsTwitchOnline(isLive);
        }
      } catch {
        if (!cancelled) setIsTwitchOnline(false);
      }
    };
    checkTwitchLive();
    const timer = window.setInterval(checkTwitchLive, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [adminSettings.twitchChannel]);

  // Automatic Kino-Zeitplan (Multi-Weekdays Mo-So + Start/End Time -> switches to 'cinema' and back to 'islands')
  useEffect(() => {
    if (!adminSettings.cinemaScheduleEnabled) {
      setIsCinemaScheduleActive(false);
      if (wasCinemaScheduledRef.current) {
        wasCinemaScheduledRef.current = false;
        setCenterStageMode('islands');
      }
      return;
    }

    const checkSchedule = () => {
      const now = new Date();
      const shortDays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      const todayShort = shortDays[now.getDay()];
      const activeWeekdays =
        Array.isArray(adminSettings.cinemaWeekdays) &&
        adminSettings.cinemaWeekdays.length > 0
          ? adminSettings.cinemaWeekdays
          : ['Mi', 'Sa'];
      const dayMatches = activeWeekdays.includes(todayShort);

      const [startH, startM] = (adminSettings.cinemaStartTime || '20:00')
        .split(':')
        .map((n) => parseInt(n, 10) || 0);
      const [endH, endM] = (adminSettings.cinemaEndTime || '22:00')
        .split(':')
        .map((n) => parseInt(n, 10) || 0);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const inTimeWindow =
        startMinutes <= endMinutes
          ? nowMinutes >= startMinutes && nowMinutes < endMinutes
          : nowMinutes >= startMinutes || nowMinutes < endMinutes;

      if (dayMatches && inTimeWindow) {
        setIsCinemaScheduleActive(true);
        if (!wasCinemaScheduledRef.current) {
          wasCinemaScheduledRef.current = true;
          setCenterStageMode('cinema');
        }
      } else {
        setIsCinemaScheduleActive(false);
        if (wasCinemaScheduledRef.current) {
          wasCinemaScheduledRef.current = false;
          setCenterStageMode('islands');
        }
      }
    };

    checkSchedule();
    const interval = window.setInterval(checkSchedule, 10000);
    return () => window.clearInterval(interval);
  }, [
    adminSettings.cinemaScheduleEnabled,
    adminSettings.cinemaWeekdays,
    adminSettings.cinemaStartTime,
    adminSettings.cinemaEndTime,
  ]);

  // Automatic Audio-Ducking (0% Hall Radio) whenever a live Twitch or YouTube stream is playing with sound on the Cinema Screen
  useEffect(() => {
    const src = adminSettings.cinemaStreamSource || 'twitch';
    const hasYoutube = Boolean((adminSettings.youtubeUrl || '').trim());
    const isStreamActiveOnCinema =
      centerStageMode === 'cinema' &&
      !adminSettings.cinemaCountdownEnabled &&
      !twitchMuted &&
      ((src === 'twitch' && isTwitchOnline) ||
        (src === 'youtube' && hasYoutube));

    soundFX.setCinemaStreamActiveWithAudio(isStreamActiveOnCinema);
    return () => {
      soundFX.setCinemaStreamActiveWithAudio(false);
    };
  }, [
    centerStageMode,
    adminSettings.cinemaStreamSource,
    adminSettings.youtubeUrl,
    adminSettings.cinemaCountdownEnabled,
    twitchMuted,
    isTwitchOnline,
  ]);

  // Increment session play time & persist to Hall Stats every 5 seconds
  useEffect(() => {
    if (!isCurtainOpen) return;
    const interval = window.setInterval(() => {
      setHallStats((prev) => {
        const updated: HallStatsData = {
          ...prev,
          totalPlaySeconds: prev.totalPlaySeconds + 5,
          bestLapRecord: Math.max(prev.bestLapRecord, telemetry.laps),
        };
        saveHallStats(updated);
        return updated;
      });
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isCurtainOpen, telemetry.laps]);

  const canEnterSingleplayerHall =
    isAnonymousGuest || playerName.trim().length >= 2;

  const handleEnterHall = useCallback(() => {
    if (!isAnonymousGuest && playerName.trim().length < 2) {
      return;
    }
    soundFX.unlockAudioContext();
    soundFX.playCurtainReveal();
    saveHasEnteredBefore(true);
    setHasEnteredBefore(true);
    setIsCurtainOpen(true);
    setShowChronicleModal(false);

    const drinkLabel =
      freeDrinkChoice === 'slush'
        ? '1x Slush Puppy'
        : freeDrinkChoice === 'bloba'
        ? '1x Bloba Cola'
        : '1x Slush Puppy & 1x Bloba Cola';
    const displayName = isAnonymousGuest
      ? 'Ein Gast-Skater'
      : playerName.trim();
    showHallAnnouncement(
      `📻 Hallenfunk: ${displayName} hat die Halle betreten (Freigetränk: ${drinkLabel})!`
    );

    // Record daily stamp on the 10er-Stempelkarte (localStorage)
    const updatedCard = recordDailyStampVisit();
    const chosenWelcomeDrink: 'slush' | 'bloba' =
      freeDrinkChoice === 'bloba' ? 'bloba' : 'slush';
    if (updatedCard.welcomeDrinkChoice !== chosenWelcomeDrink) {
      updatedCard.welcomeDrinkChoice = chosenWelcomeDrink;
      saveStampCard(updatedCard);
    }
    setStampCard(updatedCard);

    // Lock Singleplayer Entry Stamp (palladium_entry_pass) for this visit if not already locked
    setEntryPass((prev) => {
      if (prev?.locked) return prev;
      const lockedPass: EntryPassData = {
        locked: true,
        difficulty,
        hasOwnSkates,
        hasRentedSkates: false,
        drinkChipAvailable: true,
        freeDrinkChoice,
        stampedAt: new Date().toISOString(),
      };
      saveEntryPass(lockedPass);
      setHasRentedSkates(false);
      setDrinkChipAvailable(true);
      return lockedPass;
    });

    // Record Solo session start in Admin Hallen-Statistik
    setHallStats(recordSoloSessionStart());

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [
    difficulty,
    freeDrinkChoice,
    hasOwnSkates,
    isAnonymousGuest,
    playerName,
    showHallAnnouncement,
  ]);

  // Global keyboard shortcut for Admin Terminal: Ctrl + Shift + A (or Cmd + Shift + A)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (isAdminUnlocked) {
          setShowAdminTerminal((prev) => !prev);
        } else {
          setPinInput('');
          setPinError(null);
          setShowAdminPinModal(true);
        }
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (!isInput && e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsBottomBarCollapsed((prev) => !prev);
        return;
      }

      // Close Spind modal with Escape key
      if (e.key === 'Escape' && showLockerModal) {
        e.preventDefault();
        setShowLockerModal(false);
        return;
      }

      if (
        !isCurtainOpen &&
        (e.key === 'Enter' || e.key === ' ') &&
        canEnterSingleplayerHall
      ) {
        if (!isInput) {
          e.preventDefault();
          handleEnterHall();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canEnterSingleplayerHall,
    handleEnterHall,
    isAdminUnlocked,
    isCurtainOpen,
    showLockerModal,
  ]);

  const handleRedeemDrinkChipAtRental = useCallback(() => {
    setHasRentedSkates(true);
    setDrinkChipAvailable(false);
    setEntryPass((prev) => {
      const updated: EntryPassData = {
        locked: true,
        difficulty: prev ? prev.difficulty : difficulty,
        hasOwnSkates: prev ? prev.hasOwnSkates : hasOwnSkates,
        hasRentedSkates: true,
        drinkChipAvailable: false,
        stampedAt: prev?.stampedAt || new Date().toISOString(),
      };
      saveEntryPass(updated);
      return updated;
    });
  }, [difficulty, hasOwnSkates]);

  const handleRedeemDrinkChipAtBistro = useCallback(() => {
    setDrinkChipAvailable(false);
    setEntryPass((prev) => {
      const updated: EntryPassData = {
        locked: true,
        difficulty: prev ? prev.difficulty : difficulty,
        hasOwnSkates: prev ? prev.hasOwnSkates : hasOwnSkates,
        hasRentedSkates: prev ? prev.hasRentedSkates : hasRentedSkates,
        drinkChipAvailable: false,
        stampedAt: prev?.stampedAt || new Date().toISOString(),
      };
      saveEntryPass(updated);
      return updated;
    });
  }, [difficulty, hasOwnSkates, hasRentedSkates]);

  const handleResetEntryPassFromAdmin = useCallback(() => {
    resetEntryPass();
    setEntryPass(null);
    setHasRentedSkates(false);
    setDrinkChipAvailable(true);
  }, []);

  const handleLogoClick = () => {
    const now = performance.now();
    const recent = logoClickTimestampsRef.current.filter((t) => now - t < 1100);
    recent.push(now);
    logoClickTimestampsRef.current = recent;
    if (recent.length >= 3) {
      logoClickTimestampsRef.current = [];
      if (isAdminUnlocked) {
        setShowAdminTerminal(true);
      } else {
        setPinInput('');
        setPinError(null);
        setShowAdminPinModal(true);
      }
    }
  };

  const handleVerifyAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === ADMIN_PIN) {
      setIsAdminUnlocked(true);
      saveAdminUnlockedSession(true);
      setShowAdminPinModal(false);
      setShowAdminTerminal(true);
      setPinError(null);
    } else {
      setPinError('Falsche Hallenleiter-PIN! Bitte erneut versuchen.');
    }
  };

  const handleToggleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const next: CameraViewMode =
        prev === 'top-down' ? 'chase' : prev === 'chase' ? 'ego' : 'top-down';
      return next;
    });
  }, []);

  const handleToggleCharacterMode = useCallback(() => {
    setCharacterMode((prev) => (prev === 'skater' ? 'wheelchair' : 'skater'));
  }, []);

  const handleToggleShowNames = useCallback(() => {
    setNameDisplayMode((prev) =>
      prev === 'focus' ? 'all' : prev === 'all' ? 'off' : 'focus'
    );
  }, []);

  const handleToggleUnderglow = useCallback(() => {
    setUpgrades((prev) => ({
      ...prev,
      underglowEnabled: !prev.underglowEnabled,
    }));
  }, []);

  const handleToggleKengolHat = useCallback(() => {
    setKengolHatEnabled((prev) => !prev);
  }, []);

  const handleTriggerTrickFromHud = useCallback((moveId: TrickMoveId) => {
    setExternalTrickTrigger((prev) => ({
      move: moveId,
      seq: (prev?.seq || 0) + 1,
    }));
  }, []);

  // ============================================================================
  // 80s WEBRADIO / MIX-MANAGER HANDLERS
  // ============================================================================
  const handlePlayTrackAtIndex = useCallback(
    (idx: number) => {
      if (radioPlaylist.length === 0) return;
      const safeIdx =
        ((idx % radioPlaylist.length) + radioPlaylist.length) %
        radioPlaylist.length;
      setCurrentTrackIdx(safeIdx);
      soundFX.unlockAudioContext();
      soundFX.startRadioTrack(radioPlaylist[safeIdx]);
    },
    [radioPlaylist]
  );

  const handleNextTrack = useCallback(() => {
    if (radioPlaylist.length === 0) return;
    if (radioShuffle && radioPlaylist.length > 1) {
      let nextIdx = currentTrackIdx;
      while (nextIdx === currentTrackIdx) {
        nextIdx = Math.floor(Math.random() * radioPlaylist.length);
      }
      handlePlayTrackAtIndex(nextIdx);
    } else {
      handlePlayTrackAtIndex(currentTrackIdx + 1);
    }
  }, [currentTrackIdx, handlePlayTrackAtIndex, radioPlaylist.length, radioShuffle]);

  const handlePrevTrack = useCallback(() => {
    if (radioPlaylist.length === 0) return;
    handlePlayTrackAtIndex(currentTrackIdx - 1);
  }, [currentTrackIdx, handlePlayTrackAtIndex, radioPlaylist.length]);

  // ============================================================================
  // MULTI-MONITOR BROADCASTCHANNEL & PEERJS MULTIPLAYER HANDLERS
  // ============================================================================

  const buildCurrentAdminSyncPayload = useCallback((): AdminSyncPayload => {
    return {
      lightingMode,
      blacklightTimerSec,
      autoBlacklightEnabled: adminSettings.autoBlacklightEnabled,
      centerStageMode,
      activeBandName,
      customBandInput,
      bandSkinTone,
      bandGender,
      hallGameMode,
      concertLightingMode: adminSettings.concertLightingMode,
      fogMachineEnabled: adminSettings.fogMachineEnabled,
      fogBurstCount,
      activeDjName: adminSettings.activeDjName || DEFAULT_DJ_NAME,
      djTickerText: adminSettings.djTickerText,
      twitchChannel: adminSettings.twitchChannel,
      youtubeUrl: adminSettings.youtubeUrl,
      cinemaStreamSource: adminSettings.cinemaStreamSource,
      cinemaCountdownEnabled: adminSettings.cinemaCountdownEnabled,
      cinemaCountdownTitle: adminSettings.cinemaCountdownTitle,
      cinemaCountdownTargetIso: adminSettings.cinemaCountdownTargetIso,
      cinemaWeekdays: adminSettings.cinemaWeekdays,
      cinemaStartTime: adminSettings.cinemaStartTime,
      fullHallPutzlichtEnabled: adminSettings.fullHallPutzlichtEnabled,
      pixel16BitFiguresEnabled: adminSettings.pixel16BitFiguresEnabled,
      backgroundDancersEnabled: adminSettings.backgroundDancersEnabled ?? true,
      crewNames: adminSettings.crewNames,
      isMaintenanceMode: adminSettings.isMaintenanceMode,
      maintenanceReopenText:
        adminSettings.maintenanceReopenText || '🚀 ALPHA STARTING SOON',
      liveArenaStyle: adminSettings.liveArenaStyle || 'classic-neon',
      customLayout,
    };
  }, [
    lightingMode,
    blacklightTimerSec,
    adminSettings.autoBlacklightEnabled,
    centerStageMode,
    activeBandName,
    customBandInput,
    bandSkinTone,
    bandGender,
    hallGameMode,
    adminSettings.concertLightingMode,
    adminSettings.fogMachineEnabled,
    fogBurstCount,
    adminSettings.activeDjName,
    adminSettings.djTickerText,
    adminSettings.twitchChannel,
    adminSettings.youtubeUrl,
    adminSettings.cinemaStreamSource,
    adminSettings.cinemaCountdownEnabled,
    adminSettings.cinemaCountdownTitle,
    adminSettings.cinemaCountdownTargetIso,
    adminSettings.cinemaWeekdays,
    adminSettings.cinemaStartTime,
    adminSettings.fullHallPutzlichtEnabled,
    adminSettings.pixel16BitFiguresEnabled,
    adminSettings.backgroundDancersEnabled,
    adminSettings.crewNames,
    adminSettings.isMaintenanceMode,
    adminSettings.maintenanceReopenText,
    adminSettings.liveArenaStyle,
    customLayout,
  ]);

  const applyIncomingAdminSync = useCallback((s: AdminSyncPayload) => {
    isApplyingRemoteAdminSyncRef.current = true;
    setLightingMode(s.lightingMode);
    if (typeof s.blacklightTimerSec === 'number') {
      setBlacklightTimerSec(s.blacklightTimerSec);
    }
    setCenterStageMode(
      (s.centerStageMode as string) === 'live-band' ? 'band' : s.centerStageMode
    );
    setActiveBandName(s.activeBandName);
    setCustomBandInput(s.customBandInput);
    setBandSkinTone(s.bandSkinTone);
    setBandGender(s.bandGender);
    setHallGameMode(s.hallGameMode);
    setFogBurstCount(s.fogBurstCount);
    setAdminPreviewStyle(null);
    if (s.liveArenaStyle) {
      setSelectedStyleTile(s.liveArenaStyle);
    }
    if (s.customLayout) {
      setCustomLayout(s.customLayout);
      saveCustomArenaLayout(s.customLayout);
    }
    setAdminSettings((prev) => ({
      ...prev,
      autoBlacklightEnabled:
        s.autoBlacklightEnabled ?? prev.autoBlacklightEnabled,
      concertLightingMode: s.concertLightingMode,
      fogMachineEnabled: s.fogMachineEnabled,
      activeDjName: s.activeDjName,
      djTickerText: s.djTickerText,
      twitchChannel: s.twitchChannel,
      youtubeUrl: s.youtubeUrl ?? prev.youtubeUrl,
      cinemaStreamSource: s.cinemaStreamSource ?? prev.cinemaStreamSource,
      cinemaCountdownEnabled:
        s.cinemaCountdownEnabled ?? prev.cinemaCountdownEnabled,
      cinemaCountdownTitle: s.cinemaCountdownTitle ?? prev.cinemaCountdownTitle,
      cinemaCountdownTargetIso:
        s.cinemaCountdownTargetIso ?? prev.cinemaCountdownTargetIso,
      cinemaWeekdays: s.cinemaWeekdays ?? prev.cinemaWeekdays,
      cinemaStartTime: s.cinemaStartTime ?? prev.cinemaStartTime,
      fullHallPutzlichtEnabled:
        s.fullHallPutzlichtEnabled ?? prev.fullHallPutzlichtEnabled,
      pixel16BitFiguresEnabled:
        s.pixel16BitFiguresEnabled ?? prev.pixel16BitFiguresEnabled,
      backgroundDancersEnabled:
        s.backgroundDancersEnabled ?? prev.backgroundDancersEnabled,
      crewNames: s.crewNames ?? prev.crewNames,
      isMaintenanceMode: s.isMaintenanceMode,
      maintenanceReopenText:
        s.maintenanceReopenText || prev.maintenanceReopenText,
      liveArenaStyle: s.liveArenaStyle,
    }));
    window.setTimeout(() => {
      isApplyingRemoteAdminSyncRef.current = false;
    }, 60);
  }, []);

  const adminSyncPayloadRef = useRef<AdminSyncPayload>(
    buildCurrentAdminSyncPayload()
  );
  useEffect(() => {
    adminSyncPayloadRef.current = buildCurrentAdminSyncPayload();
  }, [buildCurrentAdminSyncPayload]);

  // Multi-Window / Dual-Screen BroadcastChannel Sync
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isApplyingBroadcastRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return;
    }
    const ch = new BroadcastChannel('palladium_hanau_sync_v1');
    broadcastChannelRef.current = ch;
    ch.onmessage = (ev) => {
      const data = ev.data;
      if (data && data.type === 'admin-sync' && data.payload) {
        isApplyingBroadcastRef.current = true;
        applyIncomingAdminSync(data.payload as AdminSyncPayload);
        window.setTimeout(() => {
          isApplyingBroadcastRef.current = false;
        }, 40);
      }
    };
    return () => {
      ch.close();
      broadcastChannelRef.current = null;
    };
  }, [applyIncomingAdminSync]);

  // Broadcast Hallenleiter-Sync in real-time to other tabs (BroadcastChannel) & all connected PeerJS players
  useEffect(() => {
    if (isApplyingRemoteAdminSyncRef.current) return;
    const payload = buildCurrentAdminSyncPayload();
    if (!isApplyingBroadcastRef.current && broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'admin-sync',
          payload,
        });
      } catch {
        // ignore
      }
    }
    const pkt: MultiplayerPacket = {
      type: 'admin-sync',
      payload,
    };
    if (mpRole === 'host') {
      hostConnectionsRef.current.forEach((conn) => {
        if (conn.open) {
          try {
            conn.send(pkt);
          } catch {
            // Ignore transient send error
          }
        }
      });
    } else if (mpRole === 'guest' && isAdminUnlocked) {
      // Admin with PIN has Regie priority even when connected as guest
      const conn = guestConnRef.current;
      if (conn && conn.open) {
        try {
          conn.send(pkt);
        } catch {
          // ignore
        }
      }
    }
  }, [mpRole, isAdminUnlocked, buildCurrentAdminSyncPayload]);

  const cleanupPeerSession = useCallback(() => {
    hostConnectionsRef.current.forEach((c) => {
      try {
        c.close();
      } catch {
        // ignore
      }
    });
    hostConnectionsRef.current.clear();
    hostGuestsStateRef.current.clear();
    hostGuestHeartbeatRef.current.clear();
    if (guestConnRef.current) {
      try {
        guestConnRef.current.close();
      } catch {
        // ignore
      }
      guestConnRef.current = null;
    }
    if (peerInstanceRef.current) {
      try {
        peerInstanceRef.current.destroy();
      } catch {
        // ignore
      }
      peerInstanceRef.current = null;
    }
    setRemotePlayers([]);
  }, []);

  useEffect(() => {
    return () => {
      cleanupPeerSession();
    };
  }, [cleanupPeerSession]);

  // Forward declarations via refs so Host & Guest functions can mutually invoke each other for 24/7 auto-host & handover
  const openHostRoomRef = useRef<
    (
      customRoomId?: string,
      opts?: {
        silentAutoHost?: boolean;
        silentHandover?: boolean;
        chosenName?: string;
        chosenColor?: string;
        preservedPlayers?: MultiplayerPlayerState[];
      }
    ) => void
  >(() => {});
  const connectAsGuestRef = useRef<
    (
      roomIdToJoin: string,
      chosenName: string,
      chosenColor: string,
      chosenDrink?: FreeDrinkChoice,
      retryAttempt?: number
    ) => void
  >(() => {});

  const handleOpenHostRoom = useCallback(
    (
      customRoomId?: string,
      opts?: {
        silentAutoHost?: boolean;
        silentHandover?: boolean;
        chosenName?: string;
        chosenColor?: string;
        preservedPlayers?: MultiplayerPlayerState[];
      }
    ) => {
      cleanupPeerSession();
      const targetId = (customRoomId || 'palladium-hanau-89').trim();
      setMpStatus('connecting');
      if (!opts?.silentAutoHost && !opts?.silentHandover) {
        setMpNotice(`Starte Multiplayer-Raum „${targetId}“...`);
      }

      const effectiveName = (
        opts?.chosenName ||
        playerNameRef.current ||
        localSkaterSnapshotRef.current.name ||
        'Hallenleiter'
      ).trim();
      const effectiveColor =
        opts?.chosenColor || playerShirtColorRef.current || '#ff2a85';

      if (opts?.chosenName) {
        setPlayerName(effectiveName);
        setIsAnonymousGuest(false);
      }
      if (opts?.chosenColor) {
        setPlayerShirtColor(effectiveColor);
      }

      // Switch current tab directly into the hall (no second tab, no Doppelgänger clone)
      setHasOwnSkates(true);
      setIsCurtainOpen(true);
      setShowChronicleModal(false);
      setShowGuestJoinModal(false);
      setGuestJoinError(null);

      // Copy invite link immediately when Admin clicks "Multiplayer-Raum öffnen"
      if (
        typeof window !== 'undefined' &&
        !opts?.silentAutoHost &&
        !opts?.silentHandover
      ) {
        const base = `${window.location.origin}${window.location.pathname}`;
        const inviteUrl = `${base}?room=${encodeURIComponent(targetId)}`;
        try {
          window.history.replaceState(
            null,
            '',
            `?room=${encodeURIComponent(targetId)}`
          );
        } catch {
          // ignore
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard
            .writeText(inviteUrl)
            .then(() => {
              setInviteCopied(true);
              window.setTimeout(() => setInviteCopied(false), 3000);
            })
            .catch(() => {
              // ignore
            });
        }
      }

      const peer = new Peer(targetId, PEER_ICE_CONFIG);
      peerInstanceRef.current = peer;

      peer.on('open', (id) => {
        isHandingOverHostRef.current = false;
        setMpRole('host');
        setMpRoomId(id);
        setMpStatus('connected');
        localSkaterSnapshotRef.current = {
          ...localSkaterSnapshotRef.current,
          peerId: id,
          tabSessionId: tabSessionIdRef.current,
          joinedAt: myJoinedAtRef.current,
          isAdmin: isAdminUnlockedRef.current,
          name: effectiveName,
          shirtColor: effectiveColor,
        };
        if (opts?.silentAutoHost) {
          soundFX.unlockAudioContext();
          soundFX.playCurtainReveal();
          setMpNotice(
            `🌐 24/7-Raum „${id}“ aktiv – du bist live in der Halle!`
          );
          showHallAnnouncement(
            `📻 Hallenfunk: ${effectiveName} hat den 24/7-Multiplayer-Raum betreten!`
          );
        } else if (opts?.silentHandover) {
          setMpNotice(
            `🌐 Host-Rolle für Raum „${id}“ nahtlos im Hintergrund übernommen.`
          );
        } else {
          setMpNotice(
            `🌐 Raum „${id}“ ist live & Einladungs-Link wurde kopiert!`
          );
        }
      });

      peer.on('disconnected', () => {
        // Auto-reconnect signaling on brief Safari/iOS network or tab switch
        if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
          try {
            peerInstanceRef.current.reconnect();
          } catch {
            // ignore
          }
        }
      });

      peer.on('connection', (conn) => {
        conn.on('data', (raw) => {
          const pkt = raw as MultiplayerPacket;
          if (!pkt || typeof pkt !== 'object') return;

          if (pkt.type === 'admin-takeover-request') {
            // An Admin with PIN wants to reclaim the primary Host ID ('palladium-hanau-89')
            applyIncomingAdminSync(pkt.adminSync);
            const takeoverRoomId = targetId;
            const currentGuests = Array.from(
              hostGuestsStateRef.current.values()
            );
            const handoverPkt: MultiplayerPacket = {
              type: 'host-handover',
              nextHostPeerId: 'admin-takeover',
              nextHostTabSessionId: pkt.adminTabSessionId,
              roomId: takeoverRoomId,
              adminSync: pkt.adminSync,
              players: currentGuests,
            };
            hostConnectionsRef.current.forEach((c) => {
              if (c.open) {
                try {
                  c.send(handoverPkt);
                } catch {
                  // ignore
                }
              }
            });
            isHandingOverHostRef.current = true;
            window.setTimeout(() => {
              cleanupPeerSession();
              setMpRole('guest');
              window.setTimeout(() => {
                connectAsGuestRef.current(
                  takeoverRoomId,
                  playerNameRef.current || effectiveName,
                  playerShirtColorRef.current || effectiveColor,
                  'combo',
                  0
                );
              }, 950);
            }, 150);
            return;
          }

          if (pkt.type === 'guest-leave') {
            hostConnectionsRef.current.delete(conn.peer);
            hostGuestsStateRef.current.delete(conn.peer);
            hostGuestHeartbeatRef.current.delete(conn.peer);
            if (pkt.tabSessionId) {
              hostGuestsStateRef.current.forEach((g, key) => {
                if (g.tabSessionId === pkt.tabSessionId) {
                  hostConnectionsRef.current.delete(key);
                  hostGuestsStateRef.current.delete(key);
                  hostGuestHeartbeatRef.current.delete(key);
                }
              });
            }
            const remaining = Array.from(hostGuestsStateRef.current.values());
            setRemotePlayers(remaining);
            const allPlayers: MultiplayerPlayerState[] = [
              {
                ...localSkaterSnapshotRef.current,
                peerId: peer.id || targetId,
                tabSessionId: tabSessionIdRef.current,
                joinedAt: myJoinedAtRef.current,
                isAdmin: isAdminUnlockedRef.current,
              },
              ...remaining,
            ];
            const worldPkt: MultiplayerPacket = {
              type: 'world-players',
              players: allPlayers,
              timestamp: Date.now(),
            };
            hostConnectionsRef.current.forEach((c) => {
              if (c.open) {
                try {
                  c.send(worldPkt);
                } catch {
                  // ignore
                }
              }
            });
            return;
          }

          if (pkt.type === 'heartbeat') {
            hostGuestHeartbeatRef.current.set(conn.peer, {
              lastSeen: Date.now(),
              isTabHidden: Boolean(pkt.isTabHidden),
              tabSessionId: pkt.tabSessionId,
            });
            const existing = hostGuestsStateRef.current.get(conn.peer);
            if (existing) {
              existing.lastSeenAt = Date.now();
              if (typeof pkt.isAdmin === 'boolean') {
                existing.isAdmin = pkt.isAdmin;
              }
            }
            return;
          }

          if (pkt.type === 'admin-sync') {
            // Admin connected as guest pushed a real-time Regie change -> apply & rebroadcast to all
            applyIncomingAdminSync(pkt.payload);
            hostConnectionsRef.current.forEach((c) => {
              if (c.open && c.peer !== conn.peer) {
                try {
                  c.send(pkt);
                } catch {
                  // ignore
                }
              }
            });
            return;
          }

          if (pkt.type === 'controller-pad') {
            remoteControllerInputRef.current.dx = pkt.dx || 0;
            remoteControllerInputRef.current.dy = pkt.dy || 0;
            if (pkt.jump) remoteControllerInputRef.current.jump = true;
            if (pkt.spin) remoteControllerInputRef.current.spin = true;
            if (pkt.interact) remoteControllerInputRef.current.interact = true;
            if (pkt.trickMove) {
              remoteControllerInputRef.current.trickMove = pkt.trickMove;
            }
            return;
          }

          if (pkt.type === 'guest-hello') {
            const incomingTabId =
              pkt.tabSessionId || pkt.state.tabSessionId || '';

            // Anti-Doppelgänger: If this is the exact same browser tab as the Host, ignore self-join
            if (incomingTabId && incomingTabId === tabSessionIdRef.current) {
              try {
                conn.close();
              } catch {
                // ignore
              }
              return;
            }

            // Anti-Doppelgänger: Remove any previous stale connection from the same tabSessionId (e.g. after reload)
            if (incomingTabId) {
              hostGuestsStateRef.current.forEach((existingGuest, peerKey) => {
                if (
                  peerKey !== conn.peer &&
                  existingGuest.tabSessionId === incomingTabId
                ) {
                  const oldConn = hostConnectionsRef.current.get(peerKey);
                  if (oldConn) {
                    try {
                      oldConn.close();
                    } catch {
                      // ignore
                    }
                  }
                  hostConnectionsRef.current.delete(peerKey);
                  hostGuestsStateRef.current.delete(peerKey);
                  hostGuestHeartbeatRef.current.delete(peerKey);
                }
              });
            }

            let requestedName = (pkt.state.name || '').trim();
            const requestedNorm = requestedName.toLowerCase();
            const hostNameNorm = (
              playerNameRef.current ||
              localSkaterSnapshotRef.current.name ||
              'Host'
            )
              .trim()
              .toLowerCase();

            // Check duplicate name against Host and all other connected guests (from different tabs)
            let isDuplicate =
              requestedNorm.length < 2 || requestedNorm === hostNameNorm;
            if (!isDuplicate) {
              hostGuestsStateRef.current.forEach((existingGuest, peerKey) => {
                if (
                  peerKey !== conn.peer &&
                  existingGuest.tabSessionId !== incomingTabId &&
                  (existingGuest.name || '').trim().toLowerCase() ===
                    requestedNorm
                ) {
                  isDuplicate = true;
                }
              });
            }

            // Admin with PIN always has join priority (never blocked)
            if (isDuplicate && pkt.isAdmin) {
              isDuplicate = false;
              if (requestedNorm === hostNameNorm) {
                requestedName = `${requestedName} (Regie)`;
              }
            }

            if (isDuplicate) {
              const rejectPkt: MultiplayerPacket = {
                type: 'join-rejected',
                reason:
                  'Dieser Skater-Name ist in der Halle bereits vergeben – bitte wähle einen anderen!',
              };
              try {
                conn.send(rejectPkt);
              } catch {
                // ignore
              }
              return;
            }

            // Accept Guest Join!
            const isNewPeer = !hostGuestsStateRef.current.has(conn.peer);
            hostConnectionsRef.current.set(conn.peer, conn);
            hostGuestHeartbeatRef.current.set(conn.peer, {
              lastSeen: Date.now(),
              isTabHidden: false,
              tabSessionId: incomingTabId,
            });
            const updatedGuest: MultiplayerPlayerState = {
              ...pkt.state,
              name: requestedName,
              peerId: conn.peer,
              tabSessionId: incomingTabId,
              joinedAt: pkt.joinedAt || pkt.state.joinedAt || Date.now(),
              lastSeenAt: Date.now(),
              isAdmin: Boolean(pkt.isAdmin || pkt.state.isAdmin),
            };
            hostGuestsStateRef.current.set(conn.peer, updatedGuest);
            setRemotePlayers(
              Array.from(hostGuestsStateRef.current.values()).filter(
                (pl) => pl.tabSessionId !== tabSessionIdRef.current
              )
            );
            if (isNewPeer) {
              setHallStats(recordSessionVisit());
            }

            const radioMsg = `📻 Hallenfunk: ${requestedName} ist live in die Halle gerollt!`;
            showHallAnnouncement(radioMsg);

            try {
              conn.send({
                type: 'join-accepted',
                welcomeAnnouncement: radioMsg,
              } as MultiplayerPacket);
              conn.send({
                type: 'admin-sync',
                payload: adminSyncPayloadRef.current,
              } as MultiplayerPacket);

              const allPlayers: MultiplayerPlayerState[] = [
                {
                  ...localSkaterSnapshotRef.current,
                  peerId: peer.id || targetId,
                  tabSessionId: tabSessionIdRef.current,
                  joinedAt: myJoinedAtRef.current,
                  isAdmin: isAdminUnlockedRef.current,
                },
                ...Array.from(hostGuestsStateRef.current.values()),
              ];
              const worldPkt: MultiplayerPacket = {
                type: 'world-players',
                players: allPlayers,
                timestamp: Date.now(),
              };
              hostConnectionsRef.current.forEach((c) => {
                if (c.open) {
                  try {
                    c.send(worldPkt);
                    if (c.peer !== conn.peer) {
                      c.send({
                        type: 'hall-radio',
                        message: radioMsg,
                      } as MultiplayerPacket);
                    }
                  } catch {
                    // ignore
                  }
                }
              });
            } catch {
              // ignore
            }
          } else if (pkt.type === 'player-state') {
            if (!hostConnectionsRef.current.has(conn.peer)) return;
            const prevGuest = hostGuestsStateRef.current.get(conn.peer);
            const incomingTabId =
              pkt.state.tabSessionId || prevGuest?.tabSessionId || '';
            hostGuestHeartbeatRef.current.set(conn.peer, {
              lastSeen: Date.now(),
              isTabHidden: false,
              tabSessionId: incomingTabId,
            });
            const updatedGuest: MultiplayerPlayerState = {
              ...pkt.state,
              peerId: conn.peer,
              tabSessionId: incomingTabId,
              joinedAt:
                pkt.state.joinedAt || prevGuest?.joinedAt || Date.now(),
              lastSeenAt: Date.now(),
              isAdmin: Boolean(pkt.state.isAdmin ?? prevGuest?.isAdmin),
            };
            hostGuestsStateRef.current.set(conn.peer, updatedGuest);
            setRemotePlayers(
              Array.from(hostGuestsStateRef.current.values()).filter(
                (pl) => pl.tabSessionId !== tabSessionIdRef.current
              )
            );
          }
        });

        const handleDisconnect = () => {
          hostConnectionsRef.current.delete(conn.peer);
          hostGuestsStateRef.current.delete(conn.peer);
          hostGuestHeartbeatRef.current.delete(conn.peer);
          setRemotePlayers(
            Array.from(hostGuestsStateRef.current.values()).filter(
              (pl) => pl.tabSessionId !== tabSessionIdRef.current
            )
          );
        };

        conn.on('close', handleDisconnect);
        conn.on('error', handleDisconnect);
      });

      peer.on('error', (err: { type?: string }) => {
        if (err?.type === 'unavailable-id') {
          // Room ID is already held by an active Host on PeerJS
          if (isAdminUnlockedRef.current) {
            // Admin with PIN has priority: connect to existing substitute Host and request seamless Host takeover
            cleanupPeerSession();
            const tempPeer = new Peer(PEER_ICE_CONFIG);
            peerInstanceRef.current = tempPeer;
            tempPeer.on('open', () => {
              const claimConn = tempPeer.connect(targetId, { reliable: true });
              claimConn.on('open', () => {
                try {
                  claimConn.send({
                    type: 'admin-takeover-request',
                    adminTabSessionId: tabSessionIdRef.current,
                    adminSync: adminSyncPayloadRef.current,
                  } as MultiplayerPacket);
                } catch {
                  // ignore
                }
                window.setTimeout(() => {
                  openHostRoomRef.current(targetId, { silentHandover: true });
                }, 480);
              });
              claimConn.on('error', () => {
                connectAsGuestRef.current(
                  targetId,
                  effectiveName,
                  effectiveColor,
                  'combo',
                  0
                );
              });
            });
            return;
          }
          // Non-admin collided on auto-host promotion -> join the now-existing Host as guest
          connectAsGuestRef.current(
            targetId,
            effectiveName,
            effectiveColor,
            'combo',
            0
          );
          return;
        }
        setMpStatus('error');
        setMpNotice(
          '⚠️ Verbindungsfehler. Hinweis: Falls ein strenger Adblocker oder Safari Tracking-Schutz aktiv ist, bitte WebRTC für diese Seite erlauben.'
        );
      });
    },
    [applyIncomingAdminSync, cleanupPeerSession, showHallAnnouncement]
  );

  useEffect(() => {
    openHostRoomRef.current = handleOpenHostRoom;
  }, [handleOpenHostRoom]);

  const handleCloseHostRoom = useCallback(() => {
    const closePkt: MultiplayerPacket = { type: 'room-closed' };
    hostConnectionsRef.current.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(closePkt);
        } catch {
          // ignore
        }
      }
    });
    window.setTimeout(() => {
      cleanupPeerSession();
      setMpRole('solo');
      setMpRoomId(null);
      setMpStatus('idle');
      setMpNotice('Multiplayer-Raum geschlossen. KI-Skater sind wieder aktiv.');
    }, 80);
  }, [cleanupPeerSession]);

  const handleKickGuest = useCallback((guestPeerId: string) => {
    const conn = hostConnectionsRef.current.get(guestPeerId);
    if (conn) {
      try {
        const kickPkt: MultiplayerPacket = {
          type: 'kicked',
          reason: 'Vom Hallenleiter aus dem Raum entfernt.',
        };
        conn.send(kickPkt);
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        try {
          conn.close();
        } catch {
          // ignore
        }
      }, 60);
    }
    hostConnectionsRef.current.delete(guestPeerId);
    hostGuestsStateRef.current.delete(guestPeerId);
    hostGuestHeartbeatRef.current.delete(guestPeerId);
    setRemotePlayers(Array.from(hostGuestsStateRef.current.values()));
  }, []);

  // Elect the most senior remaining player (Admin with PIN first, otherwise lowest joinedAt timestamp) when Host leaves
  const electAndMigrateHost = useCallback(
    (
      roomId: string,
      explicitNextTabId?: string,
      explicitNextPeerId?: string,
      latestSync?: AdminSyncPayload
    ) => {
      if (isHandingOverHostRef.current) return;
      isHandingOverHostRef.current = true;

      if (latestSync) {
        applyIncomingAdminSync(latestSync);
      }

      const myPeerId =
        peerInstanceRef.current?.id || localSkaterSnapshotRef.current.peerId;
      const myTabId = tabSessionIdRef.current;

      let shouldIBecomeHost = false;
      if (explicitNextTabId && explicitNextTabId === myTabId) {
        shouldIBecomeHost = true;
      } else if (explicitNextPeerId && explicitNextPeerId === myPeerId) {
        shouldIBecomeHost = true;
      } else if (!explicitNextTabId && !explicitNextPeerId) {
        // Deterministic election across all remaining players (excluding the departed host whose peerId === roomId)
        const candidates: MultiplayerPlayerState[] = [
          {
            ...localSkaterSnapshotRef.current,
            peerId: myPeerId,
            tabSessionId: myTabId,
            joinedAt: myJoinedAtRef.current,
            isAdmin: isAdminUnlockedRef.current,
          },
          ...remotePlayersRef.current.filter((p) => p.peerId !== roomId),
        ];
        candidates.sort((a, b) => {
          if (Boolean(a.isAdmin) !== Boolean(b.isAdmin)) {
            return a.isAdmin ? -1 : 1;
          }
          const ja = a.joinedAt || Number.MAX_SAFE_INTEGER;
          const jb = b.joinedAt || Number.MAX_SAFE_INTEGER;
          if (ja !== jb) return ja - jb;
          return (a.tabSessionId || a.peerId).localeCompare(
            b.tabSessionId || b.peerId
          );
        });
        const winner = candidates[0];
        if (
          winner &&
          (winner.tabSessionId === myTabId || winner.peerId === myPeerId)
        ) {
          shouldIBecomeHost = true;
        }
      }

      const currentName =
        playerNameRef.current ||
        localSkaterSnapshotRef.current.name ||
        'Skater';
      const currentColor =
        playerShirtColorRef.current ||
        localSkaterSnapshotRef.current.shirtColor ||
        '#ff2a85';

      if (shouldIBecomeHost) {
        window.setTimeout(() => {
          openHostRoomRef.current(roomId, {
            silentHandover: true,
            chosenName: currentName,
            chosenColor: currentColor,
          });
        }, 220);
      } else {
        window.setTimeout(() => {
          isHandingOverHostRef.current = false;
          connectAsGuestRef.current(
            roomId,
            currentName,
            currentColor,
            'combo',
            0
          );
        }, 1100);
      }
    },
    [applyIncomingAdminSync]
  );

  const handleConnectAsGuest = useCallback(
    (
      roomIdToJoin: string,
      chosenName: string,
      chosenColor: string,
      chosenDrink: FreeDrinkChoice = 'combo',
      retryAttempt = 0
    ) => {
      const cleanRoomId = roomIdToJoin.trim();
      const cleanName = chosenName.trim();
      if (cleanName.length < 2) {
        setGuestJoinError(
          'Bitte gib mindestens 2 Zeichen für deinen Skater-Namen ein!'
        );
        return;
      }
      setGuestJoinError(null);
      cleanupPeerSession();
      setMpStatus('connecting');
      setMpNotice(
        retryAttempt > 0
          ? `Verbindungs-Retry (${retryAttempt}/2) mit Raum „${cleanRoomId}“...`
          : `Verbinde mit Raum „${cleanRoomId}“...`
      );

      let settled = false;
      const peer = new Peer(PEER_ICE_CONFIG);
      peerInstanceRef.current = peer;

      // If signaling or WebRTC connection doesn't complete within 5.5s, auto-promote to 24/7 Host or retry
      const handshakeTimeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        if (retryAttempt < 1) {
          handleConnectAsGuest(
            cleanRoomId,
            cleanName,
            chosenColor,
            chosenDrink,
            retryAttempt + 1
          );
        } else {
          // No active host responded -> take over 24/7 Room Host role automatically in background!
          openHostRoomRef.current(cleanRoomId, {
            silentAutoHost: true,
            chosenName: cleanName,
            chosenColor,
          });
        }
      }, 5500);

      peer.on('open', (myPeerId) => {
        localSkaterSnapshotRef.current = {
          ...localSkaterSnapshotRef.current,
          peerId: myPeerId,
          tabSessionId: tabSessionIdRef.current,
          joinedAt: myJoinedAtRef.current,
          isAdmin: isAdminUnlockedRef.current,
          name: cleanName,
          shirtColor: chosenColor,
        };

        const conn = peer.connect(cleanRoomId, {
          reliable: true,
        });
        guestConnRef.current = conn;

        conn.on('open', () => {
          lastHostPacketAtRef.current = Date.now();
          const helloPkt: MultiplayerPacket = {
            type: 'guest-hello',
            freeDrinkChoice: chosenDrink,
            tabSessionId: tabSessionIdRef.current,
            joinedAt: myJoinedAtRef.current,
            isAdmin: isAdminUnlockedRef.current,
            state: {
              ...localSkaterSnapshotRef.current,
              peerId: myPeerId,
              tabSessionId: tabSessionIdRef.current,
              joinedAt: myJoinedAtRef.current,
              isAdmin: isAdminUnlockedRef.current,
              name: cleanName,
              shirtColor: chosenColor,
            },
          };
          try {
            conn.send(helloPkt);
          } catch {
            // ignore
          }
        });

        conn.on('data', (raw) => {
          const pkt = raw as MultiplayerPacket;
          if (!pkt || typeof pkt !== 'object') return;
          lastHostPacketAtRef.current = Date.now();

          if (pkt.type === 'join-rejected') {
            settled = true;
            window.clearTimeout(handshakeTimeout);
            setGuestJoinError(
              pkt.reason ||
                'Dieser Skater-Name ist in der Halle bereits vergeben – bitte wähle einen anderen!'
            );
            setMpStatus('error');
            setMpRole('solo');
            cleanupPeerSession();
            return;
          }

          if (pkt.type === 'join-accepted') {
            settled = true;
            window.clearTimeout(handshakeTimeout);
            isHandingOverHostRef.current = false;
            soundFX.unlockAudioContext();
            soundFX.playCurtainReveal();
            setPlayerName(cleanName);
            setIsAnonymousGuest(false);
            setPlayerShirtColor(chosenColor);
            setFreeDrinkChoice(chosenDrink);
            setHasOwnSkates(true);
            setIsCurtainOpen(true);
            setShowChronicleModal(false);
            setShowGuestJoinModal(false);
            setGuestJoinError(null);
            setMpRole('guest');
            setMpRoomId(cleanRoomId);
            setMpStatus('connected');
            setMpNotice(`🌐 Live verbunden mit Raum „${cleanRoomId}“!`);
            if (pkt.welcomeAnnouncement) {
              showHallAnnouncement(pkt.welcomeAnnouncement);
            }
            return;
          }

          if (pkt.type === 'host-handover') {
            settled = true;
            window.clearTimeout(handshakeTimeout);
            if (pkt.nextHostPeerId === 'admin-takeover') {
              // Admin reclaimed Host -> reconnect as guest after brief delay
              applyIncomingAdminSync(pkt.adminSync);
              window.setTimeout(() => {
                connectAsGuestRef.current(
                  pkt.roomId || cleanRoomId,
                  cleanName,
                  chosenColor,
                  chosenDrink,
                  0
                );
              }, 900);
              return;
            }
            electAndMigrateHost(
              pkt.roomId || cleanRoomId,
              pkt.nextHostTabSessionId,
              pkt.nextHostPeerId,
              pkt.adminSync
            );
            return;
          }

          if (pkt.type === 'hall-radio' && pkt.message) {
            showHallAnnouncement(pkt.message);
            return;
          }

          if (pkt.type === 'world-players') {
            const others = (pkt.players || []).filter(
              (pl) =>
                pl.peerId !== myPeerId &&
                (!pl.tabSessionId || pl.tabSessionId !== tabSessionIdRef.current)
            );
            setRemotePlayers(others);
          } else if (pkt.type === 'admin-sync') {
            applyIncomingAdminSync(pkt.payload);
          } else if (pkt.type === 'kicked') {
            settled = true;
            window.clearTimeout(handshakeTimeout);
            cleanupPeerSession();
            setMpRole('solo');
            setMpStatus('idle');
            setMpNotice(
              '🛑 Du wurdest vom Hallenleiter aus dem Multiplayer-Raum entfernt.'
            );
          } else if (pkt.type === 'room-closed') {
            settled = true;
            window.clearTimeout(handshakeTimeout);
            cleanupPeerSession();
            setMpRole('solo');
            setMpStatus('idle');
            setMpNotice(
              'ℹ️ Der Hallenleiter hat den Multiplayer-Raum geschlossen (Solo-Modus aktiv).'
            );
          }
        });

        conn.on('close', () => {
          window.clearTimeout(handshakeTimeout);
          // Do not disconnect on brief Safari/iOS background tab switch
          if (isTabHiddenRef.current) return;
          if (mpRoleRef.current === 'guest') {
            electAndMigrateHost(cleanRoomId);
          }
        });

        conn.on('error', () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(handshakeTimeout);
          if (retryAttempt < 1) {
            handleConnectAsGuest(
              cleanRoomId,
              cleanName,
              chosenColor,
              chosenDrink,
              retryAttempt + 1
            );
          } else {
            openHostRoomRef.current(cleanRoomId, {
              silentAutoHost: true,
              chosenName: cleanName,
              chosenColor,
            });
          }
        });
      });

      peer.on('disconnected', () => {
        if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
          try {
            peerInstanceRef.current.reconnect();
          } catch {
            // ignore
          }
        }
      });

      peer.on('error', (err: { type?: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(handshakeTimeout);

        // 24/7 Room: If Host is absent ('peer-unavailable'), visitor automatically takes over Host role in background!
        if (err?.type === 'peer-unavailable') {
          openHostRoomRef.current(cleanRoomId, {
            silentAutoHost: true,
            chosenName: cleanName,
            chosenColor,
          });
          return;
        }

        if (retryAttempt < 2) {
          window.setTimeout(() => {
            handleConnectAsGuest(
              cleanRoomId,
              cleanName,
              chosenColor,
              chosenDrink,
              retryAttempt + 1
            );
          }, 600);
          return;
        }

        setMpStatus('error');
        setGuestJoinError(
          `Raum „${cleanRoomId}“ konnte nicht erreicht werden. Hinweis: Falls du Safari/iOS oder einen strengen Adblocker / Tracking-Schutz (z. B. Brave Shield, uBlock, Firewall) nutzt, deaktiviere bitte den Schutz für diese Seite, damit WebRTC-Verbindungen zugelassen werden.`
        );
        setMpRole('solo');
      });
    },
    [
      applyIncomingAdminSync,
      cleanupPeerSession,
      electAndMigrateHost,
      showHallAnnouncement,
    ]
  );

  useEffect(() => {
    connectAsGuestRef.current = handleConnectAsGuest;
  }, [handleConnectAsGuest]);

  // 5s Heartbeat, Stale Avatar Cleanup, Safari/iOS visibilitychange protection & beforeunload Host-Handover / Leave
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (mpRoleRef.current === 'host') {
        let removedAny = false;
        hostGuestHeartbeatRef.current.forEach((info, peerKey) => {
          // 5s timeout for active/closed tabs; 35s grace window if Safari/iOS tab is briefly backgrounded
          const timeoutMs = info.isTabHidden ? 35000 : 5000;
          if (now - info.lastSeen > timeoutMs) {
            const staleConn = hostConnectionsRef.current.get(peerKey);
            if (staleConn) {
              try {
                staleConn.close();
              } catch {
                // ignore
              }
            }
            hostConnectionsRef.current.delete(peerKey);
            hostGuestsStateRef.current.delete(peerKey);
            hostGuestHeartbeatRef.current.delete(peerKey);
            removedAny = true;
          }
        });

        const guests = Array.from(hostGuestsStateRef.current.values()).filter(
          (pl) => pl.tabSessionId !== tabSessionIdRef.current
        );
        if (removedAny) {
          setRemotePlayers(guests);
        }

        const hostId = peerInstanceRef.current?.id || mpRoomIdRef.current || 'local';
        const allPlayers: MultiplayerPlayerState[] = [
          {
            ...localSkaterSnapshotRef.current,
            peerId: hostId,
            tabSessionId: tabSessionIdRef.current,
            joinedAt: myJoinedAtRef.current,
            isAdmin: isAdminUnlockedRef.current,
          },
          ...guests,
        ];
        const worldPkt: MultiplayerPacket = {
          type: 'world-players',
          players: allPlayers,
          timestamp: now,
        };
        hostConnectionsRef.current.forEach((conn) => {
          if (conn.open) {
            try {
              conn.send(worldPkt);
            } catch {
              // ignore
            }
          }
        });
      } else if (mpRoleRef.current === 'guest') {
        const conn = guestConnRef.current;
        if (conn && conn.open) {
          try {
            conn.send({
              type: 'heartbeat',
              tabSessionId: tabSessionIdRef.current,
              timestamp: now,
              isTabHidden: isTabHiddenRef.current,
              isAdmin: isAdminUnlockedRef.current,
            } as MultiplayerPacket);
          } catch {
            // ignore
          }
        }
        // If Host hasn't sent a packet for > 5s while tab is visible -> automatic Host handover!
        if (
          !isTabHiddenRef.current &&
          !isHandingOverHostRef.current &&
          now - lastHostPacketAtRef.current > 5200 &&
          mpRoomIdRef.current
        ) {
          electAndMigrateHost(mpRoomIdRef.current);
        }
      }
    }, 1500);

    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      isTabHiddenRef.current = hidden;
      if (!hidden) {
        lastHostPacketAtRef.current = Date.now();
        if (
          peerInstanceRef.current &&
          peerInstanceRef.current.disconnected &&
          !peerInstanceRef.current.destroyed
        ) {
          try {
            peerInstanceRef.current.reconnect();
          } catch {
            // ignore
          }
        }
        if (
          mpRoleRef.current === 'guest' &&
          (!guestConnRef.current || !guestConnRef.current.open) &&
          mpRoomIdRef.current
        ) {
          connectAsGuestRef.current(
            mpRoomIdRef.current,
            playerNameRef.current || 'Skater',
            playerShirtColorRef.current || '#ff2a85',
            'combo',
            0
          );
        }
      } else if (mpRoleRef.current === 'guest' && guestConnRef.current?.open) {
        try {
          guestConnRef.current.send({
            type: 'heartbeat',
            tabSessionId: tabSessionIdRef.current,
            timestamp: Date.now(),
            isTabHidden: true,
            isAdmin: isAdminUnlockedRef.current,
          } as MultiplayerPacket);
        } catch {
          // ignore
        }
      }
    };

    const handleUnload = () => {
      if (mpRoleRef.current === 'guest' && guestConnRef.current?.open) {
        try {
          guestConnRef.current.send({
            type: 'guest-leave',
            peerId: peerInstanceRef.current?.id || 'local',
            tabSessionId: tabSessionIdRef.current,
          } as MultiplayerPacket);
          guestConnRef.current.close();
        } catch {
          // ignore
        }
      } else if (mpRoleRef.current === 'host') {
        const guests = Array.from(hostGuestsStateRef.current.values());
        if (guests.length > 0) {
          const sorted = [...guests].sort((a, b) => {
            if (Boolean(a.isAdmin) !== Boolean(b.isAdmin)) {
              return a.isAdmin ? -1 : 1;
            }
            return (
              (a.joinedAt || Number.MAX_SAFE_INTEGER) -
              (b.joinedAt || Number.MAX_SAFE_INTEGER)
            );
          });
          const eldest = sorted[0];
          const handoverPkt: MultiplayerPacket = {
            type: 'host-handover',
            nextHostPeerId: eldest.peerId,
            nextHostTabSessionId: eldest.tabSessionId,
            roomId: mpRoomIdRef.current || 'palladium-hanau-89',
            adminSync: adminSyncPayloadRef.current,
            players: guests,
          };
          hostConnectionsRef.current.forEach((c) => {
            if (c.open) {
              try {
                c.send(handoverPkt);
              } catch {
                // ignore
              }
            }
          });
        }
      }
      if (peerInstanceRef.current) {
        try {
          peerInstanceRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [electAndMigrateHost]);

  // Called ~18x per second (every 55ms) by RollerArenaEngine when in Multiplayer
  const handleLocalMultiplayerState = useCallback(
    (stateNoId: Omit<MultiplayerPlayerState, 'peerId'>) => {
      const myPeerId = peerInstanceRef.current?.id || 'local';
      const fullState: MultiplayerPlayerState = {
        ...stateNoId,
        peerId: myPeerId,
        tabSessionId: tabSessionIdRef.current,
        joinedAt: myJoinedAtRef.current,
        isAdmin: isAdminUnlockedRef.current,
      };
      localSkaterSnapshotRef.current = fullState;

      if (mpRole === 'host') {
        const guests = Array.from(hostGuestsStateRef.current.values()).filter(
          (pl) => pl.tabSessionId !== tabSessionIdRef.current
        );
        const allPlayers: MultiplayerPlayerState[] = [fullState, ...guests];
        const worldPkt: MultiplayerPacket = {
          type: 'world-players',
          players: allPlayers,
          timestamp: Date.now(),
        };
        hostConnectionsRef.current.forEach((conn) => {
          if (conn.open) {
            try {
              conn.send(worldPkt);
            } catch {
              // ignore
            }
          }
        });
      } else if (mpRole === 'guest') {
        const conn = guestConnRef.current;
        if (conn && conn.open) {
          const statePkt: MultiplayerPacket = {
            type: 'player-state',
            state: fullState,
          };
          try {
            conn.send(statePkt);
          } catch {
            // ignore
          }
        }
      }
    },
    [mpRole]
  );

  const inviteRoomUrl = useMemo(() => {
    if (typeof window === 'undefined' || !mpRoomId) return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?room=${encodeURIComponent(mpRoomId)}`;
  }, [mpRoomId]);

  const handleIntroStepComplete = useCallback((stepId: IntroStepId) => {
    const current = introTourRef.current;
    if (current[stepId]) return;

    const nextTour: IntroTourState = {
      ...current,
      [stepId]: true,
    };
    const allDone = isIntroTourComplete(nextTour);
    const claimBonusNow = allDone && !current.bonusClaimed;
    if (claimBonusNow) {
      nextTour.bonusClaimed = true;
    }

    introTourRef.current = nextTour;
    setIntroTour(nextTour);
    saveIntroTourState(nextTour);
    soundFX.playChallengeUnlocked();

    if (stepId === 'fetch_drink') {
      setLockerSettings((prev) => ({
        ...prev,
        drinksInLocker: Math.min(9, (prev.drinksInLocker || 0) + 1),
      }));
    }

    if (claimBonusNow) {
      setLockerSettings((prev) => ({
        ...prev,
        vipDiscoSkatesEquipped: true,
      }));
      const msg =
        '🎉 Einführung komplett! +20 Bonus-Punkte & VIP Disco-Rollschuhe!';
      setIntroBannerText(msg);
      window.setTimeout(() => {
        setIntroBannerText((curr) => (curr === msg ? null : curr));
      }, 4200);
    } else {
      const msg = '✅ Aufgabe erledigt! +20 Punkte';
      setIntroBannerText(msg);
      window.setTimeout(() => {
        setIntroBannerText((curr) => (curr === msg ? null : curr));
      }, 2600);
    }
  }, []);

  const handleDrinkFromLocker = useCallback(() => {
    setLockerSettings((prev) => {
      if ((prev.drinksInLocker || 0) <= 0) return prev;
      return {
        ...prev,
        drinksInLocker: prev.drinksInLocker - 1,
      };
    });
    setLockerDrinkBoostTrigger((c) => c + 1);
  }, []);

  const handleChallengeProgress = useCallback(
    (id: ChallengeId, amount: number, isAbsolute = false) => {
      // Other challenges are locked and only count after the 4-step introduction is completed
      if (!isIntroTourComplete(introTourRef.current)) return;

      setChallengesProgress((prev) => {
        const def = PALLADIUM_CHALLENGES.find((c) => c.id === id);
        if (!def) return prev;
        const current = prev[id] || { progress: 0, completed: false };
        if (current.completed) return prev;

        const nextProgress = isAbsolute
          ? Math.max(current.progress, amount)
          : current.progress + amount;
        const completed = nextProgress >= def.target;

        const updatedMap: ChallengeProgressMap = {
          ...prev,
          [id]: {
            progress: Math.min(def.target, Math.round(nextProgress * 10) / 10),
            completed,
          },
        };
        saveChallengesProgress(updatedMap);

        if (completed && !current.completed) {
          soundFX.playChallengeUnlocked();
          setUnlockedToast(def);
          window.setTimeout(() => {
            setUnlockedToast((curr) => (curr?.id === def.id ? null : curr));
          }, 5500);

          // Automatically activate unlocked upgrade & 80s trick move in Pro-Shop
          setUpgrades((uPrev) => {
            const nextU: ProShopUpgradesState = {
              ...uPrev,
              unlockedMoves: { ...uPrev.unlockedMoves },
            };
            if (id === 'warmup_spins') {
              nextU.underglowEnabled = true;
              nextU.underglowColor = 'cyan';
              nextU.wristbandsEnabled = true;
              nextU.wristbandColor = 'cyan';
            } else if (id === 'endurance_20_laps') {
              nextU.bearingsAbec9 = true;
              nextU.unlockedMoves.spin360 = true;
            } else if (id === 'bistro_drink') {
              nextU.highGripWheels = true;
              nextU.unlockedMoves.backward = true;
            } else if (id === 'slipstream_10s') {
              nextU.aluPlatesHighTop = true;
              nextU.unlockedMoves.flamingo = true;
            } else if (id === 'chair_jump_3') {
              nextU.aluPlatesHighTop = true;
              nextU.unlockedMoves.starjump = true;
            } else if (id === 'mirror_spin') {
              nextU.underglowEnabled = true;
              nextU.underglowColor = 'gold';
              nextU.wristbandsEnabled = true;
              nextU.wristbandColor = 'gold';
            }
            return nextU;
          });
        }

        return updatedMap;
      });
    },
    []
  );

  const completedChallengesCount = useMemo(() => {
    return PALLADIUM_CHALLENGES.filter(
      (c) => challengesProgress[c.id]?.completed
    ).length;
  }, [challengesProgress]);

  const isTruePalladiumaner =
    completedChallengesCount === PALLADIUM_CHALLENGES.length;

  // Check if individual Pro-Shop upgrades & 80s Trick Moves are unlocked
  const isPinkCyanUnlocked = Boolean(
    challengesProgress['warmup_spins']?.completed
  );
  const isGreenGoldUnlocked = Boolean(
    challengesProgress['mirror_spin']?.completed
  );
  const isAbec9Unlocked = Boolean(
    challengesProgress['endurance_20_laps']?.completed
  );
  const isHighGripUnlocked = Boolean(
    challengesProgress['bistro_drink']?.completed
  );
  const isAluPlatesUnlocked = Boolean(
    challengesProgress['slipstream_10s']?.completed ||
      challengesProgress['chair_jump_3']?.completed
  );

  const isMoveSpin360Unlocked =
    Boolean(upgrades.unlockedMoves?.spin360) || isAbec9Unlocked;
  const isMoveBackwardUnlocked =
    Boolean(upgrades.unlockedMoves?.backward) || isHighGripUnlocked;
  const isMoveFlamingoUnlocked =
    Boolean(upgrades.unlockedMoves?.flamingo) ||
    Boolean(challengesProgress['slipstream_10s']?.completed);
  const isMoveStarjumpUnlocked =
    Boolean(upgrades.unlockedMoves?.starjump) ||
    Boolean(challengesProgress['chair_jump_3']?.completed);

  const handleUnlockAllProShopForTesting = () => {
    const allDone = {} as ChallengeProgressMap;
    for (const ch of PALLADIUM_CHALLENGES) {
      allDone[ch.id] = { progress: ch.target, completed: true };
    }
    setChallengesProgress(allDone);
    saveChallengesProgress(allDone);
    setUpgrades({
      bearingsAbec9: true,
      highGripWheels: true,
      aluPlatesHighTop: true,
      underglowEnabled: true,
      underglowColor: 'pink',
      wristbandsEnabled: true,
      wristbandColor: 'pink',
      unlockedMoves: {
        spin360: true,
        backward: true,
        flamingo: true,
        starjump: true,
      },
      unlockedCharms: {
        bell: true,
        teddy: true,
        pompons: true,
        dice: true,
      },
      activeCharm: upgrades.activeCharm || 'bell',
      bonusPoints: (upgrades.bonusPoints || 0) + 5000,
    });
    soundFX.playChallengeUnlocked();
  };

  // Player Points for Pro-Shop Category 6 ("80er-Rollschuh-Anhänger")
  const totalEarnedPoints = useMemo(() => {
    const baseWelcomePts = 600;
    const lapPts = Math.max(hallStats.bestLapRecord, telemetry.laps) * 120;
    const challengePts = completedChallengesCount * 350;
    const gamePts =
      telemetry.ballspielScore * 15 + telemetry.slalomCombo * 80;
    const stampPts = stampCard.stamps * 100;
    const bonusPts = upgrades.bonusPoints || 0;
    const introCompletedStepsCount =
      (introTour.open_locker ? 1 : 0) +
      (introTour.fetch_drink ? 1 : 0) +
      (introTour.skate_rink ? 1 : 0) +
      (introTour.try_ballspiel ? 1 : 0);
    const introPts =
      introCompletedStepsCount * 20 + (introTour.bonusClaimed ? 20 : 0);
    return (
      baseWelcomePts +
      lapPts +
      challengePts +
      gamePts +
      stampPts +
      bonusPts +
      introPts
    );
  }, [
    completedChallengesCount,
    hallStats.bestLapRecord,
    introTour,
    stampCard.stamps,
    telemetry.ballspielScore,
    telemetry.laps,
    telemetry.slalomCombo,
    upgrades.bonusPoints,
  ]);

  const availableProShopPoints = Math.max(
    0,
    totalEarnedPoints - (upgrades.spentPoints || 0)
  );
  const hasFreeProShopStampReward =
    stampCard.freeProShopVoucherAvailable || stampCard.stamps >= 10;

  const handleBuyOrEquipCharm = (
    charmId: SkateCharmId,
    cost: number,
    useStampVoucher = false
  ) => {
    const isUnlocked = Boolean(upgrades.unlockedCharms?.[charmId]);
    if (isUnlocked) {
      const nextCharm = upgrades.activeCharm === charmId ? null : charmId;
      setUpgrades((u) => ({
        ...u,
        activeCharm: nextCharm,
      }));
      if (nextCharm === 'bell') {
        soundFX.playSkateBellJingle();
      } else {
        soundFX.playChallengeUnlocked();
      }
      return;
    }

    if (useStampVoucher && hasFreeProShopStampReward) {
      const nextCard: StampCardData = {
        ...stampCard,
        stamps: 1,
        freeProShopVoucherAvailable: false,
        completedCardsCount: (stampCard.completedCardsCount || 0) + 1,
      };
      setStampCard(nextCard);
      saveStampCard(nextCard);
      setUpgrades((u) => ({
        ...u,
        unlockedCharms: {
          bell: Boolean(u.unlockedCharms?.bell),
          teddy: Boolean(u.unlockedCharms?.teddy),
          pompons: Boolean(u.unlockedCharms?.pompons),
          dice: Boolean(u.unlockedCharms?.dice),
          [charmId]: true,
        },
        activeCharm: charmId,
      }));
      if (charmId === 'bell') soundFX.playSkateBellJingle();
      else soundFX.playChallengeUnlocked();
      return;
    }

    if (availableProShopPoints < cost) return;
    setUpgrades((u) => ({
      ...u,
      spentPoints: (u.spentPoints || 0) + cost,
      unlockedCharms: {
        bell: Boolean(u.unlockedCharms?.bell),
        teddy: Boolean(u.unlockedCharms?.teddy),
        pompons: Boolean(u.unlockedCharms?.pompons),
        dice: Boolean(u.unlockedCharms?.dice),
        [charmId]: true,
      },
      activeCharm: charmId,
    }));
    if (charmId === 'bell') soundFX.playSkateBellJingle();
    else soundFX.playChallengeUnlocked();
  };

  const handleTriggerDjSoundboard = useCallback(
    (effectId: DjSoundboardEffectId, label: string) => {
      soundFX.unlockAudioContext();
      soundFX.playDjSoundboardEffect(effectId);
      if (effectId === 'fog-hiss') {
        setFogBurstCount((c) => c + 1);
      }
      setExternalDjJingleBubble((prev) => ({
        text: `🎛️ DJ-SOUNDBOARD: ${label}!`,
        seq: (prev?.seq || 0) + 1,
      }));
    },
    []
  );

  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const visitsToday = hallStats.dailyCounts[todayDateStr] || 1;
  const peakHourText = useMemo(
    () => computePeakHourLabel(hallStats.hourlyHistogram),
    [hallStats.hourlyHistogram]
  );
  const activePlayersOnRink = remotePlayers.length + 1;

  const twitchParentHost =
    typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost';

  const isBlockedByMaintenance =
    adminSettings.isMaintenanceMode &&
    !isAdminUnlocked &&
    !hasUrlBackstageBypass;

  const publishedStyle: ArenaVisualStyle =
    adminSettings.liveArenaStyle || 'classic-neon';
  const previewStyle = adminPreviewStyle;
  const activeStyle: ArenaVisualStyle = previewStyle || publishedStyle;

  // Build YouTube embed URL if a YouTube video or playlist URL is configured
  const youtubeEmbedUrl = useMemo(() => {
    const raw = (adminSettings.youtubeUrl || '').trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      const listId = url.searchParams.get('list');
      let videoId = url.searchParams.get('v');
      if (!videoId && url.hostname.includes('youtu.be')) {
        videoId = url.pathname.replace('/', '').trim();
      }
      if (!videoId && url.pathname.includes('/embed/')) {
        videoId = url.pathname.split('/embed/')[1]?.split('/')[0] || null;
      }
      const muteParam = twitchMuted ? '1' : '0';
      if (listId && !videoId) {
        return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(
          listId
        )}&autoplay=1&mute=${muteParam}`;
      }
      if (videoId) {
        const listQuery = listId ? `&list=${encodeURIComponent(listId)}` : '';
        return `https://www.youtube.com/embed/${encodeURIComponent(
          videoId
        )}?autoplay=1&mute=${muteParam}${listQuery}`;
      }
      return null;
    } catch {
      return null;
    }
  }, [adminSettings.youtubeUrl, twitchMuted]);

  const handleTriggerDjJingle = useCallback((slot: DjJingleSlot) => {
    soundFX.unlockAudioContext();
    setActiveJingleSlotId(slot.id);
    setExternalDjJingleBubble((prev) => ({
      text: slot.bubbleText,
      seq: (prev?.seq || 0) + 1,
    }));
    soundFX.playDjJingleOrVoiceMemo(slot, () => {
      setActiveJingleSlotId((curr) => (curr === slot.id ? null : curr));
    });
  }, []);

  // Keep unlockedMoves in upgrades synced when challenge states unlock them
  const effectiveUpgrades = useMemo<ProShopUpgradesState>(
    () => ({
      ...upgrades,
      unlockedMoves: {
        spin360: isMoveSpin360Unlocked,
        backward: isMoveBackwardUnlocked,
        flamingo: isMoveFlamingoUnlocked,
        starjump: isMoveStarjumpUnlocked,
      },
    }),
    [
      upgrades,
      isMoveSpin360Unlocked,
      isMoveBackwardUnlocked,
      isMoveFlamingoUnlocked,
      isMoveStarjumpUnlocked,
    ]
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070A12] text-[#FFF8E7] select-none flex flex-col">
      {/* TOP RETRO HUD BAR (Full Widescreen Width) */}
      <header className="z-30 flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0B0E17]/95 border-b border-fuchsia-500/35 shadow-[0_4px_20px_rgba(0,0,0,0.65)] text-xs">
        {/* Left: Logo (3x click for Admin) + Version + Active Mode Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleLogoClick}
            title="Palladium Roller Arena Hanau (3x Klick oder Ctrl+Shift+A für Hallenleiter-Regie)"
            className="flex items-center gap-2 px-2.5 py-1 rounded bg-gradient-to-r from-fuchsia-950/90 via-indigo-950/90 to-slate-900 border border-fuchsia-400/50 hover:border-cyan-400 transition cursor-pointer"
          >
            <span className="font-display font-extrabold tracking-wider text-sm text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-amber-200 to-cyan-300">
              ✦ PALLADIUM HANAU &apos;86
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30">
              {APP_VERSION_LABEL}
            </span>
          </button>

          {/* Kompaktes Spind-Menü (SPINDE) Button für Spieler */}
          <button
            type="button"
            onClick={() => {
              handleIntroStepComplete('open_locker');
              setShowLockerModal((v) => !v);
            }}
            title="Mein Spind (SPINDE): Inventar, VIP Disco-Rollschuhe, Getränke & Anzeige-/Sound-Regler"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer text-[11px] font-mono transition ${
              showLockerModal || telemetry.nearLockers
                ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                : 'bg-slate-900/90 hover:bg-slate-800 border-cyan-500/50 text-cyan-200'
            }`}
          >
            <span>🗄️ Spind</span>
            {lockerSettings.vipDiscoSkatesEquipped && (
              <span className="text-amber-300 text-[10px]">🪩</span>
            )}
            {lockerSettings.drinksInLocker > 0 && (
              <span className="px-1 rounded bg-cyan-500/20 text-cyan-200 text-[10px]">
                🥤{lockerSettings.drinksInLocker}
              </span>
            )}
          </button>

          {/* Gamepad Active Badge */}
          {telemetry.gamepadConnected && (
            <span
              title={telemetry.gamepadName}
              className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 font-mono text-[11px] animate-pulse"
            >
              🎮 Pad aktiv
            </span>
          )}

          {/* Slipstream Active Indicator */}
          {telemetry.isSlipstreamActive && (
            <span className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/90 border border-cyan-400 text-cyan-200 font-mono font-bold text-[11px] shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              💨 Windschatten aktiv!
            </span>
          )}

          {/* Slow-Skating Announcement Badge in HUD */}
          {lightingMode === 'slow-skating' && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gradient-to-r from-amber-950/95 via-rose-950/95 to-fuchsia-950/95 border border-amber-300 text-amber-200 font-mono font-bold text-[11px] shadow-[0_0_14px_rgba(251,191,36,0.45)] animate-pulse">
              🪩 JETZT BEGINNT DAS SLOW-SKATING!
            </span>
          )}

          {/* Active Singleplayer Difficulty & Skate Status Badge */}
          <span
            title="Aktuelle Erfahrungsstufe & Rollschuh-Status (fixiert durch Eintrittsstempel)"
            className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-slate-200 font-mono text-[11px] flex items-center gap-1.5"
          >
            <span>
              {difficulty === 'beginner'
                ? '🟢 Anfänger'
                : difficulty === 'pro'
                ? '🔴 Profi'
                : '🟡 Fortgeschr.'}
            </span>
            <span className="text-slate-600">•</span>
            <span
              className={
                hasOwnSkates
                  ? 'text-emerald-300 font-bold'
                  : hasRentedSkates
                  ? 'text-sky-300 font-bold'
                  : 'text-amber-300 font-bold animate-pulse'
              }
            >
              {hasOwnSkates
                ? '🛼 Eigene Skates'
                : hasRentedSkates
                ? '🛼 Leih-Skates'
                : '👟 Straßenschuhe (Verleih [E])'}
            </span>
          </span>

          {/* Freigetränk-Chip Status */}
          {drinkChipAvailable && (
            <span
              title={
                hasOwnSkates
                  ? 'Dein Freigetränk-Chip kann an der Bistro-Theke [E] für ein extra Getränk eingelöst werden!'
                  : 'Tausche deinen Freigetränk-Chip am Rollschuh-Verleih [E] gegen 80er-Leih-Rollschuhe!'
              }
              className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400/80 text-amber-200 font-mono font-bold text-[11px] shadow-[0_0_10px_rgba(251,191,36,0.28)]"
            >
              🪙 1x Freigetränk-Chip
            </span>
          )}

          {/* Gratis Welcome Gift Vouchers in Inventory */}
          {(telemetry.freeSlushCount > 0 || telemetry.freeBlobaCount > 0) && (
            <span
              title="Willkommensgeschenk an der Kasse – einlösbar an der Bistro-Theke [E]"
              className="px-2 py-0.5 rounded bg-fuchsia-950/90 border border-amber-300/70 text-amber-200 font-mono text-[11px] shadow-[0_0_10px_rgba(251,191,36,0.25)]"
            >
              🎁 Gratis:{' '}
              {telemetry.freeSlushCount > 0 && (
                <span className="text-cyan-300 font-bold mr-1.5">
                  {telemetry.freeSlushCount}x Slush
                </span>
              )}
              {telemetry.freeBlobaCount > 0 && (
                <span className="text-amber-300 font-bold">
                  {telemetry.freeBlobaCount}x Bloba
                </span>
              )}
            </span>
          )}

          {/* Active Drink Timers */}
          {telemetry.slushTimerSec > 0 && (
            <span className="px-2 py-0.5 rounded bg-sky-950/90 border border-sky-400/60 text-sky-200 font-mono text-[11px]">
              🍧 Slush-Cool: {telemetry.slushTimerSec}s
            </span>
          )}
          {telemetry.blobaColaTimerSec > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400/60 text-amber-200 font-mono text-[11px]">
              🥤 Bloba-Kick: {telemetry.blobaColaTimerSec}s
            </span>
          )}

          {/* True Palladiumaner Gold Star Badge */}
          {isTruePalladiumaner && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-300 text-amber-200 font-mono font-bold text-[11px]">
              ★ Echter Palladiumaner
            </span>
          )}
        </div>

        {/* Center: Live Telemetry Counters (Laps, Speed, Crashes, Mode) */}
        <div className="hidden xl:flex items-center gap-3 font-mono text-xs bg-slate-950/90 px-3 py-1 rounded border border-slate-800">
          <div>
            <span className="text-slate-400 mr-1">RUNDEN:</span>
            <span className="text-cyan-300 font-bold">{telemetry.laps}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400 mr-1">TEMPO:</span>
            <span className="text-emerald-300 font-bold">
              {telemetry.speed.toFixed(1)} km/h
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            <span className="text-slate-400 mr-1">STÜRZE:</span>
            <span className="text-rose-400 font-bold">{telemetry.crashes}</span>
          </div>
          {hallGameMode === 'ballspiel' && (
            <>
              <span className="text-slate-700">|</span>
              <div className="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400/80 text-amber-200 font-bold shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                🏐 IM SPIEL: {telemetry.ballspielRemaining} /{' '}
                {telemetry.ballspielTotal}
              </div>
              <span className="text-slate-700">|</span>
              <div>
                <span className="text-amber-300 mr-1">TREFFER:</span>
                <span className="text-amber-200 font-bold">
                  {telemetry.ballspielScore}
                </span>
              </div>
            </>
          )}
          {hallGameMode === 'slalom' && (
            <>
              <span className="text-slate-700">|</span>
              <div>
                <span className="text-fuchsia-300 mr-1">SLALOM-COMBO:</span>
                <span className="text-fuchsia-200 font-bold">
                  {telemetry.slalomCombo}x
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Quick Action Buttons + Public Visitor Volume Slider */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowChronicleModal(true)}
            title="Hanauer Rollschuh-Chronik & Start-Einstellungen wieder einblenden"
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-400/60 text-amber-100 font-medium transition cursor-pointer"
          >
            📜 Chronik
          </button>

          <button
            type="button"
            onClick={() => setShowChallengesModal(true)}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/50 text-amber-200 font-medium transition cursor-pointer"
          >
            🏆 Aufgaben ({completedChallengesCount}/{PALLADIUM_CHALLENGES.length})
          </button>

          <button
            type="button"
            onClick={() => setShowHallGamesModal(true)}
            className={`px-2.5 py-1 rounded border font-medium transition cursor-pointer ${
              hallGameMode !== 'free-skate'
                ? 'bg-fuchsia-950/90 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_10px_rgba(232,121,249,0.4)]'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-cyan-200'
            }`}
          >
            🎮 Hallen-Spiele
          </button>

          <button
            type="button"
            onClick={() => setShowProShopModal(true)}
            className={`px-2.5 py-1 rounded border font-medium transition cursor-pointer ${
              telemetry.nearProShop || hasFreeProShopStampReward
                ? 'bg-cyan-950 border-cyan-400 text-cyan-200 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            🛠️ Pro-Shop
            {hasFreeProShopStampReward ? ' (🎁 Gratis!)' : ''}
          </button>

          {/* 10er-Stempelkarte Button in Top HUD */}
          <button
            type="button"
            onClick={() => setShowStampCardModal(true)}
            title="Digitale 10er-Stempelkarte (1x Start-Freigetränk nach Wahl + Gratis-Pro-Shop-Prämie bei 10/10)"
            className={`px-2.5 py-1 rounded border font-mono font-bold transition cursor-pointer ${
              hasFreeProShopStampReward
                ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.45)] animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 border-amber-400/50 text-amber-200'
            }`}
          >
            🎫 Stempel: {stampCard.stamps} / 10
          </button>

          {/* 📱 Handy-Controller QR-Code Button */}
          <button
            type="button"
            onClick={() => setShowPhoneControllerModal(true)}
            title="Smartphone als 80er-Touch-Gamepad per QR-Code verbinden (?controller=ROOM_ID)"
            className={`px-2.5 py-1 rounded border font-mono font-medium transition cursor-pointer ${
              phonePadConnected
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900 hover:bg-slate-800 border-cyan-500/40 text-cyan-200'
            }`}
          >
            📱 Handy-Controller{phonePadConnected ? ' (AKTIV)' : ''}
          </button>

          {/* 📺 80er-CRT-Filter (Scanlines) Quick Toggle */}
          <button
            type="button"
            onClick={() => setCrtFilterEnabled((v) => !v)}
            title="Optionaler 80er-CRT-Filter (Scanlines & Röhrenmonitor-Look) ein-/ausschalten"
            className={`px-2 py-1 rounded border font-mono text-[11px] transition cursor-pointer ${
              crtFilterEnabled
                ? 'bg-fuchsia-950/90 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_10px_rgba(232,121,249,0.4)]'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            📺 CRT: {crtFilterEnabled ? 'AN' : 'AUS'}
          </button>

          {/* Public Visitor Volume Slider + Mute Toggle */}
          <div
            title="Persönliche Hallen-Lautstärke (wird lokal für deinen Browser gespeichert)"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-700"
          >
            <button
              type="button"
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                soundFX.setMuted(nextMuted);
                setLockerSettings((prev) => ({
                  ...prev,
                  discoSoundEnabled: !nextMuted,
                }));
              }}
              className={`font-mono text-[11px] cursor-pointer ${
                isMuted ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {isMuted || visitorVolume === 0 ? '🔇' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={isMuted ? 0 : Math.round(visitorVolume * 100)}
              onChange={(e) => {
                const pct = Number(e.target.value);
                const norm = Math.max(0, Math.min(1, pct / 100));
                setVisitorVolume(norm);
                saveVisitorVolume(norm);
                soundFX.setVolume(norm);
                if (norm > 0 && isMuted) {
                  setIsMuted(false);
                  soundFX.setMuted(false);
                  setLockerSettings((prev) => ({
                    ...prev,
                    discoSoundEnabled: true,
                  }));
                }
              }}
              className="w-16 h-1.5 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-[10px] text-slate-300 w-7 text-right">
              {isMuted ? '0%' : `${Math.round(visitorVolume * 100)}%`}
            </span>
          </div>

          {/* Live Multiplayer Status Badge in Top HUD */}
          {isMultiplayerActive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/90 border border-cyan-400 text-cyan-200 font-mono font-bold text-[11px] shadow-[0_0_12px_rgba(34,211,238,0.4)]">
              <span>🌐 LIVE ({remotePlayers.length + 1} Skater)</span>
              {mpRole === 'guest' && (
                <button
                  type="button"
                  onClick={() => {
                    cleanupPeerSession();
                    setMpRole('solo');
                    setMpStatus('idle');
                  }}
                  className="ml-1 px-1.5 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-400/60 text-rose-200 text-[10px] cursor-pointer"
                >
                  Verlassen
                </button>
              )}
            </span>
          )}

          {isAdminUnlocked && (
            <button
              type="button"
              onClick={() => setShowAdminTerminal(true)}
              className="px-2.5 py-1 rounded bg-rose-950/90 hover:bg-rose-900 border border-rose-400/70 text-rose-200 font-mono font-bold transition cursor-pointer"
            >
              🎛️ Regie
            </button>
          )}
        </div>
      </header>

      {/* MAIN 16:9 WIDESCREEN ARENA CONTAINER */}
      <main className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center bg-[#070A12]">
        {/* HALL RADIO JOIN / EVENT ANNOUNCEMENT BANNER */}
        {hallRadioBanner && (
          <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-40 px-5 py-2 rounded-full bg-slate-950/95 border-2 border-cyan-400 text-cyan-200 font-mono text-xs font-bold shadow-[0_0_24px_rgba(34,211,238,0.5)]">
            {hallRadioBanner}
          </div>
        )}

        {/* 16-BIT SOFORT-FEEDBACK BANNER FÜR PFLICHT-EINFÜHRUNG (+20 PUNKTE / BONUS) */}
        {introBannerText && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-lg bg-[#0c1428]/95 border-2 border-emerald-400 text-emerald-200 font-mono text-xs sm:text-sm font-black tracking-wide shadow-[0_0_28px_rgba(16,185,129,0.75)] animate-bounce">
            {introBannerText}
          </div>
        )}

        {/* KOMPAKTE AUFGABENBOX OBEN RECHTS (PFLICHT-EINFÜHRUNG: PALLADIUM-RUNDGANG) */}
        {isCurtainOpen && !isBlockedByMaintenance && (
          <div className="absolute top-3 right-3 z-30 w-64 rounded-xl bg-[#0e1324]/92 border-2 border-amber-400/75 p-2.5 text-white shadow-[0_0_20px_rgba(0,0,0,0.7)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-1 border-b border-slate-700/80 pb-1.5">
              <button
                type="button"
                onClick={() => setShowChallengesModal(true)}
                className="text-left font-mono text-[11px] font-extrabold text-amber-300 hover:text-amber-200 cursor-pointer flex items-center gap-1"
              >
                <span>🧭 Einführung: Palladium-Rundgang</span>
              </button>
              <button
                type="button"
                onClick={() => setIsIntroBoxMinimized((v) => !v)}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[9px] cursor-pointer"
                title="Aufgabenbox ein-/ausklappen"
              >
                {isIntroBoxMinimized ? '▼' : '▲'}
              </button>
            </div>

            {!isIntroBoxMinimized && (
              <div className="mt-1.5 space-y-1 font-mono text-[10.5px]">
                {(
                  [
                    {
                      id: 'open_locker' as IntroStepId,
                      label: 'Spind öffnen',
                      hint: 'Klick auf SPINDE / [E]',
                    },
                    {
                      id: 'fetch_drink' as IntroStepId,
                      label: 'Getränk an der Gastro holen',
                      hint: 'Bistro-Theke nutzen',
                    },
                    {
                      id: 'skate_rink' as IntroStepId,
                      label: 'Runde auf der Bahn drehen',
                      hint: 'Durch Schleuse fahren',
                    },
                    {
                      id: 'try_ballspiel' as IntroStepId,
                      label: 'Ballspiel ausprobieren',
                      hint: 'Werfen oder passen',
                    },
                  ] as const
                ).map((st) => {
                  const done = introTour[st.id];
                  return (
                    <div
                      key={st.id}
                      className={`flex items-center justify-between px-1.5 py-1 rounded border ${
                        done
                          ? 'bg-emerald-950/50 border-emerald-400/60 text-emerald-200'
                          : 'bg-slate-900/85 border-slate-700/80 text-slate-200'
                      }`}
                    >
                      <span className="truncate">
                        {done ? '✅' : '⬜'} {st.label}
                      </span>
                      <span
                        className={`text-[9px] ml-1 shrink-0 ${
                          done ? 'text-emerald-300 font-bold' : 'text-amber-300'
                        }`}
                      >
                        {done ? '+20 Pkt' : st.hint}
                      </span>
                    </div>
                  );
                })}

                <div className="pt-1 flex items-center justify-between text-[10px] border-t border-slate-800">
                  {isIntroTourComplete(introTour) ? (
                    <span className="text-emerald-300 font-bold">
                      🎉 Komplett! Alle Aufgaben frei
                    </span>
                  ) : (
                    <span className="text-amber-200/90">
                      🔒 Weitere Aufgaben nach Rundgang
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowChallengesModal(true)}
                    className="text-cyan-300 hover:underline cursor-pointer font-bold"
                  >
                    Alle ({completedChallengesCount}/{PALLADIUM_CHALLENGES.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* COMPACT TOP STATUS BAR FOR ACTIVE ADMIN PREVIEW */}
        {previewStyle && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-1.5 rounded-full bg-amber-950/95 border-2 border-amber-400 text-amber-100 font-mono text-xs font-bold shadow-[0_0_24px_rgba(251,191,36,0.55)] backdrop-blur-md">
            <span>
              👁️ ADMIN-VORSCHAU:{' '}
              <strong className="text-amber-300">
                {previewStyle === 'palladium-1989'
                  ? 'PALLADIUM 1989'
                  : previewStyle === 'pixel-16bit'
                  ? '16-BIT'
                  : 'CLASSIC NEON'}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setAdminPreviewStyle(null)}
              className="px-2.5 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-[11px] font-black transition cursor-pointer"
            >
              [Vorschau beenden]
            </button>
            <button
              type="button"
              onClick={() => setShowAdminTerminal(true)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-amber-400/50 text-amber-200 font-mono text-[11px] transition cursor-pointer"
            >
              [🎛️ Regie]
            </button>
          </div>
        )}

        {/* COMPACT TOP BAR FOR ACTIVE BUILD MODE ("🛠️ BAUMENÜ") WHEN ADMIN MODAL IS CLOSED */}
        {isAdminUnlocked && buildModeEnabled && !showAdminTerminal && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/95 border-2 border-amber-400 text-amber-100 font-mono text-[10.5px] shadow-[0_0_25px_rgba(251,191,36,0.5)] backdrop-blur-md">
            <span className="font-bold text-amber-300">
              🛠️ BAUMENÜ (Drag • Zieh-Eck • Pfeil 1/10px • [R] Drehen)
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-400/50 text-cyan-200 text-[10px]">
              Auswahl:{' '}
              <strong>
                {selectedBuildItemId?.startsWith('mod:')
                  ? customLayout.modules[
                      selectedBuildItemId.slice(4) as EditableModuleId
                    ]?.label || selectedBuildItemId
                  : selectedBuildItemId?.startsWith('npc:')
                  ? editableNpcList.find(
                      (n) => n.id === selectedBuildItemId.slice(4)
                    )?.name || selectedBuildItemId.slice(4)
                  : 'Klicke Objekt auf Spielfeld'}
              </strong>
            </span>
            {selectedBuildItemId?.startsWith('mod:') && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-amber-400/50 text-[10px]">
                <span className="text-slate-300">B:</span>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedModuleSizeOrRot(-8, 0, 0)}
                  className="px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold cursor-pointer"
                  title="Breite (w) -8 px"
                >
                  −
                </button>
                <span className="text-cyan-300 font-bold">
                  {Math.round(
                    customLayout.modules[
                      selectedBuildItemId.slice(4) as EditableModuleId
                    ]?.width || 0
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedModuleSizeOrRot(8, 0, 0)}
                  className="px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold cursor-pointer"
                  title="Breite (w) +8 px"
                >
                  +
                </button>
                <span className="text-slate-300 ml-1">H:</span>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedModuleSizeOrRot(0, -8, 0)}
                  className="px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold cursor-pointer"
                  title="Höhe (h) -8 px"
                >
                  −
                </button>
                <span className="text-cyan-300 font-bold">
                  {Math.round(
                    customLayout.modules[
                      selectedBuildItemId.slice(4) as EditableModuleId
                    ]?.height || 0
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedModuleSizeOrRot(0, 8, 0)}
                  className="px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold cursor-pointer"
                  title="Höhe (h) +8 px"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustSelectedModuleSizeOrRot(0, 0, 45)}
                  className="ml-1 px-1.5 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300 text-amber-200 font-bold cursor-pointer"
                  title="Modul um 45° drehen (Taste R)"
                >
                  ↻ Drehen (
                  {Math.round(
                    customLayout.modules[
                      selectedBuildItemId.slice(4) as EditableModuleId
                    ]?.rot || 0
                  )}
                  °)
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleCopyCustomCoordinatesJson}
              className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[10px] cursor-pointer"
            >
              {coordsCopiedToast
                ? '✅ Code-Block kopiert!'
                : '📋 Code-Block kopieren'}
            </button>
            <button
              type="button"
              onClick={handleResetCustomLayout}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] cursor-pointer"
            >
              ↩️ Standard-Layout
            </button>
            <button
              type="button"
              onClick={() => setShowAdminTerminal(true)}
              className="px-2 py-0.5 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold text-[10px] cursor-pointer"
            >
              🎛️ Regie
            </button>
            <button
              type="button"
              onClick={() => setBuildModeEnabled(false)}
              className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
            >
              ✕ Baumenü AUS
            </button>
          </div>
        )}

        <RollerArenaEngine
          playerName={playerName}
          playerShirtColor={playerShirtColor}
          isAnonymousGuest={isAnonymousGuest}
          showNames={showNames}
          nameDisplayMode={nameDisplayMode}
          characterMode={characterMode}
          cameraMode={cameraMode}
          lightingMode={lightingMode}
          centerStageMode={centerStageMode}
          activeBandName={
            customBandInput.trim() ? customBandInput.trim() : activeBandName
          }
          bandSkinTone={bandSkinTone}
          bandGender={bandGender}
          hallGameMode={hallGameMode}
          djTickerText={
            lightingMode === 'slow-skating'
              ? `🪩 JETZT BEGINNT DAS SLOW-SKATING! +++ ${adminSettings.djTickerText}`
              : adminSettings.djTickerText
          }
          specialSkaters={specialSkaters}
          ghostSkatersEnabled={adminSettings.ghostSkatersEnabled}
          kengolHatEnabled={kengolHatEnabled}
          upgrades={effectiveUpgrades}
          externalTrickTrigger={externalTrickTrigger}
          fogMachineEnabled={adminSettings.fogMachineEnabled}
          fogBurstCount={fogBurstCount}
          difficulty={difficulty}
          hasOwnSkates={hasOwnSkates}
          hasRentedSkates={hasRentedSkates}
          drinkChipAvailable={drinkChipAvailable}
          npcVoicesEnabled={adminSettings.npcVoicesEnabled}
          skateGuardWhistleEnabled={adminSettings.skateGuardWhistleEnabled}
          concertLightingMode={adminSettings.concertLightingMode}
          arenaStyle={activeStyle}
          monitorPreviewStyle={showAdminTerminal ? selectedStyleTile : null}
          fullHallPutzlichtEnabled={adminSettings.fullHallPutzlichtEnabled}
          pixel16BitFiguresEnabled={adminSettings.pixel16BitFiguresEnabled}
          backgroundDancersEnabled={
            adminSettings.backgroundDancersEnabled ?? true
          }
          cinemaCountdownEnabled={adminSettings.cinemaCountdownEnabled}
          cinemaCountdownTitle={adminSettings.cinemaCountdownTitle}
          cinemaCountdownTargetIso={adminSettings.cinemaCountdownTargetIso}
          cinemaWeekdays={adminSettings.cinemaWeekdays}
          cinemaStartTime={adminSettings.cinemaStartTime}
          crewNames={adminSettings.crewNames}
          externalDjJingleBubble={externalDjJingleBubble}
          activeDjName={
            adminSettings.crewNames?.dj ||
            adminSettings.activeDjName ||
            DEFAULT_DJ_NAME
          }
          isMuted={isMuted}
          isCurtainOpen={isCurtainOpen && !isBlockedByMaintenance}
          isMultiplayerActive={isMultiplayerActive}
          remotePlayers={remotePlayers}
          remoteControllerInputRef={remoteControllerInputRef}
          onLocalPlayerState={handleLocalMultiplayerState}
          buildModeEnabled={isAdminUnlocked && buildModeEnabled}
          customLayout={customLayout}
          selectedBuildItemId={selectedBuildItemId}
          onSelectBuildItem={setSelectedBuildItemId}
          onUpdateCustomLayout={handleUpdateCustomLayout}
          onToggleCamera={handleToggleCamera}
          onToggleCharacterMode={handleToggleCharacterMode}
          onToggleShowNames={handleToggleShowNames}
          onToggleUnderglow={handleToggleUnderglow}
          onToggleKengolHat={handleToggleKengolHat}
          onOpenProShopModal={() => setShowProShopModal(true)}
          onOpenChronicleModal={() => setShowChronicleModal(true)}
          onEnterHallFromGamepad={handleEnterHall}
          onToggleTwitchStream={() => setCenterStageMode('cinema')}
          onRedeemDrinkChipAtRental={handleRedeemDrinkChipAtRental}
          onRedeemDrinkChipAtBistro={handleRedeemDrinkChipAtBistro}
          onChallengeProgress={handleChallengeProgress}
          showAiNames={lockerSettings.showAiNames}
          showOwnName={lockerSettings.showOwnName}
          showSpeechBubbles={lockerSettings.showSpeechBubbles}
          vipDiscoSkatesEquipped={lockerSettings.vipDiscoSkatesEquipped}
          lockerDrinkBoostTrigger={lockerDrinkBoostTrigger}
          onOpenLockerModal={() => setShowLockerModal(true)}
          onIntroStepComplete={handleIntroStepComplete}
          onTelemetry={setTelemetry}
        />

        {/* LIVE KINO-LEINWAND OVERLAY (TWITCH / YOUTUBE / 80s VISUALIZER & COUNTDOWN FALLBACK) */}
        {isCurtainOpen &&
          !isBlockedByMaintenance &&
          centerStageMode === 'cinema' &&
          cameraMode === 'top-down' && (
            <div
              style={{
                left: `${
                  (((customLayout?.modules?.centerStage?.x ??
                    DEFAULT_CUSTOM_ARENA_LAYOUT.modules.centerStage.x) +
                    85) /
                    1920) *
                  100
                }%`,
                top: `${
                  (((customLayout?.modules?.centerStage?.y ??
                    DEFAULT_CUSTOM_ARENA_LAYOUT.modules.centerStage.y) +
                    38) /
                    1080) *
                  100
                }%`,
                width: `${(350 / 1920) * 100}%`,
                height: `${(256 / 1080) * 100}%`,
              }}
              className="z-20 absolute rounded border-2 border-cyan-400/90 shadow-[0_0_30px_rgba(34,211,238,0.55)] overflow-hidden flex flex-col pointer-events-auto"
            >
              <div className="flex items-center justify-between px-2 py-0.5 bg-slate-950/95 border-b border-cyan-500/40 text-[9.5px] font-mono">
                <span className="text-cyan-300 font-bold truncate">
                  {adminSettings.cinemaCountdownEnabled
                    ? `⏳ ${adminSettings.cinemaCountdownTitle || 'COUNTDOWN'}`
                    : adminSettings.cinemaStreamSource === 'youtube' &&
                      youtubeEmbedUrl
                    ? '🎬 YOUTUBE LIVE / PLAYLIST'
                    : adminSettings.cinemaStreamSource === 'twitch' &&
                      isTwitchOnline
                    ? `🎬 TWITCH LIVE: ${adminSettings.twitchChannel}`
                    : '🎹 PALLADIUM LIVE VISUALIZER'}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTwitchMuted((m) => !m)}
                    className="text-amber-300 hover:underline cursor-pointer"
                  >
                    {twitchMuted ? '🔇 Ton an' : '🔊 Stumm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterStageMode('islands')}
                    title="Kino-Leinwand schließen"
                    className="text-rose-300 hover:text-white cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </div>
              </div>

              {!adminSettings.cinemaCountdownEnabled &&
              adminSettings.cinemaStreamSource === 'youtube' &&
              youtubeEmbedUrl ? (
                <iframe
                  title="Palladium Kino-Leinwand YouTube Stream"
                  src={youtubeEmbedUrl}
                  className="w-full flex-1 border-0 bg-black"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : !adminSettings.cinemaCountdownEnabled &&
                adminSettings.cinemaStreamSource === 'twitch' &&
                isTwitchOnline ? (
                <iframe
                  title="Palladium Kino-Leinwand Live Twitch Stream"
                  src={`https://player.twitch.tv/?channel=${encodeURIComponent(
                    adminSettings.twitchChannel
                  )}&parent=${encodeURIComponent(twitchParentHost)}&muted=${
                    twitchMuted ? 'true' : 'false'
                  }`}
                  className="w-full flex-1 border-0 bg-black"
                  allowFullScreen
                />
              ) : (
                /* Transparent pass-through so the Canvas 80s Equalizer / PALLADIUM LIVE / 7-Segment Countdown Clock shines through cleanly! */
                <div className="w-full flex-1 bg-transparent pointer-events-none" />
              )}
            </div>
          )}

        {/* CHALLENGE UNLOCKED 80s RETRO BANNER */}
        {unlockedToast && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-lg bg-gradient-to-r from-fuchsia-950/95 via-indigo-950/95 to-cyan-950/95 border-2 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6)] text-center">
            <div className="font-mono text-xs uppercase tracking-widest text-amber-300 font-bold">
              ★ Aufgabe erfüllt – Pro-Shop Upgrade freigeschaltet! ★
            </div>
            <div className="font-display text-base font-extrabold text-white mt-0.5">
              {unlockedToast.title} —{' '}
              <span className="text-cyan-300">{unlockedToast.rewardLabel}</span>
            </div>
          </div>
        )}

        {/* CONTEXTUAL INTERACTION PROMPTS NEAR PRO-SHOP / SKATE RENTAL / DJ-TOWER */}
        {isCurtainOpen && telemetry.nearDjTower && (
          <div className="absolute top-14 left-4 z-30 flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/95 border-2 border-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.45)] text-xs font-mono">
            <span className="text-fuchsia-300 font-bold mr-1">
              🎛️ DJ-SOUNDBOARD:
            </span>
            {(
              [
                { id: 'airhorn' as DjSoundboardEffectId, label: '[1] 📯 Airhorn' },
                { id: 'scratch' as DjSoundboardEffectId, label: '[2] 💿 Vinyl-Scratch' },
                { id: 'laser' as DjSoundboardEffectId, label: '[3] ⚡ Laser-Zap' },
                { id: 'fog-hiss' as DjSoundboardEffectId, label: '[4] 💨 Nebel-Zischen' },
                { id: 'applause' as DjSoundboardEffectId, label: '[5] 👏 Applaus' },
              ] as const
            ).map((snd) => (
              <button
                key={snd.id}
                type="button"
                onClick={() => handleTriggerDjSoundboard(snd.id, snd.label)}
                className="px-2 py-1 rounded bg-fuchsia-950 hover:bg-fuchsia-800 border border-fuchsia-400/70 text-fuchsia-100 text-[11px] font-bold cursor-pointer transition"
              >
                {snd.label}
              </button>
            ))}
          </div>
        )}

        {isCurtainOpen && telemetry.nearProShop && !showProShopModal && (
          <div className="absolute bottom-14 left-6 z-30 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950/95 border border-cyan-400 shadow-lg text-xs">
            <span className="text-cyan-300 font-bold">
              🛠️ Pro-Shop Vitrine:
            </span>
            <span className="text-slate-200">
              Drücke <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">[E]</kbd>{' '}
              oder klicke für Rollschuh-Tuning &amp; 80er-Moves
            </span>
            <button
              type="button"
              onClick={() => setShowProShopModal(true)}
              className="ml-1 px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold cursor-pointer"
            >
              Katalog öffnen
            </button>
          </div>
        )}

        {isCurtainOpen &&
          !telemetry.hasSkatesEquipped &&
          characterMode !== 'wheelchair' && (
            <div className="absolute bottom-14 right-6 z-30 flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-amber-950/95 border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.45)] text-xs">
              <span className="text-amber-300 font-bold">
                👟 Noch auf Straßenschuhen:
              </span>
              <span className="text-amber-100">
                Gehe unten zum <strong>Rollschuh-Verleih</strong> und löse mit{' '}
                <kbd className="px-1.5 py-0.5 bg-slate-900 rounded border border-amber-400/50">
                  [E]
                </kbd>{' '}
                deinen <strong>Freigetränk-Chip</strong> gegen Leih-Rollschuhe ein!
              </span>
              {telemetry.nearSkateRental && drinkChipAvailable && (
                <button
                  type="button"
                  onClick={handleRedeemDrinkChipAtRental}
                  className="ml-1 px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold cursor-pointer"
                >
                  🛼 Jetzt Chip einlösen [E]
                </button>
              )}
            </div>
          )}

        {/* COLLAPSIBLE BOTTOM CONTROL LEGEND, 80s TRICK-MOVES BAR & RETRO CREDIT */}
        {isBottomBarCollapsed ? (
          <button
            type="button"
            onClick={() => setIsBottomBarCollapsed(false)}
            title="Steuerungs- & Info-Leiste wieder ausklappen [I]"
            className="z-20 absolute bottom-2 right-3 px-2.5 py-1 rounded-md bg-[#080B12]/90 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/60 text-[11px] font-mono text-cyan-300 shadow-lg cursor-pointer transition"
          >
            ▲ Steuerung &amp; 80er-Moves [I]
          </button>
        ) : (
          <div className="z-20 absolute bottom-0 inset-x-0 px-3 py-1 bg-[#080B12]/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                <strong className="text-cyan-300">
                  [WASD / Pfeile / Stick]
                </strong>{' '}
                Fahren
              </span>
              <span>•</span>
              <span>
                <strong className="text-fuchsia-300">
                  [Space / Q / Pad-B]
                </strong>{' '}
                360°-Spin
              </span>
              <span>•</span>
              <span>
                <strong className="text-amber-300">
                  [J / Shift / Pad-A]
                </strong>{' '}
                Sprung
              </span>
              <span>•</span>
              <span>
                <strong className="text-emerald-300">[E / F]</strong> Interaktion
              </span>
              <span>•</span>
              {/* 80s Trick-Moves Quick Bar ([1]-[4]) */}
              <div className="inline-flex items-center gap-1 bg-slate-950/90 px-2 py-0.5 rounded border border-fuchsia-500/40">
                <span className="text-fuchsia-300 font-bold text-[10px]">
                  Moves:
                </span>
                {(
                  [
                    {
                      id: 'spin360' as TrickMoveId,
                      key: '1',
                      label: '🌀 Spin',
                      unlocked: isMoveSpin360Unlocked,
                    },
                    {
                      id: 'backward' as TrickMoveId,
                      key: '2',
                      label: '🔙 Backward',
                      unlocked: isMoveBackwardUnlocked,
                    },
                    {
                      id: 'flamingo' as TrickMoveId,
                      key: '3',
                      label: '🦩 Flamingo',
                      unlocked: isMoveFlamingoUnlocked,
                    },
                    {
                      id: 'starjump' as TrickMoveId,
                      key: '4',
                      label: '⚡ Star-Jump',
                      unlocked: isMoveStarjumpUnlocked,
                    },
                  ] as const
                ).map((mv) => (
                  <button
                    key={mv.id}
                    type="button"
                    disabled={!mv.unlocked}
                    onClick={() => handleTriggerTrickFromHud(mv.id)}
                    title={
                      mv.unlocked
                        ? `Taste [${mv.key}] oder Klick für ${mv.label}`
                        : `Im Pro-Shop über Palladium-Aufgaben freischaltbar`
                    }
                    className={`px-1.5 py-0.5 rounded text-[10px] border transition ${
                      mv.unlocked
                        ? 'bg-fuchsia-950/90 hover:bg-fuchsia-800 border-fuchsia-400/70 text-fuchsia-100 cursor-pointer'
                        : 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    [{mv.key}] {mv.unlocked ? mv.label : `🔒 ${mv.label}`}
                  </button>
                ))}
              </div>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleUnderglow}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-pink-400">[L]</strong> Neon:{' '}
                {upgrades.underglowEnabled ? 'AN' : 'AUS'}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleCamera}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-cyan-300">[C]</strong> Kamera:{' '}
                {cameraMode.toUpperCase()}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleCharacterMode}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-amber-300">[V]</strong>{' '}
                {characterMode === 'skater' ? 'Rollschuh' : 'Rollstuhl'}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleKengolHat}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-fuchsia-300">[H]</strong> Kengol:{' '}
                {kengolHatEnabled ? 'AN' : 'AUS'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 hidden 2xl:inline">
                {APP_VERSION_LABEL} • 100% lokal ohne Cookies
              </span>
              <button
                type="button"
                onClick={() => setIsBottomBarCollapsed(true)}
                title="Fußleiste einklappen [I]"
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[10px] cursor-pointer"
              >
                ▼ Einklappen [I]
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 1. FIRST-VISIT VELVET CURTAIN & HISTORICAL CHRONICLE OVERLAY          */}
        {/* ===================================================================== */}
        {(!isCurtainOpen || showChronicleModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#1A051D]/98 via-[#0B0716]/98 to-[#05050B]/98 p-4 overflow-y-auto backdrop-blur-md">
            <div className="relative w-full max-w-4xl rounded-2xl bg-[#110C1D] border-2 border-fuchsia-500/60 shadow-[0_0_80px_rgba(232,121,249,0.35)] p-6 md:p-8 text-[#FFF8E7]">
              {/* Top Neon Emblem */}
              <div className="text-center border-b border-fuchsia-500/30 pb-4">
                <div className="inline-block px-3 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 font-mono text-xs text-fuchsia-300 mb-2">
                  ✦ HANAUER ROLLSCHUH-CHRONIK • {APP_VERSION_LABEL} ✦
                </div>
                <h1 className="font-display font-black text-3xl md:text-5xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-amber-200 to-cyan-300 drop-shadow-[0_0_20px_rgba(232,121,249,0.5)]">
                  PALLADIUM ROLLER ARENA HANAU
                </h1>
                <p className="text-sm text-amber-200/80 font-mono mt-1">
                  Die Geschichte hinter dem Parkett — Authentischer 80er-Jahre
                  Prototyp
                </p>
              </div>

              {/* Historical Chronicle Cards with Authentic 80s Stickers at the Top */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 mb-3">
                {/* CARD 1: 04. November 1981 — ROLLERLAND HANAU STICKER */}
                <div className="p-4 rounded-xl bg-[#191229] border border-amber-400/40 flex flex-col">
                  <div className="h-28 mb-3 flex items-center justify-center">
                    <div className="w-full h-full rounded-lg bg-[#0d1633] border-[2.5px] border-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.65)] overflow-hidden flex items-center justify-center p-1">
                      <svg
                        viewBox="0 0 220 92"
                        className="w-full h-full"
                        aria-label="Original Rollerland Hanau 1981 Aufkleber"
                      >
                        <rect
                          x="0"
                          y="0"
                          width="220"
                          height="92"
                          rx="6"
                          fill="#0b1536"
                        />
                        <path
                          d="M -10 56 Q 95 26 230 50"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2.5"
                          opacity="0.7"
                        />
                        <path
                          d="M -10 64 Q 95 34 230 58"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="1.8"
                          opacity="0.5"
                        />
                        <path
                          d="M -10 72 Q 95 42 230 66"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2"
                          opacity="0.65"
                        />
                        <g transform="translate(110, 32)">
                          <polygon
                            points="-12,-5 -44,-16 -34,-6 -46,-1 -32,3 -12,4"
                            fill="#ffffff"
                            stroke="#ef4444"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M -14 -16 L 3 -16 L 6 -2 L 19 2 Q 24 6 18 10 L -14 10 Z"
                            fill="#ffffff"
                            stroke="#0f172a"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M 1 -12 L 6 -10 M 2 -8 L 7 -6 M 4 -4 L 10 -2"
                            stroke="#ef4444"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle cx="21" cy="11" r="3.8" fill="#ef4444" />
                          <circle
                            cx="-10"
                            cy="15"
                            r="4.5"
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="-2"
                            cy="15"
                            r="4.5"
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="6"
                            cy="15"
                            r="4.5"
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="14"
                            cy="15"
                            r="4.5"
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                        </g>
                        <text
                          x="110"
                          y="69"
                          textAnchor="middle"
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth="0.9"
                          fontSize="16"
                          fontWeight="900"
                          fontFamily="Outfit, sans-serif"
                          letterSpacing="1.5"
                        >
                          ROLLERLAND
                        </text>
                        <text
                          x="110"
                          y="84"
                          textAnchor="middle"
                          fill="#f8fafc"
                          fontSize="10"
                          fontWeight="800"
                          fontFamily="JetBrains Mono, monospace"
                          letterSpacing="3"
                        >
                          HANAU
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="font-mono text-xs text-amber-300 font-bold">
                    04. November 1981
                  </div>
                  <h2 className="font-display font-bold text-base text-white mt-0.5 mb-1.5">
                    Alles beginnt als „Rollerland“
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Oben im damaligen Hanauer <em>Familyland</em>
                    -Einkaufszentrum öffnet eine der kultigsten Rollschuhbahnen
                    der Region mit großem versiegeltem Holzparkett, Pro-Shop und
                    Slush-Theke.
                  </p>
                </div>

                {/* CARD 2: August 1986 — PALLADIUM HANAU STICKER */}
                <div className="p-4 rounded-xl bg-[#191229] border border-fuchsia-400/50 flex flex-col">
                  <div className="h-28 mb-3 flex items-center justify-center">
                    <div className="w-full h-full rounded-lg bg-[#bae6fd] border-[2.5px] border-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.65)] overflow-hidden flex items-center justify-center p-1">
                      <svg
                        viewBox="0 0 220 92"
                        className="w-full h-full"
                        aria-label="Original Palladium Hanau 1986 Aufkleber"
                      >
                        <defs>
                          <linearGradient
                            id="palladiumSky"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="65%" stopColor="#bae6fd" />
                            <stop offset="100%" stopColor="#fef08a" />
                          </linearGradient>
                        </defs>
                        <rect
                          x="0"
                          y="0"
                          width="220"
                          height="92"
                          rx="6"
                          fill="url(#palladiumSky)"
                        />
                        <circle
                          cx="36"
                          cy="24"
                          r="12"
                          fill="#ffffff"
                          opacity="0.88"
                        />
                        <circle
                          cx="50"
                          cy="21"
                          r="10"
                          fill="#ffffff"
                          opacity="0.88"
                        />
                        <circle
                          cx="172"
                          cy="22"
                          r="12"
                          fill="#ffffff"
                          opacity="0.88"
                        />
                        <circle
                          cx="186"
                          cy="26"
                          r="9"
                          fill="#ffffff"
                          opacity="0.88"
                        />
                        <path
                          d="M 22 46 A 90 42 0 0 1 198 46"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="4"
                        />
                        <path
                          d="M 28 49 A 84 38 0 0 1 192 49"
                          fill="none"
                          stroke="#facc15"
                          strokeWidth="3"
                        />
                        <rect
                          x="16"
                          y="26"
                          width="8"
                          height="38"
                          fill="#eab308"
                          stroke="#ca8a04"
                        />
                        <rect
                          x="34"
                          y="31"
                          width="6"
                          height="30"
                          fill="#facc15"
                          stroke="#ca8a04"
                        />
                        <rect
                          x="50"
                          y="35"
                          width="5"
                          height="23"
                          fill="#facc15"
                          stroke="#ca8a04"
                        />
                        <rect
                          x="165"
                          y="35"
                          width="5"
                          height="23"
                          fill="#facc15"
                          stroke="#ca8a04"
                        />
                        <rect
                          x="180"
                          y="31"
                          width="6"
                          height="30"
                          fill="#facc15"
                          stroke="#ca8a04"
                        />
                        <rect
                          x="196"
                          y="26"
                          width="8"
                          height="38"
                          fill="#eab308"
                          stroke="#ca8a04"
                        />
                        <g transform="translate(110, 30)">
                          <polygon
                            points="-11,-4 -40,-15 -31,-7 -42,-3 -29,2 -11,4"
                            fill="#fde047"
                            stroke="#ca8a04"
                            strokeWidth="1.4"
                          />
                          <polygon
                            points="11,-5 38,-15 30,-7 40,-3 28,2 11,3"
                            fill="#fde047"
                            stroke="#ca8a04"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M -13 -15 L 3 -15 L 6 -2 L 18 2 Q 23 6 17 10 L -13 10 Z"
                            fill="#16a34a"
                            stroke="#052e16"
                            strokeWidth="1.8"
                          />
                          <path
                            d="M 1 -11 L 6 -9 M 2 -7 L 7 -5 M 4 -3 L 10 -1"
                            stroke="#fde047"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle
                            cx="21"
                            cy="11"
                            r="4"
                            fill="#9333ea"
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                          <circle
                            cx="-10"
                            cy="14"
                            r="4.5"
                            fill="#ff2a85"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="-2"
                            cy="14"
                            r="4.5"
                            fill="#ff2a85"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="6"
                            cy="14"
                            r="4.5"
                            fill="#ff2a85"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                          <circle
                            cx="14"
                            cy="14"
                            r="4.5"
                            fill="#ff2a85"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                        </g>
                        <g transform="translate(110, 68) rotate(-3)">
                          <text
                            x="0"
                            y="0"
                            textAnchor="middle"
                            fill="#1d4ed8"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                            fontSize="17"
                            fontStyle="italic"
                            fontWeight="900"
                            fontFamily="Outfit, sans-serif"
                            letterSpacing="1.5"
                          >
                            PALLADIUM
                          </text>
                          <line
                            x1="-62"
                            y1="5"
                            x2="62"
                            y2="5"
                            stroke="#1d4ed8"
                            strokeWidth="2.2"
                          />
                          <text
                            x="0"
                            y="16"
                            textAnchor="middle"
                            fill="#0f172a"
                            fontSize="9.5"
                            fontWeight="900"
                            fontFamily="Outfit, sans-serif"
                            letterSpacing="4"
                          >
                            HANAU
                          </text>
                        </g>
                      </svg>
                    </div>
                  </div>

                  <div className="font-mono text-xs text-fuchsia-300 font-bold">
                    August 1986
                  </div>
                  <h2 className="font-display font-bold text-base text-white mt-0.5 mb-1.5">
                    Neueröffnung als „Palladium“
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Nach dem großen Umbau im Frühjahr 1986 startet im August
                    1986 die Ära des <strong>Palladiums</strong> – legendärer
                    Treffpunkt einer ganzen Generation, mit zusammenschiebbarer
                    Mittelbühne für Live-Acts, Lichtshow und unvergesslichen
                    Abenden auf acht Rollen.
                  </p>
                </div>

                {/* CARD 3: Heute — OVAL-EMBLEM ROLLER DISCO PALLADIUM HANAU-GRIMM CENTER */}
                <div className="p-4 rounded-xl bg-[#191229] border border-cyan-400/50 flex flex-col">
                  <div className="h-28 mb-3 flex items-center justify-center">
                    <div className="w-full h-full rounded-lg bg-[#090d1f] border-[2.5px] border-white/95 shadow-[0_6px_18px_rgba(0,0,0,0.65)] overflow-hidden flex items-center justify-center p-1">
                      <svg
                        viewBox="0 0 220 92"
                        className="w-full h-full"
                        aria-label="Roller Disco Palladium Hanau-Grimm Center Oval-Emblem"
                      >
                        <rect
                          x="0"
                          y="0"
                          width="220"
                          height="92"
                          rx="6"
                          fill="#080c1d"
                        />
                        <ellipse
                          cx="110"
                          cy="46"
                          rx="98"
                          ry="39"
                          fill="#0f172a"
                          stroke="#facc15"
                          strokeWidth="3.2"
                        />
                        <ellipse
                          cx="110"
                          cy="46"
                          rx="92"
                          ry="34"
                          fill="none"
                          stroke="#fde047"
                          strokeWidth="1.1"
                          opacity="0.65"
                        />
                        <text
                          x="110"
                          y="27"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10.5"
                          fontWeight="800"
                          fontFamily="Outfit, sans-serif"
                          letterSpacing="2"
                        >
                          ★ ROLLER DISCO ★
                        </text>
                        <text
                          x="110"
                          y="52"
                          textAnchor="middle"
                          fill="#ef4444"
                          stroke="#fde047"
                          strokeWidth="0.9"
                          fontSize="24"
                          fontStyle="italic"
                          fontWeight="900"
                          fontFamily="Outfit, Georgia, serif"
                        >
                          Palladium
                        </text>
                        <text
                          x="110"
                          y="70"
                          textAnchor="middle"
                          fill="#fde047"
                          fontSize="9.5"
                          fontWeight="700"
                          fontFamily="JetBrains Mono, monospace"
                          letterSpacing="0.8"
                        >
                          HANAU-Grimm Center
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="font-mono text-xs text-cyan-300 font-bold">
                    Heute
                  </div>
                  <h2 className="font-display font-bold text-base text-white mt-0.5 mb-1.5">
                    Die digitale Zeitreise
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Ein liebevolles Retro-Tribut für alle ehemaligen
                    „Palladiumaner“ und Gäste. Mit DJ Magic Force, Speed-Skatern,
                    Skate Guards, Slush &amp; Bloba Cola und den klassischen
                    Hallen-Spielen.
                  </p>
                </div>
              </div>

              {/* "Nicht mehr anzeigen" Checkbox */}
              <div className="mb-3 flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#161026] border border-fuchsia-500/30 text-xs">
                <label className="flex items-center gap-2.5 text-amber-100 font-mono cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hideChronik}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setHideChronik(next);
                      saveHideChronik(next);
                    }}
                    className="accent-cyan-400 w-4 h-4 rounded cursor-pointer"
                  />
                  <span>
                    Nicht mehr anzeigen{' '}
                    <span className="text-slate-400 text-[11px]">
                      (Chronik beim Start überspringen – jederzeit über „📜
                      Chronik“ oben im Menü wieder aufrufbar)
                    </span>
                  </span>
                </label>
              </div>

              {/* Streamlined Cashier Entry: 1. DEIN SKATER-NAME & EINSTIEG (top) + 2. ROLLSCHUH-CHECK (directly below) */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-700/80 flex flex-col gap-3.5">
                {entryPass?.locked && (
                  <div className="px-3.5 py-2 rounded-lg bg-amber-950/90 border border-amber-400/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
                    <span className="font-bold">
                      🎟️ Eintrittsstempel aktiv – Auswahl für diesen Besuch fixiert
                    </span>
                    <span className="text-[11px] text-amber-300/90">
                      (Reset nur über das Hallenleiter-Regie-Terminal möglich)
                    </span>
                  </div>
                )}

                {/* 1. DEIN SKATER-NAME & EINSTIEG (GANZ OBEN) */}
                <div className="p-3.5 rounded-xl bg-[#101322] border border-cyan-500/40 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex-1 w-full">
                    <label className="block font-mono text-xs md:text-sm font-bold text-cyan-300 uppercase mb-1.5">
                      1. DEIN SKATER-NAME &amp; EINSTIEG (Pflichtfeld ab 2 Zeichen oder Anonym-Gast):
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={playerName}
                        disabled={isAnonymousGuest}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Dein Name oder Spitzname..."
                        maxLength={22}
                        className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAnonymousGuest}
                          onChange={(e) =>
                            setIsAnonymousGuest(e.target.checked)
                          }
                          className="accent-fuchsia-500 w-4 h-4 cursor-pointer"
                        />
                        <span>[ ] Anonym bleiben / Als Gast rollen</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Bitte mindestens 2 Zeichen eingeben (oder „Als Gast rollen“
                      aktivieren), um an der Kasse vorbei in die Halle zu starten.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!canEnterSingleplayerHall}
                      onClick={handleEnterHall}
                      className={`px-6 py-3.5 rounded-xl font-display font-black text-base tracking-wider transition ${
                        canEnterSingleplayerHall
                          ? 'bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 text-white shadow-[0_0_25px_rgba(232,121,249,0.6)] cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      🛼 HALLE BETRETEN [ENTER]
                    </button>
                  </div>
                </div>

                {/* 2. ROLLSCHUH-CHECK (DIREKT DARUNTER) */}
                <div className="p-3.5 rounded-xl bg-[#141024] border border-fuchsia-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <label
                    className={`flex items-start md:items-center gap-2.5 select-none ${
                      entryPass?.locked
                        ? 'opacity-65 cursor-not-allowed'
                        : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={hasOwnSkates}
                      disabled={Boolean(entryPass?.locked)}
                      onChange={(e) => {
                        if (entryPass?.locked) return;
                        setHasOwnSkates(e.target.checked);
                      }}
                      className="accent-emerald-400 w-4 h-4 mt-0.5 md:mt-0 rounded cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div>
                      <span className="font-mono font-bold text-xs md:text-sm text-emerald-300 uppercase">
                        2. ROLLSCHUH-CHECK — 🛼 Ich habe eigene Rollschuhe
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {hasOwnSkates ? (
                          <>
                            <strong>Eigene Rollschuhe aktiv:</strong> Du startest
                            direkt auf eigenen Custom-Skates (+10% Antritt/Kurvenlage)
                            und darfst sofort durch die Schleusen-Bande auf die Bahn!
                          </>
                        ) : (
                          <>
                            <strong>Keine eigenen Rollschuhe:</strong> Du spawnt in
                            Straßenschuhen und musst dir zuerst am{' '}
                            <strong>ROLLSCHUHVERLEIH [E]</strong> Leih-Skates holen,
                            bevor du auf die Bahn darfst!
                          </>
                        )}
                      </p>
                    </div>
                  </label>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded font-mono text-[11px] font-bold border ${
                      hasOwnSkates
                        ? 'bg-emerald-950/90 border-emerald-400/70 text-emerald-200'
                        : 'bg-amber-950/90 border-amber-400/70 text-amber-200'
                    }`}
                  >
                    {hasOwnSkates
                      ? '🛼 Eigene Skates (Direktstart)'
                      : '👟 Straßenschuhe → Verleih [E]'}
                  </span>
                </div>

                {/* 3. DIGITALE 10ER-STEMPELKARTE & 1x START-FREIGETRÄNK NACH WAHL */}
                <div className="p-3.5 rounded-xl bg-[#161228] border border-amber-400/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs md:text-sm text-amber-300 uppercase">
                        3. DIGITALE 10er-STEMPELKARTE — 🎫 Stempel: {stampCard.stamps} / 10
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 font-mono text-[10px] text-amber-200">
                        {stampCard.stamps >= 10
                          ? '🎁 10/10 VOLL: 1x Gratis-Zubehör im PRO-SHOP [E]!'
                          : 'Pro Besuchstag +1 Stempel • Bei 10/10 1x Gratis-Zubehör im PRO-SHOP'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Wähle dein <strong>1x Start-Freigetränk nach Wahl</strong> für die Bistro-Theke:
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setFreeDrinkChoice('slush');
                        const next = {
                          ...stampCard,
                          welcomeDrinkChoice: 'slush' as const,
                        };
                        setStampCard(next);
                        saveStampCard(next);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                        freeDrinkChoice === 'slush'
                          ? 'bg-cyan-500 text-slate-950 border-white shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                          : 'bg-slate-900 text-cyan-200 border-slate-700 hover:border-cyan-400'
                      }`}
                    >
                      🍧 Slush Puppy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFreeDrinkChoice('bloba');
                        const next = {
                          ...stampCard,
                          welcomeDrinkChoice: 'bloba' as const,
                        };
                        setStampCard(next);
                        saveStampCard(next);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
                        freeDrinkChoice === 'bloba'
                          ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                          : 'bg-slate-900 text-amber-200 border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      🥤 Bloba Cola
                    </button>
                  </div>
                </div>
              </div>

              {/* Creator Signature & Dedication */}
              <div className="mt-4 pt-3 border-t border-fuchsia-500/30 text-center">
                <p className="font-mono text-xs md:text-sm font-semibold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-indigo-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]">
                  created by Jürgen Becker (JR) • Ein Tribut an unsere Ära •{' '}
                  {APP_VERSION_LABEL}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. PRO-SHOP ROLLSCHUH-UPGRADES, NEON-ARMBÄNDER & 80s TRICK-MOVES      */}
        {/* ===================================================================== */}
        {showProShopModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#101424] border-2 border-cyan-400/70 shadow-2xl p-5 md:p-6 text-white">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-cyan-300 uppercase">
                    Bereich 1 • Glasvitrine, Neon-Armbänder &amp; 80er-Trick-Moves
                  </span>
                  <h2 className="font-display font-extrabold text-2xl text-white">
                    🛠️ PRO-SHOP &amp; ROLLSCHUH-TUNING
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProShopModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                >
                  Schließen [ESC]
                </button>
              </div>

              <p className="text-xs text-slate-300 mt-3">
                Rüste deine Rollschuhe mit Original-80er-Bauteilen, leuchtenden
                Neon-Schweißbändern und authentischen{' '}
                <strong className="text-fuchsia-300">80er-Skater-Moves</strong>{' '}
                aus. Freischaltung über erledigte{' '}
                <strong className="text-amber-300">Palladium-Aufgaben</strong>!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
                {/* 1. ABEC-9 Bearings */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-amber-300">
                        1. Kugellager (ABEC-9 Gold)
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {isAbec9Unlocked ? 'Freigeschaltet' : 'Aufgabe #2'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Erhöht spürbar die Endgeschwindigkeit und reduziert den
                      Rollwiderstand auf dem Parkett.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!isAbec9Unlocked}
                    onClick={() =>
                      setUpgrades((u) => ({
                        ...u,
                        bearingsAbec9: !u.bearingsAbec9,
                      }))
                    }
                    className={`mt-3 w-full py-1.5 rounded font-mono text-xs font-bold transition cursor-pointer ${
                      !isAbec9Unlocked
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : upgrades.bearingsAbec9
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-400/50'
                    }`}
                  >
                    {!isAbec9Unlocked
                      ? '🔒 Durch „Dauerläufer“ (20 Runden)'
                      : upgrades.bearingsAbec9
                      ? '✓ ABEC-9 Gold montiert'
                      : 'Montieren'}
                  </button>
                </div>

                {/* 2. High-Grip Urethan Wheels */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-cyan-300">
                        2. Spezial-Rollen (High-Grip)
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {isHighGripUnlocked ? 'Freigeschaltet' : 'Aufgabe #3'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Verbessert Kurvenlage und Bodenhaftung – schützt vor
                      Stürzen auf Bohnerwachs-Rutschzonen!
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!isHighGripUnlocked}
                    onClick={() =>
                      setUpgrades((u) => ({
                        ...u,
                        highGripWheels: !u.highGripWheels,
                      }))
                    }
                    className={`mt-3 w-full py-1.5 rounded font-mono text-xs font-bold transition cursor-pointer ${
                      !isHighGripUnlocked
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : upgrades.highGripWheels
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-400/50'
                    }`}
                  >
                    {!isHighGripUnlocked
                      ? '🔒 Durch „Slush- & Bloba-Pause“'
                      : upgrades.highGripWheels
                      ? '✓ High-Grip Urethan montiert'
                      : 'Montieren'}
                  </button>
                </div>

                {/* 3. Alu-Plates & High-Tops */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-emerald-300">
                        3. Alu-Platten &amp; High-Tops
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {isAluPlatesUnlocked
                          ? 'Freigeschaltet'
                          : 'Aufgabe #4 / #9'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Schnellerer Antritt und höhere, sauberere Sprünge beim
                      Stuhl- &amp; Hindernissprung.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!isAluPlatesUnlocked}
                    onClick={() =>
                      setUpgrades((u) => ({
                        ...u,
                        aluPlatesHighTop: !u.aluPlatesHighTop,
                      }))
                    }
                    className={`mt-3 w-full py-1.5 rounded font-mono text-xs font-bold transition cursor-pointer ${
                      !isAluPlatesUnlocked
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : upgrades.aluPlatesHighTop
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-emerald-200 border border-emerald-400/50'
                    }`}
                  >
                    {!isAluPlatesUnlocked
                      ? '🔒 Durch „Windschatten“ / „Stuhl-Springer“'
                      : upgrades.aluPlatesHighTop
                      ? '✓ Alu-Platten & High-Tops montiert'
                      : 'Montieren'}
                  </button>
                </div>

                {/* 4. Neon Underglow Kit */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-fuchsia-300">
                        4. Neon-Unterbodenbeleuchtung [L]
                      </h3>
                      <button
                        type="button"
                        onClick={handleToggleUnderglow}
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                          upgrades.underglowEnabled
                            ? 'bg-fuchsia-500 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {upgrades.underglowEnabled ? 'AKTIV' : 'AUS'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Wirft beim Fahren einen farbigen Lichtschein und eine
                      Leuchtspur auf das Holzparkett.
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    {(
                      [
                        {
                          id: 'pink',
                          label: 'Pink',
                          unlocked: isPinkCyanUnlocked,
                        },
                        {
                          id: 'cyan',
                          label: 'Cyan',
                          unlocked: isPinkCyanUnlocked,
                        },
                        {
                          id: 'green',
                          label: 'Grün',
                          unlocked: isGreenGoldUnlocked,
                        },
                        {
                          id: 'gold',
                          label: 'Gold',
                          unlocked: isGreenGoldUnlocked,
                        },
                      ] as {
                        id: NeonUnderglowColor;
                        label: string;
                        unlocked: boolean;
                      }[]
                    ).map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        disabled={!col.unlocked}
                        onClick={() =>
                          setUpgrades((u) => ({
                            ...u,
                            underglowEnabled: true,
                            underglowColor: col.id,
                          }))
                        }
                        className={`py-1 rounded font-mono text-[11px] font-bold border transition cursor-pointer ${
                          !col.unlocked
                            ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                            : upgrades.underglowColor === col.id &&
                              upgrades.underglowEnabled
                            ? 'bg-fuchsia-600 border-white text-white'
                            : 'bg-slate-800 border-slate-600 text-slate-200 hover:border-fuchsia-400'
                        }`}
                      >
                        {col.unlocked ? col.label : `🔒 ${col.label}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. 80er-Neon-Schweißbänder & Knicklicht-Armbänder */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col justify-between md:col-span-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-cyan-300">
                        5. 80er-Neon-Schweißbänder &amp; Knicklicht-Armbänder
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          setUpgrades((u) => ({
                            ...u,
                            wristbandsEnabled: !u.wristbandsEnabled,
                          }))
                        }
                        className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                          upgrades.wristbandsEnabled
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {upgrades.wristbandsEnabled ? 'ANGELEGT' : 'AUS'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Leuchtende 80er-Handgelenkbänder an beiden animierten
                      Skater-Armen – strahlen besonders intensiv im Blacklight
                      UV und ziehen bei schnellen Spins dezente Lichtspuren!
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {(
                      [
                        { id: 'pink', label: 'Neon-Pink' },
                        { id: 'cyan', label: 'Cyber-Cyan' },
                        { id: 'green', label: 'Laser-Grün' },
                        { id: 'gold', label: 'Gold-Gelb' },
                      ] as { id: NeonWristbandColor; label: string }[]
                    ).map((wb) => (
                      <button
                        key={wb.id}
                        type="button"
                        onClick={() =>
                          setUpgrades((u) => ({
                            ...u,
                            wristbandsEnabled: true,
                            wristbandColor: wb.id,
                          }))
                        }
                        className={`py-1.5 rounded font-mono text-xs font-bold border transition cursor-pointer ${
                          upgrades.wristbandsEnabled &&
                          upgrades.wristbandColor === wb.id
                            ? 'bg-cyan-500 border-white text-slate-950 shadow-[0_0_10px_rgba(34,211,238,0.45)]'
                            : 'bg-slate-800 border-slate-600 text-slate-200 hover:border-cyan-400'
                        }`}
                      >
                        {wb.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. 80er-Rollschuh-Anhänger (Pro-Shop Kategorie 6) */}
                <div className="p-3.5 rounded-xl bg-slate-900/95 border-2 border-amber-400/60 flex flex-col justify-between md:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-amber-300">
                        6. 80er-Rollschuh-Anhänger (Sichtbar an deinen Rollschuhen!)
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Kultige 80er-Anhänger direkt am Schnürsenkel deiner Skates – oder bei{' '}
                        <strong className="text-amber-300">10 / 10 Stempeln</strong> 1x komplett gratis einlösen!
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded bg-slate-950 border border-cyan-400/60 font-mono text-xs font-bold text-cyan-300">
                        ⭐ Punkte-Konto: {availableProShopPoints.toLocaleString('de-DE')} Pkt
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setUpgrades((u) => ({
                            ...u,
                            bonusPoints: (u.bonusPoints || 0) + 1000,
                          }))
                        }
                        title="1.000 Bonus-Punkte zum direkten Testen gutschreiben"
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-amber-400/50 font-mono text-[10px] text-amber-200 cursor-pointer"
                      >
                        +1.000 Pkt (Test)
                      </button>
                      {hasFreeProShopStampReward && (
                        <span className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-mono text-xs font-black animate-pulse">
                          🎫 10/10 Stempel-Gutschein: 1x Anhänger GRATIS!
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
                    {(
                      [
                        {
                          id: 'bell' as SkateCharmId,
                          title: '🔔 Klingel-Glöckchen',
                          cost: 500,
                          costLabel: '500 Pkt + Sound',
                          desc: 'Goldenes Glöckchen am Rollschuh – klingelt rhythmisch beim Rollen & Springen!',
                        },
                        {
                          id: 'teddy' as SkateCharmId,
                          title: '🧸 Mini-Teddybärchen',
                          cost: 1000,
                          costLabel: '1.000 Pkt',
                          desc: 'Kuscheliger 80er-Mini-Teddy direkt an beiden Schnürsenkeln.',
                        },
                        {
                          id: 'pompons' as SkateCharmId,
                          title: '🎀 Neon-Plüsch-Pompons',
                          cost: 1500,
                          costLabel: '1.500 Pkt',
                          desc: 'Zweifarbige Pink/Cyan-Plüschbommel im originalen 80s Roller-Disco-Stil.',
                        },
                        {
                          id: 'dice' as SkateCharmId,
                          title: '🎲 Retro-Plüschwürfel',
                          cost: 2000,
                          costLabel: '2.000 Pkt',
                          desc: 'Legendäre weiß-pinke 80er-Plüschwürfel an deinen Skates.',
                        },
                      ] as const
                    ).map((ch) => {
                      const unlocked = Boolean(upgrades.unlockedCharms?.[ch.id]);
                      const active = upgrades.activeCharm === ch.id;
                      const canAfford = availableProShopPoints >= ch.cost;
                      return (
                        <div
                          key={ch.id}
                          className={`p-3 rounded-xl border flex flex-col justify-between ${
                            active
                              ? 'bg-amber-950/45 border-2 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                              : unlocked
                              ? 'bg-slate-950/90 border-emerald-400/60'
                              : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-white">
                                {ch.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-amber-300 font-bold">
                                {unlocked ? '✓ Im Besitz' : ch.costLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1">
                              {ch.desc}
                            </p>
                          </div>

                          <div className="mt-2.5 flex flex-col gap-1">
                            {unlocked ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleBuyOrEquipCharm(ch.id, ch.cost, false)
                                }
                                className={`w-full py-1.5 rounded font-mono text-[11px] font-bold cursor-pointer transition ${
                                  active
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-400/50'
                                }`}
                              >
                                {active ? '✓ Am Rollschuh aktiv' : 'Anlegen'}
                              </button>
                            ) : (
                              <>
                                {hasFreeProShopStampReward && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleBuyOrEquipCharm(ch.id, ch.cost, true)
                                    }
                                    className="w-full py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-[10px] font-black cursor-pointer"
                                  >
                                    🎫 Gratis mit 10er-Stempelkarte!
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={!canAfford}
                                  onClick={() =>
                                    handleBuyOrEquipCharm(ch.id, ch.cost, false)
                                  }
                                  className={`w-full py-1.5 rounded font-mono text-[11px] font-bold transition ${
                                    canAfford
                                      ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer'
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  {canAfford
                                    ? `Kaufen (${ch.costLabel})`
                                    : `Noch ${(
                                        ch.cost - availableProShopPoints
                                      ).toLocaleString('de-DE')} Pkt nötig`}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 🕺 80er-Trick-Moves Section */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-fuchsia-500/50 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-mono font-bold text-xs md:text-sm uppercase text-fuchsia-300">
                    🕺 80er-Trick-Moves (Freischaltbar über Palladium-Aufgaben •
                    Steuerbar per Taste [1]–[4] oder HUD-Klick)
                  </h3>
                  <span className="font-mono text-[11px] text-amber-300">
                    Sichtbar für alle Spieler im Multiplayer!
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {[
                    {
                      id: 'spin360' as TrickMoveId,
                      key: 'Taste 1',
                      title: '🌀 360° Spin (Pirouette)',
                      unlockHint: 'Aufgabe #2 „Dauerläufer“ (20 Runden)',
                      unlocked: isMoveSpin360Unlocked,
                      desc: 'Schnelle 360°-Drehung aus der Fahrt mit ausgebreiteten Armen.',
                    },
                    {
                      id: 'backward' as TrickMoveId,
                      key: 'Taste 2',
                      title: '🔙 Backward Glide',
                      unlockHint: 'Aufgabe #3 „Slush- & Bloba-Pause“',
                      unlocked: isMoveBackwardUnlocked,
                      desc: 'Lässiges Rückwärts-Rollen im 80s-Boogie-Rhythmus mit Schulterblick.',
                    },
                    {
                      id: 'flamingo' as TrickMoveId,
                      key: 'Taste 3',
                      title: '🦩 Flamingo-Slide',
                      unlockHint: 'Aufgabe #4 „Windschatten“ (10 Sek.)',
                      unlocked: isMoveFlamingoUnlocked,
                      desc: 'Elegantes Einbein-Gleiten mit ausgestreckten Balance-Armen.',
                    },
                    {
                      id: 'starjump' as TrickMoveId,
                      key: 'Taste 4',
                      title: '⚡ Palladium Star-Jump',
                      unlockHint: 'Aufgabe #9 „Stuhl-Springer“ (3 Sprünge)',
                      unlocked: isMoveStarjumpUnlocked,
                      desc: 'Hoher Show-Sprung mit hochgerissenen Armen & Funken-Landung!',
                    },
                  ].map((mv) => (
                    <div
                      key={mv.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        mv.unlocked
                          ? 'bg-fuchsia-950/35 border-fuchsia-400/70'
                          : 'bg-slate-900/80 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-cyan-300 font-bold">
                            [{mv.key}]
                          </span>
                          <span
                            className={`font-mono text-[10px] font-bold ${
                              mv.unlocked
                                ? 'text-emerald-300'
                                : 'text-amber-300/80'
                            }`}
                          >
                            {mv.unlocked ? '✓ FREIGESCHALTET' : '🔒 GESPERRT'}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-white mt-1.5">
                          {mv.title}
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          {mv.desc}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                        {mv.unlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleTriggerTrickFromHud(mv.id);
                              setShowProShopModal(false);
                            }}
                            className="w-full py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-mono text-[11px] font-bold cursor-pointer"
                          >
                            🕺 Jetzt auf der Bahn ausführen [{mv.key}]
                          </button>
                        ) : (
                          <span className="block text-[10px] font-mono text-slate-400">
                            Freischaltung: {mv.unlockHint}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-400">
                  Tipp: Alle Bauteile &amp; 80er-Moves bleiben lokal in deinem
                  Browser gespeichert.
                </span>
                <button
                  type="button"
                  onClick={handleUnlockAllProShopForTesting}
                  className="px-3 py-1.5 rounded bg-fuchsia-950 hover:bg-fuchsia-900 border border-fuchsia-400/50 text-fuchsia-200 font-mono text-xs font-bold cursor-pointer"
                >
                  ⚡ Alle Pro-Shop Bauteile sofort freischalten (Test-Modus)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2B. KOMPAKTES INTERAKTIVES 16-BIT SPIND-MENÜ ("SPINDE", MAX ~320 PX)  */}
        {/* ===================================================================== */}
        {showLockerModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-xs"
            onClick={() => setShowLockerModal(false)}
          >
            <div
              className="w-full max-w-[320px] rounded-xl bg-[#10172A] border-2 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.45)] p-3.5 text-white font-mono"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🗄️</span>
                  <div>
                    <h3 className="font-bold text-xs text-cyan-300 uppercase tracking-wider">
                      SPIND #86 • PALLADIUM
                    </h3>
                    <p className="text-[9.5px] text-slate-400">
                      16-Bit Schließfach (Schließen mit × oder ESC)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLockerModal(false)}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-rose-900 border border-slate-600 text-slate-200 text-xs font-bold cursor-pointer flex items-center justify-center"
                  title="Schließen [ESC]"
                >
                  ×
                </button>
              </div>

              {/* SEKTION 1: MEIN SPIND (INVENTAR) */}
              <div className="mt-2.5 space-y-2">
                <div className="text-[10px] font-bold uppercase text-amber-300 tracking-wider">
                  🎒 Mein Spind (Inventar)
                </div>

                {/* Punktestand */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/90 border border-slate-700 text-[11px]">
                  <span className="text-slate-300">⭐ Punkte-Konto:</span>
                  <span className="font-bold text-amber-300">
                    {availableProShopPoints} Pkt
                  </span>
                </div>

                {/* Aktuelle Rollschuhe + VIP Disco-Rollschuhe Umschalter */}
                <div className="p-2 rounded bg-slate-900/90 border border-slate-700 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">🛼 Rollschuhe:</span>
                    <span className="font-bold text-cyan-200">
                      {lockerSettings.vipDiscoSkatesEquipped
                        ? '🪩 VIP Disco-Rollschuhe'
                        : hasOwnSkates
                        ? 'Eigene 80s Quads'
                        : hasRentedSkates
                        ? 'Leih-Rollschuhe'
                        : 'Straßenschuhe'}
                    </span>
                  </div>
                  {isIntroTourComplete(introTour) ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLockerSettings((prev) => ({
                          ...prev,
                          vipDiscoSkatesEquipped: !prev.vipDiscoSkatesEquipped,
                        }))
                      }
                      className={`w-full py-1 px-2 rounded border text-[10.5px] font-bold transition cursor-pointer ${
                        lockerSettings.vipDiscoSkatesEquipped
                          ? 'bg-amber-500/25 border-amber-300 text-amber-200'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                      }`}
                    >
                      {lockerSettings.vipDiscoSkatesEquipped
                        ? '✓ VIP Disco-Rollschuhe angelegt (+Speed & Gold-Glanz)'
                        : '🪩 VIP Disco-Rollschuhe anziehen'}
                    </button>
                  ) : (
                    <div className="text-[9.5px] text-slate-400">
                      🔒 VIP Disco-Rollschuhe: Schließe die 4 Schritte der
                      Einführung ab!
                    </div>
                  )}
                </div>

                {/* Getränke im Spind mit Trinken-Button */}
                <div className="p-2 rounded bg-slate-900/90 border border-slate-700 flex items-center justify-between gap-2 text-[11px]">
                  <div>
                    <div className="text-slate-200 font-bold">
                      🥤 Getränke: {lockerSettings.drinksInLocker || 0}x
                    </div>
                    <div className="text-[9.5px] text-slate-400">
                      Slush &amp; Bloba Speed-Boost
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={(lockerSettings.drinksInLocker || 0) <= 0}
                    onClick={handleDrinkFromLocker}
                    className={`px-2.5 py-1 rounded border text-[10.5px] font-bold transition ${
                      (lockerSettings.drinksInLocker || 0) > 0
                        ? 'bg-cyan-500 hover:bg-cyan-400 border-white text-slate-950 cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                        : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    🥤 Trinken
                  </button>
                </div>
              </div>

              {/* SEKTION 2: ANZEIGE & SOUND (SCHIEBEREGLER / TOGGLES) */}
              <div className="mt-3 pt-2.5 border-t border-slate-700 space-y-1.5">
                <div className="text-[10px] font-bold uppercase text-cyan-300 tracking-wider">
                  🎛️ Anzeige &amp; Sound (localStorage)
                </div>

                {(
                  [
                    {
                      key: 'showAiNames' as const,
                      label: 'KI-Namen',
                      desc: 'Standard: AUS (aufgeräumte Bahn)',
                      value: lockerSettings.showAiNames,
                      onToggle: () =>
                        setLockerSettings((prev) => ({
                          ...prev,
                          showAiNames: !prev.showAiNames,
                        })),
                    },
                    {
                      key: 'showOwnName' as const,
                      label: 'Eigener Name (JR)',
                      desc: 'Standard: AN',
                      value: lockerSettings.showOwnName,
                      onToggle: () =>
                        setLockerSettings((prev) => ({
                          ...prev,
                          showOwnName: !prev.showOwnName,
                        })),
                    },
                    {
                      key: 'showSpeechBubbles' as const,
                      label: 'Sprechblasen',
                      desc: 'Standard: AN',
                      value: lockerSettings.showSpeechBubbles,
                      onToggle: () =>
                        setLockerSettings((prev) => ({
                          ...prev,
                          showSpeechBubbles: !prev.showSpeechBubbles,
                        })),
                    },
                    {
                      key: 'discoSoundEnabled' as const,
                      label: 'Disco-Sound',
                      desc: 'Standard: AN',
                      value: lockerSettings.discoSoundEnabled && !isMuted,
                      onToggle: () => {
                        const nextSound = !(
                          lockerSettings.discoSoundEnabled && !isMuted
                        );
                        setLockerSettings((prev) => ({
                          ...prev,
                          discoSoundEnabled: nextSound,
                        }));
                        setIsMuted(!nextSound);
                        soundFX.setMuted(!nextSound);
                      },
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/90 border border-slate-700/90"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-slate-100">
                        {item.label}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {item.desc}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.value}
                      onClick={item.onToggle}
                      className={`relative w-11 h-5 rounded-full transition cursor-pointer border ${
                        item.value
                          ? 'bg-emerald-500/90 border-emerald-300'
                          : 'bg-slate-800 border-slate-600'
                      }`}
                    >
                      <span
                        className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                          item.value ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. PALLADIUM CHALLENGES MODAL (EINFÜHRUNG + 9 AUFGABEN)               */}
        {/* ===================================================================== */}
        {showChallengesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#111322] border-2 border-amber-400/70 shadow-2xl p-6 text-white">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-amber-300 uppercase">
                    Pflicht-Einführung (+20 Pkt je Schritt) • Pro-Shop &amp; Trick-Moves
                  </span>
                  <h2 className="font-display font-extrabold text-2xl text-white">
                    🏆 AUFGABENBOX ({completedChallengesCount}/
                    {PALLADIUM_CHALLENGES.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChallengesModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                >
                  Schließen
                </button>
              </div>

              {/* PFLICHT-EINFÜHRUNG GANZ OBEN IN DER AUFGABENBOX */}
              <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-indigo-950/90 via-slate-900/95 to-emerald-950/80 border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div>
                    <div className="font-mono text-[11px] text-emerald-300 uppercase font-bold">
                      Schritt-für-Schritt Start-Tour • Sofort +20 Punkte pro Station
                    </div>
                    <h3 className="font-display font-extrabold text-lg text-white">
                      🧭 Einführung: Palladium-Rundgang
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded font-mono text-xs font-bold border ${
                      isIntroTourComplete(introTour)
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-amber-500/20 border-amber-400 text-amber-200'
                    }`}
                  >
                    {isIntroTourComplete(introTour)
                      ? '🎉 Komplett (+20 Bonus-Pkt & VIP Disco-Rollschuhe!)'
                      : `${
                          (introTour.open_locker ? 1 : 0) +
                          (introTour.fetch_drink ? 1 : 0) +
                          (introTour.skate_rink ? 1 : 0) +
                          (introTour.try_ballspiel ? 1 : 0)
                        } / 4 erledigt`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        id: 'open_locker' as IntroStepId,
                        title: '1. Spind öffnen',
                        desc: 'Einmal auf die SPINDE klicken oder daran [E] drücken.',
                      },
                      {
                        id: 'fetch_drink' as IntroStepId,
                        title: '2. Getränk an der Gastro holen',
                        desc: 'Einmal die Gastro/Bar (SLUSH & BLOB) nutzen.',
                      },
                      {
                        id: 'skate_rink' as IntroStepId,
                        title: '3. Runde auf der Bahn drehen',
                        desc: 'Durch eine Schleuse auf die Rollfläche fahren.',
                      },
                      {
                        id: 'try_ballspiel' as IntroStepId,
                        title: '4. Ballspiel ausprobieren',
                        desc: 'Einmal im Ballspiel per [Space] oder Linksklick werfen/passen.',
                      },
                    ] as const
                  ).map((step) => {
                    const done = introTour[step.id];
                    return (
                      <div
                        key={step.id}
                        className={`p-2.5 rounded-lg border font-mono ${
                          done
                            ? 'bg-emerald-950/55 border-emerald-400 text-emerald-100'
                            : 'bg-slate-900/90 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>
                            {done ? '✅' : '⬜'} {step.title}
                          </span>
                          <span
                            className={
                              done ? 'text-emerald-300' : 'text-amber-300'
                            }
                          >
                            {done ? 'Erledigt (+20 Pkt)' : '+20 Punkte'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1 font-sans">
                          {step.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
                {PALLADIUM_CHALLENGES.map((ch, idx) => {
                  const introDone = isIntroTourComplete(introTour);
                  const st = challengesProgress[ch.id] || {
                    progress: 0,
                    completed: false,
                  };
                  const pct = Math.min(
                    100,
                    Math.round((st.progress / ch.target) * 100)
                  );
                  return (
                    <div
                      key={ch.id}
                      className={`p-3.5 rounded-xl border transition ${
                        !introDone
                          ? 'bg-slate-950/75 border-slate-800 opacity-75'
                          : st.completed
                          ? 'bg-emerald-950/35 border-emerald-400/60'
                          : 'bg-slate-900/90 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white">
                          {!introDone ? '🔒 ' : ''}
                          {idx + 1}. {ch.title}
                        </span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            !introDone
                              ? 'text-rose-300'
                              : st.completed
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                          }`}
                        >
                          {!introDone
                            ? '🔒 Erst Einführung abschließen'
                            : st.completed
                            ? '✓ ERFÜLLT'
                            : `${st.progress} / ${ch.target}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        {ch.description}
                      </p>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden my-2">
                        <div
                          className={`h-full ${
                            st.completed ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${introDone ? pct : 0}%` }}
                        />
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300">
                        🎁 Belohnung: {ch.rewardLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 4. HALLEN-SPIELE SELECTOR MODAL (BALLSPIEL, SLALOM, STUHLSPRUNG)      */}
        {/* ===================================================================== */}
        {showHallGamesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-[#120F24] border-2 border-fuchsia-400/70 shadow-2xl p-6 text-white">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-fuchsia-300 uppercase">
                    Klassische 80er-Rollschuhbahn-Events
                  </span>
                  <h2 className="font-display font-extrabold text-2xl text-white">
                    🎮 HALLEN-SPIELE AUSWÄHLEN
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHallGamesModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                >
                  Schließen
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
                {[
                  {
                    mode: 'free-skate' as HallGameMode,
                    title: '🛼 Freies Laufen (Standard)',
                    desc: 'Entspanntes Rollen mit Speed-Skater-Windschatten, Tänzern an der Spiegelwand und DJ Magic Force.',
                  },
                  {
                    mode: 'ballspiel' as HallGameMode,
                    title: '🟠 1. „Ballspiel“ (Abwerfen als Skate-Guard)',
                    desc: 'Du übernimmst sofort den Ball mit 16-Bit-Neon-Fadenkreuz! Wirf per [Space] oder Linksklick – liegende Bälle rollen nach 2,5s zu dir zurück.',
                  },
                  {
                    mode: 'slalom' as HallGameMode,
                    title: '🚧 2. „Slalom“ (Pylonen-Parcours)',
                    desc: 'Auf der oberen und unteren Geraden stehen leuchtende 80er-Slalom-Hütchen. Schlängle dich fehlerfrei für Combo-Punkte hindurch!',
                  },
                  {
                    mode: 'stuhlsprung' as HallGameMode,
                    title: '🪑 3. „Stuhl- & Hindernissprung“',
                    desc: 'Auf der Bahn stehen 1er-, 2er- und 3er-Klappstuhlreihen. Springe mit [J], [Shift] oder Pad-A darüber – bei einem Sturz eilt Sani-Sandra mit Kühlpack zur Hilfe!',
                  },
                  {
                    mode: 'springerstaffel' as HallGameMode,
                    title: '🤸‍♂️ 4. „Springerstaffel“ (Hochsprung-Gestell ab 60 cm)',
                    desc: 'Überspringe die 4 Hochsprung-Gestelle auf der Bahn! Startet bei 60 cm und steigt nach jeder fehlerfreien Runde um +20 cm.',
                  },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => {
                      setHallGameMode(item.mode);
                      setShowHallGamesModal(false);
                    }}
                    className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                      hallGameMode === item.mode
                        ? 'bg-fuchsia-950/80 border-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.4)]'
                        : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-sm text-white">
                      {item.title}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 6. 80s GLASS ENTRANCE DOOR WITH DRAWN CURTAINS (MAINTENANCE MODE)     */}
        {/* ===================================================================== */}
        {isBlockedByMaintenance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#070510] via-[#0e081a] to-[#05040a] p-4 overflow-hidden">
            {/* Ambient Neon Glow Shimmering Behind the Glass Doors */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-50">
              <div className="w-[540px] h-[540px] rounded-full bg-fuchsia-600/20 blur-3xl animate-pulse" />
              <div className="w-[420px] h-[420px] rounded-full bg-cyan-500/15 blur-3xl -ml-32" />
            </div>

            {/* 80s Metal-Framed Double Glass Entrance Door Assembly */}
            <div className="relative w-full max-w-2xl rounded-2xl bg-[#12101b] border-4 border-slate-500/80 shadow-[0_0_90px_rgba(0,0,0,0.95)] overflow-hidden">
              {/* Top Illuminated Foyer Header above the Glass Door */}
              <div className="px-6 py-3 bg-gradient-to-r from-slate-900 via-[#1b112c] to-slate-900 border-b-4 border-slate-600 flex items-center justify-between">
                <span className="font-mono text-xs text-cyan-300 tracking-widest uppercase">
                  ✦ EINGANG FOYER • HANAU-GRIMM CENTER ✦
                </span>
                <span className="font-mono text-[11px] text-amber-300">
                  {APP_VERSION_LABEL}
                </span>
              </div>

              {/* Double Glass Door Frame with Drawn Velvet Curtains Behind Glass */}
              <div className="relative grid grid-cols-2 min-h-[380px] bg-[#0b0714]">
                {/* Left Glass Door Wing + Drawn Crimson/Purple Velvet Curtain */}
                <div className="relative border-r-2 border-slate-500/80 overflow-hidden p-4 flex flex-col justify-between">
                  <div
                    className="absolute inset-0 opacity-90"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #3b0728 0px, #58103d 18px, #29041b 36px)',
                    }}
                  />
                  {/* Diagonal 80s Glass Reflection */}
                  <div className="pointer-events-none absolute -inset-10 bg-gradient-to-tr from-transparent via-white/8 to-transparent rotate-12" />
                  {/* Brass Door Handle Left */}
                  <div className="relative z-10 my-auto ml-auto mr-2 w-2.5 h-24 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 border border-amber-100 shadow-lg" />
                </div>

                {/* Right Glass Door Wing + Drawn Crimson/Purple Velvet Curtain */}
                <div className="relative border-l-2 border-slate-500/80 overflow-hidden p-4 flex flex-col justify-between">
                  <div
                    className="absolute inset-0 opacity-90"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(90deg, #29041b 0px, #58103d 18px, #3b0728 36px)',
                    }}
                  />
                  {/* Diagonal 80s Glass Reflection */}
                  <div className="pointer-events-none absolute -inset-10 bg-gradient-to-tr from-transparent via-white/8 to-transparent rotate-12" />
                  {/* Brass Door Handle Right */}
                  <div className="relative z-10 my-auto mr-auto ml-2 w-2.5 h-24 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 border border-amber-100 shadow-lg" />
                </div>

                {/* Hanging Neon Door Sign Mounted Across the Glass Door Center */}
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
                  <div
                    onDoubleClick={() => {
                      setPinInput('');
                      setPinError(null);
                      setShowAdminPinModal(true);
                    }}
                    title="Doppelklick oder Geheimtaste für Hallenleitung"
                    className="max-w-lg w-full rounded-2xl bg-[#100c1c]/95 border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.45)] p-6 text-center backdrop-blur-md"
                  >
                    <div className="inline-block px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 font-mono text-[11px] text-amber-300 font-bold mb-2">
                      🧹🛼 PALLADIUM ROLLER ARENA HANAU • TÜRSCHILD
                    </div>
                    <h2 className="font-display font-black text-xl md:text-2xl text-white tracking-wide">
                      🚧 Wegen Putz- &amp; Renovierungsarbeiten vorübergehend
                      geschlossen
                    </h2>
                    <p className="text-xs md:text-sm text-slate-300 mt-2 leading-relaxed">
                      Hinter den zugezogenen Vorhängen wird das Holzparkett
                      gerade frisch gebohnert und die 80er-Lichtanlage gewartet.
                    </p>
                    <div className="mt-4 px-4 py-2.5 rounded-xl bg-fuchsia-950/80 border border-fuchsia-400/70 font-mono text-sm md:text-base font-bold tracking-wider text-amber-200 shadow-[0_0_16px_rgba(232,121,249,0.3)]">
                      {adminSettings.maintenanceReopenText ||
                        '🚀 ALPHA STARTING SOON'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subtle, inconspicuous Admin backdoor trigger in the bottom-right corner */}
            <button
              type="button"
              onClick={() => {
                setPinInput('');
                setPinError(null);
                setShowAdminPinModal(true);
              }}
              title="Hallenleitung (Ctrl+Shift+A)"
              className="fixed bottom-2.5 right-3 z-50 px-2 py-1 rounded bg-slate-950/40 hover:bg-slate-900/90 border border-slate-700/30 hover:border-amber-400/50 text-slate-500 hover:text-amber-200 font-mono text-[10px] opacity-35 hover:opacity-100 transition cursor-pointer"
            >
              🔑 Admin-Hintereingang
            </button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 7. ADMIN PIN LOGIN MODAL (CTRL+SHIFT+A OR 3X LOGO CLICK)              */}
        {/* ===================================================================== */}
        {showAdminPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <form
              onSubmit={handleVerifyAdminPin}
              autoComplete="off"
              className="w-full max-w-sm rounded-2xl bg-[#140F23] border-2 border-rose-500/80 shadow-2xl p-6 text-white"
            >
              <div className="font-mono text-xs text-rose-400 uppercase">
                Versteckter Zugang • Hallenleiter-Regie
              </div>
              <h2 className="font-display font-extrabold text-xl mt-0.5">
                🔐 ADMIN-TERMINAL LOGIN
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Bitte persönliche Hallenleiter-PIN eingeben:
              </p>
              <input
                type="password"
                name="palladium_admin_pin_field"
                autoComplete="off"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                autoFocus
                className="mt-3 w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 font-mono text-center text-lg tracking-widest text-white focus:border-rose-400 focus:outline-none"
              />
              {pinError && (
                <div className="text-xs text-rose-400 font-mono mt-2">
                  {pinError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdminPinModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 font-mono text-xs cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-xs cursor-pointer"
                >
                  Entsperren
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 8. PIN-PROTECTED ADMIN TERMINAL ("HALLENLEITER-REGIE" - IPAD & DESKTOP)*/}
        {/* ===================================================================== */}
        {showAdminTerminal && isAdminUnlocked && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 overflow-y-auto backdrop-blur-sm">
            <div className="w-full max-w-[96vw] xl:max-w-[1720px] max-h-[96vh] overflow-y-auto rounded-2xl bg-[#120D20] border-2 border-rose-500 shadow-[0_0_60px_rgba(244,63,94,0.4)] p-3 text-white space-y-2.5">
              {/* Cleanly Fitted Header (flex-wrap, no clipping) */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/40 pb-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-display font-black text-base sm:text-lg xl:text-xl text-white">
                    🎛️ HALLENLEITER-REGIE — PALLADIUM HANAU
                  </h2>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-950/90 border border-rose-500/40 text-rose-300 uppercase">
                    PIN-GESCHÜTZT • 3-SPALTEN-REGIE
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300">
                    {APP_VERSION_LABEL}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !buildModeEnabled;
                      setBuildModeEnabled(nextState);
                      if (nextState) {
                        setShowAdminTerminal(false);
                      }
                    }}
                    className={`min-h-[34px] px-3 py-1 rounded font-mono text-xs font-bold border cursor-pointer transition ${
                      buildModeEnabled
                        ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_14px_rgba(251,191,36,0.6)]'
                        : 'bg-amber-950/90 hover:bg-amber-900 border-amber-400/70 text-amber-200'
                    }`}
                  >
                    🛠️ Baumenü: {buildModeEnabled ? 'AN (Live bearbeiten)' : 'AUS'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminUnlocked(false);
                      setBuildModeEnabled(false);
                      saveAdminUnlockedSession(false);
                      setShowAdminTerminal(false);
                    }}
                    className="min-h-[34px] px-3 py-1 rounded bg-rose-950 border border-rose-500/50 text-rose-200 font-mono text-xs cursor-pointer"
                  >
                    Abmelden
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminTerminal(false)}
                    className="min-h-[34px] px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold cursor-pointer"
                  >
                    Schließen
                  </button>
                </div>
              </div>

              {/* 3-COLUMN WIDESCREEN GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
                {/* ============================================================= */}
                {/* SPALTE 1: 1. MITTEL-ARENA & LIVE-BAND + 80s WEBRADIO/PLAYLIST */}
                {/* ============================================================= */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-mono font-bold text-xs uppercase text-amber-300">
                      1. MITTEL-ARENA &amp; LIVE-BAND-BOOKING
                    </h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'islands', label: '2 U-Inseln' },
                          { id: 'band', label: '🎸 Live-Band-Bühne' },
                          { id: 'cinema', label: '🎬 Kino-Leinwand' },
                        ] as { id: CenterStageMode; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setCenterStageMode(m.id)}
                          className={`min-h-[34px] py-1 px-1.5 rounded font-mono text-[11px] font-bold border cursor-pointer transition ${
                            centerStageMode === m.id
                              ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                              : 'bg-slate-800 text-slate-200 border-slate-600 hover:border-amber-400/60'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] text-slate-300 mb-1">
                        80s-Parodie-Band auf dem Bühnenbanner:
                      </label>
                      <div className="grid grid-cols-2 gap-1 mb-1.5">
                        {PARODY_BANDS.map((band) => (
                          <button
                            key={band}
                            type="button"
                            onClick={() => {
                              setActiveBandName(band);
                              setCustomBandInput('');
                              setCenterStageMode('band');
                              if (band === 'LAMIO') {
                                setBandSkinTone('black');
                              }
                            }}
                            className={`min-h-[32px] py-1 px-2 rounded font-mono text-[11px] border truncate cursor-pointer ${
                              activeBandName === band && !customBandInput
                                ? 'bg-fuchsia-600 border-white text-white font-bold'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            {band}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={customBandInput}
                        onChange={(e) => setCustomBandInput(e.target.value)}
                        placeholder="Oder eigener Bandname (Freitext)..."
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-white"
                      />
                    </div>

                    {/* Band-Besetzung (Hautfarbe & Geschlecht) + Konzertbeleuchtung */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-fuchsia-500/35 space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block font-mono text-[10px] uppercase text-fuchsia-300 font-bold mb-0.5">
                            Hautfarbe:
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: 'black', label: 'Schw.' },
                                { id: 'white', label: 'Weiß' },
                                { id: 'mixed', label: 'Mix' },
                              ] as { id: BandSkinToneMode; label: string }[]
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setBandSkinTone(opt.id)}
                                className={`py-1 px-1 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                  bandSkinTone === opt.id
                                    ? 'bg-fuchsia-600 border-white text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="block font-mono text-[10px] uppercase text-cyan-300 font-bold mb-0.5">
                            Geschlecht:
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: 'male', label: 'Männl.' },
                                { id: 'female', label: 'Weibl.' },
                                { id: 'mixed', label: 'Mix' },
                              ] as { id: BandGenderMode; label: string }[]
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setBandGender(opt.id)}
                                className={`py-1 px-1 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                  bandGender === opt.id
                                    ? 'bg-cyan-500 border-white text-slate-950'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-800/90 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase text-amber-300 font-bold">
                          🔦 Konzertlicht:
                        </span>
                        <div className="grid grid-cols-3 gap-1 flex-1">
                          {(
                            [
                              { id: 'auto', label: 'Auto' },
                              { id: 'on', label: 'Immer An' },
                              { id: 'off', label: 'Aus' },
                            ] as { id: ConcertLightingMode; label: string }[]
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setAdminSettings((s) => ({
                                  ...s,
                                  concertLightingMode: opt.id,
                                }))
                              }
                              className={`py-0.5 px-1.5 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                adminSettings.concertLightingMode === opt.id
                                  ? 'bg-amber-400 border-white text-slate-950'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-800/90 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase text-pink-300 font-bold">
                          💃 Background-Tänzer:
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              backgroundDancersEnabled: !(
                                s.backgroundDancersEnabled ?? true
                              ),
                            }))
                          }
                          className={`py-0.5 px-2.5 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                            adminSettings.backgroundDancersEnabled ?? true
                              ? 'bg-pink-500 border-white text-white shadow-[0_0_10px_rgba(236,72,153,0.45)]'
                              : 'bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          💃 Background-Tänzer:{' '}
                          {(adminSettings.backgroundDancersEnabled ?? true)
                            ? 'AN'
                            : 'AUS'}
                        </button>
                      </div>
                    </div>

                    {/* 📻 80er-WEBRADIO / MIX-MANAGER & PLAYLIST-UI */}
                    <div className="p-2.5 rounded-lg bg-slate-950/95 border border-cyan-400/50 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] font-bold uppercase text-cyan-300">
                          📻 80er-Webradio &amp; Mix-Playlist
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold ${
                            radioStreamStatus === 'streaming'
                              ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                              : radioStreamStatus === 'synth-fallback'
                              ? 'bg-fuchsia-500/20 border border-fuchsia-400 text-fuchsia-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {radioStreamStatus === 'streaming'
                            ? '📡 WEBRADIO LIVE'
                            : radioStreamStatus === 'synth-fallback'
                            ? '🎹 80s SYNTH-MIX AKTIV'
                            : '⏹️ BEREIT'}
                        </span>
                      </div>

                      {/* Transport Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevTrack}
                          className="min-h-[30px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 font-mono text-[10px] cursor-pointer"
                        >
                          ⏮️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isRadioPlaying) {
                              soundFX.stopRadio();
                            } else {
                              handlePlayTrackAtIndex(currentTrackIdx);
                            }
                          }}
                          className={`min-h-[30px] flex-1 py-0.5 px-2 rounded font-mono text-[11px] font-bold border cursor-pointer ${
                            isRadioPlaying
                              ? 'bg-rose-600 hover:bg-rose-500 border-white text-white'
                              : 'bg-emerald-400 hover:bg-emerald-300 border-white text-slate-950'
                          }`}
                        >
                          {isRadioPlaying ? '⏹️ Stop Mix' : '▶️ 80s Mix starten'}
                        </button>
                        <button
                          type="button"
                          onClick={handleNextTrack}
                          className="min-h-[30px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 font-mono text-[10px] cursor-pointer"
                        >
                          ⏭️
                        </button>
                        <button
                          type="button"
                          onClick={() => setRadioShuffle((s) => !s)}
                          title="Shuffle"
                          className={`min-h-[30px] px-2 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                            radioShuffle
                              ? 'bg-fuchsia-600 border-white text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          🔀
                        </button>
                        <button
                          type="button"
                          onClick={() => setRadioRepeat((r) => !r)}
                          title="Repeat"
                          className={`min-h-[30px] px-2 py-0.5 rounded font-mono text-[10px] border cursor-pointer ${
                            radioRepeat
                              ? 'bg-cyan-500 border-white text-slate-950 font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          🔁
                        </button>
                      </div>

                      {/* Track List */}
                      <div className="max-h-24 overflow-y-auto space-y-1 pr-0.5">
                        {radioPlaylist.map((tr, idx) => {
                          const isCurrent = idx === currentTrackIdx;
                          return (
                            <div
                              key={tr.id}
                              className={`flex items-center justify-between gap-1 px-2 py-1 rounded border text-[10px] font-mono ${
                                isCurrent
                                  ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 font-bold'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-300'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handlePlayTrackAtIndex(idx)}
                                className="flex-1 text-left truncate cursor-pointer"
                              >
                                {isCurrent && isRadioPlaying ? '🔊 ' : '🎵 '}
                                {tr.title}{' '}
                                <span className="text-slate-400">
                                  ({tr.bpm} BPM)
                                </span>
                              </button>
                              {tr.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = radioPlaylist.filter(
                                      (item) => item.id !== tr.id
                                    );
                                    setRadioPlaylist(
                                      next.length > 0
                                        ? next
                                        : [...DEFAULT_80S_RADIO_PLAYLIST]
                                    );
                                    if (currentTrackIdx >= next.length) {
                                      setCurrentTrackIdx(0);
                                    }
                                  }}
                                  className="text-rose-400 hover:text-white px-1 cursor-pointer"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Custom Stream / Mix Track */}
                      <div className="flex gap-1 pt-1 border-t border-slate-800">
                        <input
                          type="text"
                          value={newTrackTitle}
                          onChange={(e) => setNewTrackTitle(e.target.value)}
                          placeholder="Neuer Mix/Radio-Titel..."
                          className="flex-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-white"
                        />
                        <input
                          type="text"
                          value={newTrackUrl}
                          onChange={(e) => setNewTrackUrl(e.target.value)}
                          placeholder="MP3/Stream-URL (optional)"
                          className="flex-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-200"
                        />
                        <select
                          value={newTrackStyle}
                          onChange={(e) =>
                            setNewTrackStyle(
                              e.target.value as RadioTrackItem['synthStyle']
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-200"
                        >
                          <option value="electro-boogie">Electro</option>
                          <option value="miami-bass">Miami 808</option>
                          <option value="italo-disco">Italo</option>
                          <option value="funk-jam">Funk</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const t = newTrackTitle.trim();
                            if (!t) return;
                            const added: RadioTrackItem = {
                              id: `custom_mix_${Date.now()}`,
                              title: t,
                              subtitle: 'Custom Palladium Mix',
                              streamUrl: newTrackUrl.trim() || undefined,
                              synthStyle: newTrackStyle,
                              bpm: 120,
                              isCustom: true,
                            };
                            const next = [...radioPlaylist, added];
                            setRadioPlaylist(next);
                            setNewTrackTitle('');
                            setNewTrackUrl('');
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 🎬 AUTO-KINO-ZEITPLAN (DIREKT UNTER DER WEBRADIO-BOX, MEHRFACH-WOCHENTAGE Mo-So) */}
                    <div className="p-2 rounded-lg bg-slate-950/95 border border-cyan-400/45 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase text-cyan-300">
                          🎬 Auto-Kino-Zeitplan (Wochentage &amp; Uhrzeit):
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaScheduleEnabled: !s.cinemaScheduleEnabled,
                            }))
                          }
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                            adminSettings.cinemaScheduleEnabled
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {adminSettings.cinemaScheduleEnabled ? 'AN' : 'AUS'}
                        </button>
                      </div>

                      {/* Multi-selectable weekday buttons (Mo - So, default Mi & Sa) */}
                      <div className="grid grid-cols-7 gap-1">
                        {(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const).map(
                          (day) => {
                            const activeDays =
                              Array.isArray(adminSettings.cinemaWeekdays) &&
                              adminSettings.cinemaWeekdays.length > 0
                                ? adminSettings.cinemaWeekdays
                                : ['Mi', 'Sa'];
                            const isDayActive = activeDays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const nextDays = isDayActive
                                    ? activeDays.filter((d) => d !== day)
                                    : [...activeDays, day];
                                  setAdminSettings((s) => ({
                                    ...s,
                                    cinemaWeekdays:
                                      nextDays.length > 0 ? nextDays : [day],
                                  }));
                                }}
                                className={`py-1 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                  isDayActive
                                    ? 'bg-cyan-400 text-slate-950 border-white shadow-[0_0_8px_rgba(34,211,238,0.4)]'
                                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-cyan-400/50'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                        <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-slate-400">Von:</span>
                          <input
                            type="time"
                            value={adminSettings.cinemaStartTime || '20:00'}
                            onChange={(e) =>
                              setAdminSettings((s) => ({
                                ...s,
                                cinemaStartTime: e.target.value,
                              }))
                            }
                            className="w-full bg-transparent text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                          <span className="text-slate-400">Bis:</span>
                          <input
                            type="time"
                            value={adminSettings.cinemaEndTime || '22:00'}
                            onChange={(e) =>
                              setAdminSettings((s) => ({
                                ...s,
                                cinemaEndTime: e.target.value,
                              }))
                            }
                            className="w-full bg-transparent text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ⏳ LEINWAND-COUNTDOWN (80ER 7-SEGMENT-UHR AUF DER KINO-LEINWAND) */}
                    <div className="p-2 rounded-lg bg-slate-950/95 border border-fuchsia-500/45 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold uppercase text-fuchsia-300">
                          ⏳ LEINWAND-COUNTDOWN (TAGE : STD : MIN : SEK)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextState =
                              !adminSettings.cinemaCountdownEnabled;
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaCountdownEnabled: nextState,
                            }));
                            if (nextState) {
                              setCenterStageMode('cinema');
                            }
                          }}
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                            adminSettings.cinemaCountdownEnabled
                              ? 'bg-emerald-400 text-slate-950 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {adminSettings.cinemaCountdownEnabled ? 'AN' : 'AUS'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <input
                          type="text"
                          value={
                            adminSettings.cinemaCountdownTitle ||
                            'NÄCHSTER LIVE-STREAM'
                          }
                          onChange={(e) =>
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaCountdownTitle: e.target.value,
                            }))
                          }
                          placeholder="Titel (z.B. NÄCHSTER LIVE-STREAM)"
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-200"
                        />
                        <input
                          type="datetime-local"
                          value={(
                            adminSettings.cinemaCountdownTargetIso || ''
                          ).slice(0, 16)}
                          onChange={(e) =>
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaCountdownTargetIso: e.target.value,
                            }))
                          }
                          className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* SPALTE 2: 2. HALLENLICHT / NEBEL / DJ-JINGLES, 3. EVENT, 4. WARTUNG */}
                {/* ============================================================= */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-mono font-bold text-xs uppercase text-cyan-300">
                        2. HALLENLICHT / NEBEL / DJ-JINGLES
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          setAdminSettings((s) => ({
                            ...s,
                            fullHallPutzlichtEnabled:
                              !s.fullHallPutzlichtEnabled,
                          }))
                        }
                        title="Schaltet das helle Putzlicht für die gesamte Halle inkl. Außenbereiche ein/aus"
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                          adminSettings.fullHallPutzlichtEnabled
                            ? 'bg-amber-300 text-slate-950 border-white shadow-[0_0_10px_rgba(253,224,71,0.5)]'
                            : 'bg-slate-800 text-slate-300 border-slate-600'
                        }`}
                      >
                        💡 Voll-Putzlicht (Gesamte Halle):{' '}
                        {adminSettings.fullHallPutzlichtEnabled ? 'AN' : 'AUS'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                      {(
                        [
                          { id: 'disco', label: '🪩 Disco-Spots' },
                          { id: 'blacklight', label: '🟣 Blacklight UV' },
                          { id: 'putzlicht', label: '💡 Putzlicht' },
                          { id: 'slow-skating', label: '🕯️ Slow Skating' },
                        ] as { id: LightingMode; label: string }[]
                      ).map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLightingMode(l.id)}
                          className={`min-h-[34px] py-1.5 px-1 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                            lightingMode === l.id
                              ? 'bg-cyan-400 text-slate-950 border-white'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>

                    {/* 15-Minuten Blacklight Timer Steuerung */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-fuchsia-500/40 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-fuchsia-200">
                          Auto-Blacklight-Timer (15 Min.):
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              autoBlacklightEnabled: !s.autoBlacklightEnabled,
                            }))
                          }
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                            adminSettings.autoBlacklightEnabled
                              ? 'bg-fuchsia-500 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {adminSettings.autoBlacklightEnabled ? 'AN' : 'AUS'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={handleStart15MinBlacklight}
                          className="min-h-[30px] flex-1 py-0.5 px-2 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-mono text-[10px] font-bold cursor-pointer"
                        >
                          🟣 15 Min. Blacklight starten
                        </button>
                        {blacklightTimerSec > 0 && (
                          <span className="px-2 py-0.5 rounded bg-fuchsia-950 border border-fuchsia-400 font-mono text-[10px] text-fuchsia-200 font-bold">
                            ⏱️ {Math.floor(blacklightTimerSec / 60)}:
                            {String(blacklightTimerSec % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 80er-Disco-Nebelmaschine (gerichteter Ausstoß am Disco-Tower) & Trillerpfeife */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-cyan-500/40 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              fogMachineEnabled: !s.fogMachineEnabled,
                            }))
                          }
                          className={`min-h-[32px] flex-1 py-1 px-2 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                            adminSettings.fogMachineEnabled
                              ? 'bg-cyan-500 text-slate-950 border-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                              : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}
                        >
                          🌫️ Disconebel:{' '}
                          {adminSettings.fogMachineEnabled ? 'AN' : 'AUS'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFogBurstCount((c) => c + 1)}
                          className="min-h-[32px] py-1 px-2 rounded bg-indigo-700 hover:bg-indigo-600 border border-indigo-400/60 text-white font-mono text-[10px] font-bold transition cursor-pointer"
                        >
                          💨 Nebelstoß
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              skateGuardWhistleEnabled:
                                !s.skateGuardWhistleEnabled,
                            }))
                          }
                          className={`min-h-[32px] py-1 px-2 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                            adminSettings.skateGuardWhistleEnabled
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}
                        >
                          📯 Pfeife:{' '}
                          {adminSettings.skateGuardWhistleEnabled ? 'AN' : 'AUS'}
                        </button>
                      </div>
                    </div>

                    {/* 🎙️ DJ-JINGLE & SPRACHMEMO-PULT (OHNE BROWSER-ROBOTERSTIMME! 20% AUTO-DUCKING) */}
                    <div className="p-2 rounded-lg bg-slate-950/95 border border-amber-400/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase text-amber-300">
                          🎙️ DJ-Jingle &amp; Sprachmemo-Pult (Auto-Ducking 20%):
                        </span>
                        <span className="font-mono text-[9px] text-slate-400">
                          .mp3 / .m4a / .wav / .ogg
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          adminSettings.djJingleSlots || DEFAULT_DJ_JINGLE_SLOTS
                        ).map((slot) => {
                          const isPlayingSlot = activeJingleSlotId === slot.id;
                          const hasCustomAudio = Boolean(slot.audioUrl);
                          return (
                            <div
                              key={slot.id}
                              className="flex items-center gap-0.5"
                            >
                              <button
                                type="button"
                                onClick={() => handleTriggerDjJingle(slot)}
                                className={`min-h-[30px] flex-1 px-1.5 py-1 rounded-l font-mono text-[10px] font-bold border text-left truncate cursor-pointer transition ${
                                  isPlayingSlot
                                    ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                                    : 'bg-slate-900 hover:bg-slate-800 text-amber-100 border-slate-700'
                                }`}
                              >
                                {slot.label}
                                {hasCustomAudio ? ' 🎵' : ''}
                              </button>
                              <button
                                type="button"
                                title="Eigene Sprachmemo / Audio-Datei (.mp3, .m4a, .wav, .ogg) oder URL hinterlegen"
                                onClick={() =>
                                  setEditingJingleSlotId((curr) =>
                                    curr === slot.id ? null : slot.id
                                  )
                                }
                                className={`min-h-[30px] px-1.5 py-1 rounded-r border-y border-r font-mono text-[10px] cursor-pointer ${
                                  editingJingleSlotId === slot.id ||
                                  hasCustomAudio
                                    ? 'bg-fuchsia-700 border-fuchsia-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                              >
                                📂
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* 🎛️ 5 WEB-AUDIO DJ-SOUNDBOARD BUTTONS IM DJ-PULT */}
                      <div className="pt-1.5 border-t border-slate-800 space-y-1">
                        <span className="block font-mono text-[9.5px] font-bold uppercase text-fuchsia-300">
                          🎛️ DJ-Soundboard (5 Live Web-Audio-Sounds):
                        </span>
                        <div className="grid grid-cols-5 gap-1">
                          {(
                            [
                              {
                                id: 'airhorn' as DjSoundboardEffectId,
                                label: '[1] Airhorn',
                              },
                              {
                                id: 'scratch' as DjSoundboardEffectId,
                                label: '[2] Scratch',
                              },
                              {
                                id: 'laser' as DjSoundboardEffectId,
                                label: '[3] Laser-Zap',
                              },
                              {
                                id: 'fog-hiss' as DjSoundboardEffectId,
                                label: '[4] Nebel',
                              },
                              {
                                id: 'applause' as DjSoundboardEffectId,
                                label: '[5] Applaus',
                              },
                            ] as const
                          ).map((sb) => (
                            <button
                              key={sb.id}
                              type="button"
                              onClick={() =>
                                handleTriggerDjSoundboard(sb.id, sb.label)
                              }
                              className="min-h-[28px] px-1 py-0.5 rounded bg-fuchsia-950 hover:bg-fuchsia-800 border border-fuchsia-400/60 text-fuchsia-100 font-mono text-[9px] font-bold cursor-pointer truncate transition"
                            >
                              {sb.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {editingJingleSlotId && (
                        <div className="p-1.5 rounded bg-slate-900 border border-fuchsia-400/50 space-y-1 text-[10px] font-mono">
                          {(() => {
                            const slots =
                              adminSettings.djJingleSlots ||
                              DEFAULT_DJ_JINGLE_SLOTS;
                            const targetSlot = slots.find(
                              (s) => s.id === editingJingleSlotId
                            );
                            if (!targetSlot) return null;
                            return (
                              <>
                                <div className="flex items-center justify-between text-fuchsia-200">
                                  <span>
                                    Audio für:{' '}
                                    <strong>{targetSlot.label}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingJingleSlotId(null)}
                                    className="text-slate-400 hover:text-white cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={targetSlot.audioUrl || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const nextSlots = slots.map((item) =>
                                        item.id === targetSlot.id
                                          ? { ...item, audioUrl: val }
                                          : item
                                      );
                                      setAdminSettings((s) => ({
                                        ...s,
                                        djJingleSlots: nextSlots,
                                      }));
                                    }}
                                    placeholder="Audio-URL (.mp3/.m4a/.wav/.ogg)..."
                                    className="flex-1 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-200"
                                  />
                                  <label className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer whitespace-nowrap">
                                    Upload
                                    <input
                                      type="file"
                                      accept=".mp3,.m4a,.wav,.ogg,audio/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          if (
                                            typeof reader.result === 'string'
                                          ) {
                                            const nextSlots = slots.map(
                                              (item) =>
                                                item.id === targetSlot.id
                                                  ? {
                                                      ...item,
                                                      audioUrl:
                                                        reader.result as string,
                                                      fileName: file.name,
                                                    }
                                                  : item
                                            );
                                            setAdminSettings((s) => ({
                                              ...s,
                                              djJingleSlots: nextSlots,
                                            }));
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }}
                                    />
                                  </label>
                                  {targetSlot.audioUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextSlots = slots.map((item) =>
                                          item.id === targetSlot.id
                                            ? {
                                                ...item,
                                                audioUrl: '',
                                                fileName: undefined,
                                              }
                                            : item
                                        );
                                        setAdminSettings((s) => ({
                                          ...s,
                                          djJingleSlots: nextSlots,
                                        }));
                                      }}
                                      className="px-1.5 py-0.5 rounded bg-rose-800 text-white cursor-pointer"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* 3. HALLEN-SPIEL / EVENT & HALLENDICHTE / TEMPO */}
                    <div className="pt-1 border-t border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono font-bold text-xs uppercase text-fuchsia-300">
                          3. HALLEN-SPIEL / EVENT &amp; HALLENDICHTE
                        </h3>
                        {hallGameMode === 'ballspiel' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-400 font-mono text-[10px] text-amber-200 font-bold">
                            🏐 IM SPIEL: {telemetry.ballspielRemaining} /{' '}
                            {telemetry.ballspielTotal}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: 'free-skate', label: 'Frei' },
                            { id: 'ballspiel', label: 'Ballspiel' },
                            { id: 'slalom', label: '🚧 Slalom' },
                            { id: 'stuhlsprung', label: 'Stuhlsprung' },
                            { id: 'springerstaffel', label: '🤸‍♂️ Springerstaffel' },
                          ] as { id: HallGameMode; label: string }[]
                        ).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setHallGameMode(g.id)}
                            className={`min-h-[30px] py-1 px-1 rounded font-mono text-[9.5px] font-bold border cursor-pointer truncate ${
                              hallGameMode === g.id
                                ? 'bg-fuchsia-500 text-white border-white'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                      {/* 3er-Schalter HALLENDICHTE / TEMPO kompakt in der Hallenleiter-Regie */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        <span className="font-mono text-[10px] font-bold text-cyan-300 uppercase shrink-0">
                          🏁 HALLENDICHTE / TEMPO:
                        </span>
                        <div className="grid grid-cols-3 gap-1 flex-1">
                          {(
                            [
                              { id: 'beginner' as SingleplayerDifficulty, label: '🟢 Anfänger' },
                              { id: 'intermediate' as SingleplayerDifficulty, label: '🟡 Mittel' },
                              { id: 'pro' as SingleplayerDifficulty, label: '🔴 Profi' },
                            ] as const
                          ).map((lvl) => (
                            <button
                              key={lvl.id}
                              type="button"
                              onClick={() => setDifficulty(lvl.id)}
                              className={`min-h-[26px] py-0.5 px-1.5 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                                difficulty === lvl.id
                                  ? 'bg-cyan-500 text-slate-950 border-white'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400/50'
                              }`}
                            >
                              {lvl.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 📹 ECHTZEIT-LIVE-KAMERA / HALLEN-RÜCKFAHRKAMERA IM REGIE-PULT (INKL. SOFORTIGER STYLE-VORSCHAU!) */}
                    <div className="p-2 rounded-lg bg-slate-950 border border-rose-500/50 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          📹 LIVE HALLEN-MONITOR (RÜCKFAHRKAMERA)
                        </span>
                        <span className="text-amber-300 font-bold">
                          STYLE-VORSCHAU: {selectedStyleTile.toUpperCase()}
                        </span>
                      </div>
                      <div className="relative w-full aspect-video rounded overflow-hidden border border-slate-700 bg-black">
                        <canvas
                          id="admin-live-monitor-canvas"
                          width={384}
                          height={216}
                          className="w-full h-full object-cover"
                        />
                        <div className="pointer-events-none absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-mono text-emerald-300 bg-black/65 px-1.5 py-0.5 rounded">
                          <span>
                            CAM 01 • LOOK: {selectedStyleTile.toUpperCase()}
                          </span>
                          <span>
                            TEMPO: {telemetry.speed.toFixed(1)} km/h • RUNDEN:{' '}
                            {telemetry.laps}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. WARTUNGSMODUS („Vor der Glastür mit zugezogenen Vorhängen“) */}
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-amber-200">
                        4. WARTUNGSMODUS („Vor der Glastür“):
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAdminSettings((s) => ({
                            ...s,
                            isMaintenanceMode: !s.isMaintenanceMode,
                          }))
                        }
                        className={`min-h-[32px] px-3 py-1 rounded font-mono text-xs font-bold cursor-pointer ${
                          adminSettings.isMaintenanceMode
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {adminSettings.isMaintenanceMode ? 'AKTIV' : 'AUS'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={adminSettings.maintenanceReopenText || ''}
                      onChange={(e) =>
                        setAdminSettings((s) => ({
                          ...s,
                          maintenanceReopenText: e.target.value,
                        }))
                      }
                      placeholder="Türschild-Hinweis (z.B. 🚀 ALPHA STARTING SOON)"
                      className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-amber-200"
                    />
                  </div>
                </div>

                {/* ============================================================= */}
                {/* SPALTE 3: 5. TWITCH-STREAM & DJ-PRESETS + 6. GEISTER-SKATER   */}
                {/* ============================================================= */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 flex flex-col justify-between">
                  {/* 5. TWITCH-STREAM & DJ-PRESETS */}
                  <div className="space-y-1.5">
                    <h3 className="font-mono font-bold text-xs uppercase text-fuchsia-300">
                      5. TWITCH-STREAM &amp; DJ-PRESETS
                    </h3>

                    <div className="p-2 rounded-lg bg-slate-950/90 border border-fuchsia-500/35 space-y-1.5">
                      <span className="block font-mono text-[10px] uppercase text-fuchsia-300 font-bold">
                        Gespeicherte DJ-Presets (Twitch, Lauftext &amp; DJ-Pult):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {guestDjPresets.map((dj) => {
                          const isSelected =
                            adminSettings.activeDjName === dj.name &&
                            adminSettings.twitchChannel === dj.twitchChannel;
                          return (
                            <div
                              key={dj.id}
                              className={`inline-flex items-center rounded border text-[10px] font-mono transition ${
                                isSelected
                                  ? 'bg-fuchsia-600 border-white text-white font-bold shadow-[0_0_8px_rgba(232,121,249,0.4)]'
                                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-fuchsia-400/60'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setAdminSettings((s) => ({
                                    ...s,
                                    activeDjName: dj.name,
                                    twitchChannel: dj.twitchChannel,
                                    djTickerText: dj.tickerText,
                                  }))
                                }
                                className="px-2 py-0.5 cursor-pointer"
                              >
                                🎧 {dj.name}
                                {dj.isResident ? ' (Res.)' : ''}
                              </button>
                              {!dj.isResident && (
                                <button
                                  type="button"
                                  title="Gast-DJ Preset löschen"
                                  onClick={() => {
                                    const next = guestDjPresets.filter(
                                      (item) => item.id !== dj.id
                                    );
                                    setGuestDjPresets(next);
                                    saveGuestDjPresets(next);
                                    if (adminSettings.activeDjName === dj.name) {
                                      setAdminSettings((s) => ({
                                        ...s,
                                        activeDjName: DEFAULT_DJ_NAME,
                                        twitchChannel: DEFAULT_TWITCH_CHANNEL,
                                        djTickerText: DEFAULT_DJ_TICKER,
                                      }));
                                    }
                                  }}
                                  className="px-1.5 py-0.5 text-rose-300 hover:text-white border-l border-slate-700 cursor-pointer"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-1 border-t border-slate-800/90 space-y-1">
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="text"
                            value={newGuestDjName}
                            onChange={(e) => setNewGuestDjName(e.target.value)}
                            placeholder="DJ-Name (z.B. DJ Sven)"
                            className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-white"
                          />
                          <input
                            type="text"
                            value={newGuestDjChannel}
                            onChange={(e) =>
                              setNewGuestDjChannel(e.target.value)
                            }
                            placeholder="Twitch-Kanal (z.B. dj_sven)"
                            className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-white"
                          />
                        </div>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newGuestDjTicker}
                            onChange={(e) =>
                              setNewGuestDjTicker(e.target.value)
                            }
                            placeholder="Optionaler eigener LED-Lauftext..."
                            className="flex-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nameClean = newGuestDjName.trim();
                              const chanClean = newGuestDjChannel.trim();
                              if (!nameClean || !chanClean) return;
                              const tickerClean = newGuestDjTicker.trim()
                                ? newGuestDjTicker.trim()
                                : `+++ ON AIR: ${nameClean.toUpperCase()} +++ KLECKNIX TWIN-DECKS +++ LIVE IM PALLADIUM HANAU +++`;
                              const newPreset: GuestDjPreset = {
                                id: `guest_dj_${Date.now()}`,
                                name: nameClean,
                                twitchChannel: chanClean,
                                tickerText: tickerClean,
                                isResident: false,
                              };
                              const nextList = [...guestDjPresets, newPreset];
                              setGuestDjPresets(nextList);
                              saveGuestDjPresets(nextList);
                              setAdminSettings((s) => ({
                                ...s,
                                activeDjName: newPreset.name,
                                twitchChannel: newPreset.twitchChannel,
                                djTickerText: newPreset.tickerText,
                              }));
                              setNewGuestDjName('');
                              setNewGuestDjChannel('');
                              setNewGuestDjTicker('');
                            }}
                            className="px-2 py-0.5 rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-mono font-bold text-[10px] cursor-pointer whitespace-nowrap"
                          >
                            + Gast-DJ
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="text"
                        value={adminSettings.activeDjName || DEFAULT_DJ_NAME}
                        onChange={(e) =>
                          setAdminSettings((s) => ({
                            ...s,
                            activeDjName: e.target.value,
                          }))
                        }
                        placeholder="DJ-Name am Pult..."
                        className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-cyan-300"
                      />
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={adminSettings.twitchChannel}
                          onChange={(e) =>
                            setAdminSettings((s) => ({
                              ...s,
                              twitchChannel: e.target.value,
                            }))
                          }
                          className="flex-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              activeDjName: DEFAULT_DJ_NAME,
                              twitchChannel: DEFAULT_TWITCH_CHANNEL,
                              djTickerText: DEFAULT_DJ_TICKER,
                            }))
                          }
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300 cursor-pointer"
                        >
                          Resident
                        </button>
                      </div>
                    </div>

                    {/* YouTube Video/Playlist URL & Kino-Leinwand Quelle */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-cyan-500/35 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] text-cyan-300 font-bold uppercase">
                          🎬 Kino-Leinwand Quelle (Auto-Ducking 0%):
                        </span>
                        <div className="flex gap-1">
                          {(
                            [
                              { id: 'twitch', label: 'Twitch' },
                              { id: 'youtube', label: 'YouTube' },
                              { id: 'visualizer', label: '80s Visualizer' },
                            ] as const
                          ).map((srcOpt) => (
                            <button
                              key={srcOpt.id}
                              type="button"
                              onClick={() =>
                                setAdminSettings((s) => ({
                                  ...s,
                                  cinemaStreamSource: srcOpt.id,
                                }))
                              }
                              className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold border cursor-pointer ${
                                (adminSettings.cinemaStreamSource ||
                                  'twitch') === srcOpt.id
                                  ? 'bg-cyan-400 text-slate-950 border-white'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {srcOpt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={adminSettings.youtubeUrl || ''}
                        onChange={(e) =>
                          setAdminSettings((s) => ({
                            ...s,
                            youtubeUrl: e.target.value,
                            cinemaStreamSource: e.target.value.trim()
                              ? 'youtube'
                              : s.cinemaStreamSource,
                          }))
                        }
                        placeholder="YouTube Video- oder Playlist-URL (https://www.youtube.com/watch?v=...)"
                        className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-200"
                      />
                      <div className="text-[9px] font-mono text-slate-400">
                        💡 Hinweis: YouTube-Videos/Playlists müssen auf{' '}
                        <strong className="text-amber-200">Öffentlich</strong>{' '}
                        oder{' '}
                        <strong className="text-amber-200">
                          Nicht gelistet
                        </strong>{' '}
                        stehen. Wenn offline/blockiert, läuft automatisch der{' '}
                        <strong className="text-fuchsia-300">
                          80s PALLADIUM LIVE Equalizer
                        </strong>
                        !
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="font-mono text-[10px] text-slate-300">
                          80er-LED-Matrix-Lauftext über dem DJ-Tower:
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              djTickerText: DEFAULT_DJ_TICKER,
                            }))
                          }
                          className="text-[10px] font-mono text-cyan-300 hover:underline cursor-pointer"
                        >
                          Reset Lauftext
                        </button>
                      </div>
                      <input
                        type="text"
                        value={adminSettings.djTickerText}
                        onChange={(e) =>
                          setAdminSettings((s) => ({
                            ...s,
                            djTickerText: e.target.value,
                          }))
                        }
                        className="w-full px-2 py-1 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono text-amber-300"
                      />
                    </div>
                  </div>

                  {/* 6. GEISTER-SKATER MANAGER (STANDARDMÄSSIG LEER) & HALLEN-CREW NAMEN */}
                  <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono font-bold text-[11px] uppercase text-cyan-300">
                        6. GEISTER-SKATER MANAGER (FREI DEFINIERBAR)
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          setAdminSettings((s) => ({
                            ...s,
                            ghostSkatersEnabled: !s.ghostSkatersEnabled,
                          }))
                        }
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer ${
                          adminSettings.ghostSkatersEnabled
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        Geister-Skater:{' '}
                        {adminSettings.ghostSkatersEnabled ? 'AN' : 'AUS'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 min-h-[20px]">
                      {specialSkaters.length === 0 ? (
                        <span className="text-[10px] font-mono text-slate-400 italic">
                          Keine Geister-Skater eingetragen – füge unten eigene
                          Ehrengäste hinzu.
                        </span>
                      ) : (
                        specialSkaters.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/50 font-mono text-[10px] text-cyan-200"
                          >
                            👻 {name}
                            <button
                              type="button"
                              onClick={() => {
                                const next = specialSkaters.filter(
                                  (n) => n !== name
                                );
                                setSpecialSkaters(next);
                                saveSpecialSkaters(next);
                              }}
                              className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newGhostName}
                        onChange={(e) => setNewGhostName(e.target.value)}
                        placeholder="Neuer Geister-Skater..."
                        className="flex-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newGhostName.trim()) return;
                          const next = [...specialSkaters, newGhostName.trim()];
                          setSpecialSkaters(next);
                          saveSpecialSkaters(next);
                          setNewGhostName('');
                        }}
                        className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono font-bold text-[10px] cursor-pointer"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSpecialSkaters([]);
                          saveSpecialSkaters([]);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] cursor-pointer"
                      >
                        Leeren
                      </button>
                    </div>

                    {/* 👥 HALLEN-CREW UMBENENNEN (DJ, Light Jockey, Skate-Guard, Lehrerin, Krankenschwester) */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-amber-400/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold uppercase text-amber-300">
                          👥 Hallen-Crew Namen (localStorage):
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              crewNames: { ...DEFAULT_CREW_NAMES },
                            }))
                          }
                          className="text-[9px] font-mono text-cyan-300 hover:underline cursor-pointer"
                        >
                          Standard
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[9.5px] font-mono">
                        {(
                          [
                            { key: 'dj', label: '🎧 DJ' },
                            { key: 'lightJockey', label: '💡 Light-Jockey' },
                            { key: 'skateGuard', label: '🦺 Skate-Guard' },
                            { key: 'rollerTeacher', label: '🛼 Lehrerin' },
                            { key: 'nurse', label: '➕ Sani-Schwester' },
                            { key: 'security', label: '🛡️ Security' },
                          ] as { key: keyof CrewNamesConfig; label: string }[]
                        ).map((cField) => (
                          <div key={cField.key} className="flex flex-col">
                            <span className="text-[8.5px] text-slate-400">
                              {cField.label}:
                            </span>
                            <input
                              type="text"
                              value={
                                adminSettings.crewNames?.[cField.key] ??
                                DEFAULT_CREW_NAMES[cField.key]
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setAdminSettings((s) => ({
                                  ...s,
                                  crewNames: {
                                    ...(s.crewNames || DEFAULT_CREW_NAMES),
                                    [cField.key]: val,
                                  },
                                  ...(cField.key === 'dj'
                                    ? { activeDjName: val }
                                    : {}),
                                }));
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 🌐 MULTIPLAYER-SPASSRAUM (LIVE-SESSION PER PEERJS) */}
                  <div className="p-2 rounded-lg bg-slate-950/95 border border-emerald-400/50 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-mono font-bold text-[11px] uppercase text-emerald-300">
                        🌐 MULTIPLAYER-SPASSRAUM (LIVE-SESSION)
                      </h3>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-400/50 font-mono text-[10px] font-bold text-emerald-200">
                        {mpRole === 'host'
                          ? `${remotePlayers.length + 1} Skater live in der Halle`
                          : 'Solo-Modus (KI aktiv)'}
                      </span>
                    </div>

                    {mpRole !== 'host' ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {MULTIPLAYER_OUTFIT_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              title={`Outfit-Farbe: ${c.label}`}
                              onClick={() => setPlayerShirtColor(c.hex)}
                              style={{ backgroundColor: c.hex }}
                              className={`w-4 h-4 rounded-full border cursor-pointer ${
                                playerShirtColor === c.hex
                                  ? 'border-2 border-white scale-110'
                                  : 'border-slate-700 opacity-75'
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenHostRoom('palladium-hanau-89')}
                          className="min-h-[34px] flex-1 py-1 px-2.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-bold text-[11px] cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                        >
                          🚀 Multiplayer-Raum öffnen
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            readOnly
                            value={inviteRoomUrl}
                            className="flex-1 px-2 py-0.5 rounded bg-slate-900 border border-emerald-500/40 font-mono text-[10px] text-emerald-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                typeof navigator !== 'undefined' &&
                                navigator.clipboard
                              ) {
                                navigator.clipboard.writeText(inviteRoomUrl);
                                setInviteCopied(true);
                                window.setTimeout(
                                  () => setInviteCopied(false),
                                  2500
                                );
                              }
                            }}
                            className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono font-bold text-[10px] cursor-pointer whitespace-nowrap"
                          >
                            {inviteCopied
                              ? '✅ Link kopiert!'
                              : '📋 Einladungs-Link kopieren'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseHostRoom}
                            className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] cursor-pointer whitespace-nowrap"
                          >
                            🛑 Raum schließen
                          </button>
                        </div>

                        {/* Live Visitor List + Kick Button */}
                        <div className="flex flex-wrap items-center gap-1 max-h-12 overflow-y-auto">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/50 font-mono text-[10px] text-emerald-200">
                            ★ {playerName || 'Host'} (Host)
                          </span>
                          {remotePlayers.map((rp) => (
                            <span
                              key={rp.peerId}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-cyan-400/50 font-mono text-[10px] text-cyan-100"
                            >
                              <span
                                className="w-2 h-2 rounded-full inline-block"
                                style={{
                                  backgroundColor: rp.shirtColor || '#00f0ff',
                                }}
                              />
                              {rp.name}
                              <button
                                type="button"
                                title="Besucher aus dem Raum werfen (Kick)"
                                onClick={() => handleKickGuest(rp.peerId)}
                                className="ml-0.5 px-1 rounded bg-rose-900 hover:bg-rose-700 text-rose-200 text-[9px] font-bold cursor-pointer"
                              >
                                Kick
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {mpNotice && (
                      <div className="text-[9px] font-mono text-cyan-300 truncate">
                        {mpNotice}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* =============================================================== */}
              {/* VOLLE BREITE DARUNTER: 🎨 BAHN-STYLES & EPOCHEN-LOOKS           */}
              {/* =============================================================== */}
              <div className="p-3 rounded-xl bg-slate-900/95 border-2 border-fuchsia-500/50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-mono font-bold text-xs uppercase text-fuchsia-300">
                      🎨 BAHN-STYLES &amp; EPOCHEN-LOOKS (VORSCHAU &amp; FREISCHALTUNG)
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Look auswählen – zuerst nur für dich testen oder dauerhaft
                      für alle Besucher freischalten:
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-emerald-400/50 text-emerald-300">
                      Live für alle:{' '}
                      <strong>
                        {publishedStyle === 'palladium-1989'
                          ? '📼 Palladium 1989'
                          : publishedStyle === 'pixel-16bit'
                          ? '👾 16-Bit Pixel-Art'
                          : '🕹️ Classic Neon'}
                      </strong>
                    </span>
                    {previewStyle && (
                      <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-400 text-amber-200">
                        👁️ Vorschau aktiv:{' '}
                        <strong>
                          {previewStyle === 'palladium-1989'
                            ? 'Palladium 1989'
                            : previewStyle === 'pixel-16bit'
                            ? '16-Bit Pixel-Art'
                            : 'Classic Neon'}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Wählbare Style-Kacheln */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'classic-neon' as ArenaVisualStyle,
                        title: '🕹️ Classic Neon (Bisheriger Look)',
                        desc: 'Vertrauter 80er-Neon-Look mit klarem Farbschema, leuchtender Rückwand und geschmeidigen 2.5D-Figuren (Standard).',
                      },
                      {
                        id: 'palladium-1989' as ArenaVisualStyle,
                        title: '📼 Palladium 1989 (Original-Halle)',
                        desc: 'Fensterlose dunkle Wände mit 80er-Neon/Chrom-Ornamenten, violette Blacklight-Deckenröhren, goldene Discokugel-Lichtpunkte & 1989-Mittelsäulen-Leinwand mit 80er-Projektor.',
                      },
                      {
                        id: 'pixel-16bit' as ArenaVisualStyle,
                        title: '👾 16-Bit Pixel-Art (Arcade-Look)',
                        desc: 'Zeichnet Skater, NPCs und Hallenelemente im echten 16-Bit-Retro-Pixel-Stil (imageSmoothingEnabled = false, dunkle 1px-Outlines, Retro-Farbpalette).',
                      },
                    ]
                  ).map((tile) => {
                    const isSelected = selectedStyleTile === tile.id;
                    const isLive = publishedStyle === tile.id;
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => setSelectedStyleTile(tile.id)}
                        className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-fuchsia-950/90 border-2 border-fuchsia-400 shadow-[0_0_16px_rgba(232,121,249,0.35)]'
                            : 'bg-slate-950/90 hover:bg-slate-900 border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="font-mono font-bold text-xs text-white">
                              {tile.title}
                            </span>
                            {isLive && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 font-mono text-[9px] font-bold">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-300 leading-snug">
                            {tile.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Aktions-Buttons + 16-Bit Ganzkörper-Figuren Schalter + 7. Einlass-Resets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminPreviewStyle(selectedStyleTile);
                        setStyleFeedbackToast(
                          `👁️ Admin-Vorschau aktiv: „${selectedStyleTile}“ ist jetzt live für deine Sitzung sichtbar!`
                        );
                        setShowAdminTerminal(false);
                      }}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs cursor-pointer transition shadow-[0_0_12px_rgba(251,191,36,0.35)]"
                    >
                      👁️ Nur für mich testen (Admin-Vorschau)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminPreviewStyle(null);
                        setAdminSettings((s) => ({
                          ...s,
                          liveArenaStyle: selectedStyleTile,
                        }));
                        setStyleFeedbackToast(
                          `🚀 Style „${selectedStyleTile}“ wurde dauerhaft in localStorage für alle Besucher freigeschaltet!`
                        );
                        soundFX.playChallengeUnlocked();
                      }}
                      className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-bold text-xs cursor-pointer transition shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                    >
                      🚀 Ausgewählten Style für alle freischalten
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAdminSettings((s) => ({
                          ...s,
                          pixel16BitFiguresEnabled: !s.pixel16BitFiguresEnabled,
                        }))
                      }
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg font-mono font-bold text-xs border cursor-pointer transition ${
                        adminSettings.pixel16BitFiguresEnabled ||
                        selectedStyleTile === 'pixel-16bit'
                          ? 'bg-fuchsia-600 text-white border-white shadow-[0_0_12px_rgba(232,121,249,0.4)]'
                          : 'bg-slate-800 text-slate-300 border-slate-600'
                      }`}
                    >
                      👾 16-Bit Ganzkörper-Figuren (24×32):{' '}
                      {adminSettings.pixel16BitFiguresEnabled ||
                      selectedStyleTile === 'pixel-16bit'
                        ? 'AN'
                        : 'AUS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrtFilterEnabled((v) => !v)}
                      className={`min-h-[34px] px-2.5 py-1 rounded-lg font-mono font-bold text-xs border cursor-pointer transition ${
                        crtFilterEnabled
                          ? 'bg-cyan-500 text-slate-950 border-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                          : 'bg-slate-800 text-slate-300 border-slate-600'
                      }`}
                    >
                      📺 80er-CRT-Filter (Scanlines):{' '}
                      {crtFilterEnabled ? 'AN' : 'AUS'}
                    </button>
                    {styleFeedbackToast && (
                      <span className="text-[10px] font-mono text-cyan-300">
                        {styleFeedbackToast}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-300">
                    <span>
                      Stempel:{' '}
                      <strong
                        className={
                          entryPass?.locked
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }
                      >
                        {entryPass?.locked ? 'FIXIERT' : 'FREI'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetEntryPassFromAdmin}
                      className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 font-mono font-bold text-[10px] cursor-pointer"
                    >
                      🎟️ Stempel-Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setHallStats(resetHallStats())}
                      className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-mono text-[10px] cursor-pointer"
                    >
                      📊 Statistik-Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetEntryPass();
                        setEntryPass(null);
                        setHasRentedSkates(false);
                        setDrinkChipAvailable(true);
                        saveHasEnteredBefore(false);
                        saveHideChronik(false);
                        setHideChronik(false);
                        setHasEnteredBefore(false);
                        setIsCurtainOpen(false);
                        setShowChronicleModal(true);
                        setShowAdminTerminal(false);
                      }}
                      className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-[10px] cursor-pointer"
                    >
                      🎭 8. First-Visit-Vorhang Reset
                    </button>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* 7. EXKLUSIVE HALLEN-STATISTIK NUR IM ADMINBEREICH             */}
                {/* ============================================================= */}
                <div className="pt-2 border-t border-slate-800/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs uppercase text-cyan-300">
                      📊 Hallen-Statistik (Exklusiv im Admin-Bereich • localStorage)
                    </span>
                    <button
                      type="button"
                      onClick={() => setHallStats(resetHallStats())}
                      className="px-2.5 py-0.5 rounded bg-rose-950/90 hover:bg-rose-900 border border-rose-400/60 text-rose-200 font-mono text-[10px] font-bold cursor-pointer"
                    >
                      🗑️ Statistik zurücksetzen
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="px-3 py-2 rounded-lg bg-slate-950/95 border border-emerald-400/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">
                          Aktuell auf Bahn
                        </div>
                        <div className="font-display font-black text-lg text-emerald-300 leading-tight">
                          {activePlayersOnRink}
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 font-mono text-[9px] text-emerald-300">
                        LIVE
                      </span>
                    </div>

                    <div className="px-3 py-2 rounded-lg bg-slate-950/95 border border-cyan-400/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">
                          Gestartete Solositzungen
                        </div>
                        <div className="font-display font-black text-lg text-cyan-300 leading-tight">
                          {hallStats.soloSessionsStarted ?? hallStats.totalSessions}
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-slate-500">
                        Solo
                      </span>
                    </div>

                    <div className="px-3 py-2 rounded-lg bg-slate-950/95 border border-indigo-400/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">
                          Multiplayer-Sitzungen
                        </div>
                        <div className="font-display font-black text-lg text-indigo-300 leading-tight">
                          {hallStats.multiplayerSessionsStarted ?? 0}
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-indigo-300/80">
                        🌐 Runden
                      </span>
                    </div>

                    <div className="px-3 py-2 rounded-lg bg-slate-950/95 border border-fuchsia-400/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">
                          MP-Besucher &amp; Peak
                        </div>
                        <div className="font-display font-black text-base text-fuchsia-300 leading-tight">
                          {hallStats.totalMultiplayerVisitorsSeen ?? 0} Ges. /{' '}
                          {hallStats.peakConcurrentMultiplayerPlayers ?? 1} Max
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-slate-500">
                        Gäste
                      </span>
                    </div>

                    <div className="px-3 py-2 rounded-lg bg-slate-950/95 border border-sky-400/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">
                          Besucher heute
                        </div>
                        <div className="font-display font-black text-lg text-sky-300 leading-tight">
                          {visitsToday}
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-slate-500">
                        {todayDateStr}
                      </span>
                    </div>

                    <div className="px-3 py-2 rounded-lg bg-slate-950/95 border border-amber-400/50 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">
                          Stoßzeit (Peak)
                        </div>
                        <div className="font-mono font-bold text-xs sm:text-sm text-amber-300 leading-tight">
                          {peakHourText}
                        </div>
                      </div>
                      <span className="font-mono text-[9px] text-amber-300/80">
                        ⏰
                      </span>
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* 🛠️ BAUMENÜ (RAUM-MODULE, KI-SKATER ANKERPUNKTE & HITBOX-DEBUG)*/}
                {/* ============================================================= */}
                <div className="pt-2.5 border-t border-slate-800/90 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-mono font-bold text-xs uppercase text-amber-300">
                        🛠️ BAUMENÜ (RAUM-MODULE, KI-SKATER &amp; ROTE DEBUG-HITBOXEN)
                      </h3>
                      <span className="text-[10px] font-mono text-slate-400">
                        Maus-Drag-&amp;-Drop direkt auf dem Spielfeld • Pfeiltasten{' '}
                        <strong className="text-cyan-300">1 px</strong> /{' '}
                        <strong className="text-cyan-300">Shift + Pfeil 10 px</strong> •
                        Single-Source-of-Truth Kollision
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBuildModeEnabled((v) => !v)}
                        className={`min-h-[30px] px-3 py-1 rounded font-mono text-[11px] font-bold border cursor-pointer transition ${
                          buildModeEnabled
                            ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                            : 'bg-slate-800 text-slate-200 border-slate-600 hover:border-amber-400'
                        }`}
                      >
                        🛠️ Baumenü-Modus: {buildModeEnabled ? 'AN' : 'AUS'}
                      </button>

                      {buildModeEnabled && (
                        <button
                          type="button"
                          onClick={() => setShowAdminTerminal(false)}
                          className="min-h-[30px] px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono text-[10px] font-bold cursor-pointer"
                        >
                          🎯 Auf Spielfeld verschieben (Regie ausblenden)
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyCustomCoordinatesJson}
                        className="min-h-[30px] px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-[10px] font-bold cursor-pointer"
                        title="Kopiert den kompletten DEFAULT_LAYOUT Code-Block (inkl. START/ENDE Kommentarzeilen) für deinen HTML-Editor"
                      >
                        {coordsCopiedToast
                          ? '✅ DEFAULT_LAYOUT Code-Block kopiert!'
                          : '📋 Code-Block kopieren'}
                      </button>

                      <button
                        type="button"
                        onClick={handleResetCustomLayout}
                        className="min-h-[30px] px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 border border-rose-400/60 text-rose-200 font-mono text-[10px] font-bold cursor-pointer"
                      >
                        ↩️ Standard-Layout
                      </button>
                    </div>
                  </div>

                  {/* Compact Grid of all 9 Movable Room Modules (incl. SPINDE, w/h +/- & ↻ Drehen) + AI Skaters & Crew Anchors */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-[10px] font-mono">
                    {/* A) 9 Raum-Module (inkl. SPINDE, Skalieren w/h, Drehen rot & dynamischer Hitbox) */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-cyan-500/40 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-cyan-300 font-bold">
                        <span>
                          📦 9 Raum-Module (inkl. SPINDE • Zieh-Eck • [R] Drehen):
                        </span>
                        <span className="text-[9px] text-rose-300">
                          ■ Rot = Hitbox • ⚓ Grün = gateLeft/gateRight
                        </span>
                      </div>

                      {/* Compact W / H (+/-) & ↻ Drehen toolbar for the currently selected Room Module */}
                      {selectedBuildItemId?.startsWith('mod:') && (() => {
                        const selModId = selectedBuildItemId.slice(4) as EditableModuleId;
                        const selMod = customLayout.modules[selModId];
                        if (!selMod) return null;
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 rounded bg-slate-900/95 border border-amber-400/60 text-[10px]">
                            <span className="font-bold text-amber-300 truncate">
                              🎯 {selMod.label} ({Math.round(selMod.x)}, {Math.round(selMod.y)})
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-300">Breite (w):</span>
                              <button
                                type="button"
                                onClick={() => handleAdjustSelectedModuleSizeOrRot(-8, 0, 0)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <span className="text-cyan-300 font-bold min-w-[28px] text-center">
                                {Math.round(selMod.width)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustSelectedModuleSizeOrRot(8, 0, 0)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold cursor-pointer"
                              >
                                +
                              </button>

                              <span className="text-slate-300 ml-1">Höhe (h):</span>
                              <button
                                type="button"
                                onClick={() => handleAdjustSelectedModuleSizeOrRot(0, -8, 0)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold cursor-pointer"
                              >
                                −
                              </button>
                              <span className="text-cyan-300 font-bold min-w-[28px] text-center">
                                {Math.round(selMod.height)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustSelectedModuleSizeOrRot(0, 8, 0)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold cursor-pointer"
                              >
                                +
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAdjustSelectedModuleSizeOrRot(0, 0, 45)}
                                className="ml-1 px-2 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300 text-amber-200 font-bold cursor-pointer"
                                title="Um 45° drehen (oder Taste R auf dem Spielfeld)"
                              >
                                ↻ Drehen ({Math.round(selMod.rot || 0)}°)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAdjustSelectedModuleSizeOrRot(0, 0, 90)}
                                className="px-1.5 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-400/60 text-cyan-200 font-bold cursor-pointer"
                                title="Um 90° drehen (Shift+R)"
                              >
                                +90°
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {(
                          Object.keys(
                            customLayout.modules
                          ) as EditableModuleId[]
                        ).map((modId) => {
                          const m = customLayout.modules[modId];
                          const itemKey = `mod:${modId}`;
                          const isSelected = selectedBuildItemId === itemKey;
                          return (
                            <button
                              key={modId}
                              type="button"
                              onClick={() => {
                                setSelectedBuildItemId(itemKey);
                                if (!buildModeEnabled) {
                                  setBuildModeEnabled(true);
                                }
                              }}
                              className={`p-1.5 rounded border text-left transition cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-400/20 border-amber-300 text-amber-200 font-bold'
                                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              <div className="truncate text-[9.5px] font-bold">
                                {m.label}
                              </div>
                              <div className="text-[8.5px] text-cyan-300">
                                {Math.round(m.x)},{Math.round(m.y)} • {Math.round(m.width)}×{Math.round(m.height)}
                                {m.rot ? ` • ${Math.round(m.rot)}°` : ''}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* B) KI-Skater & Crew feste Ankerpunkte (homeX / homeY) */}
                    <div className="p-2 rounded-lg bg-slate-950/90 border border-fuchsia-500/40 space-y-1.5">
                      <div className="flex items-center justify-between text-fuchsia-300 font-bold">
                        <span>
                          🛼 KI-Skater &amp; Crew Ankerpunkte (homeX / homeY):
                        </span>
                        <span className="text-[9px] text-emerald-300">
                          Dauerhaft bei Reload &amp; Event-Ende
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 max-h-28 overflow-y-auto pr-0.5">
                        {editableNpcList.map((npc) => {
                          const saved = customLayout.npcAnchors[npc.id];
                          const hx = Math.round(
                            saved ? saved.homeX : npc.homeX ?? npc.x
                          );
                          const hy = Math.round(
                            saved ? saved.homeY : npc.homeY ?? npc.y
                          );
                          const itemKey = `npc:${npc.id}`;
                          const isSelected = selectedBuildItemId === itemKey;
                          return (
                            <button
                              key={npc.id}
                              type="button"
                              onClick={() => {
                                setSelectedBuildItemId(itemKey);
                                if (!buildModeEnabled) {
                                  setBuildModeEnabled(true);
                                }
                              }}
                              className={`p-1 rounded border text-left transition cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-400/20 border-amber-300 text-amber-200 font-bold'
                                  : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              <div className="truncate text-[9px] font-bold">
                                {npc.name}
                              </div>
                              <div className="text-[8.5px] text-fuchsia-300">
                                X:{hx} • Y:{hy}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 9. 80s MULTIPLAYER INVITATION WELCOME MODAL (?room=<RAUM_ID>)         */}
        {/* ===================================================================== */}
        {showGuestJoinModal && initialUrlRoomId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-2xl bg-[#120D20] border-2 border-cyan-400 shadow-[0_0_55px_rgba(0,240,255,0.45)] p-5 text-white space-y-4">
              <div className="text-center space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/60 font-mono text-[10px] text-cyan-300 uppercase">
                  🌐 Live-Einladung • Raum: {initialUrlRoomId} • {APP_VERSION_LABEL}
                </span>
                <h2 className="font-display font-black text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-amber-200 to-fuchsia-400">
                  Willkommen im Palladium Hanau!
                </h2>
                <p className="text-xs text-slate-300">
                  Du betrittst die echte 24/7-Multiplayer-Bahn – rolle live mit
                  deinen Freunden zur 80er-Show!
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-mono text-xs text-cyan-300 mb-1">
                    Dein Skater-Name auf der Bahn (Pflichtfeld, mind. 2 Zeichen):
                  </label>
                  <input
                    type="text"
                    maxLength={22}
                    value={guestJoinNameInput}
                    onChange={(e) => {
                      setGuestJoinNameInput(e.target.value);
                      if (guestJoinError) setGuestJoinError(null);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        guestJoinNameInput.trim().length >= 2 &&
                        mpStatus !== 'connecting'
                      ) {
                        handleConnectAsGuest(
                          initialUrlRoomId,
                          guestJoinNameInput,
                          playerShirtColor
                        );
                      }
                    }}
                    placeholder="Dein Name oder Spitzname..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-400/60 font-mono text-sm text-white focus:outline-none focus:border-amber-300"
                  />
                  {guestJoinError && (
                    <div className="mt-1.5 px-2.5 py-1.5 rounded bg-rose-950/90 border border-rose-400 text-rose-200 font-mono text-xs font-bold">
                      ⚠️ {guestJoinError}
                    </div>
                  )}
                </div>

                <div>
                  <span className="block font-mono text-xs text-fuchsia-300 mb-1.5">
                    Deine 80er-Outfit-Farbe:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {MULTIPLAYER_OUTFIT_COLORS.map((col) => {
                      const active = playerShirtColor === col.hex;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setPlayerShirtColor(col.hex)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border font-mono text-xs transition cursor-pointer ${
                            active
                              ? 'bg-slate-900 border-2 border-white text-white font-bold shadow-[0_0_12px_rgba(255,255,255,0.35)]'
                              : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/60 shrink-0"
                            style={{ backgroundColor: col.hex }}
                          />
                          <span className="truncate">{col.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={
                    guestJoinNameInput.trim().length < 2 ||
                    mpStatus === 'connecting'
                  }
                  onClick={() =>
                    handleConnectAsGuest(
                      initialUrlRoomId,
                      guestJoinNameInput,
                      playerShirtColor
                    )
                  }
                  className={`flex-1 py-2.5 px-4 rounded-xl font-mono font-black text-sm transition ${
                    guestJoinNameInput.trim().length >= 2 &&
                    mpStatus !== 'connecting'
                      ? 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 text-slate-950 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:brightness-110'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  {mpStatus === 'connecting'
                    ? '⏳ Prüfe Namen & verbinde...'
                    : '🛼 Jetzt live in die Halle rollen!'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 10. DIGITALE 10er-STEMPELKARTE MODAL (localStorage)                   */}
        {/* ===================================================================== */}
        {showStampCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl bg-[#140F26] border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.35)] p-5 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-amber-300 uppercase">
                    Palladium Hanau Treuepass • Gespeichert im localStorage
                  </span>
                  <h2 className="font-display font-black text-2xl text-white">
                    🎫 DIGITALE 10er-STEMPELKARTE ({stampCard.stamps} / 10)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStampCardModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                >
                  Schließen
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, idx) => {
                  const num = idx + 1;
                  const stamped = num <= stampCard.stamps;
                  return (
                    <div
                      key={num}
                      className={`p-2.5 rounded-xl border text-center font-mono transition ${
                        stamped
                          ? 'bg-amber-400/20 border-2 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                          : 'bg-slate-900/80 border-slate-700 text-slate-500'
                      }`}
                    >
                      <div className="text-[10px]">BESUCH #{num}</div>
                      <div className="text-lg font-black mt-0.5">
                        {stamped ? (num === 10 ? '🎁' : '🛼') : '○'}
                      </div>
                      <div className="text-[9px] mt-0.5">
                        {num === 1
                          ? 'Freigetränk'
                          : num === 10
                          ? 'Pro-Shop Gratis'
                          : stamped
                          ? 'Gestempelt'
                          : 'Offen'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/40 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono font-bold text-cyan-300">
                    🍹 1x Start-Freigetränk nach Wahl (Stempel #1 im Bistro):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFreeDrinkChoice('slush');
                        const next: StampCardData = {
                          ...stampCard,
                          welcomeDrinkChoice: 'slush',
                        };
                        setStampCard(next);
                        saveStampCard(next);
                      }}
                      className={`px-2.5 py-1 rounded font-mono text-xs font-bold border cursor-pointer ${
                        stampCard.welcomeDrinkChoice === 'slush'
                          ? 'bg-cyan-400 text-slate-950 border-white'
                          : 'bg-slate-900 text-cyan-200 border-slate-700'
                      }`}
                    >
                      🍧 Slush Puppy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFreeDrinkChoice('bloba');
                        const next: StampCardData = {
                          ...stampCard,
                          welcomeDrinkChoice: 'bloba',
                        };
                        setStampCard(next);
                        saveStampCard(next);
                      }}
                      className={`px-2.5 py-1 rounded font-mono text-xs font-bold border cursor-pointer ${
                        stampCard.welcomeDrinkChoice === 'bloba'
                          ? 'bg-amber-400 text-slate-950 border-white'
                          : 'bg-slate-900 text-amber-200 border-slate-700'
                      }`}
                    >
                      🥤 Bloba Cola
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300">
                  Pro Besuchstag kommt automatisch <strong>1 Stempel</strong> dazu. Bei{' '}
                  <strong className="text-amber-300">10 / 10 Stempeln</strong> erhältst du{' '}
                  <strong>1x Gratis-Zubehör oder Rollschuh-Anhänger</strong> im{' '}
                  <strong>PRO-SHOP [E]</strong>!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextStamps = Math.min(10, stampCard.stamps + 1);
                      const next: StampCardData = {
                        ...stampCard,
                        stamps: nextStamps,
                        freeProShopVoucherAvailable:
                          stampCard.freeProShopVoucherAvailable ||
                          nextStamps >= 10,
                      };
                      setStampCard(next);
                      saveStampCard(next);
                      soundFX.playChallengeUnlocked();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-amber-200 font-mono text-xs font-bold cursor-pointer"
                  >
                    +1 Besuchs-Stempel simulieren (Test)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStampCard(resetStampCard())}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 font-mono text-xs cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowStampCardModal(false);
                    setShowProShopModal(true);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-xs font-black cursor-pointer"
                >
                  🛠️ Zum Pro-Shop öffnen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 11. 📱 HANDY-CONTROLLER QR-CODE MODAL (?controller=ROOM_ID)            */}
        {/* ===================================================================== */}
        {showPhoneControllerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-[#101526] border-2 border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.4)] p-5 text-white space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-cyan-300 uppercase">
                    80s Smartphone Touch-Gamepad • WebRTC Live-Koppeln
                  </span>
                  <h2 className="font-display font-black text-xl text-white">
                    📱 HANDY-CONTROLLER KOPPELN
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhoneControllerModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                >
                  Schließen
                </button>
              </div>

              {(() => {
                const targetPadId = mpRoomId || controllerHostId;
                const base =
                  typeof window !== 'undefined'
                    ? `${window.location.origin}${window.location.pathname}`
                    : '';
                const controllerUrl = `${base}?controller=${encodeURIComponent(
                  targetPadId
                )}`;
                const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
                  controllerUrl
                )}`;
                return (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40">
                      <div className="p-2 rounded-xl bg-white shrink-0 shadow-lg">
                        <img
                          src={qrImgUrl}
                          alt="QR-Code für Smartphone-Controller"
                          width={148}
                          height={148}
                          className="w-36 h-36 block"
                        />
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="inline-block px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400/50 font-mono text-[10px] text-cyan-300">
                          Raum-ID: {targetPadId}
                        </div>
                        <p className="text-slate-200 leading-relaxed">
                          Scanne den <strong>QR-Code</strong> mit deinem Smartphone oder öffne den Link, um dein Handy als{' '}
                          <strong className="text-fuchsia-300">
                            80er-Touch-Gamepad
                          </strong>{' '}
                          (Steuerkreuz, Sprung, 360°-Spin &amp; Moves) zu nutzen!
                        </p>
                        <div className="font-mono text-[11px] text-emerald-300">
                          Status:{' '}
                          {phonePadConnected
                            ? '🟢 Smartphone-Gamepad live verbunden!'
                            : '⏳ Wartet auf Smartphone-Verbindung...'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={controllerUrl}
                        className="flex-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] text-cyan-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            typeof navigator !== 'undefined' &&
                            navigator.clipboard
                          ) {
                            navigator.clipboard.writeText(controllerUrl);
                          }
                        }}
                        className="px-3 py-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-xs font-bold cursor-pointer"
                      >
                        📋 Kopieren
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 12. 📺 OPTIONALER 80er-CRT-FILTER (SCANLINES & VIGNETTE OVERLAY)      */}
        {/* ===================================================================== */}
        {crtFilterEnabled && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
            style={{
              background:
                'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.24) 0px, rgba(0, 0, 0, 0.24) 1px, transparent 1px, transparent 3px), radial-gradient(circle at center, transparent 62%, rgba(0, 0, 0, 0.48) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
        )}

        {/* ===================================================================== */}
        {/* 13. 📱 FULLSCREEN 80s SMARTPHONE TOUCH-GAMEPAD (?controller=ROOM_ID)  */}
        {/* ===================================================================== */}
        {initialControllerRoomId && (
          <SmartphoneTouchGamepadOverlay targetRoomId={initialControllerRoomId} />
        )}
      </main>
    </div>
  );
}

function SmartphoneTouchGamepadOverlay({
  targetRoomId,
}: {
  targetRoomId: string;
}) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  );
  const connRef = useRef<DataConnection | null>(null);
  const joyRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const peer = new Peer(PEER_ICE_CONFIG);
    peer.on('open', () => {
      const conn = peer.connect(targetRoomId, { reliable: true });
      connRef.current = conn;
      conn.on('open', () => {
        setStatus('connected');
      });
      conn.on('error', () => setStatus('error'));
      conn.on('close', () => setStatus('error'));
    });
    peer.on('error', () => setStatus('error'));

    const interval = window.setInterval(() => {
      const c = connRef.current;
      if (c && c.open) {
        try {
          c.send({
            type: 'controller-pad',
            dx: joyRef.current.dx,
            dy: joyRef.current.dy,
          } as MultiplayerPacket);
        } catch {
          // ignore
        }
      }
    }, 50);

    return () => {
      window.clearInterval(interval);
      try {
        peer.destroy();
      } catch {
        // ignore
      }
    };
  }, [targetRoomId]);

  const sendAction = (patch: Partial<MultiplayerPacket & { type: 'controller-pad' }>) => {
    const c = connRef.current;
    if (c && c.open) {
      try {
        c.send({
          type: 'controller-pad',
          dx: joyRef.current.dx,
          dy: joyRef.current.dy,
          ...patch,
        });
      } catch {
        // ignore
      }
    }
  };

  const handlePadPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    const rawX = e.clientX - cx;
    const rawY = e.clientY - cy;
    const dist = Math.hypot(rawX, rawY);
    const scale = dist > maxR ? maxR / dist : 1;
    const nx = (rawX * scale) / maxR;
    const ny = (rawY * scale) / maxR;
    joyRef.current = {
      dx: Math.round(nx * 100) / 100,
      dy: Math.round(ny * 100) / 100,
    };
    setKnobPos({ x: rawX * scale, y: rawY * scale });
  };

  const resetPadPointer = () => {
    joyRef.current = { dx: 0, dy: 0 };
    setKnobPos({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#080714] text-white flex flex-col justify-between p-4 select-none touch-none">
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-950 border border-fuchsia-500/60">
        <div>
          <div className="font-display font-black text-base text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-amber-200 to-cyan-300">
            📱 PALLADIUM 80s HANDY-CONTROLLER
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Ziel-Raum: <strong className="text-cyan-300">{targetRoomId}</strong>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded font-mono text-xs font-bold border ${
            status === 'connected'
              ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
              : status === 'connecting'
              ? 'bg-amber-950 border-amber-400 text-amber-200'
              : 'bg-rose-950 border-rose-400 text-rose-200'
          }`}
        >
          {status === 'connected'
            ? '🟢 LIVE VERBUNDEN'
            : status === 'connecting'
            ? '⏳ VERBINDE...'
            : '⚠️ GETRENNT'}
        </span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 items-center my-3">
        {/* Left: 80s Arcade Touch Thumbstick */}
        <div className="flex flex-col items-center justify-center">
          <div
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handlePadPointer(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) handlePadPointer(e);
            }}
            onPointerUp={resetPadPointer}
            onPointerCancel={resetPadPointer}
            className="relative w-44 h-44 rounded-full bg-slate-900 border-4 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.4)] flex items-center justify-center"
          >
            <div className="w-16 h-16 rounded-full border border-cyan-500/30" />
            <div
              style={{
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 border-2 border-white shadow-lg"
            />
          </div>
          <span className="font-mono text-xs text-cyan-300 mt-2">
            🕹️ 360° LENK-STICK
          </span>
        </div>

        {/* Right: 80s Neon Action & Trick Buttons */}
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onPointerDown={() => sendAction({ jump: true })}
              className="py-4 rounded-2xl bg-amber-400 active:bg-amber-300 text-slate-950 font-mono font-black text-sm border-2 border-white shadow-[0_0_20px_rgba(251,191,36,0.5)]"
            >
              🦘 SPRUNG [A]
            </button>
            <button
              type="button"
              onPointerDown={() => sendAction({ spin: true })}
              className="py-4 rounded-2xl bg-fuchsia-600 active:bg-fuchsia-500 text-white font-mono font-black text-sm border-2 border-white shadow-[0_0_20px_rgba(232,121,249,0.5)]"
            >
              🌀 360°-SPIN [B]
            </button>
          </div>

          <button
            type="button"
            onPointerDown={() => sendAction({ interact: true })}
            className="py-3 rounded-xl bg-emerald-500 active:bg-emerald-400 text-slate-950 font-mono font-black text-xs border-2 border-white"
          >
            ✋ AKTION / WURF / THEKE [E]
          </button>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {(
              [
                { id: 'spin360' as TrickMoveId, label: '[1] 🌀 Spin' },
                { id: 'backward' as TrickMoveId, label: '[2] 🔙 Backward' },
                { id: 'flamingo' as TrickMoveId, label: '[3] 🦩 Flamingo' },
                { id: 'starjump' as TrickMoveId, label: '[4] ⚡ Star-Jump' },
              ] as const
            ).map((mv) => (
              <button
                key={mv.id}
                type="button"
                onPointerDown={() => sendAction({ trickMove: mv.id })}
                className="py-2 rounded-lg bg-slate-900 active:bg-fuchsia-800 border border-fuchsia-400/60 text-fuchsia-200 font-mono text-[11px] font-bold"
              >
                {mv.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center font-mono text-[10px] text-slate-400">
        Palladium Hanau &apos;86 • 80er-Touch-Gamepad • Echtzeit-WebRTC
      </div>
    </div>
  );
}

export default App;
