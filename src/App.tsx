import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_PIN,
  ArenaVisualStyle,
  BandGenderMode,
  BandSkinToneMode,
  CameraViewMode,
  CenterStageMode,
  ChallengeDefinition,
  ChallengeId,
  ConcertLightingMode,
  DEFAULT_DJ_NAME,
  DEFAULT_DJ_TICKER,
  DEFAULT_SPECIAL_SKATERS,
  DEFAULT_TWITCH_CHANNEL,
  GuestDjPreset,
  HallGameMode,
  LightingMode,
  PALLADIUM_CHALLENGES,
  PARODY_BANDS,
  PlayerCharacterMode,
  ProShopUpgradesState,
  NeonUnderglowColor,
} from './config/arenaConfig';
import Peer, { DataConnection } from 'peerjs';
import {
  ArenaLiveTelemetry,
  MultiplayerPlayerState,
  RollerArenaEngine,
} from './components/RollerArenaEngine';
import { soundFX } from './utils/soundEffects';
import {
  AdminPersistentSettings,
  ChallengeProgressMap,
  computePeakHourLabel,
  EntryPassData,
  HallStatsData,
  loadAdminSettings,
  loadAdminUnlockedSession,
  loadChallengesProgress,
  loadEntryPass,
  loadGuestDjPresets,
  loadHallStats,
  loadHasEnteredBefore,
  loadHideChronik,
  loadPlayerProfile,
  loadProShopUpgrades,
  loadSpecialSkaters,
  recordSessionVisit,
  resetEntryPass,
  resetHallStats,
  saveAdminSettings,
  saveAdminUnlockedSession,
  saveChallengesProgress,
  saveEntryPass,
  saveGuestDjPresets,
  saveHallStats,
  saveHasEnteredBefore,
  saveHideChronik,
  savePlayerProfile,
  saveProShopUpgrades,
  saveSpecialSkaters,
  SingleplayerDifficulty,
} from './utils/storageAndStats';

const MULTIPLAYER_OUTFIT_COLORS = [
  { id: 'neon-pink', label: 'Neon-Pink', hex: '#ff2a85' },
  { id: 'cyber-cyan', label: 'Cyber-Cyan', hex: '#00f0ff' },
  { id: 'laser-green', label: 'Laser-Grün', hex: '#39ff14' },
  { id: 'sunset-gold', label: 'Sunset-Gold', hex: '#f59e0b' },
  { id: 'electric-violet', label: 'Electric-Violett', hex: '#a855f7' },
  { id: 'turbo-red', label: 'Turbo-Rot', hex: '#ef4444' },
] as const;

interface AdminSyncPayload {
  lightingMode: LightingMode;
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
  isMaintenanceMode: boolean;
  liveArenaStyle: ArenaVisualStyle;
}

type MultiplayerPacket =
  | {
      type: 'guest-hello';
      state: MultiplayerPlayerState;
    }
  | {
      type: 'player-state';
      state: MultiplayerPlayerState;
    }
  | {
      type: 'world-players';
      players: MultiplayerPlayerState[];
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
    };

export function App() {
  // First-visit curtain & chronicle state (cookie-free localStorage)
  const [hideChronik, setHideChronik] = useState<boolean>(() =>
    loadHideChronik()
  );
  const [hasEnteredBefore, setHasEnteredBefore] = useState<boolean>(() =>
    loadHasEnteredBefore()
  );
  const [isCurtainOpen, setIsCurtainOpen] = useState<boolean>(
    () => loadHasEnteredBefore() || loadHideChronik()
  );
  const [showChronicleModal, setShowChronicleModal] = useState<boolean>(
    () => !loadHasEnteredBefore() && !loadHideChronik()
  );

  // Player Profile & Cashier Guest Mode
  const initialProfile = useMemo(() => loadPlayerProfile(), []);
  const [playerName, setPlayerName] = useState<string>(initialProfile.name);
  const [isAnonymousGuest, setIsAnonymousGuest] = useState<boolean>(
    initialProfile.isAnonymousGuest
  );
  const [showNames, setShowNames] = useState<boolean>(true);

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
  const [isMuted, setIsMuted] = useState<boolean>(false);

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

  // Lighting & Schedule Automation States
  const [blacklightTimerSec, setBlacklightTimerSec] = useState<number>(0);
  const preBlacklightModeRef = useRef<LightingMode>('disco');
  const preBallspielModeRef = useRef<LightingMode>('disco');
  const wasBallspielRef = useRef<boolean>(false);
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
  const [guestJoinNameInput, setGuestJoinNameInput] = useState<string>(() =>
    initialProfile.name && initialProfile.name !== 'Gast'
      ? initialProfile.name
      : ''
  );

  const peerInstanceRef = useRef<Peer | null>(null);
  const hostConnectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const hostGuestsStateRef = useRef<Map<string, MultiplayerPlayerState>>(
    new Map()
  );
  const guestConnRef = useRef<DataConnection | null>(null);
  const localSkaterSnapshotRef = useRef<MultiplayerPlayerState>({
    peerId: 'local',
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
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showTwitchWidget, setShowTwitchWidget] = useState<boolean>(false);
  const [isTwitchOnline, setIsTwitchOnline] = useState<boolean>(false);
  const [isCinemaScheduleActive, setIsCinemaScheduleActive] =
    useState<boolean>(false);
  const [twitchMuted, setTwitchMuted] = useState<boolean>(false);
  const [fogBurstCount, setFogBurstCount] = useState<number>(0);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] =
    useState<boolean>(false);

  // Hall Statistics
  const [hallStats, setHallStats] = useState<HallStatsData>(() =>
    recordSessionVisit()
  );
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

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
    slalomCombo: 0,
  });

  // Save profile whenever changed
  useEffect(() => {
    savePlayerProfile({ name: playerName, isAnonymousGuest });
  }, [playerName, isAnonymousGuest]);

  // Save upgrades whenever changed
  useEffect(() => {
    saveProShopUpgrades(upgrades);
  }, [upgrades]);

  // Save admin settings whenever changed
  useEffect(() => {
    saveAdminSettings(adminSettings);
  }, [adminSettings]);

  // Automatic coupling: Ballspiel <-> Putzlicht (bright hall lighting during Ballspiel)
  useEffect(() => {
    if (hallGameMode === 'ballspiel' && !wasBallspielRef.current) {
      wasBallspielRef.current = true;
      setLightingMode((currentLight) => {
        if (currentLight !== 'putzlicht') {
          preBallspielModeRef.current = currentLight;
        }
        return 'putzlicht';
      });
    } else if (hallGameMode !== 'ballspiel' && wasBallspielRef.current) {
      wasBallspielRef.current = false;
      setLightingMode(preBallspielModeRef.current || 'disco');
    }
  }, [hallGameMode]);

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
          setLightingMode(
            hallGameMode === 'ballspiel'
              ? 'putzlicht'
              : preBlacklightModeRef.current || 'disco'
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [blacklightTimerSec, hallGameMode]);

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

  // Check whether the configured Twitch channel is actually LIVE / online
  // Keeps the top-right Twitch dock and center Cinema screen hidden when offline so the white "offline" screen never blocks the playfield!
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

  // Automatic Kino-Zeitplan (Weekday + Start/End Time -> switches to 'cinema' and back to 'islands')
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
      const dayNames = [
        'Sonntag',
        'Montag',
        'Dienstag',
        'Mittwoch',
        'Donnerstag',
        'Freitag',
        'Samstag',
      ];
      const todayName = dayNames[now.getDay()];
      const dayMatches =
        adminSettings.cinemaWeekday === 'Täglich' ||
        adminSettings.cinemaWeekday === todayName;

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
    adminSettings.cinemaWeekday,
    adminSettings.cinemaStartTime,
    adminSettings.cinemaEndTime,
  ]);

  // Increment session play time & persist to Hall Stats every 5 seconds
  useEffect(() => {
    if (!isCurtainOpen) return;
    const interval = window.setInterval(() => {
      setSessionSeconds((prev) => prev + 5);
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

  // Global keyboard shortcut for Admin Terminal: Ctrl + Shift + A (or Cmd + Shift + A)
  // Also Enter / Space to open the First-Visit Curtain when visible
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

      if (!isCurtainOpen && (e.key === 'Enter' || e.key === ' ')) {
        if (!isInput) {
          e.preventDefault();
          handleEnterHall();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAdminUnlocked, isCurtainOpen]);

  const handleEnterHall = useCallback(() => {
    soundFX.playCurtainReveal();
    saveHasEnteredBefore(true);
    setHasEnteredBefore(true);
    setIsCurtainOpen(true);
    setShowChronicleModal(false);

    // Lock Singleplayer Entry Stamp (palladium_entry_pass) for this visit if not already locked
    setEntryPass((prev) => {
      if (prev?.locked) return prev;
      const lockedPass: EntryPassData = {
        locked: true,
        difficulty,
        hasOwnSkates,
        hasRentedSkates: false,
        drinkChipAvailable: true,
        stampedAt: new Date().toISOString(),
      };
      saveEntryPass(lockedPass);
      setHasRentedSkates(false);
      setDrinkChipAvailable(true);
      return lockedPass;
    });

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [difficulty, hasOwnSkates]);

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
      setPinError('Falsche Hallenleiter-PIN! (Tipp: Eröffnungsjahr 1986)');
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
    setShowNames((prev) => !prev);
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

  // ============================================================================
  // PEERJS MULTIPLAYER HANDLERS (OPEN ROOM, JOIN ROOM, KICK, CLOSE & ADMIN SYNC)
  // ============================================================================

  const buildCurrentAdminSyncPayload = useCallback((): AdminSyncPayload => {
    return {
      lightingMode,
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
      isMaintenanceMode: adminSettings.isMaintenanceMode,
      liveArenaStyle: adminSettings.liveArenaStyle || 'classic-neon',
    };
  }, [
    lightingMode,
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
    adminSettings.isMaintenanceMode,
    adminSettings.liveArenaStyle,
  ]);

  const adminSyncPayloadRef = useRef<AdminSyncPayload>(
    buildCurrentAdminSyncPayload()
  );
  useEffect(() => {
    adminSyncPayloadRef.current = buildCurrentAdminSyncPayload();
  }, [buildCurrentAdminSyncPayload]);

  // Broadcast Hallenleiter-Sync from Host to all connected Guests whenever any Admin setting changes!
  useEffect(() => {
    if (mpRole !== 'host') return;
    const pkt: MultiplayerPacket = {
      type: 'admin-sync',
      payload: buildCurrentAdminSyncPayload(),
    };
    hostConnectionsRef.current.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(pkt);
        } catch {
          // Ignore transient send error
        }
      }
    });
  }, [mpRole, buildCurrentAdminSyncPayload]);

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

  const handleOpenHostRoom = useCallback(
    (customRoomId?: string) => {
      cleanupPeerSession();
      const targetId =
        customRoomId ||
        `palladium-hanau-89-${Math.floor(100 + Math.random() * 900)}`;
      setMpStatus('connecting');
      setMpNotice('Starte Multiplayer-Host-Raum...');

      const peer = new Peer(targetId);
      peerInstanceRef.current = peer;

      peer.on('open', (id) => {
        setMpRole('host');
        setMpRoomId(id);
        setMpStatus('connected');
        setMpNotice(
          `🌐 Multiplayer-Raum „${id}“ ist live! Teile den Einladungs-Link mit deinen Freunden.`
        );
        localSkaterSnapshotRef.current.peerId = id;
      });

      peer.on('connection', (conn) => {
        hostConnectionsRef.current.set(conn.peer, conn);

        conn.on('open', () => {
          // Immediately send current Hallenleiter-Sync state & world players to the joining guest
          try {
            const syncPkt: MultiplayerPacket = {
              type: 'admin-sync',
              payload: adminSyncPayloadRef.current,
            };
            conn.send(syncPkt);

            const allPlayers: MultiplayerPlayerState[] = [
              {
                ...localSkaterSnapshotRef.current,
                peerId: peer.id || targetId,
              },
              ...Array.from(hostGuestsStateRef.current.values()),
            ];
            const worldPkt: MultiplayerPacket = {
              type: 'world-players',
              players: allPlayers,
            };
            conn.send(worldPkt);
          } catch {
            // ignore
          }
        });

        conn.on('data', (raw) => {
          const pkt = raw as MultiplayerPacket;
          if (!pkt || typeof pkt !== 'object') return;
          if (pkt.type === 'guest-hello' || pkt.type === 'player-state') {
            const updatedGuest: MultiplayerPlayerState = {
              ...pkt.state,
              peerId: conn.peer,
            };
            hostGuestsStateRef.current.set(conn.peer, updatedGuest);
            setRemotePlayers(Array.from(hostGuestsStateRef.current.values()));
          }
        });

        const handleDisconnect = () => {
          hostConnectionsRef.current.delete(conn.peer);
          hostGuestsStateRef.current.delete(conn.peer);
          setRemotePlayers(Array.from(hostGuestsStateRef.current.values()));
        };

        conn.on('close', handleDisconnect);
        conn.on('error', handleDisconnect);
      });

      peer.on('error', (err: { type?: string }) => {
        if (err?.type === 'unavailable-id' && !customRoomId) {
          handleOpenHostRoom(
            `palladium-hanau-89-${Math.floor(1000 + Math.random() * 9000)}`
          );
          return;
        }
        setMpStatus('error');
        setMpNotice('Verbindungsfehler beim Erstellen des Multiplayer-Raums.');
      });
    },
    [cleanupPeerSession]
  );

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
    setRemotePlayers(Array.from(hostGuestsStateRef.current.values()));
  }, []);

  const handleConnectAsGuest = useCallback(
    (roomIdToJoin: string, chosenName: string, chosenColor: string) => {
      cleanupPeerSession();
      const cleanName = chosenName.trim() || 'Gast-Skater';
      setPlayerName(cleanName);
      setIsAnonymousGuest(false);
      setPlayerShirtColor(chosenColor);
      setHasOwnSkates(true);
      setIsCurtainOpen(true);
      setShowChronicleModal(false);
      setShowGuestJoinModal(false);
      setMpStatus('connecting');
      setMpNotice(`Verbinde mit Palladium-Raum „${roomIdToJoin}“...`);

      const peer = new Peer();
      peerInstanceRef.current = peer;

      peer.on('open', (myPeerId) => {
        localSkaterSnapshotRef.current.peerId = myPeerId;
        localSkaterSnapshotRef.current.name = cleanName;
        localSkaterSnapshotRef.current.shirtColor = chosenColor;

        const conn = peer.connect(roomIdToJoin, { reliable: true });
        guestConnRef.current = conn;

        conn.on('open', () => {
          setMpRole('guest');
          setMpRoomId(roomIdToJoin);
          setMpStatus('connected');
          setMpNotice(`🌐 Live verbunden mit Raum „${roomIdToJoin}“!`);

          const helloPkt: MultiplayerPacket = {
            type: 'guest-hello',
            state: {
              ...localSkaterSnapshotRef.current,
              peerId: myPeerId,
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

          if (pkt.type === 'world-players') {
            const others = (pkt.players || []).filter(
              (pl) => pl.peerId !== myPeerId
            );
            setRemotePlayers(others);
          } else if (pkt.type === 'admin-sync') {
            const s = pkt.payload;
            setLightingMode(s.lightingMode);
            setCenterStageMode(s.centerStageMode);
            setActiveBandName(s.activeBandName);
            setCustomBandInput(s.customBandInput);
            setBandSkinTone(s.bandSkinTone);
            setBandGender(s.bandGender);
            setHallGameMode(s.hallGameMode);
            setFogBurstCount(s.fogBurstCount);
            setAdminPreviewStyle(null);
            setAdminSettings((prev) => ({
              ...prev,
              concertLightingMode: s.concertLightingMode,
              fogMachineEnabled: s.fogMachineEnabled,
              activeDjName: s.activeDjName,
              djTickerText: s.djTickerText,
              twitchChannel: s.twitchChannel,
              isMaintenanceMode: s.isMaintenanceMode,
              liveArenaStyle: s.liveArenaStyle,
            }));
          } else if (pkt.type === 'kicked') {
            cleanupPeerSession();
            setMpRole('solo');
            setMpStatus('idle');
            setMpNotice(
              '🛑 Du wurdest vom Hallenleiter aus dem Multiplayer-Raum entfernt.'
            );
          } else if (pkt.type === 'room-closed') {
            cleanupPeerSession();
            setMpRole('solo');
            setMpStatus('idle');
            setMpNotice(
              'ℹ️ Der Hallenleiter hat den Multiplayer-Raum geschlossen (Solo-Modus aktiv).'
            );
          }
        });

        conn.on('close', () => {
          cleanupPeerSession();
          setMpRole('solo');
          setMpStatus('idle');
        });

        conn.on('error', () => {
          setMpStatus('error');
          setMpNotice(
            `Raum „${roomIdToJoin}“ ist aktuell nicht erreichbar (Solo-Modus aktiv).`
          );
          setMpRole('solo');
        });
      });

      peer.on('error', () => {
        setMpStatus('error');
        setMpNotice(
          `Raum „${roomIdToJoin}“ konnte nicht erreicht werden (Solo-Modus aktiv).`
        );
        setMpRole('solo');
      });
    },
    [cleanupPeerSession]
  );

  // Called ~18x per second (every 55ms) by RollerArenaEngine when in Multiplayer
  const handleLocalMultiplayerState = useCallback(
    (stateNoId: Omit<MultiplayerPlayerState, 'peerId'>) => {
      const myPeerId = peerInstanceRef.current?.id || 'local';
      const fullState: MultiplayerPlayerState = {
        ...stateNoId,
        peerId: myPeerId,
      };
      localSkaterSnapshotRef.current = fullState;

      if (mpRole === 'host') {
        const guests = Array.from(hostGuestsStateRef.current.values());
        const allPlayers: MultiplayerPlayerState[] = [fullState, ...guests];
        const worldPkt: MultiplayerPacket = {
          type: 'world-players',
          players: allPlayers,
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

  const handleChallengeProgress = useCallback(
    (id: ChallengeId, amount: number, isAbsolute = false) => {
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

          // Automatically activate unlocked upgrade in Pro-Shop
          setUpgrades((uPrev) => {
            const nextU = { ...uPrev };
            if (id === 'warmup_spins') {
              nextU.underglowEnabled = true;
              nextU.underglowColor = 'cyan';
            } else if (id === 'endurance_20_laps') {
              nextU.bearingsAbec9 = true;
            } else if (id === 'bistro_drink') {
              nextU.highGripWheels = true;
            } else if (id === 'slipstream_10s' || id === 'chair_jump_3') {
              nextU.aluPlatesHighTop = true;
            } else if (id === 'mirror_spin') {
              nextU.underglowEnabled = true;
              nextU.underglowColor = 'gold';
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

  // Check if individual Pro-Shop upgrades are unlocked via challenges
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
    });
    soundFX.playChallengeUnlocked();
  };

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
  const avgSessionMin = useMemo(() => {
    const avgSec =
      hallStats.totalSessions > 0
        ? Math.round(hallStats.totalPlaySeconds / hallStats.totalSessions)
        : 0;
    const m = Math.floor(avgSec / 60);
    const s = avgSec % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }, [hallStats]);

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070A12] text-[#FFF8E7] select-none flex flex-col">
      {/* TOP RETRO HUD BAR (Full Widescreen Width) */}
      <header className="z-30 flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0B0E17]/95 border-b border-fuchsia-500/35 shadow-[0_4px_20px_rgba(0,0,0,0.65)] text-xs">
        {/* Left: Logo (3x click for Admin) + Active Mode Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
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
              ALPHA 0.1
            </span>
          </button>

          {/* Checkbox [X] Namen anzeigen */}
          <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/90 border border-slate-700/80 hover:border-cyan-400/60 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={showNames}
              onChange={(e) => {
                setShowNames(e.target.checked);
                e.target.blur();
              }}
              className="accent-cyan-400 rounded cursor-pointer"
            />
            <span className="font-medium text-slate-200">
              Namen anzeigen <span className="text-slate-400 font-mono">[N]</span>
            </span>
          </label>

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
              title="Willkommensgeschenk an der Kasse – einlösbar an der Bistro-Theke [E] oder direkt per Taste [1] / [2]"
              className="px-2 py-0.5 rounded bg-fuchsia-950/90 border border-amber-300/70 text-amber-200 font-mono text-[11px] shadow-[0_0_10px_rgba(251,191,36,0.25)]"
            >
              🎁 Gratis:{' '}
              {telemetry.freeSlushCount > 0 && (
                <span className="text-cyan-300 font-bold mr-1.5">
                  {telemetry.freeSlushCount}x Slush [1]
                </span>
              )}
              {telemetry.freeBlobaCount > 0 && (
                <span className="text-amber-300 font-bold">
                  {telemetry.freeBlobaCount}x Bloba [2]
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

        {/* Right: Quick Action Buttons (Chronik, Aufgaben, Hallen-Spiele, Pro-Shop, Statistik) */}
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
              telemetry.nearProShop
                ? 'bg-cyan-950 border-cyan-400 text-cyan-200 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            🛠️ Pro-Shop
          </button>

          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/50 text-slate-200 font-medium transition cursor-pointer"
          >
            📊 Hallen-Statistik
          </button>

          <button
            type="button"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              soundFX.setMuted(nextMuted);
              if (
                nextMuted &&
                typeof window !== 'undefined' &&
                'speechSynthesis' in window
              ) {
                window.speechSynthesis.cancel();
              }
            }}
            title="Spiel-Sound & Sprachausgabe stummschalten / aktivieren"
            className={`px-2 py-1 rounded border font-mono text-[11px] transition cursor-pointer ${
              isMuted
                ? 'bg-rose-950/90 border-rose-400/70 text-rose-200'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-emerald-300'
            }`}
          >
            {isMuted ? '🔇 Stumm' : '🔊 Ton'}
          </button>

          {/* Live Multiplayer Status Badge in Top HUD */}
          {isMultiplayerActive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/90 border border-cyan-400 text-cyan-200 font-mono font-bold text-[11px] shadow-[0_0_12px_rgba(34,211,238,0.4)]">
              <span>
                🌐 LIVE ({remotePlayers.length + 1} Skater)
              </span>
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
        {/* COMPACT TOP STATUS BAR FOR ACTIVE ADMIN PREVIEW */}
        {previewStyle && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-1.5 rounded-full bg-amber-950/95 border-2 border-amber-400 text-amber-100 font-mono text-xs font-bold shadow-[0_0_24px_rgba(251,191,36,0.55)] backdrop-blur-md">
            <span>
              👁️ ADMIN-VORSCHAU:{' '}
              <strong className="text-amber-300">
                {previewStyle === 'palladium-1989'
                  ? 'PALLADIUM 1989'
                  : previewStyle === 'pixel-16bit'
                  ? '16-BIT'
                  : 'CLASSIC NEON'}
              </strong>{' '}
              <span className="text-amber-200/80 font-normal">
                (PALLADIUM 1989 / 16-BIT)
              </span>
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

        <RollerArenaEngine
          playerName={playerName}
          playerShirtColor={playerShirtColor}
          isAnonymousGuest={isAnonymousGuest}
          showNames={showNames}
          characterMode={characterMode}
          cameraMode={cameraMode}
          lightingMode={lightingMode}
          centerStageMode={
            centerStageMode === 'cinema' &&
            !isTwitchOnline &&
            !isCinemaScheduleActive &&
            activeStyle !== 'palladium-1989'
              ? 'live-band'
              : centerStageMode
          }
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
          upgrades={upgrades}
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
          activeDjName={adminSettings.activeDjName || DEFAULT_DJ_NAME}
          isMuted={isMuted}
          isCurtainOpen={isCurtainOpen && !isBlockedByMaintenance}
          isMultiplayerActive={isMultiplayerActive}
          remotePlayers={remotePlayers}
          onLocalPlayerState={handleLocalMultiplayerState}
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
          onTelemetry={setTelemetry}
        />

        {/* LIVE TWITCH VIDEO OVERLAY DIRECTLY ON THE CENTER PALLADIUM KINO-LEINWAND (Only when stream is live or Auto-Kino-Zeitplan is active!) */}
        {isCurtainOpen &&
          !isBlockedByMaintenance &&
          centerStageMode === 'cinema' &&
          (isTwitchOnline || isCinemaScheduleActive) &&
          cameraMode === 'top-down' && (
            <div
              style={{
                left: `${(825 / 1920) * 100}%`,
                top: `${(356 / 1080) * 100}%`,
                width: `${(350 / 1920) * 100}%`,
                height: `${(256 / 1080) * 100}%`,
              }}
              className="z-20 absolute rounded border-2 border-cyan-400/90 shadow-[0_0_30px_rgba(34,211,238,0.55)] overflow-hidden bg-black flex flex-col"
            >
              <div className="flex items-center justify-between px-2 py-0.5 bg-slate-950/95 border-b border-cyan-500/40 text-[10px] font-mono">
                <span className="text-cyan-300 font-bold truncate">
                  🎬 KINO-LEINWAND LIVE: {adminSettings.twitchChannel}
                </span>
                <button
                  type="button"
                  onClick={() => setTwitchMuted((m) => !m)}
                  className="text-amber-300 hover:underline cursor-pointer ml-2"
                >
                  {twitchMuted ? '🔇 Ton an' : '🔊 Stumm'}
                </button>
              </div>
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

        {/* CONTEXTUAL INTERACTION PROMPTS NEAR PRO-SHOP / SKATE RENTAL / BISTRO / DJ TOWER */}
        {isCurtainOpen && telemetry.nearProShop && !showProShopModal && (
          <div className="absolute bottom-14 left-6 z-30 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-950/95 border border-cyan-400 shadow-lg text-xs">
            <span className="text-cyan-300 font-bold">
              🛠️ Pro-Shop Vitrine:
            </span>
            <span className="text-slate-200">
              Drücke <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">[E]</kbd>{' '}
              oder klicke für Rollschuh-Tuning
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

        {/* COLLAPSIBLE BOTTOM CONTROL LEGEND & RETRO DEVELOPER CREDIT BAR (TOGGLE VIA BUTTON OR KEY [I]) */}
        {isBottomBarCollapsed ? (
          <button
            type="button"
            onClick={() => setIsBottomBarCollapsed(false)}
            title="Steuerungs- & Info-Leiste wieder ausklappen [I]"
            className="z-20 absolute bottom-2 right-3 px-2.5 py-1 rounded-md bg-[#080B12]/90 hover:bg-slate-900 border border-slate-700/80 hover:border-cyan-400/60 text-[11px] font-mono text-cyan-300 shadow-lg cursor-pointer transition"
          >
            ▲ Steuerung &amp; Info [I]
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
                <strong className="text-emerald-300">
                  [E / F / Klick / Pad-X]
                </strong>{' '}
                Ball / Shop / Bistro
              </span>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleUnderglow}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-pink-400">[L]</strong> Unterboden-Neon:{' '}
                {upgrades.underglowEnabled ? 'AN' : 'AUS'}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleCamera}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-cyan-300">[C / Pad-Y]</strong> Kamera:{' '}
                {cameraMode.toUpperCase()}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleCharacterMode}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-amber-300">[V]</strong> Modus:{' '}
                {characterMode === 'skater' ? 'Rollschuh' : 'Rollstuhl'}
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleToggleKengolHat}
                className="hover:text-cyan-300 cursor-pointer"
              >
                <strong className="text-fuchsia-300">[H]</strong> Kengol-Look:{' '}
                {kengolHatEnabled ? 'AN' : 'AUS'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 hidden lg:inline">
                Retro-Tribut für alle Hanauer „Palladiumaner“ (1981 Rollerland •
                1986 Palladium) • 100% lokal ohne Cookies
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
                  ✦ HANAUER ROLLSCHUH-CHRONIK • FAMILYLAND &amp; PALLADIUM ✦
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
                  {/* 80s Sticker 1: ROLLERLAND HANAU */}
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
                        {/* Curved sweeping rink track lines */}
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
                        {/* White Winged Roller Skate with Red Laces & Bright Red Wheels */}
                        <g transform="translate(110, 32)">
                          {/* White/Red Wing */}
                          <polygon
                            points="-12,-5 -44,-16 -34,-6 -46,-1 -32,3 -12,4"
                            fill="#ffffff"
                            stroke="#ef4444"
                            strokeWidth="1.5"
                          />
                          {/* Crisp White Roller Skate Boot */}
                          <path
                            d="M -14 -16 L 3 -16 L 6 -2 L 19 2 Q 24 6 18 10 L -14 10 Z"
                            fill="#ffffff"
                            stroke="#0f172a"
                            strokeWidth="1.8"
                          />
                          {/* Red Laces */}
                          <path
                            d="M 1 -12 L 6 -10 M 2 -8 L 7 -6 M 4 -4 L 10 -2"
                            stroke="#ef4444"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          {/* Red Toe-Stop */}
                          <circle cx="21" cy="11" r="3.8" fill="#ef4444" />
                          {/* 4 Bright Red Wheels */}
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
                        {/* Red ROLLERLAND & HANAU Text */}
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
                  {/* 80s Sticker 2: PALLADIUM HANAU */}
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
                        {/* Fluffy 80s Clouds */}
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
                        {/* Red-Yellow Glass Roof Arch */}
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
                        {/* Yellow Perspective Colonnade Pillars */}
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
                        {/* Green Winged Roller Skate with Yellow Laces, Pink Wheels & Violet Toe-Stop */}
                        <g transform="translate(110, 30)">
                          {/* Yellow Wings */}
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
                          {/* Green Boot */}
                          <path
                            d="M -13 -15 L 3 -15 L 6 -2 L 18 2 Q 23 6 17 10 L -13 10 Z"
                            fill="#16a34a"
                            stroke="#052e16"
                            strokeWidth="1.8"
                          />
                          {/* Yellow Laces */}
                          <path
                            d="M 1 -11 L 6 -9 M 2 -7 L 7 -5 M 4 -3 L 10 -1"
                            stroke="#fde047"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          {/* Violet Toe-Stop */}
                          <circle
                            cx="21"
                            cy="11"
                            r="4"
                            fill="#9333ea"
                            stroke="#ffffff"
                            strokeWidth="1"
                          />
                          {/* 4 Bright Pink Wheels */}
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
                        {/* Angled Blue PALLADIUM + Line + HANAU */}
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
                  {/* 80s Sticker 3: ROLLER DISCO Palladium – HANAU-Grimm Center Oval Emblem */}
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
                        {/* Dark-Blue Oval with Double Gold Rim */}
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
                        {/* White Arched Text ROLLER DISCO */}
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
                        {/* Sweeping Red Retro Script Palladium */}
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
                        {/* Bottom Text HANAU-Grimm Center */}
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

              {/* "Nicht mehr anzeigen" Checkbox (persisted in localStorage under palladium_hide_chronik) */}
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

              {/* Cashier Entry & Guest Mode Configuration + Singleplayer Experience Levels + Own Skates vs. Rental + Anti-Cheat Stamp */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-700/80 flex flex-col gap-3.5">
                {/* Anti-Cheat Entry Stamp Active Notice (when palladium_entry_pass is locked in localStorage) */}
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

                {/* Singleplayer Experience Levels (Anfänger, Fortgeschrittener, Profi) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-mono text-xs text-fuchsia-300 uppercase font-bold">
                      🏁 1. Singleplayer-Erfahrungsstufe &amp; Start-Bahn wählen:
                    </label>
                    <span className="font-mono text-[11px] text-slate-400">
                      Bestimmt KI-Dichte, Grundtempo &amp; Startspur
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {(
                      [
                        {
                          id: 'beginner' as SingleplayerDifficulty,
                          title: '🟢 Anfänger',
                          subtitle: 'Wenig Betrieb · Start auf der Innenbahn',
                          desc: 'Reduzierte KI-Skater-Anzahl, ruhigeres Grundtempo und sicherer Start innen nahe der Mittelbühne.',
                          activeClass:
                            'bg-emerald-950/90 border-emerald-400 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.35)]',
                        },
                        {
                          id: 'intermediate' as SingleplayerDifficulty,
                          title: '🟡 Fortgeschrittener',
                          subtitle: 'Normaler Disco-Abend · Mittelbahn',
                          desc: 'Ausgewogene Hallenfülle, normales Disco-Tempo und klassischer Einstieg auf der mittleren Spur.',
                          activeClass:
                            'bg-amber-950/90 border-amber-400 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.35)]',
                        },
                        {
                          id: 'pro' as SingleplayerDifficulty,
                          title: '🔴 Profi',
                          subtitle:
                            'Samstagabend Volles Haus · Außenbahn & hohes Tempo',
                          desc: 'Volle Halle, schnelleres Grundtempo, aktive Speed-Skater-Kette außen und Start mitten im Geschehen.',
                          activeClass:
                            'bg-rose-950/90 border-rose-400 text-rose-100 shadow-[0_0_16px_rgba(244,63,94,0.35)]',
                        },
                      ] as const
                    ).map((lvl) => {
                      const isSelected = difficulty === lvl.id;
                      const isLocked = Boolean(entryPass?.locked);
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            if (isLocked) return;
                            setDifficulty(lvl.id);
                          }}
                          className={`p-3 rounded-xl border text-left transition ${
                            isSelected
                              ? lvl.activeClass
                              : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-slate-500'
                          } ${
                            isLocked
                              ? 'opacity-65 cursor-not-allowed'
                              : 'cursor-pointer'
                          }`}
                        >
                          <div className="font-display font-extrabold text-sm flex items-center justify-between">
                            <span>{lvl.title}</span>
                            {isSelected && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-white/30">
                                AKTIV
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] font-bold text-cyan-300 mt-0.5">
                            {lvl.subtitle}
                          </div>
                          <p className="text-[11px] text-slate-300/90 mt-1 leading-snug">
                            {lvl.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checkbox "🛼 Ich habe eigene Rollschuhe" vs. Rollschuh-Verleih über Freigetränk-Chip */}
                <div className="p-3 rounded-xl bg-[#141024] border border-cyan-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
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
                      <span className="font-mono font-bold text-xs md:text-sm text-emerald-300">
                        🛼 Ich habe eigene Rollschuhe
                      </span>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {hasOwnSkates ? (
                          <>
                            <strong>Aktiv:</strong> Du startest direkt auf eigenen
                            Custom-Skates (+10% Antritt/Kurvenlage) und behältst
                            deinen <strong>1× Freigetränk-Chip</strong> fürs Bistro!
                          </>
                        ) : (
                          <>
                            <strong>Keine eigenen Rollschuhe:</strong> Du betrittst
                            die Halle auf Straßenschuhen und tauscht deinen{' '}
                            <strong>Freigetränk-Chip am Rollschuh-Verleih [E]</strong>{' '}
                            verbindlich gegen 80er-Leih-Rollschuhe ein.
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
                      ? '🪙 Chip bleibt fürs Bistro'
                      : '🪙 Chip → Leih-Rollschuhe [E]'}
                  </span>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-1 border-t border-slate-800">
                  <div className="flex-1 w-full">
                    <label className="block font-mono text-xs text-cyan-300 uppercase mb-1">
                      🎟️ Kasse &amp; Einstieg — Dein Skater-Name (Optional):
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={playerName}
                        disabled={isAnonymousGuest}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Leer lassen = Kein Namensschild"
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
                      Bleibt das Feld leer oder ist „Als Gast rollen“ aktiv,
                      wird über deiner Spielfigur gar kein Namensschild
                      gerendert.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleEnterHall}
                      className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 text-white font-display font-black text-base tracking-wider shadow-[0_0_25px_rgba(232,121,249,0.6)] transition cursor-pointer"
                    >
                      🛼 HALLE BETRETEN [ENTER]
                    </button>
                  </div>
                </div>

                {/* Retro-styled Welcome Gift Ticket Badge below HALLE BETRETEN [ENTER] */}
                <div className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-950/80 via-fuchsia-950/80 to-cyan-950/80 border border-dashed border-amber-300/80 shadow-[0_0_18px_rgba(251,191,36,0.2)] flex items-center justify-center text-center">
                  <span className="font-mono text-xs md:text-sm font-bold tracking-wide text-amber-200">
                    🎁 WILLKOMMENSGESCHENK AN DER KASSE: 1x Slush Puppy &amp; 1x
                    Bloba Cola gratis beim Eintritt!
                  </span>
                </div>
              </div>

              {/* Creator Signature & Dedication in the Bottom Footer of the Start Frame */}
              <div className="mt-4 pt-3 border-t border-fuchsia-500/30 text-center">
                <p className="font-mono text-xs md:text-sm font-semibold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-200 to-indigo-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]">
                  created by Jürgen Becker (JR) • Ein Tribut an unsere Ära
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. PRO-SHOP ROLLSCHUH-UPGRADES MODAL                                  */}
        {/* ===================================================================== */}
        {showProShopModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-[#101424] border-2 border-cyan-400/70 shadow-2xl p-6 text-white">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-cyan-300 uppercase">
                    Bereich 1 • Glasvitrine &amp; PALLADIUMANER-Crew
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
                Rüste deine Rollschuhe mit Original-80er-Bauteilen aus. Neue
                Bauteile schaltest du durch erledigte{' '}
                <strong className="text-amber-300">Palladium-Aufgaben</strong>{' '}
                frei!
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
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
                      ? '🔒 Durch „Dauerläufer“ (20 Runden) freischalten'
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
                        2. Spezial-Rollen (High-Grip Urethan)
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {isHighGripUnlocked ? 'Freigeschaltet' : 'Aufgabe #3'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Verbessert Kurvenlage und Bodenhaftung – schützt vor
                      Stürzen auf den unangekündigten Bohnerwachs-Rutschzonen!
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
                      ? '🔒 Durch „Slush- & Bloba-Pause“ freischalten'
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
                        3. Alu-Platten &amp; High-Top-Schuhe
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
                      ? '🔒 Durch „Windschatten“ oder „Stuhl-Springer“'
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
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-400">
                  Tipp: Alle Bauteile bleiben lokal in deinem Browser
                  gespeichert.
                </span>
                <button
                  type="button"
                  onClick={handleUnlockAllProShopForTesting}
                  className="px-3 py-1 rounded bg-fuchsia-950 hover:bg-fuchsia-900 border border-fuchsia-400/50 text-fuchsia-200 font-mono text-xs cursor-pointer"
                >
                  ⚡ Alle Pro-Shop Bauteile sofort freischalten (Test-Modus)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. PALLADIUM CHALLENGES MODAL (9 AUFGABEN)                            */}
        {/* ===================================================================== */}
        {showChallengesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#111322] border-2 border-amber-400/70 shadow-2xl p-6 text-white">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-amber-300 uppercase">
                    Kleine 80er-Aufgaben ohne Zwang • Pro-Shop Freischaltungen
                  </span>
                  <h2 className="font-display font-extrabold text-2xl text-white">
                    🏆 PALLADIUM-CHALLENGES ({completedChallengesCount}/
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
                {PALLADIUM_CHALLENGES.map((ch, idx) => {
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
                      className={`p-3.5 rounded-xl border ${
                        st.completed
                          ? 'bg-emerald-950/35 border-emerald-400/60'
                          : 'bg-slate-900/90 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">
                          {idx + 1}. {ch.title}
                        </span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            st.completed ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        >
                          {st.completed
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
                          style={{ width: `${pct}%` }}
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
                    title: '🟠 1. „Ballspiel“ (Abwerfen mit den Guards)',
                    desc: 'Schlüpfe ins schwarze SKATE GUARD-Shirt! Wirf mit [E]/[F], Mausklick oder Pad-X/RB leuchtende Neon-Softbälle (prallen 1x an Banden ab).',
                  },
                  {
                    mode: 'slalom' as HallGameMode,
                    title: '锥 2. „Slalom“ (Pylonen-Parcours)',
                    desc: 'Auf der oberen und unteren Geraden stehen leuchtende 80er-Slalom-Hütchen. Schlängle dich fehlerfrei für Combo-Punkte hindurch!',
                  },
                  {
                    mode: 'stuhlsprung' as HallGameMode,
                    title: '🪑 3. „Stuhl- & Hindernissprung“',
                    desc: 'Auf der unteren Geraden stehen 1er-, 2er- und 3er-Klappstuhlreihen. Springe mit [J], [Shift] oder Pad-A rechtzeitig darüber!',
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
        {/* 5. HALLEN-STATISTIK & BESUCHER-ANALYSE MODAL                          */}
        {/* ===================================================================== */}
        {showStatsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-[#0D1322] border-2 border-cyan-400/70 shadow-2xl p-6 text-white">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="font-mono text-xs text-cyan-300 uppercase">
                    Rein lokal ohne Cookies • Anonymisierte Hallen-Analyse
                  </span>
                  <h2 className="font-display font-extrabold text-2xl text-white">
                    📊 HALLEN-STATISTIK &amp; STOSSZEITEN
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatsModal(false)}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                >
                  Schließen
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <div className="text-[11px] font-mono text-slate-400">
                    Besucher heute
                  </div>
                  <div className="font-display font-black text-2xl text-cyan-300">
                    {visitsToday}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <div className="text-[11px] font-mono text-slate-400">
                    Besuche gesamt
                  </div>
                  <div className="font-display font-black text-2xl text-fuchsia-300">
                    {hallStats.totalSessions}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <div className="text-[11px] font-mono text-slate-400">
                    Ø Verweildauer
                  </div>
                  <div className="font-display font-black text-xl text-amber-300">
                    {avgSessionMin}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <div className="text-[11px] font-mono text-slate-400">
                    Rundenrekord
                  </div>
                  <div className="font-display font-black text-2xl text-emerald-300">
                    {Math.max(hallStats.bestLapRecord, telemetry.laps)}
                  </div>
                </div>
              </div>

              {/* 24-Hour Peak Bar Chart */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-slate-300 font-bold">
                    Stündliche Verteilung (00–23 Uhr)
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-xs font-bold">
                    Peak-Zeit: {peakHourText}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-1 h-28 pt-4">
                  {hallStats.hourlyHistogram.map((count, hour) => {
                    const maxCount = Math.max(
                      1,
                      ...hallStats.hourlyHistogram
                    );
                    const heightPct = Math.max(
                      8,
                      Math.round((count / maxCount) * 100)
                    );
                    return (
                      <div
                        key={hour}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <div className="w-full h-20 flex items-end">
                          <div
                            title={`${hour}:00 Uhr: ${count} Sessions`}
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t ${
                              count === maxCount
                                ? 'bg-gradient-to-t from-fuchsia-500 to-amber-300'
                                : 'bg-cyan-500/70'
                            }`}
                          />
                        </div>
                        <span className="text-[9px] font-mono text-slate-500">
                          {String(hour).padStart(2, '0')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>
                  Aktuelle Sitzung: {Math.floor(sessionSeconds / 60)}m{' '}
                  {sessionSeconds % 60}s
                </span>
                <span>100% localStorage (Keine Cookies)</span>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 6. MAINTENANCE MODE OVERLAY ("HIER WIRD GEBOHNERT")                   */}
        {/* ===================================================================== */}
        {isBlockedByMaintenance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090812]/95 p-6 text-center">
            <div className="max-w-lg w-full p-8 rounded-2xl bg-[#161224] border-2 border-amber-400 shadow-[0_0_60px_rgba(251,191,36,0.3)]">
              <div className="text-4xl mb-2">🧹🛼✨</div>
              <h2 className="font-display font-black text-2xl text-amber-300">
                HIER WIRD GEBOHNERT!
              </h2>
              <p className="text-sm text-slate-300 mt-2">
                Das Holzparkett der Palladium Roller Arena Hanau erhält gerade
                eine frische Schicht Bohnerwachs. Zutritt aktuell nur mit
                Backstage-Pass oder Hallenleiter-PIN.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPinInput('');
                  setPinError(null);
                  setShowAdminPinModal(true);
                }}
                className="mt-5 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs cursor-pointer"
              >
                🔑 Backstage-PIN eingeben
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 7. ADMIN PIN LOGIN MODAL (CTRL+SHIFT+A OR 3X LOGO CLICK)              */}
        {/* ===================================================================== */}
        {showAdminPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <form
              onSubmit={handleVerifyAdminPin}
              className="w-full max-w-sm rounded-2xl bg-[#140F23] border-2 border-rose-500/80 shadow-2xl p-6 text-white"
            >
              <div className="font-mono text-xs text-rose-400 uppercase">
                Versteckter Zugang • Hallenleiter-Regie
              </div>
              <h2 className="font-display font-extrabold text-xl mt-0.5">
                🔐 ADMIN-TERMINAL LOGIN
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Bitte Hallenleiter-PIN eingeben (Standard-PIN im Code:{' '}
                <code className="text-amber-300">1986</code>):
              </p>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN (1986)"
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
        {/* 8. PIN-PROTECTED ADMIN TERMINAL ("HALLENLEITER-REGIE")                */}
        {/* ===================================================================== */}
        {showAdminTerminal && isAdminUnlocked && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 overflow-y-auto backdrop-blur-sm">
            <div className="w-full max-w-[96vw] xl:max-w-[1720px] rounded-2xl bg-[#120D20] border-2 border-rose-500 shadow-[0_0_60px_rgba(244,63,94,0.4)] p-3 text-white space-y-2.5">
              {/* Compact Header */}
              <div className="flex items-center justify-between border-b border-rose-500/40 pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-display font-black text-lg xl:text-xl text-white">
                    🎛️ HALLENLEITER-REGIE — PALLADIUM HANAU
                  </h2>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-950/90 border border-rose-500/40 text-rose-300 uppercase">
                    PIN-geschütztes Admin-Terminal (3-Spalten-Regie)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminUnlocked(false);
                      saveAdminUnlockedSession(false);
                      setShowAdminTerminal(false);
                    }}
                    className="px-2.5 py-1 rounded bg-rose-950 border border-rose-500/50 text-rose-200 font-mono text-xs cursor-pointer"
                  >
                    Abmelden
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdminTerminal(false)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs cursor-pointer"
                  >
                    Schließen
                  </button>
                </div>
              </div>

              {/* 3-COLUMN WIDESCREEN GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
                {/* ============================================================= */}
                {/* SPALTE 1: 1. MITTEL-ARENA & LIVE-BAND-BOOKING                 */}
                {/* ============================================================= */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-mono font-bold text-xs uppercase text-amber-300">
                      1. MITTEL-ARENA &amp; LIVE-BAND-BOOKING
                    </h3>
                    <div className="flex gap-1.5">
                      {(
                        [
                          { id: 'islands', label: '2 U-Inseln (Standard)' },
                          { id: 'live-band', label: '🎸 Live-Band-Bühne' },
                          { id: 'cinema', label: '🎬 Kino-Leinwand' },
                        ] as { id: CenterStageMode; label: string }[]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setCenterStageMode(m.id)}
                          className={`flex-1 py-1 px-1.5 rounded font-mono text-[11px] font-bold border cursor-pointer ${
                            centerStageMode === m.id
                              ? 'bg-amber-400 text-slate-950 border-white'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
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
                              setCenterStageMode('live-band');
                              if (band === 'LAMIO') {
                                setBandSkinTone('black');
                              }
                            }}
                            className={`py-1 px-2 rounded font-mono text-[11px] border truncate cursor-pointer ${
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
                      <div>
                        <span className="block font-mono text-[10px] uppercase text-fuchsia-300 font-bold mb-0.5">
                          Band-Besetzung (Hautfarbe):
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: 'black', label: 'Schwarz' },
                              { id: 'white', label: 'Weiß' },
                              { id: 'mixed', label: 'Gemischt' },
                            ] as { id: BandSkinToneMode; label: string }[]
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setBandSkinTone(opt.id)}
                              className={`py-0.5 px-1.5 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                bandSkinTone === opt.id
                                  ? 'bg-fuchsia-600 border-white text-white shadow-[0_0_8px_rgba(232,121,249,0.4)]'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block font-mono text-[10px] uppercase text-cyan-300 font-bold mb-0.5">
                          Band-Besetzung (Geschlecht):
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: 'male', label: 'Männlich' },
                              { id: 'female', label: 'Weiblich' },
                              { id: 'mixed', label: 'Gemischt' },
                            ] as { id: BandGenderMode; label: string }[]
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setBandGender(opt.id)}
                              className={`py-0.5 px-1.5 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                                bandGender === opt.id
                                  ? 'bg-cyan-500 border-white text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-800/90">
                        <span className="block font-mono text-[10px] uppercase text-amber-300 font-bold mb-0.5">
                          🔦 KONZERTBELEUCHTUNG:
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(
                            [
                              { id: 'auto', label: 'Automatik' },
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
                                  ? 'bg-amber-400 border-white text-slate-950 shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Kino-Zeitplan */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold text-cyan-300">
                        🎬 Auto-Kino-Zeitplan (Twitch auf Kino-Leinwand):
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
                    <div className="grid grid-cols-3 gap-1 text-[10px] font-mono">
                      <div>
                        <label className="block text-[9px] text-slate-400">
                          Wochentag
                        </label>
                        <select
                          value={adminSettings.cinemaWeekday}
                          onChange={(e) =>
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaWeekday: e.target.value,
                            }))
                          }
                          className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-white"
                        >
                          {[
                            'Montag',
                            'Dienstag',
                            'Mittwoch',
                            'Donnerstag',
                            'Freitag',
                            'Samstag',
                            'Sonntag',
                            'Täglich',
                          ].map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">
                          Von (Start)
                        </label>
                        <input
                          type="time"
                          value={adminSettings.cinemaStartTime}
                          onChange={(e) =>
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaStartTime: e.target.value,
                            }))
                          }
                          className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400">
                          Bis (Ende)
                        </label>
                        <input
                          type="time"
                          value={adminSettings.cinemaEndTime}
                          onChange={(e) =>
                            setAdminSettings((s) => ({
                              ...s,
                              cinemaEndTime: e.target.value,
                            }))
                          }
                          className="w-full px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ============================================================= */}
                {/* SPALTE 2: 2. HALLENLICHT / NEBEL / PFEIFE, 3. EVENT, 4. WARTUNG */}
                {/* ============================================================= */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-mono font-bold text-xs uppercase text-cyan-300">
                      2. HALLENLICHT / BLACKLIGHT / NEBEL / TRILLERPFEIFE
                    </h3>
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
                          className={`py-1.5 px-1 rounded font-mono text-[10px] font-bold border cursor-pointer ${
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
                          className="flex-1 py-1 px-2 rounded bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-mono text-[10px] font-bold cursor-pointer"
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

                    {/* 80er-Bühnen-Nebelmaschine, NPC-Stimmen & Trillerpfeife */}
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
                          className={`flex-1 py-1 px-2 rounded font-mono text-[11px] font-bold border transition cursor-pointer ${
                            adminSettings.fogMachineEnabled
                              ? 'bg-cyan-500 text-slate-950 border-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                              : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}
                        >
                          🌫️ Nebelmaschine:{' '}
                          {adminSettings.fogMachineEnabled ? 'AN' : 'AUS'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFogBurstCount((c) => c + 1)}
                          className="py-1 px-2.5 rounded bg-indigo-700 hover:bg-indigo-600 border border-indigo-400/60 text-white font-mono text-[11px] font-bold transition cursor-pointer"
                        >
                          💨 Nebelstoß
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {/* Hörbare NPC-Stimmen (Sprechblasen) Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => {
                              const nextVoices = !s.npcVoicesEnabled;
                              if (
                                !nextVoices &&
                                typeof window !== 'undefined' &&
                                'speechSynthesis' in window
                              ) {
                                window.speechSynthesis.cancel();
                              }
                              return {
                                ...s,
                                npcVoicesEnabled: nextVoices,
                              };
                            })
                          }
                          className={`py-1 px-2 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                            adminSettings.npcVoicesEnabled
                              ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                              : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}
                        >
                          🗣️ NPC-Stimmen (Sprechblasen):{' '}
                          {adminSettings.npcVoicesEnabled ? 'AN' : 'AUS'}
                        </button>

                        {/* 📯 Skate-Guard-Trillerpfeife Toggle */}
                        <button
                          type="button"
                          onClick={() =>
                            setAdminSettings((s) => ({
                              ...s,
                              skateGuardWhistleEnabled:
                                !s.skateGuardWhistleEnabled,
                            }))
                          }
                          className={`py-1 px-2 rounded font-mono text-[10px] font-bold border transition cursor-pointer ${
                            adminSettings.skateGuardWhistleEnabled
                              ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                              : 'bg-slate-800 text-slate-300 border-slate-600'
                          }`}
                        >
                          📯 Skate-Guard-Trillerpfeife:{' '}
                          {adminSettings.skateGuardWhistleEnabled ? 'AN' : 'AUS'}
                        </button>
                      </div>
                    </div>

                    {/* 3. HALLEN-SPIEL / EVENT */}
                    <div className="pt-1 border-t border-slate-800">
                      <h3 className="font-mono font-bold text-xs uppercase text-fuchsia-300 mb-1">
                        3. HALLEN-SPIEL / EVENT (Ballspiel = Putzlicht)
                      </h3>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            { id: 'free-skate', label: 'Frei' },
                            { id: 'ballspiel', label: 'Ballspiel' },
                            { id: 'slalom', label: 'Slalom' },
                            { id: 'stuhlsprung', label: 'Stuhlsprung' },
                          ] as { id: HallGameMode; label: string }[]
                        ).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setHallGameMode(g.id)}
                            className={`py-1 rounded font-mono text-[10px] font-bold border cursor-pointer ${
                              hallGameMode === g.id
                                ? 'bg-fuchsia-500 text-white border-white'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 4. WARTUNGSMODUS */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="font-mono text-xs font-bold text-amber-200">
                      4. WARTUNGSMODUS („Hier wird gebohnert“):
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAdminSettings((s) => ({
                          ...s,
                          isMaintenanceMode: !s.isMaintenanceMode,
                        }))
                      }
                      className={`px-3 py-1 rounded font-mono text-xs font-bold cursor-pointer ${
                        adminSettings.isMaintenanceMode
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {adminSettings.isMaintenanceMode ? 'AKTIV' : 'AUS'}
                    </button>
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

                      {/* Kompaktes Formular "+ Gast-DJ hinzufügen" */}
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

                  {/* 6. GEISTER-SKATER MANAGER & 🌐 MULTIPLAYER-SPASSRAUM */}
                  <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono font-bold text-[11px] uppercase text-cyan-300">
                        6. GEISTER-SKATER MANAGER
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
                    <div className="flex flex-wrap gap-1">
                      {specialSkaters.map((name) => (
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
                      ))}
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
                          setSpecialSkaters([...DEFAULT_SPECIAL_SKATERS]);
                          saveSpecialSkaters([...DEFAULT_SPECIAL_SKATERS]);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] cursor-pointer"
                      >
                        Reset
                      </button>
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
                          className="flex-1 py-1 px-2.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-bold text-[11px] cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.4)]"
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

                {/* Aktions-Buttons + 7. Statistik & Einlass / 8. Intro-Reset kompakt in einer Zeile */}
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
                      className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-bold text-xs cursor-pointer transition shadow-[0_0_12px_rgba(251,191,36,0.35)]"
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
                      className="px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-mono font-bold text-xs cursor-pointer transition shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                    >
                      🚀 Ausgewählten Style für alle freischalten
                    </button>
                    {styleFeedbackToast && (
                      <span className="text-[10px] font-mono text-cyan-300">
                        {styleFeedbackToast}
                      </span>
                    )}
                  </div>

                  {/* 7. Statistik & Einlass / 8. First-Visit-Vorhang kompakt integriert */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-300">
                    <span>
                      <strong>7. Statistik:</strong> Heute {visitsToday} • Ges.{' '}
                      {hallStats.totalSessions} • Stempel:{' '}
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
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 9. 80s MULTIPLAYER INVITATION WELCOME MODAL (?room=<RAUM_ID>)         */}
        {/* ===================================================================== */}
        {showGuestJoinModal && initialUrlRoomId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
            <div className="w-full max-w-md rounded-2xl bg-[#120D20] border-2 border-cyan-400 shadow-[0_0_55px_rgba(0,240,255,0.45)] p-5 text-white space-y-4">
              <div className="text-center space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/60 font-mono text-[10px] text-cyan-300 uppercase">
                  🌐 Live-Einladung • Raum: {initialUrlRoomId}
                </span>
                <h2 className="font-display font-black text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-amber-200 to-fuchsia-400">
                  Willkommen im Palladium Hanau! Gib deinen Skater-Namen ein &amp;
                  wähle deine Outfit-Farbe
                </h2>
                <p className="text-xs text-slate-300">
                  Du betrittst die reine Menschen-Bahn ohne KI-Bots – rolle
                  live mit deinen Freunden zur 80er-Show!
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-mono text-xs text-cyan-300 mb-1">
                    Dein Skater-Name auf der Bahn:
                  </label>
                  <input
                    type="text"
                    maxLength={22}
                    value={guestJoinNameInput}
                    onChange={(e) => setGuestJoinNameInput(e.target.value)}
                    placeholder="z.B. Roller-Robby"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-cyan-400/60 font-mono text-sm text-white focus:outline-none focus:border-amber-300"
                  />
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
                  onClick={() =>
                    handleConnectAsGuest(
                      initialUrlRoomId,
                      guestJoinNameInput,
                      playerShirtColor
                    )
                  }
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300 text-slate-950 font-mono font-black text-sm cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.5)] hover:brightness-110 transition"
                >
                  🛼 Jetzt live in die Halle rollen!
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
