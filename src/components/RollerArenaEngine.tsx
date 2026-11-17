import React, { useEffect, useRef } from 'react';
import {
  applyCustomArenaLayout,
  ARENA_LAYOUT,
  ArenaVisualStyle,
  BandGenderMode,
  BandSkinToneMode,
  CameraViewMode,
  CenterStageMode,
  ChallengeId,
  ConcertLightingMode,
  CrewNamesConfig,
  CustomArenaLayoutState,
  CustomNpcAnchor,
  DEFAULT_CREW_NAMES,
  DEFAULT_CUSTOM_ARENA_LAYOUT,
  EditableModuleId,
  getModuleCollisionRect,
  HallGameMode,
  LightingMode,
  NameDisplayMode,
  NeonWristbandColor,
  PlayerCharacterMode,
  ProShopUpgradesState,
  SkateCharmId,
  StationDialogId,
  TrickMoveId,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/arenaConfig';
import { soundFX } from '../utils/soundEffects';
import {
  CustomCrewStationMember,
  SingleplayerDifficulty,
} from '../utils/storageAndStats';

export interface ArenaLiveTelemetry {
  x: number;
  y: number;
  speed: number;
  laps: number;
  cleanLapsStreak: number;
  crashes: number;
  isSlipstreamActive: boolean;
  isOnWaxPatch: boolean;
  slushTimerSec: number;
  blobaColaTimerSec: number;
  freeSlushCount: number;
  freeBlobaCount: number;
  nearProShop: boolean;
  nearSkateRental: boolean;
  nearBistroCounter: boolean;
  nearDjTower: boolean;
  nearCashier?: boolean;
  hasSkatesEquipped: boolean;
  djAudioProximity: number; // 0.15 .. 1.0
  gamepadConnected: boolean;
  gamepadName: string;
  activeSpeech: string | null;
  ballspielScore: number;
  ballspielRemaining: number;
  ballspielTotal: number;
  slalomCombo: number;
  activeTrickMove?: TrickMoveId | null;
  nearLockers?: boolean;
  nearNewspaperStand?: boolean;
  nearLeaderboardBoard?: boolean;
  nearCustomCrewId?: string | null;
  slalomRound?: number;
  slalomSpeedPercent?: number;
  nearArcadeMachine?: 'monkey-stomp' | 'disco-invaders' | 'pac-roller' | null;
  ballspielElapsedSec?: number;
  isArcadeProtected?: boolean;
}

export interface MultiplayerPlayerState {
  peerId: string;
  tabSessionId?: string;
  joinedAt?: number;
  lastSeenAt?: number;
  isAdmin?: boolean;
  name: string;
  shirtColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  headingRad: number;
  spinAngleOffset: number;
  isSpinning: boolean;
  jumpZ: number;
  isJumping: boolean;
  characterMode: PlayerCharacterMode;
  kengolHat: boolean;
  crashTimer: number;
  speechBubble: string | null;
  activeTrickMove?: TrickMoveId | null;
  trickTimer?: number;
  wristbandColor?: NeonWristbandColor;
  activeCharm?: SkateCharmId | null;
  avatarRole?: 'standard' | 'kid' | 'stammgast';
}

interface InterpolatedRemotePlayer extends MultiplayerPlayerState {
  renderX: number;
  renderY: number;
  renderHeading: number;
  renderJumpZ: number;
}

interface RollerArenaEngineProps {
  playerName: string;
  playerShirtColor?: string;
  isAnonymousGuest: boolean;
  showNames: boolean;
  nameDisplayMode?: NameDisplayMode;
  characterMode: PlayerCharacterMode;
  difficulty: SingleplayerDifficulty;
  hasOwnSkates: boolean;
  hasRentedSkates: boolean;
  drinkChipAvailable: boolean;
  npcVoicesEnabled: boolean;
  skateGuardWhistleEnabled: boolean;
  fullHallPutzlichtEnabled?: boolean;
  pixel16BitFiguresEnabled?: boolean;
  backgroundDancersEnabled?: boolean;
  monitorPreviewStyle?: ArenaVisualStyle | null;
  cinemaCountdownEnabled?: boolean;
  cinemaCountdownTitle?: string;
  cinemaCountdownTargetIso?: string;
  cinemaWeekdays?: string[];
  cinemaStartTime?: string;
  crewNames?: CrewNamesConfig;
  externalDjJingleBubble?: { text: string; seq: number } | null;
  concertLightingMode: ConcertLightingMode;
  arenaStyle: ArenaVisualStyle;
  activeDjName: string;
  isMuted: boolean;
  cameraMode: CameraViewMode;
  lightingMode: LightingMode;
  centerStageMode: CenterStageMode;
  activeBandName: string;
  bandSkinTone: BandSkinToneMode;
  bandGender: BandGenderMode;
  hallGameMode: HallGameMode;
  djTickerText: string;
  specialSkaters: string[];
  ghostSkatersEnabled: boolean;
  kengolHatEnabled: boolean;
  upgrades: ProShopUpgradesState;
  fogMachineEnabled: boolean;
  fogBurstCount: number;
  isCurtainOpen: boolean;
  isMultiplayerActive?: boolean;
  remotePlayers?: MultiplayerPlayerState[];
  externalTrickTrigger?: { move: TrickMoveId; seq: number } | null;
  remoteControllerInputRef?: React.MutableRefObject<{
    dx: number;
    dy: number;
    jump: boolean;
    spin: boolean;
    interact: boolean;
    boost: boolean;
    trickMove: TrickMoveId | null;
  }>;
  onLocalPlayerState?: (state: Omit<MultiplayerPlayerState, 'peerId'>) => void;
  onToggleCamera: () => void;
  onToggleCharacterMode: () => void;
  onToggleShowNames: () => void;
  onToggleUnderglow: () => void;
  onToggleKengolHat: () => void;
  onOpenProShopModal: () => void;
  onOpenChronicleModal: () => void;
  onEnterHallFromGamepad: () => void;
  onToggleTwitchStream?: () => void;
  onRedeemDrinkChipAtRental: () => void;
  onRedeemDrinkChipAtBistro: () => void;
  onChallengeProgress: (
    id: ChallengeId,
    amount: number,
    isAbsolute?: boolean
  ) => void;
  onTelemetry: (telemetry: ArenaLiveTelemetry) => void;
  buildModeEnabled?: boolean;
  customLayout?: CustomArenaLayoutState;
  selectedBuildItemId?: string | null;
  onSelectBuildItem?: (id: string | null) => void;
  onUpdateCustomLayout?: (nextLayout: CustomArenaLayoutState) => void;
  showAiNames?: boolean;
  showOwnName?: boolean;
  showSpeechBubbles?: boolean;
  vipDiscoSkatesEquipped?: boolean;
  lockerDrinkBoostTrigger?: number;
  onOpenLockerModal?: () => void;
  onIntroStepComplete?: (
    stepId: 'open_locker' | 'fetch_drink' | 'skate_rink' | 'try_ballspiel'
  ) => void;
  skateDirection?: 'ccw' | 'cw';
  springerStaffelShowActive?: boolean;
  teleportTrigger?: {
    x: number;
    y: number;
    headingRad?: number;
    label?: string;
    seq: number;
  } | null;
  onClickDjConsole?: () => void;
  neonLightboxesEnabled?: boolean;
  neonLightboxLine1?: string;
  neonLightboxLine2?: string;
  neonLightboxLine3?: string;
  onCertificateEvent?: (
    eventType:
      | 'skate_rink'
      | 'clean_slalom'
      | 'clean_jump'
      | 'high_speed_jump'
  ) => void;
  onAwardObstaclePoints?: (points: number) => void;
  onRequestAdminPinModal?: () => void;
  mobilitySelected?: boolean;
  avatarRole?: 'standard' | 'kid' | 'stammgast';
  sundayCliqueActive?: boolean;
  onOpenStationDialog?: (stationId: StationDialogId | string) => void;
  customCrewMembers?: CustomCrewStationMember[];
  newspaperEnabled?: boolean;
  newspaperHasNewBadge?: boolean;
  onOpenNewspaperModal?: () => void;
  monitorCameraMode?: 'local' | 'multiplayer';
  manualSlowCruiseActive?: boolean;
  onSlalomRoundComplete?: (round: number, bonusPixels: number) => void;
  onOpenLeaderboardModal?: () => void;
  isPlayingArcade?: boolean;
  onOpenArcadeMachine?: (
    gameId: 'monkey-stomp' | 'disco-invaders' | 'pac-roller'
  ) => void;
  ballspielResetSeq?: number;
  onBallspielRoundFinished?: (result: {
    elapsedSec: number;
    totalSkaters: number;
    reason: 'victory' | 'timeout';
  }) => void;
}

export interface TrackNpc {
  id: string;
  name: string;
  gender: 'female' | 'male';
  role: 'regular' | 'speed' | 'guard' | 'ghost' | 'wheelchair-npc';
  orbitAngle: number;
  laneRadiusX: number;
  laneRadiusY: number;
  laneOffset?: number;
  homeX?: number;
  homeY?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  headingRad: number;
  baseSpeed: number;
  shirtColor: string;
  accentColor: string;
  wheelColor: string;
  skateBootColor?: 'white' | 'black';
  legwarmerColor?: string;
  spinTimer: number;
  jumpZ?: number;
  jumpVz?: number;
  speechText: string | null;
  speechTimer: number;
  crashTimer: number;
  hitOutTimer: number;
  eliminated?: boolean;
  eliminatedOrder?: number;
  ballspielTargetX?: number;
  ballspielTargetY?: number;
  ballspielRetargetTimer?: number;
  sittingBarrierSpot: { x: number; y: number; normalRad: number } | null;
  excursionPhase?:
    | 'idle'
    | 'exiting-rink'
    | 'going-to-spot'
    | 'at-spot'
    | 'returning-to-gate';
  excursionSpotId?: 'snackbar' | 'lockers' | 'wc';
  excursionTargetX?: number;
  excursionTargetY?: number;
  excursionGateSide?: 'left' | 'right';
  excursionPauseTimer?: number;
}

interface NeonSoftball {
  id?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncesLeft: number;
  color: string;
  fromPlayer: boolean;
  state?: 'HELD' | 'THROWN' | 'FREE' | 'PASS_TO_PLAYER';
  holderId?: 'player' | string | null;
  manniAction?: 'pass_to_player' | 'co_throw';
  holdTimer?: number;
  freeTimer?: number;
}

interface SlalomCone {
  id: number;
  x: number;
  y: number;
  side: 'left' | 'right';
  wobbleTimer: number;
  passed: boolean;
}

interface JumpObstacleChair {
  id: number;
  x: number;
  y: number;
  chairCount: 1 | 2 | 3;
  width: number;
  height: number;
  angleRad: number;
  knockedOverTimer: number;
  clearedByPlayer: boolean;
  clearedInLap: boolean;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}

interface WheelTrailPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
  width: number;
}

/** Normalize angle difference to [-PI, +PI] for shortest-path rotation */
function normalizeAngle(rad: number): number {
  let a = rad % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function rotateShortest(
  current: number,
  target: number,
  maxStep: number
): number {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

/** Stadium-like outer track helper so Speed-Skaters hug the outer barrier & curved top-left DJ-Tower */
function computeTrackOvalPoint(
  centerX: number,
  centerY: number,
  rx: number,
  ry: number,
  angle: number,
  isOuterSpeedTrack: boolean,
  isClockwise = false
): { x: number; y: number; tangentRad: number } {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const deflectCorner = (px: number, py: number) => {
    // Smoothly guide outer track around the curved top-left DJ-Tower quarter-circle
    const minSum =
      ARENA_LAYOUT.djTower.bevelLeftX + ARENA_LAYOUT.djTower.bevelLeftY + 34;
    if (px + py < minSum) {
      const push = (minSum - (px + py)) * 0.5;
      return { x: px + push, y: py + push };
    }
    return { x: px, y: py };
  };

  if (!isOuterSpeedTrack) {
    const rawX = centerX + cosA * rx;
    const rawY = centerY + sinA * ry;
    const cur = deflectCorner(rawX, rawY);
    const tx = isClockwise ? -sinA * rx : sinA * rx;
    const ty = isClockwise ? cosA * ry : -cosA * ry;
    return { x: cur.x, y: cur.y, tangentRad: Math.atan2(ty, tx) };
  }

  const pExp = 0.78;
  const rawX =
    centerX + Math.sign(cosA) * Math.pow(Math.abs(cosA), pExp) * rx;
  const rawY =
    centerY + Math.sign(sinA) * Math.pow(Math.abs(sinA), pExp) * ry;
  const cur = deflectCorner(rawX, rawY);

  const dAngle = isClockwise ? 0.02 : -0.02;
  const cosNext = Math.cos(angle + dAngle);
  const sinNext = Math.sin(angle + dAngle);
  const rawNx =
    centerX + Math.sign(cosNext) * Math.pow(Math.abs(cosNext), pExp) * rx;
  const rawNy =
    centerY + Math.sign(sinNext) * Math.pow(Math.abs(sinNext), pExp) * ry;
  const nxt = deflectCorner(rawNx, rawNy);

  return {
    x: cur.x,
    y: cur.y,
    tangentRad: Math.atan2(nxt.y - cur.y, nxt.x - cur.x),
  };
}

/**
 * Newly entering players spawn directly in the entrance corridor between the
 * right-side cashier window of "1) KASSE & EINGANG" and Security-Sammy!
 */
function getPlayerStartCoords(
  _diff: SingleplayerDifficulty,
  _hasSkatesEquipped: boolean
): { x: number; y: number; headingRad: number } {
  const { entranceSpawn } = ARENA_LAYOUT.bottomEntrance;
  return {
    x: entranceSpawn.x,
    y: entranceSpawn.y,
    headingRad: Math.PI * 0.75,
  };
}

/**
 * Builds the AI NPC roster dynamically scaled for Singleplayer Experience Level:
 * - Distributed evenly around the entire track length and across Inner, Middle & Outer lanes
 * - Alternating White & Black 80s roller skates (`skateBootColor: 'white' | 'black'`) with colorful neon wheels
 */
export function buildTrackNpcsForDifficulty(
  diff: SingleplayerDifficulty,
  customAnchors?: Record<string, CustomNpcAnchor>
): TrackNpc[] {
  const speedScale =
    diff === 'beginner' ? 0.76 : diff === 'pro' ? 1.18 : 1.0;

  const allSpeedSkaters: TrackNpc[] = [
    {
      id: 'speed-1',
      name: 'Paceline-Leader Kai',
      gender: 'male',
      role: 'speed',
      orbitAngle: 0.48,
      laneRadiusX: 668,
      laneRadiusY: 336,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.92 * speedScale,
      shirtColor: '#dc2626',
      accentColor: '#fde047',
      wheelColor: '#38bdf8',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'speed-2',
      name: 'Aero-Anja',
      gender: 'female',
      role: 'speed',
      orbitAngle: 0.36,
      laneRadiusX: 668,
      laneRadiusY: 336,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.92 * speedScale,
      shirtColor: '#dc2626',
      accentColor: '#38bdf8',
      wheelColor: '#fde047',
      legwarmerColor: '#ff2a85',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'speed-3',
      name: 'Turbo-Marek',
      gender: 'male',
      role: 'speed',
      orbitAngle: 0.24,
      laneRadiusX: 668,
      laneRadiusY: 336,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.92 * speedScale,
      shirtColor: '#dc2626',
      accentColor: '#39ff14',
      wheelColor: '#ec4899',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'speed-4',
      name: 'Sprint-Sonja',
      gender: 'female',
      role: 'speed',
      orbitAngle: 0.12,
      laneRadiusX: 668,
      laneRadiusY: 336,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.92 * speedScale,
      shirtColor: '#dc2626',
      accentColor: '#f472b6',
      wheelColor: '#00f0ff',
      legwarmerColor: '#00f0ff',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'speed-5',
      name: 'Raketen-Ralf',
      gender: 'male',
      role: 'speed',
      orbitAngle: 0.0,
      laneRadiusX: 668,
      laneRadiusY: 336,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.92 * speedScale,
      shirtColor: '#b91c1c',
      accentColor: '#00f0ff',
      wheelColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'speed-6',
      name: 'Blitz-Bianca',
      gender: 'female',
      role: 'speed',
      orbitAngle: -0.12,
      laneRadiusX: 668,
      laneRadiusY: 336,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.92 * speedScale,
      shirtColor: '#b91c1c',
      accentColor: '#fde047',
      wheelColor: '#ff2a85',
      legwarmerColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
  ];

  const guards: TrackNpc[] = [
    {
      id: 'guard-1',
      name: 'SKATE GUARD Manni',
      gender: 'male',
      role: 'guard',
      orbitAngle: 1.2,
      laneRadiusX: 542,
      laneRadiusY: 262,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.68 * speedScale,
      shirtColor: '#070a10',
      accentColor: '#39ff14',
      wheelColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'guard-2',
      name: 'SKATE GUARD Biggi',
      gender: 'female',
      role: 'guard',
      orbitAngle: 4.34,
      laneRadiusX: 542,
      laneRadiusY: 262,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.68 * speedScale,
      shirtColor: '#070a10',
      accentColor: '#39ff14',
      wheelColor: '#39ff14',
      legwarmerColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
  ];

  const allRegularSkaters: TrackNpc[] = [
    {
      id: 'cult-skate-cat',
      name: '🐱 Skate Cat',
      gender: 'female',
      role: 'regular',
      orbitAngle: 0.65,
      laneRadiusX: 485,
      laneRadiusY: 240,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.61 * speedScale,
      shirtColor: '#f59e0b',
      accentColor: '#fde047',
      wheelColor: '#ff2a85',
      legwarmerColor: '#ff2a85',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'cult-walkman-moni',
      name: '🎧 Walkman-Moni',
      gender: 'female',
      role: 'regular',
      orbitAngle: 2.95,
      laneRadiusX: 535,
      laneRadiusY: 266,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.59 * speedScale,
      shirtColor: '#ec4899',
      accentColor: '#00f0ff',
      wheelColor: '#39ff14',
      legwarmerColor: '#00f0ff',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'cult-breakdance-benni',
      name: '🕺 Breakdance-Benni',
      gender: 'male',
      role: 'regular',
      orbitAngle: 4.55,
      laneRadiusX: 595,
      laneRadiusY: 294,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.63 * speedScale,
      shirtColor: '#dc2626',
      accentColor: '#fde047',
      wheelColor: '#00f0ff',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-1',
      name: 'Disco-Dieter',
      gender: 'male',
      role: 'regular',
      orbitAngle: 2.1,
      laneRadiusX: 495,
      laneRadiusY: 245,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.56 * speedScale,
      shirtColor: '#1e3a8a',
      accentColor: '#38bdf8',
      wheelColor: '#f472b6',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-2',
      name: 'Neon-Nadine',
      gender: 'female',
      role: 'regular',
      orbitAngle: 3.4,
      laneRadiusX: 472,
      laneRadiusY: 234,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.61 * speedScale,
      shirtColor: '#701a75',
      accentColor: '#f472b6',
      wheelColor: '#00f0ff',
      legwarmerColor: '#fde047',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-3',
      name: 'WCMX-Marco',
      gender: 'male',
      role: 'wheelchair-npc',
      orbitAngle: 5.1,
      laneRadiusX: 518,
      laneRadiusY: 254,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.63 * speedScale,
      shirtColor: '#065f46',
      accentColor: '#39ff14',
      wheelColor: '#38bdf8',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-4',
      name: 'Slalom-Steffi',
      gender: 'female',
      role: 'regular',
      orbitAngle: 0.9,
      laneRadiusX: 462,
      laneRadiusY: 228,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.58 * speedScale,
      shirtColor: '#4c1d95',
      accentColor: '#c084fc',
      wheelColor: '#39ff14',
      legwarmerColor: '#f472b6',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-5',
      name: 'Boogie-Bernd',
      gender: 'male',
      role: 'regular',
      orbitAngle: 2.75,
      laneRadiusX: 575,
      laneRadiusY: 284,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.59 * speedScale,
      shirtColor: '#0f766e',
      accentColor: '#2dd4bf',
      wheelColor: '#fde047',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-6',
      name: 'Glitter-Gabi',
      gender: 'female',
      role: 'regular',
      orbitAngle: 4.05,
      laneRadiusX: 602,
      laneRadiusY: 298,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.57 * speedScale,
      shirtColor: '#9d174d',
      accentColor: '#f472b6',
      wheelColor: '#38bdf8',
      legwarmerColor: '#00f0ff',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-7',
      name: 'Synth-Sven',
      gender: 'male',
      role: 'regular',
      orbitAngle: 1.55,
      laneRadiusX: 615,
      laneRadiusY: 304,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.62 * speedScale,
      shirtColor: '#1d4ed8',
      accentColor: '#fde047',
      wheelColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-8',
      name: 'Lady-Lisa',
      gender: 'female',
      role: 'regular',
      orbitAngle: 5.65,
      laneRadiusX: 560,
      laneRadiusY: 276,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.60 * speedScale,
      shirtColor: '#6b21a8',
      accentColor: '#e879f9',
      wheelColor: '#fde047',
      legwarmerColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-9',
      name: 'Retro-Rico',
      gender: 'male',
      role: 'regular',
      orbitAngle: 0.45,
      laneRadiusX: 525,
      laneRadiusY: 258,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.58 * speedScale,
      shirtColor: '#b45309',
      accentColor: '#fde047',
      wheelColor: '#00f0ff',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-10',
      name: 'Disco-Dora',
      gender: 'female',
      role: 'regular',
      orbitAngle: 3.05,
      laneRadiusX: 508,
      laneRadiusY: 250,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.57 * speedScale,
      shirtColor: '#be185d',
      accentColor: '#00f0ff',
      wheelColor: '#ff2a85',
      legwarmerColor: '#fde047',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-11',
      name: 'Funky-Frank',
      gender: 'male',
      role: 'regular',
      orbitAngle: 4.75,
      laneRadiusX: 588,
      laneRadiusY: 290,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.61 * speedScale,
      shirtColor: '#0369a1',
      accentColor: '#39ff14',
      wheelColor: '#f472b6',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-12',
      name: 'Wave-Wendy',
      gender: 'female',
      role: 'regular',
      orbitAngle: 1.85,
      laneRadiusX: 452,
      laneRadiusY: 222,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.56 * speedScale,
      shirtColor: '#4338ca',
      accentColor: '#38bdf8',
      wheelColor: '#fde047',
      legwarmerColor: '#ff2a85',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-13',
      name: 'Kassetten-Karsten',
      gender: 'male',
      role: 'regular',
      orbitAngle: 3.72,
      laneRadiusX: 632,
      laneRadiusY: 312,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.63 * speedScale,
      shirtColor: '#15803d',
      accentColor: '#fde047',
      wheelColor: '#00f0ff',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-14',
      name: 'Pop-Petra',
      gender: 'female',
      role: 'regular',
      orbitAngle: 5.95,
      laneRadiusX: 622,
      laneRadiusY: 308,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.60 * speedScale,
      shirtColor: '#a21caf',
      accentColor: '#39ff14',
      wheelColor: '#38bdf8',
      legwarmerColor: '#fde047',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
    {
      id: 'reg-15',
      name: 'Break-Boris',
      gender: 'male',
      role: 'regular',
      orbitAngle: 2.42,
      laneRadiusX: 548,
      laneRadiusY: 270,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      headingRad: 0,
      baseSpeed: 0.62 * speedScale,
      shirtColor: '#3730a3',
      accentColor: '#f472b6',
      wheelColor: '#39ff14',
      spinTimer: 0,
      speechText: null,
      speechTimer: 0,
      crashTimer: 0,
      hitOutTimer: 0,
      sittingBarrierSpot: null,
    },
  ];

  const selectedList =
    diff === 'beginner'
      ? [
          ...allSpeedSkaters.slice(0, 1),
          ...guards,
          ...allRegularSkaters.slice(0, 6),
        ]
      : diff === 'pro'
      ? [...allSpeedSkaters, ...guards, ...allRegularSkaters]
      : [
          ...allSpeedSkaters.slice(0, 4),
          ...guards,
          ...allRegularSkaters.slice(0, 8),
        ];

  const { rink } = ARENA_LAYOUT;
  return selectedList.map((npc, idx) => {
    const savedAnchor = customAnchors?.[npc.id];
    const effectiveAngle =
      typeof savedAnchor?.orbitAngle === 'number' &&
      Number.isFinite(savedAnchor.orbitAngle)
        ? savedAnchor.orbitAngle
        : npc.orbitAngle;
    const effectiveRx =
      typeof savedAnchor?.laneRadiusX === 'number' &&
      Number.isFinite(savedAnchor.laneRadiusX)
        ? savedAnchor.laneRadiusX
        : npc.laneRadiusX;
    const effectiveRy =
      typeof savedAnchor?.laneRadiusY === 'number' &&
      Number.isFinite(savedAnchor.laneRadiusY)
        ? savedAnchor.laneRadiusY
        : npc.laneRadiusY;
    const pt = computeTrackOvalPoint(
      rink.centerX,
      rink.centerY,
      effectiveRx,
      effectiveRy,
      effectiveAngle,
      npc.role === 'speed'
    );
    const homeX =
      typeof savedAnchor?.homeX === 'number' &&
      Number.isFinite(savedAnchor.homeX)
        ? Math.round(savedAnchor.homeX)
        : Math.round(pt.x);
    const homeY =
      typeof savedAnchor?.homeY === 'number' &&
      Number.isFinite(savedAnchor.homeY)
        ? Math.round(savedAnchor.homeY)
        : Math.round(pt.y);
    return {
      ...npc,
      orbitAngle: effectiveAngle,
      laneRadiusX: effectiveRx,
      laneRadiusY: effectiveRy,
      homeX,
      homeY,
      x: homeX,
      y: homeY,
      headingRad: pt.tangentRad,
      laneOffset: 0,
      jumpZ: 0,
      jumpVz: 0,
      skateBootColor: idx % 2 === 0 ? 'white' : 'black',
    };
  });
}

export const RollerArenaEngine: React.FC<RollerArenaEngineProps> = ({
  playerName,
  playerShirtColor = '#1e1b4b',
  isAnonymousGuest,
  showNames,
  characterMode,
  difficulty,
  hasOwnSkates,
  hasRentedSkates,
  drinkChipAvailable,
  npcVoicesEnabled,
  skateGuardWhistleEnabled,
  fullHallPutzlichtEnabled = false,
  pixel16BitFiguresEnabled = false,
  monitorPreviewStyle = null,
  cinemaCountdownEnabled = false,
  cinemaCountdownTitle = 'NÄCHSTER PALLADIUM LIVE-STREAM',
  cinemaCountdownTargetIso = '',
  cinemaWeekdays = ['Mi', 'Sa'],
  cinemaStartTime = '20:00',
  crewNames = DEFAULT_CREW_NAMES,
  externalDjJingleBubble = null,
  concertLightingMode,
  arenaStyle,
  activeDjName,
  isMuted,
  cameraMode,
  lightingMode,
  centerStageMode,
  activeBandName,
  bandSkinTone,
  bandGender,
  hallGameMode,
  djTickerText,
  specialSkaters,
  ghostSkatersEnabled,
  kengolHatEnabled,
  upgrades,
  fogMachineEnabled,
  fogBurstCount,
  isCurtainOpen,
  isMultiplayerActive = false,
  remotePlayers = [],
  externalTrickTrigger = null,
  remoteControllerInputRef,
  onLocalPlayerState,
  onToggleCamera,
  onToggleCharacterMode,
  onToggleShowNames,
  onToggleUnderglow,
  onToggleKengolHat,
  onOpenProShopModal,
  onOpenChronicleModal,
  onEnterHallFromGamepad,
  onToggleTwitchStream,
  onRedeemDrinkChipAtRental,
  onRedeemDrinkChipAtBistro,
  onChallengeProgress,
  onTelemetry,
  buildModeEnabled = false,
  customLayout,
  selectedBuildItemId = null,
  onSelectBuildItem,
  onUpdateCustomLayout,
  showAiNames = false,
  showOwnName = true,
  showSpeechBubbles = true,
  vipDiscoSkatesEquipped = false,
  lockerDrinkBoostTrigger = 0,
  onOpenLockerModal,
  onIntroStepComplete,
  skateDirection = 'ccw',
  springerStaffelShowActive = false,
  teleportTrigger = null,
  onClickDjConsole,
  neonLightboxesEnabled = true,
  neonLightboxLine1 = 'RESIDENT DJ',
  neonLightboxLine2 = 'DJ MAGIC FORCE',
  neonLightboxLine3 = 'AB 20:00 UHR',
  onCertificateEvent,
  onAwardObstaclePoints,
  onRequestAdminPinModal,
  mobilitySelected = true,
  avatarRole = 'standard',
  sundayCliqueActive = false,
  onOpenStationDialog,
  customCrewMembers = [],
  newspaperEnabled = true,
  newspaperHasNewBadge = false,
  onOpenNewspaperModal,
  monitorCameraMode = 'local',
  manualSlowCruiseActive = false,
  onSlalomRoundComplete,
  onOpenLeaderboardModal,
  isPlayingArcade = false,
  onOpenArcadeMachine,
  ballspielResetSeq = 0,
  onBallspielRoundFinished,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogEnabledRef = useRef<boolean>(fogMachineEnabled);
  const arenaStyleRef = useRef<ArenaVisualStyle>(arenaStyle || 'classic-neon');
  const centerArenaRef = useRef<CenterStageMode>(centerStageMode || 'islands');
  const fogBurstTimerRef = useRef<number>(0);
  const pendingTrickRef = useRef<TrickMoveId | null>(null);
  const lastTrickSeqRef = useRef<number>(0);
  const pendingDjBubbleRef = useRef<string | null>(null);
  const lastDjBubbleSeqRef = useRef<number>(0);
  const pendingLockerDrinkBoostRef = useRef<boolean>(false);
  const lastLockerDrinkBoostSeqRef = useRef<number>(lockerDrinkBoostTrigger);
  const pendingTeleportRef = useRef<{
    x: number;
    y: number;
    headingRad?: number;
    label?: string;
  } | null>(null);
  const lastTeleportSeqRef = useRef<number>(teleportTrigger?.seq || 0);
  const pendingBallspielResetRef = useRef<boolean>(false);
  const lastBallspielResetSeqRef = useRef<number>(ballspielResetSeq);

  const triggerFogBurst = () => {
    fogBurstTimerRef.current = 9.5;
  };

  useEffect(() => {
    fogEnabledRef.current = fogMachineEnabled;
  }, [fogMachineEnabled]);

  useEffect(() => {
    arenaStyleRef.current = arenaStyle || 'classic-neon';
  }, [arenaStyle]);

  useEffect(() => {
    centerArenaRef.current = centerStageMode || 'islands';
  }, [centerStageMode]);

  useEffect(() => {
    if (
      externalTrickTrigger &&
      externalTrickTrigger.seq !== lastTrickSeqRef.current
    ) {
      lastTrickSeqRef.current = externalTrickTrigger.seq;
      pendingTrickRef.current = externalTrickTrigger.move;
    }
  }, [externalTrickTrigger]);

  useEffect(() => {
    if (
      externalDjJingleBubble &&
      externalDjJingleBubble.seq !== lastDjBubbleSeqRef.current
    ) {
      lastDjBubbleSeqRef.current = externalDjJingleBubble.seq;
      pendingDjBubbleRef.current = externalDjJingleBubble.text;
    }
  }, [externalDjJingleBubble]);

  useEffect(() => {
    if (fogBurstCount > 0) {
      triggerFogBurst();
    }
  }, [fogBurstCount]);

  const propsRef = useRef({
    playerName,
    playerShirtColor,
    isAnonymousGuest,
    showNames,
    characterMode,
    difficulty,
    hasOwnSkates,
    hasRentedSkates,
    drinkChipAvailable,
    npcVoicesEnabled,
    skateGuardWhistleEnabled,
    fullHallPutzlichtEnabled,
    pixel16BitFiguresEnabled,
    monitorPreviewStyle,
    cinemaCountdownEnabled,
    cinemaCountdownTitle,
    cinemaCountdownTargetIso,
    cinemaWeekdays,
    cinemaStartTime,
    crewNames,
    concertLightingMode,
    arenaStyle,
    activeDjName,
    isMuted,
    cameraMode,
    lightingMode,
    centerStageMode,
    activeBandName,
    bandSkinTone,
    bandGender,
    hallGameMode,
    djTickerText,
    specialSkaters,
    ghostSkatersEnabled,
    kengolHatEnabled,
    upgrades,
    fogMachineEnabled,
    fogBurstCount,
    isCurtainOpen,
    isMultiplayerActive,
    remotePlayers,
    remoteControllerInputRef,
    onLocalPlayerState,
    onToggleCamera,
    onToggleCharacterMode,
    onToggleShowNames,
    onToggleUnderglow,
    onToggleKengolHat,
    onOpenProShopModal,
    onOpenChronicleModal,
    onEnterHallFromGamepad,
    onToggleTwitchStream,
    onRedeemDrinkChipAtRental,
    onRedeemDrinkChipAtBistro,
    onChallengeProgress,
    onTelemetry,
    buildModeEnabled,
    customLayout,
    selectedBuildItemId,
    onSelectBuildItem,
    onUpdateCustomLayout,
    showAiNames,
    showOwnName,
    showSpeechBubbles,
    vipDiscoSkatesEquipped,
    lockerDrinkBoostTrigger,
    onOpenLockerModal,
    onIntroStepComplete,
    skateDirection,
    springerStaffelShowActive,
    teleportTrigger,
    onClickDjConsole,
    neonLightboxesEnabled,
    neonLightboxLine1,
    neonLightboxLine2,
    neonLightboxLine3,
    onCertificateEvent,
    onAwardObstaclePoints,
    onRequestAdminPinModal,
    mobilitySelected,
    avatarRole,
    sundayCliqueActive,
    onOpenStationDialog,
    customCrewMembers,
    newspaperEnabled,
    newspaperHasNewBadge,
    onOpenNewspaperModal,
    monitorCameraMode,
    manualSlowCruiseActive,
    onSlalomRoundComplete,
    onOpenLeaderboardModal,
    isPlayingArcade,
    onOpenArcadeMachine,
    ballspielResetSeq,
    onBallspielRoundFinished,
  });

  useEffect(() => {
    if (customLayout) {
      applyCustomArenaLayout(customLayout);
    }
    propsRef.current = {
      playerName,
      playerShirtColor,
      isAnonymousGuest,
      showNames,
      characterMode,
      difficulty,
      hasOwnSkates,
      hasRentedSkates,
      drinkChipAvailable,
      npcVoicesEnabled,
      skateGuardWhistleEnabled,
      fullHallPutzlichtEnabled,
      pixel16BitFiguresEnabled,
      monitorPreviewStyle,
      cinemaCountdownEnabled,
      cinemaCountdownTitle,
      cinemaCountdownTargetIso,
      cinemaWeekdays,
      cinemaStartTime,
      crewNames,
      concertLightingMode,
      arenaStyle,
      activeDjName,
      isMuted,
      cameraMode,
      lightingMode,
      centerStageMode,
      activeBandName,
      bandSkinTone,
      bandGender,
      hallGameMode,
      djTickerText,
      specialSkaters,
      ghostSkatersEnabled,
      kengolHatEnabled,
      upgrades,
      fogMachineEnabled,
      fogBurstCount,
      isCurtainOpen,
      isMultiplayerActive,
      remotePlayers,
      remoteControllerInputRef,
      onLocalPlayerState,
      onToggleCamera,
      onToggleCharacterMode,
      onToggleShowNames,
      onToggleUnderglow,
      onToggleKengolHat,
      onOpenProShopModal,
      onOpenChronicleModal,
      onEnterHallFromGamepad,
      onToggleTwitchStream,
      onRedeemDrinkChipAtRental,
      onRedeemDrinkChipAtBistro,
      onChallengeProgress,
      onTelemetry,
      buildModeEnabled,
      customLayout,
      selectedBuildItemId,
      onSelectBuildItem,
      onUpdateCustomLayout,
      showAiNames,
      showOwnName,
      showSpeechBubbles,
      vipDiscoSkatesEquipped,
      lockerDrinkBoostTrigger,
      onOpenLockerModal,
      onIntroStepComplete,
      skateDirection,
      springerStaffelShowActive,
      teleportTrigger,
      onClickDjConsole,
      neonLightboxesEnabled,
      neonLightboxLine1,
      neonLightboxLine2,
      neonLightboxLine3,
      onCertificateEvent,
      onAwardObstaclePoints,
      onRequestAdminPinModal,
      mobilitySelected,
      avatarRole,
      sundayCliqueActive,
      onOpenStationDialog,
      customCrewMembers,
      newspaperEnabled,
      newspaperHasNewBadge,
      onOpenNewspaperModal,
      monitorCameraMode,
      manualSlowCruiseActive,
      onSlalomRoundComplete,
      onOpenLeaderboardModal,
      isPlayingArcade,
      onOpenArcadeMachine,
      ballspielResetSeq,
      onBallspielRoundFinished,
    };
  }, [
    playerName,
    playerShirtColor,
    isAnonymousGuest,
    showNames,
    characterMode,
    difficulty,
    hasOwnSkates,
    hasRentedSkates,
    drinkChipAvailable,
    npcVoicesEnabled,
    skateGuardWhistleEnabled,
    fullHallPutzlichtEnabled,
    pixel16BitFiguresEnabled,
    monitorPreviewStyle,
    cinemaCountdownEnabled,
    cinemaCountdownTitle,
    cinemaCountdownTargetIso,
    cinemaWeekdays,
    cinemaStartTime,
    crewNames,
    concertLightingMode,
    arenaStyle,
    activeDjName,
    isMuted,
    cameraMode,
    lightingMode,
    centerStageMode,
    activeBandName,
    bandSkinTone,
    bandGender,
    hallGameMode,
    djTickerText,
    specialSkaters,
    ghostSkatersEnabled,
    kengolHatEnabled,
    upgrades,
    fogMachineEnabled,
    fogBurstCount,
    isCurtainOpen,
    isMultiplayerActive,
    remotePlayers,
    remoteControllerInputRef,
    onLocalPlayerState,
    onToggleCamera,
    onToggleCharacterMode,
    onToggleShowNames,
    onToggleUnderglow,
    onToggleKengolHat,
    onOpenProShopModal,
    onOpenChronicleModal,
    onEnterHallFromGamepad,
    onToggleTwitchStream,
    onRedeemDrinkChipAtRental,
    onRedeemDrinkChipAtBistro,
    onChallengeProgress,
    onTelemetry,
    buildModeEnabled,
    customLayout,
    selectedBuildItemId,
    onSelectBuildItem,
    onUpdateCustomLayout,
    showAiNames,
    showOwnName,
    showSpeechBubbles,
    vipDiscoSkatesEquipped,
    lockerDrinkBoostTrigger,
    onOpenLockerModal,
    onIntroStepComplete,
    skateDirection,
    springerStaffelShowActive,
    teleportTrigger,
    onClickDjConsole,
    neonLightboxesEnabled,
    neonLightboxLine1,
    neonLightboxLine2,
    neonLightboxLine3,
    onCertificateEvent,
    onAwardObstaclePoints,
    onRequestAdminPinModal,
    mobilitySelected,
    avatarRole,
    sundayCliqueActive,
    onOpenStationDialog,
    customCrewMembers,
    newspaperEnabled,
    newspaperHasNewBadge,
    onOpenNewspaperModal,
    monitorCameraMode,
    manualSlowCruiseActive,
    onSlalomRoundComplete,
    onOpenLeaderboardModal,
    isPlayingArcade,
    onOpenArcadeMachine,
    ballspielResetSeq,
    onBallspielRoundFinished,
  ]);

  useEffect(() => {
    if (lockerDrinkBoostTrigger > lastLockerDrinkBoostSeqRef.current) {
      lastLockerDrinkBoostSeqRef.current = lockerDrinkBoostTrigger;
      pendingLockerDrinkBoostRef.current = true;
    }
  }, [lockerDrinkBoostTrigger]);

  useEffect(() => {
    if (
      teleportTrigger &&
      teleportTrigger.seq !== lastTeleportSeqRef.current
    ) {
      lastTeleportSeqRef.current = teleportTrigger.seq;
      pendingTeleportRef.current = teleportTrigger;
    }
  }, [teleportTrigger]);

  useEffect(() => {
    if (ballspielResetSeq !== lastBallspielResetSeqRef.current) {
      lastBallspielResetSeqRef.current = ballspielResetSeq;
      pendingBallspielResetRef.current = true;
    }
  }, [ballspielResetSeq]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ========================================================================
    // 0. HiDPI / RETINA RESOLUTION & PIXEL-CRISPNESS SCALING
    // ========================================================================
    let currentDpr = 1;
    const applyCanvasHiDpiScale = () => {
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      currentDpr = dpr;
      const targetW = Math.round(WORLD_WIDTH * dpr);
      const targetH = Math.round(WORLD_HEIGHT * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.imageSmoothingEnabled = false;
    };
    applyCanvasHiDpiScale();
    window.addEventListener('resize', applyCanvasHiDpiScale);
    document.addEventListener('fullscreenchange', applyCanvasHiDpiScale);

    // ========================================================================
    // 1. PLAYER & WORLD RUNTIME STATE (SPAWN SCALED BY EXPERIENCE LEVEL & SKATES)
    // ========================================================================
    const initP = propsRef.current;
    const initialHasSkates =
      initP.hasOwnSkates ||
      initP.hasRentedSkates ||
      initP.characterMode === 'wheelchair';
    const initialStart = getPlayerStartCoords(
      initP.difficulty,
      initialHasSkates
    );

    const player = {
      x: initialStart.x,
      y: initialStart.y,
      vx: 0,
      vy: 0,
      headingRad: initialStart.headingRad,
      radius: 12,
      spinAngleOffset: 0,
      isSpinning: false,
      jumpZ: 0,
      jumpVz: 0,
      isJumping: false,
      jumpCooldownTimer: 0,
      stridePhase: 0,
      crashTimer: 0,
      consecutiveCrashes: 0,
      bumpCountSinceGudrun: 0,
      bumpCooldownTimer: 0,
      medicRescueTimer: 0,
      afkSecondsOnTrack: 0,
      guardEscortActive: false,
      slushRemainingSec: 0,
      blobaColaRemainingSec: 0,
      freeSlushCount: initP.drinkChipAvailable ? 1 : 0,
      freeBlobaCount: initP.drinkChipAvailable ? 1 : 0,
      hasShownWelcomeGift: false,
      slipstreamAccumSec: 0,
      isSlipstreamActive: false,
      isOnWaxPatch: false,
      speechBubble:
        'Willkommen im Palladium Hanau! Viel Spaß auf der Bahn!' as
          | string
          | null,
      speechTimer: 4.5,
      laps: 0,
      cleanLapsStreak: 0,
      passedTopHalf: false,
      totalCrashes: 0,
      warmupSpinsCount: 0,
      ballspielHits: 0,
      slalomCombo: 0,
      activeTrickMove: null as TrickMoveId | null,
      trickTimer: 0,
    };

    // Browser speechSynthesis robot voice is strictly disabled; visual bubbles + real DJ Jingles/Voice Memos only!
    const speakNpcBubble = (
      _rawText: string,
      _speakerName: string,
      _gender: 'female' | 'male'
    ) => {
      // No-op: strictly no window.speechSynthesis robot voice
    };

    // DJ Magic Force Neon Speech Bubble & "Put your hands up!" Crowd Cheer State
    let djSpeechBubble: string | null =
      '🎤 "Willkommen im Palladium Hanau! Let\'s roll!"';
    let djSpeechTimer = 6.5;
    let djNextAutoSpeechTimer = 22.0;
    let djHandsUpCheerTimer = 0;
    let ambientChatterTimer = 7.5;
    let jrEasterEggTimer = 0;
    let centerLogoClickCount = 0;
    let lastCenterLogoClickTime = 0;
    let prevLightingMode: LightingMode = propsRef.current.lightingMode;
    let prevHallGameMode: HallGameMode = propsRef.current.hallGameMode;
    let prevDifficulty: SingleplayerDifficulty = propsRef.current.difficulty;
    let prevHasOwnSkates: boolean = propsRef.current.hasOwnSkates;
    let prevIsCurtainOpen: boolean = propsRef.current.isCurtainOpen;

    // 80s Stage Fog Machine & Manual Burst Timer State
    let lastFogBurstCount = propsRef.current.fogBurstCount;
    let fogBurstTimer = 0;

    // Nurse / Paramedic ("Schwester Gudrun") + Stretcher Team Rescue Sequence State
    // Enters and exits exclusively through one of the two offset Schleusen-Banden!

    const saniNurse = {
      active: false,
      withStretcherTeam: false,
      phase: 'idle' as 'idle' | 'running-in' | 'kneeling' | 'walking-out',
      x: 1410,
      y: 912,
      startX: 1410,
      startY: 912,
      gateX: 1410,
      gateY: 842,
      targetX: 1400,
      targetY: 700,
      headingRad: -Math.PI / 2,
      phaseTimer: 0,
      phaseDuration: 3.0,
      speechText: null as string | null,
    };

    const triggerSaniNurseDispatch = (
      crashX: number,
      crashY: number,
      withStretcherTeam = false
    ) => {
      if (saniNurse.active) return;
      const nurseLabel =
        propsRef.current.crewNames?.nurse || 'Schwester Gudrun';
      // Pick the nearest of the two offset Schleusen-Banden (Schleuse 1 left x=540, Schleuse 2 right x=1410)
      const useLeftSchleuse = Math.abs(crashX - 540) < Math.abs(crashX - 1410);
      const gateCenterX = useLeftSchleuse ? 540 : 1410;
      const spawnX = useLeftSchleuse ? 495 : 1362;
      const spawnY = 918;
      saniNurse.active = true;
      saniNurse.withStretcherTeam = withStretcherTeam;
      saniNurse.phase = 'running-in';
      saniNurse.startX = spawnX;
      saniNurse.startY = spawnY;
      saniNurse.gateX = gateCenterX;
      saniNurse.gateY = 842;
      saniNurse.x = spawnX;
      saniNurse.y = spawnY;
      saniNurse.targetX = Math.max(330, Math.min(1670, crashX + 26));
      saniNurse.targetY = Math.max(145, Math.min(825, crashY + 10));
      saniNurse.phaseTimer = 0;
      saniNurse.phaseDuration = 3.0;
      saniNurse.headingRad = -Math.PI / 2;
      saniNurse.speechText = withStretcherTeam
        ? `🚑 ${nurseLabel} + 2 Sanitäter mit Trage & Skate-Guard rücken an!`
        : `🚑 ${nurseLabel} eilt durch die Schleuse herbei!`;
      speakNpcBubble(saniNurse.speechText, nurseLabel, 'female');
    };

    // Unannounced Floor Wax Slip Zone (Bohnerwachs-Rutschzone)
    const waxPatch = {
      x: 1230,
      y: 700,
      radiusX: 98,
      radiusY: 58,
      relocateTimer: 26,
    };

    // Center Stage smooth animation progress (0 = Left `[` & Right `]` U-islands, 1 = closed center stage)
    let stageCloseProgress = 0;

    // Particles, Trails, Projectiles & Floating +10 Score Popups
    const sparks: SparkParticle[] = [];
    const trails: WheelTrailPoint[] = [];
    const softballs: NeonSoftball[] = [];
    const floatingScores: {
      x: number;
      y: number;
      startY: number;
      text: string;
      age: number;
      duration: number;
    }[] = [];
    let prevLeftWheel: { x: number; y: number } | null = null;
    let prevRightWheel: { x: number; y: number } | null = null;

    // Slalom Cones (Top & Bottom Straights of the rink centered at x = 1000)
    const slalomCones: SlalomCone[] = [
      { id: 1, x: 630, y: 715, side: 'left', wobbleTimer: 0, passed: false },
      { id: 2, x: 790, y: 755, side: 'right', wobbleTimer: 0, passed: false },
      { id: 3, x: 950, y: 715, side: 'left', wobbleTimer: 0, passed: false },
      { id: 4, x: 1110, y: 755, side: 'right', wobbleTimer: 0, passed: false },
      { id: 5, x: 1270, y: 715, side: 'left', wobbleTimer: 0, passed: false },
      { id: 6, x: 1270, y: 245, side: 'right', wobbleTimer: 0, passed: false },
      { id: 7, x: 1110, y: 205, side: 'left', wobbleTimer: 0, passed: false },
      { id: 8, x: 950, y: 245, side: 'right', wobbleTimer: 0, passed: false },
      { id: 9, x: 790, y: 205, side: 'left', wobbleTimer: 0, passed: false },
      { id: 10, x: 630, y: 245, side: 'right', wobbleTimer: 0, passed: false },
    ];

    // True Slalom Zigzag (Left/Right Alternation), Progression & Ballspiel Anti-Farming State
    let lastScoredPylonId: number | null = null;
    let lastPassSide: 'left' | 'right' | null = null;
    let prevSlalomCheckX = player.x;
    let slalomRoundsCompleted = 0;
    let slalomGatesInCurrentRound = 0;
    let lastScoredBallId: string | null = null;
    let lastBallScoreTimeMs = 0;
    let lastBallScorePlayerX = 0;
    let lastBallScorePlayerY = 0;
    let ballDistanceSkatedSinceLastScore = 999;
    let ballThrowSeqCounter = 1;

    // Folding Chairs Round-Course (Rundum-Parcours around the entire flat parquet rink)
    const jumpChairs: JumpObstacleChair[] = [
      {
        id: 1,
        x: 620,
        y: 730,
        chairCount: 1,
        width: 34,
        height: 46,
        angleRad: 0,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 2,
        x: 955,
        y: 735,
        chairCount: 2,
        width: 64,
        height: 48,
        angleRad: 0,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 3,
        x: 1265,
        y: 725,
        chairCount: 3,
        width: 96,
        height: 52,
        angleRad: 0,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 4,
        x: 1555,
        y: 484,
        chairCount: 2,
        width: 64,
        height: 48,
        angleRad: -Math.PI / 2,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 5,
        x: 1280,
        y: 235,
        chairCount: 2,
        width: 64,
        height: 48,
        angleRad: Math.PI,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 6,
        x: 965,
        y: 230,
        chairCount: 3,
        width: 96,
        height: 52,
        angleRad: Math.PI,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 7,
        x: 635,
        y: 235,
        chairCount: 1,
        width: 34,
        height: 46,
        angleRad: Math.PI,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
      {
        id: 8,
        x: 435,
        y: 484,
        chairCount: 2,
        width: 64,
        height: 48,
        angleRad: Math.PI / 2,
        knockedOverTimer: 0,
        clearedByPlayer: false,
        clearedInLap: false,
      },
    ];

    // Barrier spectator spots for AI skaters when Stuhlsprung is active
    const barrierSpectatorSpots = [
      { x: 430, y: 882 },
      { x: 580, y: 882 },
      { x: 730, y: 882 },
      { x: 880, y: 882 },
      { x: 1030, y: 882 },
      { x: 1180, y: 882 },
      { x: 1732, y: 230 },
      { x: 1732, y: 390 },
      { x: 1732, y: 550 },
      { x: 1732, y: 710 },
    ];

    // ========================================================================
    // 2. INITIALIZE TRACK NPCS SCALED BY SINGLEPLAYER DIFFICULTY & CUSTOM ANCHORS
    // ========================================================================
    if (initP.customLayout) {
      applyCustomArenaLayout(initP.customLayout);
    }
    const trackNpcs: TrackNpc[] = buildTrackNpcsForDifficulty(
      initP.difficulty,
      initP.customLayout?.npcAnchors
    );
    let lastSyncedLayoutJson = JSON.stringify(initP.customLayout || null);

    // Random Barrier-Sitting Event State (Skate Guard whistle enforcement: "📣 TRILLER! Nicht auf der Bande sitzen!")
    let barrierSitTimer = 9.5;
    let activeBarrierSitterId: string | null = null;
    const barrierSitSpots = [
      { x: 290, y: 465, normalRad: 0 }, // Sitting from outside on the left blue barrier
      { x: 1710, y: 395, normalRad: Math.PI }, // Sitting from outside on the right blue barrier
      { x: 1015, y: 860, normalRad: -Math.PI / 2 }, // Sitting on the bottom blue barrier
    ];

    // ========================================================================
    // 3. GLOBAL KEYBOARD & MOUSE LISTENERS (INSTANT RESPONSE)
    // ========================================================================
    const keysDown: Record<string, boolean> = {};
    let mouseWorldX = ARENA_LAYOUT.rink.centerX;
    let mouseWorldY = ARENA_LAYOUT.rink.centerY;
    let hasMouseMovedOnCanvas = false;

    // Singleplayer Slow-Skate Flirt State
    let slowFlirtAttemptCount = 0;
    let springerstaffelClearedIds = new Set<number>();
    let skateBellRingTimer = 0;
    let slowFlirtCooldown = 0;
    let slowFlirtPartnerId: string | null = null;
    let slowFlirtImpressedByTrick = false;
    const slowFlirtRejectedIds = new Set<string>();

    const triggerJrEasterEgg = () => {
      jrEasterEggTimer = 6.0;
      soundFX.playChallengeUnlocked();
      for (let i = 0; i < 32; i++) {
        const ang = (Math.PI * 2 * i) / 32;
        sparks.push({
          x: ARENA_LAYOUT.rink.centerX,
          y: ARENA_LAYOUT.rink.centerY,
          vx: Math.cos(ang) * (110 + Math.random() * 140),
          vy: Math.sin(ang) * (110 + Math.random() * 140),
          color: ['#fde047', '#00f0ff', '#ff2a85', '#39ff14'][i % 4],
          alpha: 1,
          size: 4.5 + Math.random() * 3,
        });
      }
    };

    const triggerPlayer360Spin = () => {
      const p = propsRef.current;
      const hasSkatesEquipped =
        p.hasOwnSkates || p.hasRentedSkates || p.characterMode === 'wheelchair';
      if (!hasSkatesEquipped) {
        player.speechBubble =
          '👟 Erst am Rollschuh-Verleih Skates holen! [E] am Schalter!';
        player.speechTimer = 2.8;
        return;
      }
      if (player.isSpinning || player.crashTimer > 0) return;
      player.isSpinning = true;
      player.spinAngleOffset = 0;
      soundFX.playSpin360();
      if (p.lightingMode === 'slow-skating') {
        slowFlirtImpressedByTrick = true;
      }

      // Check if in front of the vertical Left Mirror Wall (#5 Challenge "Spiegel-Tänzer")
      const { mirrorWall } = ARENA_LAYOUT;
      if (
        player.x >= mirrorWall.x &&
        player.x <= mirrorWall.danceFloorX + 145 &&
        player.y >= mirrorWall.y - 25 &&
        player.y <= mirrorWall.y + mirrorWall.height + 25
      ) {
        propsRef.current.onChallengeProgress('mirror_spin', 1);
        player.warmupSpinsCount += 1;
        propsRef.current.onChallengeProgress('warmup_spins', 1);
      }
    };

    const triggerPlayerJump = (): boolean => {
      // Strictly lock jump to ground contact (jumpZ === 0 && !isJumping) + 0.25s post-landing cooldown
      if (
        player.isJumping ||
        player.jumpZ > 0 ||
        player.jumpCooldownTimer > 0 ||
        player.crashTimer > 0
      ) {
        return false;
      }
      player.isJumping = true;
      player.jumpZ = 0;
      const hasHighTopUpgrade = propsRef.current.upgrades.aluPlatesHighTop;
      const hasBlobaKick = player.blobaColaRemainingSec > 0;
      // Shortened jump duration & height impulse (~38% shorter airtime & forward impulse)
      player.jumpVz =
        (hasHighTopUpgrade ? 245 : 205) * (hasBlobaKick ? 1.1 : 1.0);
      player.vx *= 0.8;
      player.vy *= 0.8;
      soundFX.playJump();
      if (propsRef.current.lightingMode === 'slow-skating') {
        slowFlirtImpressedByTrick = true;
      }
      return true;
    };

    const triggerTrickMove = (move: TrickMoveId) => {
      const p = propsRef.current;
      const hasSkatesEquipped =
        p.hasOwnSkates || p.hasRentedSkates || p.characterMode === 'wheelchair';
      if (!hasSkatesEquipped) {
        player.speechBubble =
          '👟 Erst am Rollschuh-Verleih Skates holen! [E] am Schalter!';
        player.speechTimer = 2.8;
        return;
      }
      if (player.crashTimer > 0) return;

      const unlocked = p.upgrades.unlockedMoves || {
        spin360: false,
        backward: false,
        flamingo: false,
        starjump: false,
      };

      if (move === 'spin360') {
        if (!unlocked.spin360) {
          player.speechBubble =
            '🔒 [1] 360° Spin: Im Pro-Shop über „Dauerläufer“ freischalten!';
          player.speechTimer = 2.6;
          return;
        }
        player.activeTrickMove = 'spin360';
        player.trickTimer = 0.65;
        triggerPlayer360Spin();
        player.speechBubble = '🌀 360° PIROUETTE!';
        player.speechTimer = 1.8;
        for (let i = 0; i < 18; i++) {
          const ang = (Math.PI * 2 * i) / 18;
          sparks.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(ang) * (85 + Math.random() * 90),
            vy: Math.sin(ang) * (85 + Math.random() * 90),
            color: ['#00f0ff', '#ff2a85', '#39ff14', '#fde047'][i % 4],
            alpha: 1,
            size: 3.8 + Math.random() * 2.5,
          });
        }
      } else if (move === 'backward') {
        if (!unlocked.backward) {
          player.speechBubble =
            '🔒 [2] Backward Glide: Über „Slush- & Bloba-Pause“ freischalten!';
          player.speechTimer = 2.6;
          return;
        }
        player.activeTrickMove = 'backward';
        player.trickTimer = 3.0;
        soundFX.playSpin360();
        player.speechBubble = '🔙 BACKWARD GLIDE (3s Rückwärts-Rollen)!';
        player.speechTimer = 2.4;
      } else if (move === 'flamingo') {
        if (!unlocked.flamingo) {
          player.speechBubble =
            '🔒 [3] Flamingo-Slide: Über „Windschatten-Surfer“ freischalten!';
          player.speechTimer = 2.6;
          return;
        }
        player.activeTrickMove = 'flamingo';
        player.trickTimer = 2.4;
        soundFX.playSpin360();
        player.speechBubble = '🦩 FLAMINGO EINBEIN-SLIDE!';
        player.speechTimer = 2.2;
      } else if (move === 'starjump') {
        if (!unlocked.starjump) {
          player.speechBubble =
            '🔒 [4] Palladium Star-Jump: Über „Stuhl-Springer“ freischalten!';
          player.speechTimer = 2.6;
          return;
        }
        // Strictly lock Star-Jump to ground contact (isGrounded && 0.25s cooldown)
        if (!triggerPlayerJump()) {
          return;
        }
        player.activeTrickMove = 'starjump';
        player.trickTimer = 0.85;
        player.isSpinning = true;
        player.spinAngleOffset = 0;
        player.jumpVz = Math.min(265, Math.max(player.jumpVz, 250));
        player.speechBubble = '⚡ PALLADIUM STAR-JUMP!';
        player.speechTimer = 2.0;
        for (let i = 0; i < 22; i++) {
          const ang = (Math.PI * 2 * i) / 22;
          sparks.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(ang) * (105 + Math.random() * 110),
            vy: Math.sin(ang) * (105 + Math.random() * 110),
            color: i % 2 === 0 ? '#fde047' : '#39ff14',
            alpha: 1,
            size: 4.5 + Math.random() * 2.5,
          });
        }
      }
    };

    const triggerInteractOrThrowBall = () => {
      const p = propsRef.current;

      // 0a. Check 80er-Spindreihe (SPINDE / Lockers) proximity -> opens compact Spind menu & completes Intro step 1!
      const lk = ARENA_LAYOUT.lockers;
      if (lk) {
        const effLk = getModuleCollisionRect(lk);
        const lkCx = effLk.x + effLk.width / 2;
        const lkCy = effLk.y + effLk.height / 2;
        const distLockers = Math.hypot(player.x - lkCx, player.y - lkCy);
        if (distLockers <= Math.max(effLk.width, effLk.height) / 2 + 58) {
          p.onIntroStepComplete?.('open_locker');
          p.onOpenLockerModal?.();
          player.speechBubble = '🗄️ Spind geöffnet! Inventar & Anzeige bereit.';
          player.speechTimer = 2.4;
          return;
        }
      }

      // 0b. Check 1. Kasse & Einlass proximity (Station 1)
      const cb = ARENA_LAYOUT.bottomEntrance.cashierBooth;
      const distCashier = Math.hypot(
        player.x - cb.centerX,
        player.y - cb.centerY
      );
      if (distCashier <= 125) {
        p.onOpenStationDialog?.('kasse');
        player.speechBubble = `🎟️ 1. Kasse (${p.crewNames?.cashier || 'Kassen-Karin'}): Tickets & Stempelkarte!`;
        player.speechTimer = 2.8;
        return;
      }

      // 0. Check Rollschuh-Verleih Counter proximity (Single Source of Truth from ARENA_LAYOUT.proShopAndRental!)
      const rentalCenterX = ARENA_LAYOUT.proShopAndRental.rentalInteractX;
      const rentalInteractY = ARENA_LAYOUT.proShopAndRental.rentalInteractY;
      const distRental = Math.hypot(
        player.x - rentalCenterX,
        player.y - rentalInteractY
      );
      if (distRental <= ARENA_LAYOUT.proShopAndRental.rentalInteractRadius) {
        p.onOpenStationDialog?.('verleih');
        if (!p.hasOwnSkates && !p.hasRentedSkates) {
          p.onRedeemDrinkChipAtRental();
          player.freeSlushCount = 0;
          player.freeBlobaCount = 0;
          player.speechBubble =
            '🛼 80er Leih-Rollschuhe vom Verleih geschnürt! Ab durch die Schleuse aufs Parkett!';
          player.speechTimer = 4.2;
          soundFX.playChallengeUnlocked();
          speakNpcBubble(
            'Hier sind deine 80er Leih-Rollschuhe! Viel Spaß auf der Bahn!',
            'VERLEIH-BIGGI',
            'female'
          );
          return;
        } else if (p.hasOwnSkates) {
          player.speechBubble =
            '🛼 Du trägst bereits deine eigenen Profi-Rollschuhe!';
          player.speechTimer = 2.6;
          return;
        } else {
          player.speechBubble =
            '🛼 Deine 80er-Leih-Rollschuhe sitzen schon perfekt!';
          player.speechTimer = 2.6;
          return;
        }
      }

      // 1. Check Bistro Counter proximity (Slush-Puppie & Bloba Cola at bottom-left Bistro)
      const distBistro = Math.hypot(
        player.x - ARENA_LAYOUT.bistro.interactX,
        player.y - ARENA_LAYOUT.bistro.interactY
      );
      if (distBistro <= ARENA_LAYOUT.bistro.interactRadius) {
        p.onOpenStationDialog?.('snackbar');
        p.onIntroStepComplete?.('fetch_drink');
        if (!p.hasOwnSkates && !p.hasRentedSkates) {
          player.speechBubble =
            '🥤 Erfrischung an der Gastro geholt! (Leih-Skates gibt es am ROLLSCHUHVERLEIH [E])';
          player.speechTimer = 3.5;
          soundFX.playDrinkRefresh();
          return;
        }
        player.slushRemainingSec = 75;
        player.blobaColaRemainingSec = 45;
        if (
          p.drinkChipAvailable &&
          (player.freeSlushCount > 0 || player.freeBlobaCount > 0)
        ) {
          player.freeSlushCount = 0;
          player.freeBlobaCount = 0;
          p.onRedeemDrinkChipAtBistro();
          player.speechBubble =
            '🎁 Freigetränk-Chip eingelöst: Slush Puppy & Bloba Cola gratis!';
        } else {
          player.speechBubble =
            '🥤 Slush-Puppie & Bloba Cola! Mega Frische-Kick!';
        }
        player.speechTimer = 3.2;
        soundFX.playDrinkRefresh();
        p.onChallengeProgress('bistro_drink', 1);
        return;
      }

      // 2. Check Pro-Shop proximity (Station 3: 80s Pixel-Arcade-Dialog & Pro-Shop)
      const distShop = Math.hypot(
        player.x - ARENA_LAYOUT.proShopAndRental.proShopInteractX,
        player.y - ARENA_LAYOUT.proShopAndRental.proShopInteractY
      );
      if (distShop <= ARENA_LAYOUT.proShopAndRental.proShopInteractRadius) {
        if (p.onOpenStationDialog) {
          p.onOpenStationDialog('proshop');
          return;
        }
        p.onOpenProShopModal();
        return;
      }

      // 2b. Check DJ-Tower proximity for Station 5 DJ-Kanzel Dialog & live DJ shoutout!
      const distDj = Math.hypot(
        player.x - ARENA_LAYOUT.djTower.centerX,
        player.y - ARENA_LAYOUT.djTower.centerY
      );
      const distDjEgo = Math.hypot(
        player.x - ARENA_LAYOUT.djTower.egoTriggerX,
        player.y - ARENA_LAYOUT.djTower.egoTriggerY
      );
      if (distDj <= 220 || distDjEgo <= ARENA_LAYOUT.djTower.egoTriggerRadius) {
        p.onOpenStationDialog?.('dj');
        const djName = p.activeDjName || 'DJ Magic Force';
        djSpeechBubble = `🎤 "${djName}: Grüße von den Klecknix Twin-Decks ans Palladium Hanau!"`;
        djSpeechTimer = 5.5;
        speakNpcBubble(djSpeechBubble, djName, 'male');
        player.speechBubble = `🎧 Shoutout an ${djName} am Pult!`;
        player.speechTimer = 2.8;
        return;
      }

      // 3. In "Ballspiel" mode: Player as Skate-Guard throws toward 16-Bit Neon Crosshair (or passes to Ordner Manni!)
      // 2c. Check Custom Crew Station Members proximity ([E] interaction)
      if (p.customCrewMembers && p.customCrewMembers.length > 0) {
        for (const cm of p.customCrewMembers) {
          if (Math.hypot(player.x - cm.x, player.y - cm.y) <= 115) {
            p.onOpenStationDialog?.(cm.id);
            player.speechBubble = `👾 ${cm.crewName} (${cm.stationTitle}): „${cm.quote}“`;
            player.speechTimer = 3.0;
            return;
          }
        }
      }

      // 2d. Check Newspaper Stand & Hallen-Ehrentafel proximity ([E] interaction)
      const cbInteract = ARENA_LAYOUT.bottomEntrance.cashierBooth;
      const newsStandInteractX = cbInteract.x + cbInteract.width / 2;
      const newsStandInteractY = cbInteract.y + cbInteract.height + 36;
      if (
        p.newspaperEnabled !== false &&
        Math.hypot(player.x - newsStandInteractX, player.y - newsStandInteractY) <=
          84
      ) {
        p.onOpenNewspaperModal?.();
        return;
      }
      const lbBoardInteractX = cbInteract.x + cbInteract.width + 66;
      const lbBoardInteractY = cbInteract.y + cbInteract.height + 26;
      if (
        Math.hypot(player.x - lbBoardInteractX, player.y - lbBoardInteractY) <=
        88
      ) {
        p.onOpenLeaderboardModal?.();
        return;
      }

      // 2e. Check 80s Retro Arcade Cabinets proximity near the DJ-Kanzel ([E] interaction)
      const arcadeCabs: {
        id: 'monkey-stomp' | 'disco-invaders' | 'pac-roller';
        label: string;
        x: number;
        y: number;
      }[] = [
        { id: 'monkey-stomp', label: 'MONKEY STOMP', x: 84, y: 264 },
        { id: 'disco-invaders', label: 'DISCO INVADERS', x: 148, y: 264 },
        { id: 'pac-roller', label: 'PAC-ROLLER', x: 212, y: 264 },
      ];
      let nearestCab: (typeof arcadeCabs)[0] | null = null;
      let nearestCabDist = 9999;
      for (const cab of arcadeCabs) {
        const dCab = Math.hypot(player.x - cab.x, player.y - (cab.y + 18));
        if (dCab < nearestCabDist) {
          nearestCabDist = dCab;
          nearestCab = cab;
        }
      }
      if (nearestCab && nearestCabDist <= 76 && p.onOpenArcadeMachine) {
        p.onOpenArcadeMachine(nearestCab.id);
        player.speechBubble = `🕹️ ${nearestCab.label} gestartet! Park-Schutz aktiv!`;
        player.speechTimer = 2.8;
        return;
      }

      if (p.hallGameMode === 'ballspiel') {
        const singleBall = softballs[0];
        if (singleBall) {
          if (
            (singleBall.state === 'HELD' && singleBall.holderId === 'player') ||
            (singleBall.state === 'FREE' &&
              Math.hypot(singleBall.x - player.x, singleBall.y - player.y) < 95)
          ) {
            const currentSkaterSpeed = Math.hypot(player.vx, player.vy);
            const minBallThrowSpeed = 355 * 0.35;
            if (currentSkaterSpeed < minBallThrowSpeed) {
              player.speechBubble = '⚡ Erst Schwung holen zum Werfen!';
              player.speechTimer = 1.8;
              return;
            }
            const aimX = hasMouseMovedOnCanvas
              ? mouseWorldX
              : player.x + Math.cos(player.headingRad) * 220;
            const aimY = hasMouseMovedOnCanvas
              ? mouseWorldY
              : player.y + Math.sin(player.headingRad) * 220;
            const throwAngle =
              Math.hypot(aimX - player.x, aimY - player.y) > 12
                ? Math.atan2(aimY - player.y, aimX - player.x)
                : player.headingRad;
            const speed = 720;
            singleBall.state = 'THROWN';
            singleBall.holderId = null;
            singleBall.x = player.x + Math.cos(throwAngle) * 28;
            singleBall.y = player.y + Math.sin(throwAngle) * 28;
            singleBall.vx = Math.cos(throwAngle) * speed;
            singleBall.vy = Math.sin(throwAngle) * speed;
            singleBall.bouncesLeft = 2;
            singleBall.color = '#39ff14';
            singleBall.fromPlayer = true;
            singleBall.freeTimer = 0;
            player.headingRad = throwAngle;
            soundFX.playBallThrowOrHit(false);
            p.onIntroStepComplete?.('try_ballspiel');
          }
        }
        return;
      }

      // 4. In "Slow-Skating" mode (Singleplayer): Pressing [E]/[F] near a solo AI skater initiates a Slow-Skate Flirt attempt!
      if (
        p.lightingMode === 'slow-skating' &&
        !p.isMultiplayerActive &&
        p.hallGameMode === 'free-skate' &&
        !slowFlirtPartnerId
      ) {
        const soloCandidates = trackNpcs.filter(
          (n) =>
            n.role !== 'guard' &&
            !['reg-1', 'reg-2', 'speed-3', 'speed-2', 'speed-1', 'speed-4'].includes(
              n.id
            ) &&
            Math.hypot(n.x - player.x, n.y - player.y) < 110
        );
        if (soloCandidates.length > 0) {
          soloCandidates.sort(
            (a, b) =>
              Math.hypot(a.x - player.x, a.y - player.y) -
              Math.hypot(b.x - player.x, b.y - player.y)
          );
          const candidate = soloCandidates[0];
          slowFlirtAttemptCount += 1;
          if (slowFlirtAttemptCount === 1 && !slowFlirtImpressedByTrick) {
            candidate.speechText = '„Sorry, noch nicht mein Typ!“';
            candidate.speechTimer = 3.5;
            player.speechBubble = '😅 Ein Korb! Gleich beim nächsten versuchen...';
            player.speechTimer = 2.8;
            slowFlirtRejectedIds.add(candidate.id);
            slowFlirtCooldown = 2.2;
          } else if (
            slowFlirtAttemptCount === 2 &&
            !slowFlirtImpressedByTrick &&
            slowFlirtRejectedIds.has(candidate.id)
          ) {
            candidate.speechText = '„Üb erstmal noch ein bisschen!“';
            candidate.speechTimer = 3.5;
            player.speechBubble = '🕺 Erstmal einen 360°-Spin [Q] zeigen!';
            player.speechTimer = 2.8;
            slowFlirtCooldown = 2.2;
          } else {
            slowFlirtPartnerId = candidate.id;
            candidate.speechText =
              '„Na gut, fahren wir eine Runde zusammen!“';
            candidate.speechTimer = 4.5;
            player.speechBubble = `💖 Hand-in-Hand mit ${candidate.name}!`;
            player.speechTimer = 4.0;
            soundFX.playChallengeUnlocked();
          }
        }
      }
    };

    // Build Mode (Baumenü) Drag-&-Drop & Resize State & Helpers
    let buildDragState:
      | {
          kind: 'module';
          modId: EditableModuleId;
          offsetX: number;
          offsetY: number;
        }
      | {
          kind: 'resize-module';
          modId: EditableModuleId;
          startMouseX: number;
          startMouseY: number;
          startW: number;
          startH: number;
        }
      | {
          kind: 'npc';
          npcId: string;
          offsetX: number;
          offsetY: number;
        }
      | null = null;

    const convertClientToWorldCoords = (
      clientX: number,
      clientY: number,
      rect: DOMRect
    ): { x: number; y: number } => {
      const rawX = ((clientX - rect.left) / rect.width) * WORLD_WIDTH;
      const rawY = ((clientY - rect.top) / rect.height) * WORLD_HEIGHT;
      const camMode = propsRef.current.cameraMode;
      if (camMode === 'chase') {
        const zoomX = 1.48;
        const zoomY = 1.32;
        const camX = Math.max(420, Math.min(WORLD_WIDTH - 420, player.x));
        const camY = Math.max(300, Math.min(WORLD_HEIGHT - 300, player.y));
        return {
          x: (rawX - WORLD_WIDTH / 2) / zoomX + camX,
          y: (rawY - WORLD_HEIGHT / 2) / zoomY + camY,
        };
      }
      if (camMode === 'ego') {
        const zoomX = 1.92;
        const zoomY = 1.72;
        const lookAheadX = Math.max(
          340,
          Math.min(
            WORLD_WIDTH - 340,
            player.x + Math.cos(player.headingRad) * 115
          )
        );
        const lookAheadY = Math.max(
          240,
          Math.min(
            WORLD_HEIGHT - 240,
            player.y + Math.sin(player.headingRad) * 115
          )
        );
        return {
          x: (rawX - WORLD_WIDTH / 2) / zoomX + lookAheadX,
          y: (rawY - WORLD_HEIGHT / 2) / zoomY + lookAheadY,
        };
      }
      if (
        typeof window !== 'undefined' &&
        window.innerWidth <= 1024 &&
        !propsRef.current.buildModeEnabled
      ) {
        const followZoom = window.innerWidth < 640 ? 1.56 : 1.32;
        const halfW = WORLD_WIDTH / (2 * followZoom);
        const halfH = WORLD_HEIGHT / (2 * followZoom);
        const camX = Math.max(halfW, Math.min(WORLD_WIDTH - halfW, player.x));
        const camY = Math.max(halfH, Math.min(WORLD_HEIGHT - halfH, player.y));
        return {
          x: (rawX - WORLD_WIDTH / 2) / followZoom + camX,
          y: (rawY - WORLD_HEIGHT / 2) / followZoom + camY,
        };
      }
      return { x: rawX, y: rawY };
    };

    const getActiveCustomLayoutCopy = (): CustomArenaLayoutState => {
      const current = propsRef.current.customLayout || DEFAULT_CUSTOM_ARENA_LAYOUT;
      const modules = {} as CustomArenaLayoutState['modules'];
      (Object.keys(DEFAULT_CUSTOM_ARENA_LAYOUT.modules) as EditableModuleId[]).forEach(
        (key) => {
          modules[key] = {
            ...(current.modules?.[key] || DEFAULT_CUSTOM_ARENA_LAYOUT.modules[key]),
          };
        }
      );
      return {
        modules,
        npcAnchors: { ...(current.npcAnchors || {}) },
      };
    };

    const computeNpcOrbitFromPosition = (nx: number, ny: number, role: string) => {
      const { rink } = ARENA_LAYOUT;
      const dx = nx - rink.centerX;
      const dy = rink.centerY - ny;
      const orbitAngle = Math.atan2(dy, dx);
      const cosA = Math.cos(orbitAngle);
      const flatBonusX = role === 'speed' ? 18 : 26;
      const adjustedDx = dx - Math.sign(cosA) * Math.pow(Math.abs(cosA), 3) * flatBonusX;
      const radialScale = Math.hypot(adjustedDx / 548, dy / 270);
      const clampedScale = Math.max(0.32, Math.min(1.26, radialScale || 1));
      return {
        orbitAngle,
        laneRadiusX: Math.round(548 * clampedScale),
        laneRadiusY: Math.round(270 * clampedScale),
      };
    };

    const moveBuildSelectionByDelta = (targetId: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) return;
      const nextLayout = getActiveCustomLayoutCopy();
      if (targetId.startsWith('mod:')) {
        const modId = targetId.slice(4) as EditableModuleId;
        const mod = nextLayout.modules[modId];
        if (!mod) return;
        mod.x = Math.max(0, Math.min(WORLD_WIDTH - mod.width, Math.round(mod.x + dx)));
        mod.y = Math.max(0, Math.min(WORLD_HEIGHT - mod.height, Math.round(mod.y + dy)));
        applyCustomArenaLayout(nextLayout);
        lastSyncedLayoutJson = JSON.stringify(nextLayout);
        propsRef.current.onUpdateCustomLayout?.(nextLayout);
      } else if (targetId.startsWith('npc:')) {
        const npcId = targetId.slice(4);
        const npc = trackNpcs.find((n) => n.id === npcId);
        if (!npc) return;
        const nextX = Math.max(24, Math.min(WORLD_WIDTH - 24, Math.round(npc.x + dx)));
        const nextY = Math.max(24, Math.min(WORLD_HEIGHT - 24, Math.round(npc.y + dy)));
        npc.x = nextX;
        npc.y = nextY;
        npc.homeX = nextX;
        npc.homeY = nextY;
        const orb = computeNpcOrbitFromPosition(nextX, nextY, npc.role);
        npc.orbitAngle = orb.orbitAngle;
        npc.laneRadiusX = orb.laneRadiusX;
        npc.laneRadiusY = orb.laneRadiusY;
        nextLayout.npcAnchors[npc.id] = {
          name: npc.name,
          homeX: nextX,
          homeY: nextY,
          orbitAngle: orb.orbitAngle,
          laneRadiusX: orb.laneRadiusX,
          laneRadiusY: orb.laneRadiusY,
        };
        lastSyncedLayoutJson = JSON.stringify(nextLayout);
        propsRef.current.onUpdateCustomLayout?.(nextLayout);
      }
    };

    const rotateBuildSelectedModule = (targetId: string, stepDeg: number) => {
      if (!targetId.startsWith('mod:')) return;
      const modId = targetId.slice(4) as EditableModuleId;
      const nextLayout = getActiveCustomLayoutCopy();
      const mod = nextLayout.modules[modId];
      if (!mod) return;
      mod.rot = (((mod.rot || 0) + stepDeg) % 360 + 360) % 360;
      applyCustomArenaLayout(nextLayout);
      lastSyncedLayoutJson = JSON.stringify(nextLayout);
      propsRef.current.onUpdateCustomLayout?.(nextLayout);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputFocused =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        activeTag === 'SELECT';
      if (isInputFocused) return;

      // In Build Mode (Baumenü): Arrow keys nudge 1px (Shift+Arrow = 10px) & key 'R' rotates selected module by 45° (Shift+R = 90°)
      if (
        propsRef.current.buildModeEnabled &&
        propsRef.current.selectedBuildItemId
      ) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx =
            e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy =
            e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          moveBuildSelectionByDelta(propsRef.current.selectedBuildItemId, dx, dy);
          return;
        }
        if (
          (e.key === 'r' || e.key === 'R') &&
          propsRef.current.selectedBuildItemId.startsWith('mod:')
        ) {
          e.preventDefault();
          rotateBuildSelectedModule(
            propsRef.current.selectedBuildItemId,
            e.shiftKey ? 90 : 45
          );
          return;
        }
      }

      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
          ' ',
        ].includes(e.key)
      ) {
        e.preventDefault();
      }

      const k = e.key.toLowerCase();
      keysDown[k] = true;
      keysDown[e.code] = true;

      // Easter-Egg: pressing J + R simultaneously triggers "✨ CREATED BY JÜRGEN BECKER (JR) ✨"
      if (keysDown['j'] && keysDown['r']) {
        triggerJrEasterEgg();
        return;
      }

      if (e.code === 'Space') {
        if (!propsRef.current.isCurtainOpen) {
          propsRef.current.onEnterHallFromGamepad();
        } else if (propsRef.current.hallGameMode === 'ballspiel') {
          triggerInteractOrThrowBall();
        } else if (
          propsRef.current.hallGameMode === 'stuhlsprung' ||
          propsRef.current.hallGameMode === 'springerstaffel'
        ) {
          triggerPlayerJump();
        } else {
          const { mirrorWall } = ARENA_LAYOUT;
          const inSpinZone =
            player.x >= mirrorWall.x &&
            player.x <= mirrorWall.danceFloorX + 145 &&
            player.y >= mirrorWall.y - 25 &&
            player.y <= mirrorWall.y + mirrorWall.height + 25;
          if (inSpinZone || Math.hypot(player.vx, player.vy) < 95) {
            triggerPlayer360Spin();
          } else {
            triggerPlayerJump();
          }
        }
      } else if (k === 'q') {
        if (propsRef.current.isCurtainOpen) {
          triggerPlayer360Spin();
        }
      } else if (k === 'j' || e.key === 'Shift') {
        triggerPlayerJump();
      } else if (k === 'e' || k === 'f') {
        triggerInteractOrThrowBall();
      } else if (k === 'c') {
        propsRef.current.onToggleCamera();
      } else if (k === 'v') {
        propsRef.current.onToggleCharacterMode();
      } else if (k === 'n') {
        propsRef.current.onToggleShowNames();
      } else if (k === 'l') {
        propsRef.current.onToggleUnderglow();
      } else if (k === 'h') {
        propsRef.current.onToggleKengolHat();
        player.speechBubble = !propsRef.current.kengolHatEnabled
          ? '🦘 Kengol-Bucket-Hat & weiß-pinke Kengo-Skates AN!'
          : '🛼 Klassischer 80er-Look aktiv!';
        player.speechTimer = 2.4;
      } else if (k === '1') {
        if (propsRef.current.upgrades.unlockedMoves?.spin360) {
          triggerTrickMove('spin360');
        } else if (
          player.freeSlushCount > 0 &&
          propsRef.current.drinkChipAvailable &&
          (propsRef.current.hasOwnSkates || propsRef.current.hasRentedSkates)
        ) {
          player.freeSlushCount = 0;
          if (player.freeBlobaCount === 0) {
            propsRef.current.onRedeemDrinkChipAtBistro();
          }
          player.slushRemainingSec = 75;
          player.speechBubble = '🍧 Gratis Slush Puppy eingelöst! Mega Cool-Kick!';
          player.speechTimer = 2.8;
          soundFX.playDrinkRefresh();
          propsRef.current.onIntroStepComplete?.('fetch_drink');
          propsRef.current.onChallengeProgress('bistro_drink', 1);
        } else {
          triggerTrickMove('spin360');
        }
      } else if (k === '2') {
        if (propsRef.current.upgrades.unlockedMoves?.backward) {
          triggerTrickMove('backward');
        } else if (
          player.freeBlobaCount > 0 &&
          propsRef.current.drinkChipAvailable &&
          (propsRef.current.hasOwnSkates || propsRef.current.hasRentedSkates)
        ) {
          player.freeBlobaCount = 0;
          if (player.freeSlushCount === 0) {
            propsRef.current.onRedeemDrinkChipAtBistro();
          }
          player.blobaColaRemainingSec = 45;
          player.speechBubble = '🥤 Gratis Bloba Cola eingelöst! Turbo-Prickeln!';
          player.speechTimer = 2.8;
          soundFX.playDrinkRefresh();
          propsRef.current.onIntroStepComplete?.('fetch_drink');
          propsRef.current.onChallengeProgress('bistro_drink', 1);
        } else {
          triggerTrickMove('backward');
        }
      } else if (k === '3') {
        triggerTrickMove('flamingo');
      } else if (k === '4') {
        triggerTrickMove('starjump');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysDown[k] = false;
      keysDown[e.code] = false;
    };

    const handleCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const worldPt = convertClientToWorldCoords(e.clientX, e.clientY, rect);
      const worldX = worldPt.x;
      const worldY = worldPt.y;

      // In Build Mode (Baumenü): Hit-test Resize-Handle, AI Skaters & Room Modules for direct Drag-&-Drop / Resize!
      if (propsRef.current.buildModeEnabled) {
        const activeMods =
          propsRef.current.customLayout?.modules ||
          DEFAULT_CUSTOM_ARENA_LAYOUT.modules;

        // 0. If a module is currently selected, hit-test its bottom-right Resize-Handle (Zieh-Eck) first!
        const selId = propsRef.current.selectedBuildItemId;
        if (selId && selId.startsWith('mod:')) {
          const selModId = selId.slice(4) as EditableModuleId;
          const selMod = activeMods[selModId];
          if (selMod) {
            const eff = getModuleCollisionRect(selMod);
            const handleX = eff.x + eff.width + 3;
            const handleY = eff.y + eff.height + 3;
            if (Math.hypot(worldX - handleX, worldY - handleY) <= 18) {
              buildDragState = {
                kind: 'resize-module',
                modId: selModId,
                startMouseX: worldX,
                startMouseY: worldY,
                startW: selMod.width,
                startH: selMod.height,
              };
              return;
            }
          }
        }

        // 1. Hit-test AI skaters / Crew figures (32px radius around their position)
        for (let i = trackNpcs.length - 1; i >= 0; i--) {
          const npc = trackNpcs[i];
          if (Math.hypot(worldX - npc.x, worldY - npc.y) <= 32) {
            buildDragState = {
              kind: 'npc',
              npcId: npc.id,
              offsetX: worldX - npc.x,
              offsetY: worldY - npc.y,
            };
            propsRef.current.onSelectBuildItem?.(`npc:${npc.id}`);
            return;
          }
        }

        // 2. Hit-test the movable modules (including individual Bistro tables & SPINDE / lockers; check smaller items first)
        const hitOrder: EditableModuleId[] = [
          'bistroTable1',
          'bistroTable2',
          'bistroTable3',
          'bistroTable4',
          'baffleLeft',
          'baffleRight',
          'lockers',
          'proShop',
          'skateRental',
          'cashier',
          'bistro',
          'centerStage',
          'djTower',
        ];
        for (const modId of hitOrder) {
          const m = activeMods[modId];
          if (!m) continue;
          const eff = getModuleCollisionRect(m);
          const pad = modId === 'baffleLeft' || modId === 'baffleRight' ? 12 : 6;
          // Also check if user clicked directly on the bottom-right resize handle of this module
          const handleX = eff.x + eff.width + 3;
          const handleY = eff.y + eff.height + 3;
          if (Math.hypot(worldX - handleX, worldY - handleY) <= 16) {
            buildDragState = {
              kind: 'resize-module',
              modId,
              startMouseX: worldX,
              startMouseY: worldY,
              startW: m.width,
              startH: m.height,
            };
            propsRef.current.onSelectBuildItem?.(`mod:${modId}`);
            return;
          }
          if (
            worldX >= eff.x - pad &&
            worldX <= eff.x + eff.width + pad &&
            worldY >= eff.y - pad &&
            worldY <= eff.y + eff.height + pad
          ) {
            buildDragState = {
              kind: 'module',
              modId,
              offsetX: worldX - m.x,
              offsetY: worldY - m.y,
            };
            propsRef.current.onSelectBuildItem?.(`mod:${modId}`);
            return;
          }
        }

        propsRef.current.onSelectBuildItem?.(null);
        return;
      }

      // Easter-Egg: 3x click on the center Palladium logo triggers "✨ CREATED BY JÜRGEN BECKER (JR) ✨"
      if (
        Math.hypot(
          worldX - ARENA_LAYOUT.rink.centerX,
          worldY - ARENA_LAYOUT.rink.centerY
        ) <= 135
      ) {
        const nowClick = performance.now();
        if (nowClick - lastCenterLogoClickTime < 900) {
          centerLogoClickCount += 1;
        } else {
          centerLogoClickCount = 1;
        }
        lastCenterLogoClickTime = nowClick;
        if (centerLogoClickCount >= 3) {
          centerLogoClickCount = 0;
          triggerJrEasterEgg();
          return;
        }
      }

      // Check click on 80s Newspaper Stand ("Der Palladium-Kurier") in front entrance/reception area
      const cb = ARENA_LAYOUT.bottomEntrance.cashierBooth;
      const newsStandX = cb.x + cb.width / 2;
      const newsStandY = cb.y + cb.height + 36;
      if (
        propsRef.current.newspaperEnabled !== false &&
        Math.hypot(worldX - newsStandX, worldY - newsStandY) <= 44
      ) {
        propsRef.current.onOpenNewspaperModal?.();
        return;
      }

      // Check click on 80s Arcade Hallen-Ehrentafel ("🏆 BESTENLISTE") at the entrance wall
      const lbBoardX = cb.x + cb.width + 66;
      const lbBoardY = cb.y + cb.height + 26;
      if (Math.hypot(worldX - lbBoardX, worldY - lbBoardY) <= 46) {
        propsRef.current.onOpenLeaderboardModal?.();
        return;
      }

      // Check click on 1. Kasse & Einlass ("KASSE & EINGANG")
      if (
        worldX >= cb.x - 20 &&
        worldX <= cb.x + cb.width + 20 &&
        worldY >= cb.y - 20 &&
        worldY <= cb.y + cb.height + 20
      ) {
        propsRef.current.onOpenStationDialog?.('kasse');
        return;
      }

      // Check click on the curved top-left DJ-Pult ("▶ DJ-PULT [KLICK] ◀" / Station 5: DJ-Kanzel)
      const { djTower, proShopAndRental } = ARENA_LAYOUT;
      if (
        Math.hypot(worldX - djTower.centerX, worldY - djTower.centerY) <=
        djTower.clickRadius
      ) {
        propsRef.current.onOpenStationDialog?.('dj');
        propsRef.current.onClickDjConsole?.();
        return;
      }

      // Check click on Rollschuh-Verleih counter (Station 2: Verleih)
      const rb = proShopAndRental.rentalBounds;
      if (
        worldX >= rb.x &&
        worldX <= rb.x + rb.width &&
        worldY >= rb.y - 45 &&
        worldY <= rb.y + rb.height
      ) {
        propsRef.current.onOpenStationDialog?.('verleih');
        if (!propsRef.current.hasOwnSkates && !propsRef.current.hasRentedSkates) {
          propsRef.current.onRedeemDrinkChipAtRental();
          player.freeSlushCount = 0;
          player.freeBlobaCount = 0;
          player.speechBubble =
            '🛼 Freigetränk-Chip gegen Leih-Rollschuhe eingelöst! Aufs Parkett!';
          player.speechTimer = 4.2;
          soundFX.playChallengeUnlocked();
          speakNpcBubble(
            'Hier sind deine 80er Leih-Rollschuhe! Viel Spaß auf der Bahn!',
            'VERLEIH-BIGGI',
            'female'
          );
        }
        return;
      }

      // Check click on 80er-Spindreihe ("SPINDE") -> opens compact Spind menu & completes Intro step 1!
      const lk = ARENA_LAYOUT.lockers;
      if (lk) {
        const effLk = getModuleCollisionRect(lk);
        if (
          worldX >= effLk.x - 14 &&
          worldX <= effLk.x + effLk.width + 14 &&
          worldY >= effLk.y - 18 &&
          worldY <= effLk.y + effLk.height + 14
        ) {
          propsRef.current.onIntroStepComplete?.('open_locker');
          propsRef.current.onOpenLockerModal?.();
          player.speechBubble = '🗄️ Spind geöffnet!';
          player.speechTimer = 2.2;
          return;
        }
      }

      // Check click on Bistro / Gastro Counter (Station 4: Snack-Bar)
      const bc = ARENA_LAYOUT.bistro.counter;
      if (
        worldX >= bc.x - 20 &&
        worldX <= bc.x + bc.width + 20 &&
        worldY >= bc.y - 35 &&
        worldY <= bc.y + bc.height + 35
      ) {
        propsRef.current.onOpenStationDialog?.('snackbar');
        propsRef.current.onIntroStepComplete?.('fetch_drink');
        player.slushRemainingSec = 75;
        player.blobaColaRemainingSec = 45;
        if (
          propsRef.current.drinkChipAvailable &&
          (player.freeSlushCount > 0 || player.freeBlobaCount > 0)
        ) {
          player.freeSlushCount = 0;
          player.freeBlobaCount = 0;
          propsRef.current.onRedeemDrinkChipAtBistro();
          player.speechBubble =
            '🎁 Freigetränk-Chip an der Gastro eingelöst: Slush & Bloba Cola!';
        } else {
          player.speechBubble =
            '🥤 Erfrischung an der Gastro geholt! Mega Frische-Kick!';
        }
        player.speechTimer = 3.0;
        soundFX.playDrinkRefresh();
        propsRef.current.onChallengeProgress('bistro_drink', 1);
        return;
      }

      // Check click on Pro-Shop showcase (Station 3: Pro-Shop)
      const sb = proShopAndRental.proShopBounds;
      if (
        worldX >= sb.x &&
        worldX <= sb.x + sb.width &&
        worldY >= sb.y - 40 &&
        worldY <= sb.y + sb.height
      ) {
        if (propsRef.current.onOpenStationDialog) {
          propsRef.current.onOpenStationDialog('proshop');
        } else {
          propsRef.current.onOpenProShopModal();
        }
        return;
      }

      // Check click on Custom Crew Station Members placed on the rink
      if (
        propsRef.current.customCrewMembers &&
        propsRef.current.customCrewMembers.length > 0
      ) {
        for (const cm of propsRef.current.customCrewMembers) {
          if (Math.hypot(worldX - cm.x, worldY - cm.y) <= 44) {
            propsRef.current.onOpenStationDialog?.(cm.id);
            return;
          }
        }
      }

      // Check click on 3 Retro 80s Arcade Cabinets in the Arcade corner near the DJ-Kanzel
      const clickArcadeCabs: {
        id: 'monkey-stomp' | 'disco-invaders' | 'pac-roller';
        label: string;
        x: number;
        y: number;
      }[] = [
        { id: 'monkey-stomp', label: 'MONKEY STOMP', x: 84, y: 264 },
        { id: 'disco-invaders', label: 'DISCO INVADERS', x: 148, y: 264 },
        { id: 'pac-roller', label: 'PAC-ROLLER', x: 212, y: 264 },
      ];
      for (const cab of clickArcadeCabs) {
        if (
          Math.abs(worldX - cab.x) <= 28 &&
          Math.abs(worldY - cab.y) <= 28
        ) {
          propsRef.current.onOpenArcadeMachine?.(cab.id);
          player.speechBubble = `🕹️ ${cab.label} gestartet! Park-Schutz aktiv!`;
          player.speechTimer = 2.6;
          return;
        }
      }

      if (propsRef.current.hallGameMode === 'ballspiel') {
        mouseWorldX = worldX;
        mouseWorldY = worldY;
        hasMouseMovedOnCanvas = true;
        triggerInteractOrThrowBall();
      }
    };

    const handleCanvasMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const worldPt = convertClientToWorldCoords(e.clientX, e.clientY, rect);
      mouseWorldX = worldPt.x;
      mouseWorldY = worldPt.y;
      hasMouseMovedOnCanvas = true;

      if (buildDragState && propsRef.current.buildModeEnabled) {
        const drag = buildDragState;
        const nextLayout = getActiveCustomLayoutCopy();
        if (drag.kind === 'module') {
          const mod = nextLayout.modules[drag.modId];
          if (mod) {
            mod.x = Math.max(
              0,
              Math.min(
                WORLD_WIDTH - mod.width,
                Math.round(mouseWorldX - drag.offsetX)
              )
            );
            mod.y = Math.max(
              0,
              Math.min(
                WORLD_HEIGHT - mod.height,
                Math.round(mouseWorldY - drag.offsetY)
              )
            );
            applyCustomArenaLayout(nextLayout);
            lastSyncedLayoutJson = JSON.stringify(nextLayout);
            propsRef.current.onUpdateCustomLayout?.(nextLayout);
          }
        } else if (drag.kind === 'resize-module') {
          const mod = nextLayout.modules[drag.modId];
          if (mod) {
            const dw = Math.round(mouseWorldX - drag.startMouseX);
            const dh = Math.round(mouseWorldY - drag.startMouseY);
            const rot = ((mod.rot || 0) % 360 + 360) % 360;
            const isSwapped = rot === 90 || rot === 270;
            const minW =
              drag.modId === 'baffleLeft' || drag.modId === 'baffleRight'
                ? 24
                : 32;
            const minH =
              drag.modId === 'baffleLeft' || drag.modId === 'baffleRight'
                ? 8
                : 20;
            mod.width = Math.max(
              minW,
              Math.min(960, drag.startW + (isSwapped ? dh : dw))
            );
            mod.height = Math.max(
              minH,
              Math.min(640, drag.startH + (isSwapped ? dw : dh))
            );
            applyCustomArenaLayout(nextLayout);
            lastSyncedLayoutJson = JSON.stringify(nextLayout);
            propsRef.current.onUpdateCustomLayout?.(nextLayout);
          }
        } else if (drag.kind === 'npc') {
          const npc = trackNpcs.find((n) => n.id === drag.npcId);
          if (npc) {
            const nextX = Math.max(
              24,
              Math.min(
                WORLD_WIDTH - 24,
                Math.round(mouseWorldX - drag.offsetX)
              )
            );
            const nextY = Math.max(
              24,
              Math.min(
                WORLD_HEIGHT - 24,
                Math.round(mouseWorldY - drag.offsetY)
              )
            );
            npc.x = nextX;
            npc.y = nextY;
            npc.homeX = nextX;
            npc.homeY = nextY;
            const orb = computeNpcOrbitFromPosition(nextX, nextY, npc.role);
            npc.orbitAngle = orb.orbitAngle;
            npc.laneRadiusX = orb.laneRadiusX;
            npc.laneRadiusY = orb.laneRadiusY;
            nextLayout.npcAnchors[npc.id] = {
              name: npc.name,
              homeX: nextX,
              homeY: nextY,
              orbitAngle: orb.orbitAngle,
              laneRadiusX: orb.laneRadiusX,
              laneRadiusY: orb.laneRadiusY,
            };
            lastSyncedLayoutJson = JSON.stringify(nextLayout);
            propsRef.current.onUpdateCustomLayout?.(nextLayout);
          }
        }
      }
    };

    const handleCanvasMouseUp = () => {
      buildDragState = null;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);

    // ========================================================================
    // 4. HTML5 GAMEPAD API STATE & EDGE DETECTION
    // ========================================================================
    let gamepadConnected = false;
    let gamepadName = '';
    const prevPadButtons: boolean[] = Array(16).fill(false);

    const onGamepadConn = (e: GamepadEvent) => {
      gamepadConnected = true;
      gamepadName = e.gamepad.id;
    };
    const onGamepadDisconn = () => {
      gamepadConnected = false;
      gamepadName = '';
    };
    window.addEventListener('gamepadconnected', onGamepadConn);
    window.addEventListener('gamepaddisconnected', onGamepadDisconn);

    // ========================================================================
    // 5. MAIN 60FPS GAME LOOP (PHYSICS, AI, SLIPSTREAM, COLLISIONS & RENDER)
    // ========================================================================
    let animFrameId = 0;
    let lastTime = performance.now();
    let lastTelemetryTime = 0;
    let lastMultiplayerEmitTime = 0;
    let shuffleTrainTimer = 8.0;
    let shuffleTrainActiveSec = 0;
    let excursionTriggerTimer = 7.5;
    let cultChatterTimer = 11.0;
    let ballspielElapsedSec = 0;
    let ballspielRoundEnded = false;
    const remotePlayersMap = new Map<string, InterpolatedRemotePlayer>();

    const stepFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Ensure HiDPI transform is locked to logical 1920x1000 coordinates with crisp pixels
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      if (jrEasterEggTimer > 0) {
        jrEasterEggTimer = Math.max(0, jrEasterEggTimer - dt);
      }

      const p = propsRef.current;
      const hasSkatesEquipped =
        p.mobilitySelected !== false &&
        (p.hasOwnSkates ||
          p.hasRentedSkates ||
          p.characterMode === 'wheelchair');

      // Keep Single Source of Truth ARENA_LAYOUT & NPC home anchors synchronized with customLayout (including Reset & Multiplayer Live-Sync!)
      const currentLayoutJson = JSON.stringify(p.customLayout || null);
      if (currentLayoutJson !== lastSyncedLayoutJson) {
        lastSyncedLayoutJson = currentLayoutJson;
        applyCustomArenaLayout(p.customLayout || DEFAULT_CUSTOM_ARENA_LAYOUT);
        const freshDefaults = buildTrackNpcsForDifficulty(
          p.difficulty,
          p.customLayout?.npcAnchors
        );
        trackNpcs.forEach((npc) => {
          const match = freshDefaults.find((d) => d.id === npc.id);
          if (match) {
            npc.homeX = match.homeX;
            npc.homeY = match.homeY;
            npc.orbitAngle = match.orbitAngle;
            npc.laneRadiusX = match.laneRadiusX;
            npc.laneRadiusY = match.laneRadiusY;
            if (p.buildModeEnabled || !p.customLayout?.npcAnchors?.[npc.id]) {
              npc.x = match.homeX ?? match.x;
              npc.y = match.homeY ?? match.y;
            }
          }
        });
      }

      // Sync difficulty roster or starting position when entering the hall or changing pre-entry settings
      if (
        p.difficulty !== prevDifficulty ||
        p.hasOwnSkates !== prevHasOwnSkates ||
        (!prevIsCurtainOpen && p.isCurtainOpen)
      ) {
        if (p.difficulty !== prevDifficulty) {
          prevDifficulty = p.difficulty;
          const nextNpcs = buildTrackNpcsForDifficulty(
            p.difficulty,
            p.customLayout?.npcAnchors
          );
          trackNpcs.splice(0, trackNpcs.length, ...nextNpcs);
        }
        prevHasOwnSkates = p.hasOwnSkates;
        prevIsCurtainOpen = p.isCurtainOpen;

        const spawn = getPlayerStartCoords(p.difficulty, hasSkatesEquipped);
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.headingRad = spawn.headingRad;
      }

      // Keep free drink chip counts synchronized with persisted entryPass state
      if (!p.drinkChipAvailable) {
        player.freeSlushCount = 0;
        player.freeBlobaCount = 0;
      }

      // Welcome Notification on Hall Entry between side Cashier window & Security-Sammy
      if (p.isCurtainOpen && !player.hasShownWelcomeGift) {
        player.hasShownWelcomeGift = true;
        if (p.hasOwnSkates || p.characterMode === 'wheelchair') {
          player.freeSlushCount = p.drinkChipAvailable ? 1 : 0;
          player.freeBlobaCount = p.drinkChipAvailable ? 1 : 0;
          player.speechBubble =
            'Willkommen im Palladium Hanau! Viel Spaß auf der Bahn!';
          player.speechTimer = 5.2;
        } else if (!p.hasRentedSkates) {
          player.speechBubble =
            'Willkommen im Palladium Hanau! Viel Spaß auf der Bahn! (Leih-Skates am Verleih [E])';
          player.speechTimer = 5.5;
        } else {
          player.speechBubble =
            'Willkommen im Palladium Hanau! Viel Spaß auf der Bahn!';
          player.speechTimer = 5.2;
        }
      }

      // DJ Magic Force Neon Speech Bubbles (Mode Changes, Jingle Triggers & Every 20–30 Seconds)
      if (pendingDjBubbleRef.current) {
        djSpeechBubble = pendingDjBubbleRef.current;
        djSpeechTimer = 6.5;
        djNextAutoSpeechTimer = 24.0;
        pendingDjBubbleRef.current = null;
      }
      if (djSpeechTimer > 0) {
        djSpeechTimer = Math.max(0, djSpeechTimer - dt);
        if (djSpeechTimer <= 0) {
          djSpeechBubble = null;
        }
      }
      if (djHandsUpCheerTimer > 0) {
        djHandsUpCheerTimer = Math.max(0, djHandsUpCheerTimer - dt);
      }

      const triggerHandsUpCrowdCheer = () => {
        djHandsUpCheerTimer = 4.8;
        const cheerTexts = [
          '🙌 Put your hands up!',
          '🙌 Yeah!! Palladium 86!',
          '🙌 Danger Rytm Crew!!',
          '🙌 Hände hoch!!',
        ];
        trackNpcs.forEach((npc, idx) => {
          if (npc.role !== 'guard' && idx % 2 === 0) {
            npc.speechText = cheerTexts[idx % cheerTexts.length];
            npc.speechTimer = 3.2;
          }
        });
      };

      if (p.lightingMode !== prevLightingMode) {
        prevLightingMode = p.lightingMode;
        if (p.lightingMode === 'blacklight') {
          djSpeechBubble =
            '🎤 "Blacklight UV Time! Lasst die Neon-Rollen glühen!"';
        } else if (p.lightingMode === 'slow-skating') {
          djSpeechBubble =
            '🪩 "JETZT BEGINNT DAS SLOW-SKATING! Schnappt euch euren Partner!"';
        } else if (p.lightingMode === 'putzlicht') {
          djSpeechBubble =
            '🎤 "Volles Putzlicht an – freie Sicht auf dem Parkett!"';
        } else {
          djSpeechBubble =
            '🎤 "Disco-Spots & Strobo an! Let\'s roll, Palladium Hanau!"';
        }
        djSpeechTimer = 6.0;
        djNextAutoSpeechTimer = 22.0;
        speakNpcBubble(djSpeechBubble, p.activeDjName || 'DJ MAGIC FORCE', 'male');
      }

      if (p.fogBurstCount !== lastFogBurstCount) {
        lastFogBurstCount = p.fogBurstCount;
        triggerFogBurst();
        fogBurstTimer = 9.5;
      }
      if (fogBurstTimerRef.current > fogBurstTimer) {
        fogBurstTimer = fogBurstTimerRef.current;
      }
      if (fogBurstTimer > 0) {
        fogBurstTimer = Math.max(0, fogBurstTimer - dt);
        fogBurstTimerRef.current = fogBurstTimer;
      }

      const resetBallspielRosterAndStopwatch = () => {
        const fullRoster = buildTrackNpcsForDifficulty(
          'pro',
          p.customLayout?.npcAnchors
        );
        const guardsOnly = fullRoster.filter((n) => n.role === 'guard');
        const skaters15 = fullRoster
          .filter((n) => n.role !== 'guard')
          .slice(0, 15)
          .map((n, sIdx) => ({
            ...n,
            eliminated: false,
            eliminatedOrder: undefined,
            hitOutTimer: 0,
            sittingBarrierSpot: null,
            excursionPhase: 'idle' as const,
            ballspielTargetX: 520 + (sIdx % 5) * 235,
            ballspielTargetY: 220 + Math.floor(sIdx / 5) * 240,
            ballspielRetargetTimer: 0.8 + (sIdx % 4) * 0.45,
          }));
        trackNpcs.splice(0, trackNpcs.length, ...guardsOnly, ...skaters15);
        player.ballspielHits = 0;
        ballspielElapsedSec = 0;
        ballspielRoundEnded = false;
        lastScoredBallId = null;
        lastBallScoreTimeMs = 0;
        ballDistanceSkatedSinceLastScore = 999;

        softballs.splice(0, softballs.length, {
          x: player.x + Math.cos(player.headingRad) * 24,
          y: player.y + Math.sin(player.headingRad) * 24,
          vx: 0,
          vy: 0,
          bouncesLeft: 2,
          color: '#39ff14',
          fromPlayer: true,
          state: 'HELD',
          holderId: 'player',
          holdTimer: 0,
          freeTimer: 0,
        });
      };

      if (pendingBallspielResetRef.current) {
        pendingBallspielResetRef.current = false;
        if (p.hallGameMode === 'ballspiel') {
          player.x = 720;
          player.y = 740;
          player.vx = 0;
          player.vy = 0;
          player.headingRad = 0;
          player.crashTimer = 0;
          resetBallspielRosterAndStopwatch();
          player.speechBubble =
            '🔄 Neue Ballspiel-Runde gestartet! Stoppuhr läuft ab 0,0 s!';
          player.speechTimer = 3.2;
        }
      }

      if (p.hallGameMode !== prevHallGameMode) {
        prevHallGameMode = p.hallGameMode;

        // Rule #2: ONLY when switching to an active Event ('ballspiel', 'slalom', 'stuhlsprung', 'springerstaffel')
        // does the player spawn directly onto the rink! When switching to 'free-skate', position remains unchanged.
        if (p.hallGameMode !== 'free-skate') {
          player.x = 720;
          player.y = 740;
          player.vx = 0;
          player.vy = 0;
          player.headingRad = 0;
          player.crashTimer = 0;
        }

        if (p.hallGameMode === 'ballspiel') {
          resetBallspielRosterAndStopwatch();

          player.speechBubble =
            '🏐 Du hast den Ball! Ziele mit dem Neon-Fadenkreuz & wirf mit [Space] oder Linksklick!';
          player.speechTimer = 4.5;

          djSpeechBubble =
            '🎤 "Ballspiel-Bestzeitjagd startet! Wer räumt die Bahn am schnellsten leer?"';
          djSpeechTimer = 5.5;
          speakNpcBubble(djSpeechBubble, p.activeDjName || 'DJ MAGIC FORCE', 'male');
        } else {
          ballspielElapsedSec = 0;
          ballspielRoundEnded = false;
          // Restore normal difficulty NPC roster when leaving Ballspiel (returning each NPC to its saved homeX/homeY anchor!)
          const restoredNpcs = buildTrackNpcsForDifficulty(
            p.difficulty,
            p.customLayout?.npcAnchors
          ).map((n) => ({
            ...n,
            eliminated: false,
            eliminatedOrder: undefined,
            hitOutTimer: 0,
            excursionPhase: 'idle' as const,
          }));
          trackNpcs.splice(0, trackNpcs.length, ...restoredNpcs);
          softballs.length = 0;

          if (p.hallGameMode === 'stuhlsprung') {
            djSpeechBubble =
              '🎤 "Rundum-Stuhlsprung frei! Alle Zuschauer an die Bande!"';
            djSpeechTimer = 5.5;
            speakNpcBubble(
              djSpeechBubble,
              p.activeDjName || 'DJ MAGIC FORCE',
              'male'
            );
          } else if (p.hallGameMode === 'slalom') {
            lastScoredPylonId = null;
            lastPassSide = null;
            prevSlalomCheckX = player.x;
            slalomCones.forEach((c) => {
              c.passed = false;
              c.wobbleTimer = 0;
            });
            djSpeechBubble =
              '🎤 "Slalom-Parcours eröffnet! Echter Links-Rechts-Zickzack um die Pylonen zählt!"';
            djSpeechTimer = 5.5;
            speakNpcBubble(
              djSpeechBubble,
              p.activeDjName || 'DJ MAGIC FORCE',
              'male'
            );
          } else if (p.hallGameMode === 'springerstaffel') {
            activeSpringerstaffelHeightCm = 60;
            springerstaffelClearedIds.clear();
            djSpeechBubble =
              '🎤 "Springerstaffel eröffnet! Hochsprung-Gestell startet bei 60 cm (+20 cm pro Runde)!"';
            djSpeechTimer = 5.5;
            speakNpcBubble(
              djSpeechBubble,
              p.activeDjName || 'DJ MAGIC FORCE',
              'male'
            );
          }
        }
        djNextAutoSpeechTimer = 22.0;
      }

      djNextAutoSpeechTimer -= dt;
      if (djNextAutoSpeechTimer <= 0 && p.isCurtainOpen) {
        djNextAutoSpeechTimer = 21 + Math.random() * 7;
        const djLabel = p.activeDjName || 'DJ Magic Force';
        const djPhrases = [
          '🎤 "Put your hands up in the air!"',
          `🎤 "${djLabel} live an den Klecknix Twin-Decks!"`,
          '🎤 "Palladium Hanau – seid ihr gut drauf?!"',
          '🎤 "Let\'s roll! Danger Rytm Crew in the mix!"',
          '🎤 "Put your hands up in the air!"',
        ];
        const chosen =
          djPhrases[Math.floor(Math.random() * djPhrases.length)];
        djSpeechBubble = chosen;
        djSpeechTimer = 5.5;
        speakNpcBubble(chosen, djLabel, 'male');
        if (chosen.includes('Put your hands up')) {
          triggerHandsUpCrowdCheer();
        }
      }

      // Periodic authentic 80s NPC rink chatter so Disco-Dieter, Slalom-Steffi, Neon-Nadine, etc. speak audibly (only in Solo mode!)
      ambientChatterTimer -= dt;
      if (
        !p.isMultiplayerActive &&
        ambientChatterTimer <= 0 &&
        p.isCurtainOpen &&
        p.hallGameMode === 'free-skate'
      ) {
        ambientChatterTimer = 8.5 + Math.random() * 5.5;
        const candidates = trackNpcs.filter(
          (n) => !n.speechText && n.crashTimer <= 0 && n.hitOutTimer <= 0
        );
        if (candidates.length > 0) {
          const speaker =
            candidates[Math.floor(Math.random() * candidates.length)];
          const femaleLines = [
            'Voll der 80er Groove heute im Palladium!',
            'Schau mal, wie die Neon-Rollen leuchten!',
            'Gleich noch ein Slush Puppy an der Theke!',
            'Freie Bahn in der Kurve!',
          ];
          const maleLines = [
            'Palladium Hanau – beste Bahn überhaupt!',
            'Saubere Spur halten, Leute!',
            'DJ Magic Force legt heute wieder Bretter auf!',
            'Achtung, wir ziehen im Windschatten vorbei!',
          ];
          const guardLines = [
            'Immer schön gegen den Uhrzeigersinn rollen!',
            'Spur frei halten für die Speed-Skater außen!',
          ];
          const linePool =
            speaker.role === 'guard'
              ? guardLines
              : speaker.gender === 'female'
              ? femaleLines
              : maleLines;
          const chosenLine =
            linePool[Math.floor(Math.random() * linePool.length)];
          speaker.speechText = chosenLine;
          speaker.speechTimer = 3.4;
          speakNpcBubble(chosenLine, speaker.name, speaker.gender);
        }
      }

      // ----------------------------------------------------------------------
      // A. POLL HTML5 GAMEPAD API DIRECTLY IN GAME LOOP
      // ----------------------------------------------------------------------
      let padAxisX = 0;
      let padAxisY = 0;
      let padThrottle = 0;

      if (typeof navigator.getGamepads === 'function') {
        const pads = navigator.getGamepads();
        const activePad = pads
          ? pads[0] || pads[1] || pads[2] || pads[3]
          : null;
        if (activePad && activePad.connected) {
          gamepadConnected = true;
          gamepadName = activePad.id;

          const rawX = activePad.axes[0] || 0;
          const rawY = activePad.axes[1] || 0;
          const deadzone = 0.15;
          if (Math.hypot(rawX, rawY) > deadzone) {
            padAxisX = rawX;
            padAxisY = rawY;
          }

          if (activePad.buttons[12]?.pressed) padAxisY = -1;
          if (activePad.buttons[13]?.pressed) padAxisY = 1;
          if (activePad.buttons[14]?.pressed) padAxisX = -1;
          if (activePad.buttons[15]?.pressed) padAxisX = 1;

          if (activePad.buttons[7]?.value > 0.1) {
            padThrottle = activePad.buttons[7].value;
          }

          const isPressed = (idx: number) =>
            Boolean(activePad.buttons[idx]?.pressed);
          if (isPressed(0) && !prevPadButtons[0]) {
            if (!p.isCurtainOpen) p.onEnterHallFromGamepad();
            else triggerPlayerJump();
          }
          if (isPressed(1) && !prevPadButtons[1]) {
            triggerPlayer360Spin();
          }
          if (
            (isPressed(2) && !prevPadButtons[2]) ||
            (isPressed(5) && !prevPadButtons[5])
          ) {
            triggerInteractOrThrowBall();
          }
          if (isPressed(3) && !prevPadButtons[3]) {
            p.onToggleCamera();
          }
          if (isPressed(8) && !prevPadButtons[8]) {
            p.onToggleShowNames();
          }
          if (isPressed(9) && !prevPadButtons[9]) {
            if (!p.isCurtainOpen) p.onEnterHallFromGamepad();
            else p.onOpenChronicleModal();
          }

          // Gamepad Right-Stick (or Left-Stick fallback) updates aiming target in Ballspiel
          const aimRawX = activePad.axes[2] || 0;
          const aimRawY = activePad.axes[3] || 0;
          if (Math.hypot(aimRawX, aimRawY) > 0.2) {
            mouseWorldX = player.x + aimRawX * 220;
            mouseWorldY = player.y + aimRawY * 220;
            hasMouseMovedOnCanvas = true;
          } else if (Math.hypot(padAxisX, padAxisY) > 0.2) {
            mouseWorldX = player.x + padAxisX * 190;
            mouseWorldY = player.y + padAxisY * 190;
          }

          for (let b = 0; b < 16; b++) {
            prevPadButtons[b] = isPressed(b);
          }
        }
      }

      // Apply drink speed boost triggered from the player's Spind inventory ("Trinken")
      if (pendingLockerDrinkBoostRef.current) {
        pendingLockerDrinkBoostRef.current = false;
        player.slushRemainingSec = Math.max(player.slushRemainingSec, 45);
        player.blobaColaRemainingSec = Math.max(player.blobaColaRemainingSec, 35);
        player.speechBubble =
          '🥤 Spind-Drink getrunken! Voller Turbo-Boost auf der Bahn!';
        player.speechTimer = 3.2;
        soundFX.playDrinkRefresh();
      }

      // Apply direct event start-position teleport triggered from Spind Tab C ("Live-Events & Shows")
      if (pendingTeleportRef.current) {
        const tp = pendingTeleportRef.current;
        pendingTeleportRef.current = null;
        player.x = tp.x;
        player.y = tp.y;
        player.vx = 0;
        player.vy = 0;
        if (typeof tp.headingRad === 'number') {
          player.headingRad = tp.headingRad;
        }
        player.speechBubble = tp.label
          ? `🎪 Direkt zum Startpunkt: ${tp.label}!`
          : '🛼 Direkt zur Startposition auf der Bahn!';
        player.speechTimer = 3.0;
        soundFX.playChallengeUnlocked();
      }

      // ----------------------------------------------------------------------
      // B. UPDATE PLAYER TIMERS, WAX PATCH, STAGE ANIMATION & JUMP ARC
      // ----------------------------------------------------------------------
      if (player.slushRemainingSec > 0) {
        player.slushRemainingSec = Math.max(0, player.slushRemainingSec - dt);
      }
      if (player.blobaColaRemainingSec > 0) {
        player.blobaColaRemainingSec = Math.max(
          0,
          player.blobaColaRemainingSec - dt
        );
      }
      if (player.speechTimer > 0) {
        player.speechTimer = Math.max(0, player.speechTimer - dt);
        if (player.speechTimer === 0) player.speechBubble = null;
      }
      if (player.crashTimer > 0) {
        player.crashTimer = Math.max(0, player.crashTimer - dt);
      }
      if (player.bumpCooldownTimer > 0) {
        player.bumpCooldownTimer = Math.max(0, player.bumpCooldownTimer - dt);
      }
      if (player.medicRescueTimer > 0) {
        player.medicRescueTimer = Math.max(0, player.medicRescueTimer - dt);
      }

      // Update Nurse / Paramedic ("Schwester Gudrun") Rescue Sequence (via nearest Schleusen-Bande!)
      if (saniNurse.active) {
        const nurseLabel = p.crewNames?.nurse || 'Schwester Gudrun';
        saniNurse.phaseTimer += dt;
        if (saniNurse.phase === 'running-in') {
          saniNurse.targetX = Math.max(330, Math.min(1670, player.x + 28));
          saniNurse.targetY = Math.max(145, Math.min(825, player.y + 10));
          const progress = Math.min(
            1,
            saniNurse.phaseTimer / saniNurse.phaseDuration
          );
          if (progress < 0.35) {
            const sub = progress / 0.35;
            saniNurse.x =
              saniNurse.startX + (saniNurse.gateX - saniNurse.startX) * sub;
            saniNurse.y =
              saniNurse.startY + (saniNurse.gateY - saniNurse.startY) * sub;
            saniNurse.headingRad = Math.atan2(
              saniNurse.gateY - saniNurse.startY,
              saniNurse.gateX - saniNurse.startX
            );
          } else {
            const sub = (progress - 0.35) / 0.65;
            saniNurse.x =
              saniNurse.gateX + (saniNurse.targetX - saniNurse.gateX) * sub;
            saniNurse.y =
              saniNurse.gateY + (saniNurse.targetY - saniNurse.gateY) * sub;
            saniNurse.headingRad = Math.atan2(
              saniNurse.targetY - saniNurse.gateY,
              saniNurse.targetX - saniNurse.gateX
            );
          }
          if (player.crashTimer > 0 && player.crashTimer < 0.4) {
            player.crashTimer = 0.4;
          }
          if (progress >= 1) {
            saniNurse.phase = 'kneeling';
            saniNurse.phaseTimer = 0;
            saniNurse.phaseDuration = 3.5;
            saniNurse.speechText = saniNurse.withStretcherTeam
              ? `🚑 ${nurseLabel}: „10x gerempelt! Ab auf die Trage zum Durchchecken!“`
              : `🧊 Erste Hilfe: ${nurseLabel} legt ein Kühlpack & Eisspray auf!`;
            speakNpcBubble(saniNurse.speechText, nurseLabel, 'female');
            player.crashTimer = Math.max(player.crashTimer, 3.2);
            player.speechBubble = `🧊 Danke für die Pflege, ${nurseLabel}!`;
            player.speechTimer = 3.2;
          }
        } else if (saniNurse.phase === 'kneeling') {
          saniNurse.x = Math.max(330, Math.min(1670, player.x + 28));
          saniNurse.y = Math.max(145, Math.min(825, player.y + 10));
          saniNurse.headingRad = Math.atan2(
            player.y - saniNurse.y,
            player.x - saniNurse.x
          );
          if (saniNurse.phaseTimer >= saniNurse.phaseDuration) {
            saniNurse.phase = 'walking-out';
            saniNurse.phaseTimer = 0;
            saniNurse.phaseDuration = 3.2;
            saniNurse.targetX = saniNurse.x;
            saniNurse.targetY = saniNurse.y;
            saniNurse.speechText = `👍 ${nurseLabel}: „Wieder fit! Gute Weiterfahrt!“`;
            speakNpcBubble(saniNurse.speechText, nurseLabel, 'female');
            player.crashTimer = 0;
            player.medicRescueTimer = 0;
          }
        } else if (saniNurse.phase === 'walking-out') {
          const progress = Math.min(
            1,
            saniNurse.phaseTimer / saniNurse.phaseDuration
          );
          if (progress < 0.65) {
            const sub = progress / 0.65;
            saniNurse.x =
              saniNurse.targetX + (saniNurse.gateX - saniNurse.targetX) * sub;
            saniNurse.y =
              saniNurse.targetY + (saniNurse.gateY - saniNurse.targetY) * sub;
            saniNurse.headingRad = Math.atan2(
              saniNurse.gateY - saniNurse.targetY,
              saniNurse.gateX - saniNurse.targetX
            );
          } else {
            const sub = (progress - 0.65) / 0.35;
            saniNurse.x =
              saniNurse.gateX + (saniNurse.startX - saniNurse.gateX) * sub;
            saniNurse.y =
              saniNurse.gateY + (saniNurse.startY - saniNurse.gateY) * sub;
            saniNurse.headingRad = Math.atan2(
              saniNurse.startY - saniNurse.gateY,
              saniNurse.startX - saniNurse.gateX
            );
          }
          if (progress >= 1) {
            saniNurse.active = false;
            saniNurse.phase = 'idle';
            saniNurse.speechText = null;
          }
        }
      }

      // Smoothly animate collapsible Center Stage (`[` & `]` sliding together horizontally)
      const activeCenterMode = centerArenaRef.current;
      const targetStage = activeCenterMode === 'islands' ? 0 : 1;
      stageCloseProgress +=
        (targetStage - stageCloseProgress) * Math.min(1, dt * 3.5);

      // Handle external HUD button trick trigger
      if (pendingTrickRef.current) {
        const move = pendingTrickRef.current;
        pendingTrickRef.current = null;
        triggerTrickMove(move);
      }

      // Update active trick move timer
      if (player.trickTimer > 0) {
        player.trickTimer = Math.max(0, player.trickTimer - dt);
        if (player.trickTimer === 0) {
          player.activeTrickMove = null;
        }
      }

      // Periodically relocate unannounced Floor Wax Slip Zone (Bohnerwachs-Rutschzone)
      waxPatch.relocateTimer -= dt;
      if (waxPatch.relocateTimer <= 0) {
        waxPatch.relocateTimer = 24 + Math.random() * 14;
        const spots = [
          { x: 1250, y: 695 },
          { x: 710, y: 225 },
          { x: 1280, y: 265 },
          { x: 700, y: 705 },
        ];
        const pick = spots[Math.floor(Math.random() * spots.length)];
        waxPatch.x = pick.x;
        waxPatch.y = pick.y;
      }

      // Compact Jump physics (~38% shorter duration via steeper gravity 920) + 0.25s post-landing cooldown
      if (player.jumpCooldownTimer > 0) {
        player.jumpCooldownTimer = Math.max(0, player.jumpCooldownTimer - dt);
      }
      if (player.isJumping) {
        player.jumpZ += player.jumpVz * dt;
        player.jumpVz -= 920 * dt;
        if (player.jumpZ <= 0) {
          player.jumpZ = 0;
          player.jumpVz = 0;
          player.isJumping = false;
          player.jumpCooldownTimer = 0.25;
        }
      }

      // 360° Spin animation
      if (player.isSpinning) {
        const spinSpeed = player.isOnWaxPatch ? Math.PI * 8.5 : Math.PI * 5.4;
        player.spinAngleOffset += spinSpeed * dt;
        if (player.spinAngleOffset >= Math.PI * 2) {
          player.spinAngleOffset = 0;
          player.isSpinning = false;
        }
      }

      // ----------------------------------------------------------------------
      // C. PLAYER MOVEMENT, OWN SKATES BONUS vs. STREET SHOES & UPGRADES
      // ----------------------------------------------------------------------
      const keyUp = keysDown['w'] || keysDown['arrowup'] || keysDown['KeyW'];
      const keyDown =
        keysDown['s'] || keysDown['arrowdown'] || keysDown['KeyS'];
      const keyLeft =
        keysDown['a'] || keysDown['arrowleft'] || keysDown['KeyA'];
      const keyRight =
        keysDown['d'] || keysDown['arrowright'] || keysDown['KeyD'];

      const rc = p.remoteControllerInputRef?.current;
      if (rc) {
        if (rc.jump) {
          rc.jump = false;
          if (!p.isCurtainOpen) p.onEnterHallFromGamepad();
          else triggerPlayerJump();
        }
        if (rc.spin) {
          rc.spin = false;
          triggerPlayer360Spin();
        }
        if (rc.interact) {
          rc.interact = false;
          triggerInteractOrThrowBall();
        }
        if (rc.trickMove) {
          const mv = rc.trickMove;
          rc.trickMove = null;
          triggerTrickMove(mv);
        }
      }

      let inputX =
        (keyRight ? 1 : 0) - (keyLeft ? 1 : 0) + padAxisX + (rc ? rc.dx : 0);
      let inputY =
        (keyDown ? 1 : 0) - (keyUp ? 1 : 0) + padAxisY + (rc ? rc.dy : 0);
      const inputMag = Math.hypot(inputX, inputY);
      if (inputMag > 1) {
        inputX /= inputMag;
        inputY /= inputMag;
      }

      // Play metallic 80s Skate-Bell jingle when 'bell' charm is equipped and rolling
      if (p.upgrades.activeCharm === 'bell' && hasSkatesEquipped) {
        const curSpd = Math.hypot(player.vx, player.vy);
        if (curSpd > 55 || player.isJumping || player.isSpinning) {
          skateBellRingTimer -= dt;
          if (skateBellRingTimer <= 0) {
            skateBellRingTimer = player.isSpinning
              ? 0.22
              : Math.max(0.32, 0.85 - (curSpd / 420) * 0.45);
            soundFX.playSkateBellJingle();
          }
        }
      }

      const waxDx = (player.x - waxPatch.x) / waxPatch.radiusX;
      const waxDy = (player.y - waxPatch.y) / waxPatch.radiusY;
      player.isOnWaxPatch =
        hasSkatesEquipped && waxDx * waxDx + waxDy * waxDy <= 1.0;

      // Own Skates ("Eigene Rollschuhe") grant sportier acceleration (+10%) & cornering (+12%),
      // whereas Street Shoes (!hasSkatesEquipped) walk slowly on the outer carpet until visiting Rollschuh-Verleih!
      const ownSkatesSpeedBonus = p.hasOwnSkates ? 1.07 : 1.0;
      const ownSkatesAccelBonus = p.hasOwnSkates ? 1.11 : 1.0;
      const streetShoesPenalty = hasSkatesEquipped ? 1.0 : 0.52;

      const bearingsMult = p.upgrades.bearingsAbec9 ? 1.18 : 1.0;
      const platesMult = p.upgrades.aluPlatesHighTop ? 1.16 : 1.0;
      const slushMult = player.slushRemainingSec > 0 ? 1.14 : 1.0;
      const blobaMult = player.blobaColaRemainingSec > 0 ? 1.15 : 1.0;
      const slipstreamMult = player.isSlipstreamActive ? 1.22 : 1.0;

      const vipDiscoMult = p.vipDiscoSkatesEquipped ? 1.08 : 1.0;
      const isSlowSkateDirection =
        p.skateDirection === 'cw' || p.lightingMode === 'slow-skating';
      const isManualSlowCruise =
        Boolean(p.manualSlowCruiseActive) ||
        Boolean(keysDown['shift'] || keysDown['ShiftLeft'] || keysDown['ShiftRight']);
      const slowSkateThrottleMult =
        isSlowSkateDirection || isManualSlowCruise ? 0.45 : 1.0;
      const slalomSpeedBonusMult =
        p.hallGameMode === 'slalom'
          ? 1 + Math.min(0.8, slalomRoundsCompleted * 0.08)
          : 1.0;
      const maxSpeed =
        355 *
        ownSkatesSpeedBonus *
        vipDiscoMult *
        streetShoesPenalty *
        bearingsMult *
        slushMult *
        slipstreamMult *
        slowSkateThrottleMult *
        slalomSpeedBonusMult;
      const airControlMult = player.isJumping ? 0.65 : 1.0;
      const preSpeedForAccel = Math.hypot(player.vx, player.vy);
      const gentleStartMult =
        preSpeedForAccel < 95 ? 0.65 + (preSpeedForAccel / 95) * 0.35 : 1.0;
      const accel =
        405 *
        gentleStartMult *
        ownSkatesAccelBonus *
        (hasSkatesEquipped ? 1.0 : 0.72) *
        platesMult *
        blobaMult *
        airControlMult;

      if (player.crashTimer <= 0 && player.medicRescueTimer <= 0) {
        if (inputMag > 0.05) {
          player.vx += inputX * accel * dt;
          player.vy += inputY * accel * dt;

          const currentSpeed = Math.hypot(player.vx, player.vy);
          if (
            player.isOnWaxPatch &&
            !p.upgrades.highGripWheels &&
            currentSpeed > 230 &&
            !player.isJumping
          ) {
            const velAngle = Math.atan2(player.vy, player.vx);
            const inputAngle = Math.atan2(inputY, inputX);
            if (Math.abs(normalizeAngle(inputAngle - velAngle)) > 2.15) {
              player.crashTimer = 3.2;
              player.speechBubble = 'Huch, frisch gebohnert!';
              player.speechTimer = 2.8;
              player.totalCrashes += 1;
              player.consecutiveCrashes += 1;
              soundFX.playCrash(false);
              triggerSaniNurseDispatch(player.x, player.y);
            }
          }
        } else if (padThrottle > 0.1) {
          player.vx += Math.cos(player.headingRad) * accel * padThrottle * dt;
          player.vy += Math.sin(player.headingRad) * accel * padThrottle * dt;
        }
      }

      const baseFriction = !hasSkatesEquipped
        ? 0.92
        : player.isOnWaxPatch
        ? p.upgrades.highGripWheels
          ? 0.991
          : 0.9965
        : p.upgrades.bearingsAbec9
        ? 0.9915
        : p.hasOwnSkates
        ? 0.99
        : 0.9885;
      const frameDrag = Math.pow(baseFriction, dt * 60);
      player.vx *= frameDrag;
      player.vy *= frameDrag;

      const speed = Math.hypot(player.vx, player.vy);
      if (speed > maxSpeed) {
        player.vx = (player.vx / speed) * maxSpeed;
        player.vy = (player.vy / speed) * maxSpeed;
      }

      // Park- & Schutz-Modus während eines 80er-Arcade-Spiels an der DJ-Kanzel:
      // Spieler wird automatisch sicher in der Arcade-Nische (148, 304) geparkt und ist vor Bällen & Remplern geschützt!
      if (p.isPlayingArcade) {
        player.x = 148;
        player.y = 304;
        player.vx = 0;
        player.vy = 0;
        player.headingRad = -Math.PI / 2;
        player.crashTimer = 0;
        player.medicRescueTimer = 0;
      } else {
        player.x += player.vx * dt;
        player.y += player.vy * dt;

        if (speed > 8) {
          const targetHeading = Math.atan2(player.vy, player.vx);
          const turnRate = p.hasOwnSkates ? 13.0 : 11.5;
          player.headingRad = rotateShortest(
            player.headingRad,
            targetHeading,
            dt * turnRate
          );
          player.stridePhase += speed * dt * 0.032;
        }
      }

      // Prevent stepping onto the wooden rink parquet through the Schleusen-Banden in street shoes (!hasSkatesEquipped)
      const { rink, djTower, gates } = ARENA_LAYOUT;
      const inLeftSchleuse =
        player.x >= gates.bottomLeftSchwingtuer.xStart - 16 &&
        player.x <= gates.bottomLeftSchwingtuer.xEnd + 16;
      const inRightSchleuse =
        player.x >= gates.bottomRightEntrance.xStart - 16 &&
        player.x <= gates.bottomRightEntrance.xEnd + 16;
      if (
        !hasSkatesEquipped &&
        (inLeftSchleuse || inRightSchleuse) &&
        player.y < rink.y + rink.height + player.radius + 4 &&
        player.y > rink.y + rink.height - 90
      ) {
        player.y = rink.y + rink.height + player.radius + 4;
        player.vy = Math.max(0, player.vy);
        if (player.speechTimer <= 0.4) {
          player.speechBubble =
            p.mobilitySelected === false
              ? '🚧 Schranke verriegelt: Bitte wähle erst deine Rollschuhe, Leihrollschuhe oder Rollstuhl!'
              : '🛑 Bitte wähle erst deine Rollschuhe! Am ROLLSCHUHVERLEIH [E] Leih-Skates holen!';
          player.speechTimer = 3.2;
          speakNpcBubble(
            'Halt! Bitte wähle erst deine Rollschuhe, Leihrollschuhe oder den Rollstuhl vor dem Bahneintritt!',
            'SKATE GUARD MANNI',
            'male'
          );
        }
      }

      // Record Neon Underglow, Flamingo Slide, or Slush / Bloba Wheel Trails on the Parquet
      const isFlamingoActive = player.activeTrickMove === 'flamingo';
      if (
        hasSkatesEquipped &&
        speed > 30 &&
        player.jumpZ <= 2 &&
        (p.upgrades.underglowEnabled ||
          isFlamingoActive ||
          player.slushRemainingSec > 0 ||
          player.blobaColaRemainingSec > 0)
      ) {
        const perpX = -Math.sin(player.headingRad) * 14;
        const perpY = Math.cos(player.headingRad) * 14;
        const lx = player.x + perpX;
        const ly = player.y + perpY;
        const rx = player.x - perpX;
        const ry = player.y - perpY;

        const colorMap: Record<string, string> = {
          pink: '#ff2a85',
          cyan: '#00f0ff',
          green: '#39ff14',
          gold: '#fde047',
        };
        const trailCol = isFlamingoActive
          ? '#ff2a85'
          : player.slushRemainingSec > 0
          ? '#00f0ff'
          : player.blobaColaRemainingSec > 0
          ? '#f59e0b'
          : colorMap[p.upgrades.underglowColor] || '#00f0ff';

        if (prevLeftWheel && prevRightWheel) {
          trails.push({
            x1: prevLeftWheel.x,
            y1: prevLeftWheel.y,
            x2: lx,
            y2: ly,
            color: trailCol,
            alpha: isFlamingoActive ? 0.85 : 0.55,
            width: isFlamingoActive ? 6.5 : 4,
          });
          if (!isFlamingoActive) {
            trails.push({
              x1: prevRightWheel.x,
              y1: prevRightWheel.y,
              x2: rx,
              y2: ry,
              color: trailCol,
              alpha: 0.55,
              width: 4,
            });
          }
          if (trails.length > 220) trails.splice(0, 2);
        }
        prevLeftWheel = { x: lx, y: ly };
        prevRightWheel = { x: rx, y: ry };
      } else {
        prevLeftWheel = null;
        prevRightWheel = null;
      }

      // ----------------------------------------------------------------------
      // D. ARENA WALLS, CURVED DJ-TOWER, ROTATED U-ISLANDS (`[` & `]`), 2 GATES
      // ----------------------------------------------------------------------
      resolvePlayerArenaCollisions(player, stageCloseProgress);

      // ----------------------------------------------------------------------
      // E. COUNTER-CLOCKWISE LAP DETECTION & VIP EGO-VIEW CHECK
      // ----------------------------------------------------------------------
      const onRinkFloor =
        hasSkatesEquipped &&
        player.x > rink.x + 20 &&
        player.x < rink.x + rink.width - 20 &&
        player.y > rink.y + 20 &&
        player.y < rink.y + rink.height - 20;

      if (onRinkFloor) {
        p.onIntroStepComplete?.('skate_rink');
        p.onCertificateEvent?.('skate_rink');
        if (player.y < rink.centerY - 105 && player.vx < -20) {
          player.passedTopHalf = true;
        }
        if (
          player.y > rink.centerY + 105 &&
          player.vx > 20 &&
          player.passedTopHalf
        ) {
          player.passedTopHalf = false;
          player.laps += 1;
          player.cleanLapsStreak += 1;
          p.onChallengeProgress(
            'endurance_20_laps',
            player.cleanLapsStreak,
            true
          );
        }
      }

      const distDj = Math.hypot(
        player.x - djTower.egoTriggerX,
        player.y - djTower.egoTriggerY
      );
      if (distDj <= djTower.egoTriggerRadius && p.cameraMode === 'ego') {
        p.onChallengeProgress('vip_ego_view', 1);
      }

      // ----------------------------------------------------------------------
      // F. UPDATE TRACK NPCS (SKIPPED IN MULTIPLAYER SO THE RINK BELONGS EXCLUSIVELY TO REAL PLAYERS!)
      //    & INTERPOLATE CONNECTED REMOTE HUMAN PLAYERS
      // ----------------------------------------------------------------------
      player.isSlipstreamActive = false;

      // Sync & smoothly interpolate connected remote human players
      const incomingRemotes = p.remotePlayers || [];
      const activeRemoteIds = new Set<string>();
      for (const rp of incomingRemotes) {
        activeRemoteIds.add(rp.peerId);
        const existing = remotePlayersMap.get(rp.peerId);
        if (!existing) {
          remotePlayersMap.set(rp.peerId, {
            ...rp,
            renderX: rp.x,
            renderY: rp.y,
            renderHeading: rp.headingRad + (rp.spinAngleOffset || 0),
            renderJumpZ: rp.jumpZ || 0,
          });
        } else {
          const predX = rp.x + (rp.vx || 0) * Math.min(0.05, dt * 0.5);
          const predY = rp.y + (rp.vy || 0) * Math.min(0.05, dt * 0.5);
          const distJump = Math.hypot(
            predX - existing.renderX,
            predY - existing.renderY
          );
          const lerpFactor = Math.min(1, dt * 15);
          const nextRenderX =
            distJump > 260
              ? rp.x
              : existing.renderX + (predX - existing.renderX) * lerpFactor;
          const nextRenderY =
            distJump > 260
              ? rp.y
              : existing.renderY + (predY - existing.renderY) * lerpFactor;
          const nextHeading = rotateShortest(
            existing.renderHeading,
            rp.headingRad + (rp.spinAngleOffset || 0),
            dt * 18
          );
          const nextJumpZ =
            existing.renderJumpZ +
            ((rp.jumpZ || 0) - existing.renderJumpZ) * Math.min(1, dt * 16);

          remotePlayersMap.set(rp.peerId, {
            ...rp,
            renderX: nextRenderX,
            renderY: nextRenderY,
            renderHeading: nextHeading,
            renderJumpZ: nextJumpZ,
          });
        }
      }
      for (const oldId of Array.from(remotePlayersMap.keys())) {
        if (!activeRemoteIds.has(oldId)) {
          remotePlayersMap.delete(oldId);
        }
      }

      if (
        !p.isMultiplayerActive &&
        p.hallGameMode !== 'stuhlsprung' &&
        onRinkFloor &&
        speed < 12 &&
        player.medicRescueTimer <= 0
      ) {
        player.afkSecondsOnTrack += dt;
      } else {
        player.afkSecondsOnTrack = 0;
        player.guardEscortActive = false;
      }

      const isSlowSkating = p.lightingMode === 'slow-skating';
      const isClockwiseSkate =
        p.skateDirection === 'cw' || isSlowSkating;
      const isSpringerStaffelShow =
        p.hallGameMode === 'springerstaffel' ||
        Boolean(p.springerStaffelShowActive);

      if (!p.isMultiplayerActive) {
        // Keep all skaters on the closed oval track (no barrier-sitting criss-crossing across the rink!)
        if (activeBarrierSitterId) {
          trackNpcs.forEach((n) => {
            n.sittingBarrierSpot = null;
          });
          activeBarrierSitterId = null;
        }
        const activeSitterNpc: TrackNpc | null = null;
        const assignedBarrierGuardId: string | null = null;

        // Romantic Slow-Skating Couples Definition (3 couples skating synchronously, 1 partner backwards facing the other at a clean fixed distance!)
        const slowSkateCouples: Record<
          string,
          {
            leaderId: string;
            isBackwardsPartner: boolean;
            rx: number;
            ry: number;
            orbitSpeed: number;
          }
        > = {
          'reg-1': {
            leaderId: 'reg-1',
            isBackwardsPartner: false,
            rx: 482,
            ry: 238,
            orbitSpeed: 0.34,
          },
          'reg-2': {
            leaderId: 'reg-1',
            isBackwardsPartner: true,
            rx: 482,
            ry: 238,
            orbitSpeed: 0.34,
          },
          'speed-3': {
            leaderId: 'speed-3',
            isBackwardsPartner: false,
            rx: 642,
            ry: 322,
            orbitSpeed: 0.36,
          },
          'speed-2': {
            leaderId: 'speed-3',
            isBackwardsPartner: true,
            rx: 642,
            ry: 322,
            orbitSpeed: 0.36,
          },
          'speed-1': {
            leaderId: 'speed-1',
            isBackwardsPartner: false,
            rx: 564,
            ry: 282,
            orbitSpeed: 0.35,
          },
          'speed-4': {
            leaderId: 'speed-1',
            isBackwardsPartner: true,
            rx: 564,
            ry: 282,
            orbitSpeed: 0.35,
          },
        };

        // Periodic synchronized 4-5 skater Shuffle-Skate-Train in Free-Skate mode (paused during Ballspiel / Slow-Skating)
        let isShuffleTrainActive = false;
        if (p.hallGameMode === 'free-skate' && !isSlowSkating) {
          if (shuffleTrainActiveSec > 0) {
            shuffleTrainActiveSec = Math.max(0, shuffleTrainActiveSec - dt);
            isShuffleTrainActive = true;
          } else {
            shuffleTrainTimer -= dt;
            if (shuffleTrainTimer <= 0) {
              shuffleTrainActiveSec = 11.5;
              shuffleTrainTimer = 18.0 + Math.random() * 8.0;
              isShuffleTrainActive = true;
            }
          }
        } else {
          shuffleTrainActiveSec = 0;
        }
        const shuffleTrainMemberIds = isShuffleTrainActive
          ? ['reg-2', 'reg-4', 'reg-6', 'reg-8']
          : [];

        // Lebendige Wegpunkt-Routinen (Snack-Bar, Spinde, WC-Flur) & Kult-KI-Sprüche im Free-Skate-Modus
        if (
          p.hallGameMode === 'free-skate' &&
          !isSlowSkating &&
          !isSpringerStaffelShow &&
          !p.buildModeEnabled
        ) {
          excursionTriggerTimer -= dt;
          if (excursionTriggerTimer <= 0) {
            excursionTriggerTimer = 11.0 + Math.random() * 6.0;
            const activeExcursions = trackNpcs.filter(
              (n) => n.excursionPhase && n.excursionPhase !== 'idle'
            ).length;
            if (activeExcursions < 2) {
              const candidates = trackNpcs.filter(
                (n) =>
                  n.role !== 'guard' &&
                  (!n.excursionPhase || n.excursionPhase === 'idle') &&
                  !shuffleTrainMemberIds.includes(n.id) &&
                  n.y > 580
              );
              if (candidates.length > 0) {
                const chosen =
                  candidates[Math.floor(Math.random() * candidates.length)];
                const spots: {
                  id: 'snackbar' | 'lockers' | 'wc';
                  x: number;
                  y: number;
                  gate: 'left' | 'right';
                  startBubble: string;
                }[] = [
                  {
                    id: 'snackbar',
                    x: 565,
                    y: 932,
                    gate: 'left',
                    startBubble: '🥤 Kurz zur Snack-Bar auf ein Slush-Puppie!',
                  },
                  {
                    id: 'lockers',
                    x: 1585,
                    y: 934,
                    gate: 'right',
                    startBubble: '🗄️ Kurz an die Schließfächer!',
                  },
                  {
                    id: 'wc',
                    x: 118,
                    y: 854,
                    gate: 'left',
                    startBubble: '🚰 Kurzer Boxenstopp im Vorbereich!',
                  },
                ];
                const pickSpot =
                  spots[Math.floor(Math.random() * spots.length)];
                chosen.excursionPhase = 'exiting-rink';
                chosen.excursionSpotId = pickSpot.id;
                chosen.excursionTargetX = pickSpot.x;
                chosen.excursionTargetY = pickSpot.y;
                chosen.excursionGateSide = pickSpot.gate;
                chosen.excursionPauseTimer = 0;
                chosen.speechText = pickSpot.startBubble;
                chosen.speechTimer = 3.2;
              }
            }
          }

          cultChatterTimer -= dt;
          if (cultChatterTimer <= 0) {
            cultChatterTimer = 9.5 + Math.random() * 5.5;
            const cultIds = [
              'cult-skate-cat',
              'cult-walkman-moni',
              'cult-breakdance-benni',
            ];
            const pickId =
              cultIds[Math.floor(Math.random() * cultIds.length)];
            const cultNpc = trackNpcs.find((n) => n.id === pickId);
            if (
              cultNpc &&
              (!cultNpc.excursionPhase || cultNpc.excursionPhase === 'idle') &&
              cultNpc.speechTimer <= 0
            ) {
              if (pickId === 'cult-skate-cat') {
                const catQuotes = [
                  '🐱 Miau! Samtpfoten auf acht Sims-Rollen!',
                  '🐾 Schnurr-Kurvenlage im Palladium Hanau!',
                  '😺 Die Hallenkatze rollt immer auf der Ideallinie!',
                ];
                cultNpc.speechText =
                  catQuotes[Math.floor(Math.random() * catQuotes.length)];
                cultNpc.speechTimer = 3.8;
              } else if (pickId === 'cult-walkman-moni') {
                const moniQuotes = [
                  '🎧 Walkman-Kassette Seite B – Italo-Disco auf Anschlag!',
                  '📻 Frische Batterien im Walkman & Neon-Stulpen an!',
                  '🎶 Boah, dieser Bass von DJ Magic Force!',
                ];
                cultNpc.speechText =
                  moniQuotes[Math.floor(Math.random() * moniQuotes.length)];
                cultNpc.speechTimer = 3.8;
              } else if (pickId === 'cult-breakdance-benni') {
                const benniQuotes = [
                  '🕺 Electric Boogie & 360°-Spin an der Bande!',
                  '⚡ Breakdance-Freeze auf acht Rollen!',
                  '🔥 Hanau ’86 – zeig mir deinen besten Spin!',
                ];
                cultNpc.speechText =
                  benniQuotes[Math.floor(Math.random() * benniQuotes.length)];
                cultNpc.speechTimer = 3.8;
                if ((cultNpc.jumpZ || 0) === 0) {
                  cultNpc.jumpVz = 195;
                }
              }
            }
          }
        } else {
          // Reset any active excursion cleanly when switching to a hall game mode
          for (const n of trackNpcs) {
            if (n.excursionPhase && n.excursionPhase !== 'idle') {
              n.excursionPhase = 'idle';
            }
          }
        }

        // Pre-enforce minimum longitudinal & lateral separation between solo AI skaters on the oval (45–50 px spacing, smooth lane overtaking)
        const soloNpcs = trackNpcs.filter(
          (n) =>
            !n.sittingBarrierSpot &&
            !n.eliminated &&
            n.hitOutTimer <= 0 &&
            p.hallGameMode !== 'ballspiel' &&
            !(isSlowSkating && slowSkateCouples[n.id]?.isBackwardsPartner) &&
            !shuffleTrainMemberIds.includes(n.id)
        );
        for (let i = 0; i < soloNpcs.length; i++) {
          const a = soloNpcs[i];
          a.laneOffset = (a.laneOffset || 0) * Math.pow(0.25, dt);
          for (let j = i + 1; j < soloNpcs.length; j++) {
            const b = soloNpcs[j];
            const laneDiff = Math.abs(
              a.laneRadiusX + (a.laneOffset || 0) - (b.laneRadiusX + (b.laneOffset || 0))
            );
            if (laneDiff < 70 || isSlowSkating) {
              const angDiff = normalizeAngle(a.orbitAngle - b.orbitAngle);
              const minAngGap =
                a.role === 'speed' && !isSlowSkating ? 0.18 : 0.28;
              if (Math.abs(angDiff) < minAngGap) {
                const push = (minAngGap - Math.abs(angDiff)) * 0.55 * dt;
                if (angDiff >= 0) {
                  a.orbitAngle = normalizeAngle(a.orbitAngle + push);
                  b.orbitAngle = normalizeAngle(b.orbitAngle - push);
                } else {
                  a.orbitAngle = normalizeAngle(a.orbitAngle - push);
                  b.orbitAngle = normalizeAngle(b.orbitAngle + push);
                }
                // Lateral lane-change steering so faster skaters cleanly overtake on neighboring lane
                if (!isSlowSkating) {
                  a.laneOffset = Math.max(-42, Math.min(42, (a.laneOffset || 0) + 28 * dt));
                  b.laneOffset = Math.max(-42, Math.min(42, (b.laneOffset || 0) - 28 * dt));
                }
              }
            }
          }
        }

        trackNpcs.forEach((npc, npcIdx) => {
          // Dynamically apply custom crew names to guard-1 and guard-2
          if (npc.id === 'guard-1') {
            npc.name =
              p.crewNames?.skateGuard || DEFAULT_CREW_NAMES.skateGuard;
          } else if (npc.id === 'guard-2') {
            npc.name =
              p.crewNames?.rollerTeacher || DEFAULT_CREW_NAMES.rollerTeacher;
          }

          if (npc.speechTimer > 0) {
            npc.speechTimer = Math.max(0, npc.speechTimer - dt);
            if (npc.speechTimer === 0) npc.speechText = null;
          }

          // Rule #1: When Baumenü (Build Mode) is active, pause AI movement so skaters can be clicked & dragged cleanly!
          if (p.buildModeEnabled) {
            npc.vx = 0;
            npc.vy = 0;
            npc.jumpZ = 0;
            npc.jumpVz = 0;
            return;
          }

          if (npc.crashTimer > 0) {
            npc.crashTimer = Math.max(0, npc.crashTimer - dt);
            return;
          }

          // Update individual AI jump arc if jumping
          if ((npc.jumpZ || 0) > 0 || (npc.jumpVz || 0) > 0) {
            npc.jumpZ = (npc.jumpZ || 0) + (npc.jumpVz || 0) * dt;
            npc.jumpVz = (npc.jumpVz || 0) - 880 * dt;
            if ((npc.jumpZ || 0) <= 0) {
              npc.jumpZ = 0;
              npc.jumpVz = 0;
            }
          } else if (
            p.hallGameMode === 'free-skate' &&
            !isSlowSkating &&
            npc.role !== 'guard' &&
            !shuffleTrainMemberIds.includes(npc.id) &&
            Math.random() < dt * 0.045
          ) {
            // Occasional individual jump or 360° spin trick by solo skaters on the track
            npc.jumpVz = 185;
          }

          if (p.hallGameMode === 'stuhlsprung') {
            const spot =
              barrierSpectatorSpots[npcIdx % barrierSpectatorSpots.length];
            npc.x += (spot.x - npc.x) * Math.min(1, dt * 4.5);
            npc.y += (spot.y - npc.y) * Math.min(1, dt * 4.5);
            npc.vx = 0;
            npc.vy = 0;
            const lookToPlayer = Math.atan2(player.y - npc.y, player.x - npc.x);
            npc.headingRad = rotateShortest(
              npc.headingRad,
              lookToPlayer,
              dt * 10
            );
            return;
          }

          // Eliminated Ballspiel KIs skate out through the nearest dynamic Schleusen waypoint (gateLeft or gateRight) and line up cleanly in 2 spectator zones with 68px spacing!
          const gLeftWp = ARENA_LAYOUT.gates.gateLeft || { x: 494, y: 860 };
          const gRightWp = ARENA_LAYOUT.gates.gateRight || { x: 1456, y: 860 };

          if (npc.eliminated) {
            const orderIdx =
              typeof npc.eliminatedOrder === 'number'
                ? npc.eliminatedOrder
                : npcIdx;
            const isZoneA = orderIdx < 7;
            const targetStandX = isZoneA
              ? 1762
              : 460 + (orderIdx - 7) * 68;
            const targetStandY = isZoneA ? 185 + orderIdx * 68 : 906;

            const useRightSchleuse =
              isZoneA ||
              Math.hypot(npc.x - gRightWp.x, npc.y - gRightWp.y) <
                Math.hypot(npc.x - gLeftWp.x, npc.y - gLeftWp.y);
            const activeGateWp = useRightSchleuse ? gRightWp : gLeftWp;

            if (npc.y < activeGateWp.y - 4 && npc.x < 1715) {
              // Step 1: Inside the rink -> steer to nearest Schleuse waypoint (gateLeft or gateRight)
              const dxE = activeGateWp.x - npc.x;
              const dyE = activeGateWp.y + 8 - npc.y;
              const distE = Math.max(1, Math.hypot(dxE, dyE));
              const exitSpd = 285;
              npc.vx = (dxE / distE) * exitSpd;
              npc.vy = (dyE / distE) * exitSpd;
              npc.x += npc.vx * dt;
              npc.y += npc.vy * dt;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dyE, dxE),
                dt * 10
              );
            } else if (npc.y < activeGateWp.y + 36 && npc.x < 1715) {
              // Step 2: Roll cleanly through the Schleuse opening into the outer Vorbereich corridor
              const dxG = activeGateWp.x - npc.x;
              const dyG = activeGateWp.y + 44 - npc.y;
              const distG = Math.max(1, Math.hypot(dxG, dyG));
              npc.vx = (dxG / distG) * 255;
              npc.vy = (dyG / distG) * 255;
              npc.x += npc.vx * dt;
              npc.y += npc.vy * dt;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dyG, dxG),
                dt * 10
              );
            } else {
              // Step 3: Glide to assigned spectator spot in Zone A or Zone B with clean 68px spacing
              const dxB = targetStandX - npc.x;
              const dyB = targetStandY - npc.y;
              const distB = Math.hypot(dxB, dyB);
              if (distB > 6) {
                const spdB = 220;
                npc.vx = (dxB / distB) * spdB;
                npc.vy = (dyB / distB) * spdB;
                npc.x += (dxB / distB) * Math.min(distB, spdB * dt);
                npc.y += (dyB / distB) * Math.min(distB, spdB * dt);
                npc.headingRad = rotateShortest(
                  npc.headingRad,
                  Math.atan2(dyB, dxB),
                  dt * 10
                );
              } else {
                npc.vx = 0;
                npc.vy = 0;
                const watchAngle = isZoneA ? Math.PI : -Math.PI / 2;
                npc.headingRad = rotateShortest(
                  npc.headingRad,
                  watchAngle,
                  dt * 8
                );
              }
            }
            return;
          }

          if (npc.hitOutTimer > 0) {
            npc.hitOutTimer = Math.max(0, npc.hitOutTimer - dt);
            return;
          }

          // Autonomous Waypoint Excursions (Snack-Bar, Spinde, WC-Flur) in Free-Skate mode
          if (
            p.hallGameMode === 'free-skate' &&
            npc.excursionPhase &&
            npc.excursionPhase !== 'idle'
          ) {
            const gateWp =
              npc.excursionGateSide === 'right' ? gRightWp : gLeftWp;
            if (npc.excursionPhase === 'exiting-rink') {
              const targetX = gateWp.x;
              const targetY = gateWp.y + 30;
              const dx = targetX - npc.x;
              const dy = targetY - npc.y;
              const dist = Math.max(1, Math.hypot(dx, dy));
              const spd = 235;
              npc.vx = (dx / dist) * spd;
              npc.vy = (dy / dist) * spd;
              npc.x += npc.vx * dt;
              npc.y += npc.vy * dt;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dy, dx),
                dt * 10
              );
              if (npc.y >= gateWp.y + 18 || dist < 18) {
                npc.excursionPhase = 'going-to-spot';
              }
              return;
            }
            if (npc.excursionPhase === 'going-to-spot') {
              const tx = npc.excursionTargetX ?? gateWp.x;
              const ty = npc.excursionTargetY ?? 930;
              const dx = tx - npc.x;
              const dy = ty - npc.y;
              const dist = Math.hypot(dx, dy);
              if (dist > 12) {
                const spd = 215;
                npc.vx = (dx / dist) * spd;
                npc.vy = (dy / dist) * spd;
                npc.x += npc.vx * dt;
                npc.y += npc.vy * dt;
                npc.headingRad = rotateShortest(
                  npc.headingRad,
                  Math.atan2(dy, dx),
                  dt * 10
                );
              } else {
                npc.vx = 0;
                npc.vy = 0;
                npc.excursionPhase = 'at-spot';
                npc.excursionPauseTimer = 4.2;
                if (npc.excursionSpotId === 'snackbar') {
                  npc.speechText =
                    '🍧 Mmmh, eiskaltes Slush-Puppie an der Snack-Bar!';
                } else if (npc.excursionSpotId === 'lockers') {
                  npc.speechText =
                    '🗄️ Schnell am Spind die Schnürsenkel nachgezogen!';
                } else {
                  npc.speechText =
                    '💧 Kurze Erfrischungspause – gleich geht’s weiter!';
                }
                npc.speechTimer = 4.0;
              }
              return;
            }
            if (npc.excursionPhase === 'at-spot') {
              npc.vx = 0;
              npc.vy = 0;
              npc.excursionPauseTimer =
                (npc.excursionPauseTimer || 0) - dt;
              if ((npc.excursionPauseTimer || 0) <= 0) {
                npc.excursionPhase = 'returning-to-gate';
                npc.speechText = '🛼 Frisch gestärkt zurück auf die Bahn!';
                npc.speechTimer = 2.6;
              }
              return;
            }
            if (npc.excursionPhase === 'returning-to-gate') {
              const targetX = gateWp.x;
              const targetY = rink.y + rink.height - 62;
              const needsCorridorAlign =
                Math.abs(npc.x - gateWp.x) > 26 && npc.y > gateWp.y + 6;
              const stepX = gateWp.x;
              const stepY = needsCorridorAlign ? gateWp.y + 24 : targetY;
              const dx = stepX - npc.x;
              const dy = stepY - npc.y;
              const dist = Math.max(1, Math.hypot(dx, dy));
              const spd = 235;
              npc.vx = (dx / dist) * spd;
              npc.vy = (dy / dist) * spd;
              npc.x += npc.vx * dt;
              npc.y += npc.vy * dt;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dy, dx),
                dt * 10
              );
              if (npc.y <= rink.y + rink.height - 48) {
                npc.excursionPhase = 'idle';
                const orb = computeNpcOrbitFromPosition(
                  npc.x,
                  npc.y,
                  npc.role
                );
                npc.orbitAngle = orb.orbitAngle;
              }
              return;
            }
          }

          // Check whether this NPC's anchor (homeX/homeY) was explicitly placed in the Vorbereich/Bistro outside the rink
          const homeX = npc.homeX ?? npc.x;
          const homeY = npc.homeY ?? npc.y;
          const isHomeOutsideRink =
            p.hallGameMode === 'free-skate' &&
            !isSpringerStaffelShow &&
            (homeX < rink.x + 8 ||
              homeX > rink.x + rink.width - 8 ||
              homeY > rink.y + rink.height + 10);
          const isNpcOutsideRink =
            npc.x < rink.x + 8 ||
            npc.x > rink.x + rink.width - 8 ||
            npc.y > rink.y + rink.height + 10;

          if (isHomeOutsideRink) {
            // NPC belongs in the Vorbereich (e.g. Bistro / Foyer): if currently on the rink, route out via nearest gateLeft/gateRight first!
            if (!isNpcOutsideRink) {
              const useRight =
                Math.hypot(npc.x - gRightWp.x, npc.y - gRightWp.y) <
                Math.hypot(npc.x - gLeftWp.x, npc.y - gLeftWp.y);
              const wp = useRight ? gRightWp : gLeftWp;
              const dxOut = wp.x - npc.x;
              const dyOut = wp.y + 28 - npc.y;
              const distOut = Math.max(1, Math.hypot(dxOut, dyOut));
              const spdOut = 250;
              npc.vx = (dxOut / distOut) * spdOut;
              npc.vy = (dyOut / distOut) * spdOut;
              npc.x += npc.vx * dt;
              npc.y += npc.vy * dt;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dyOut, dxOut),
                dt * 10
              );
              return;
            }
            // Already in Vorbereich -> glide cleanly to homeX/homeY
            const dxH = homeX - npc.x;
            const dyH = homeY - npc.y;
            const distH = Math.hypot(dxH, dyH);
            if (distH > 8) {
              const spdH = 210;
              npc.vx = (dxH / distH) * spdH;
              npc.vy = (dyH / distH) * spdH;
              npc.x += (dxH / distH) * Math.min(distH, spdH * dt);
              npc.y += (dyH / distH) * Math.min(distH, spdH * dt);
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dyH, dxH),
                dt * 10
              );
            } else {
              npc.vx = 0;
              npc.vy = 0;
            }
            return;
          }

          // If an active rink skater was placed outside the rink barrier (y > rink.y + rink.height + 10), route them in through the nearest Schleuse!
          if (isNpcOutsideRink) {
            const useLeft =
              Math.hypot(npc.x - gLeftWp.x, npc.y - gLeftWp.y) <
              Math.hypot(npc.x - gRightWp.x, npc.y - gRightWp.y);
            const wp = useLeft ? gLeftWp : gRightWp;
            const needsHorizontalAlign =
              Math.abs(npc.x - wp.x) > 22 && npc.y >= wp.y + 4;
            const entryX = wp.x;
            const entryY = needsHorizontalAlign ? wp.y + 18 : rink.y + rink.height - 65;
            const dxIn = entryX - npc.x;
            const dyIn = entryY - npc.y;
            const distIn = Math.max(1, Math.hypot(dxIn, dyIn));
            const spdIn = 265;
            npc.vx = (dxIn / distIn) * spdIn;
            npc.vy = (dyIn / distIn) * spdIn;
            npc.x += npc.vx * dt;
            npc.y += npc.vy * dt;
            npc.headingRad = rotateShortest(
              npc.headingRad,
              Math.atan2(dyIn, dxIn),
              dt * 10
            );
            return;
          }

          // Wild / Free-roaming Ballspiel Movement (Paceline & Shuffle-Train paused; skaters dodge the ball & guards/skaters chase FREE ball!)
          if (p.hallGameMode === 'ballspiel') {
            const singleBall = softballs[0];
            let targetX = npc.ballspielTargetX || rink.centerX;
            let targetY = npc.ballspielTargetY || rink.centerY;

            // Rule #5: ONLY Ordner Manni ('guard-1') chases a FREE ball! Normal runners NEVER swarm the ball!
            let chasingFreeBall = false;
            if (
              singleBall &&
              singleBall.state === 'FREE' &&
              npc.id === 'guard-1'
            ) {
              chasingFreeBall = true;
            }

            if (
              singleBall &&
              singleBall.state === 'HELD' &&
              singleBall.holderId === 'guard-1' &&
              npc.id === 'guard-1'
            ) {
              // Ordner Manni holds the ball briefly to pass to JR or take a Co-Throw shot
              npc.vx *= 0.2;
              npc.vy *= 0.2;
              return;
            }

            if (chasingFreeBall && singleBall) {
              targetX = singleBall.x;
              targetY = singleBall.y;
            } else {
              npc.ballspielRetargetTimer =
                (npc.ballspielRetargetTimer || 0) - dt;
              if (
                (npc.ballspielRetargetTimer || 0) <= 0 ||
                Math.hypot(targetX - npc.x, targetY - npc.y) < 48
              ) {
                npc.ballspielRetargetTimer = 1.1 + Math.random() * 1.4;
                // Pick a free spot on the rink floor away from the center U-islands
                const side = Math.random() < 0.5 ? -1 : 1;
                const candX =
                  rink.centerX +
                  (Math.random() * 2 - 1) * 580;
                const candY =
                  Math.abs(candX - rink.centerX) < 340
                    ? rink.centerY + side * (175 + Math.random() * 155)
                    : rink.centerY + (Math.random() * 2 - 1) * 310;
                npc.ballspielTargetX = Math.max(
                  rink.x + 55,
                  Math.min(rink.x + rink.width - 55, candX)
                );
                npc.ballspielTargetY = Math.max(
                  rink.y + 55,
                  Math.min(rink.y + rink.height - 55, candY)
                );
                targetX = npc.ballspielTargetX;
                targetY = npc.ballspielTargetY;
              }

              // Dodge incoming THROWN ball or ball holder
              if (singleBall && npc.role !== 'guard') {
                const distBall = Math.hypot(
                  npc.x - singleBall.x,
                  npc.y - singleBall.y
                );
                if (distBall < 240 && distBall > 1) {
                  targetX += ((npc.x - singleBall.x) / distBall) * 180;
                  targetY += ((npc.y - singleBall.y) / distBall) * 180;
                }
              }
            }

            const dxB = targetX - npc.x;
            const dyB = targetY - npc.y;
            const distB = Math.max(1, Math.hypot(dxB, dyB));
            const moveSpd =
              npc.role === 'guard'
                ? 295
                : chasingFreeBall
                ? 285
                : 235 + (npcIdx % 4) * 18;
            npc.vx = (dxB / distB) * moveSpd;
            npc.vy = (dyB / distB) * moveSpd;
            npc.x += npc.vx * dt;
            npc.y += npc.vy * dt;

            // Keep Ballspiel skaters out of the dynamic center U-islands (`[` and `]`)
            const { uIslands } = ARENA_LAYOUT;
            if (
              npc.x > uIslands.leftDefaultX - 10 &&
              npc.x < uIslands.rightDefaultX + uIslands.width + 10 &&
              npc.y > uIslands.topY - 12 &&
              npc.y < uIslands.topY + uIslands.height + 12
            ) {
              if (npc.y < uIslands.topY + uIslands.height / 2) {
                npc.y = uIslands.topY - 14;
                npc.vy = -Math.abs(npc.vy);
              } else {
                npc.y = uIslands.topY + uIslands.height + 14;
                npc.vy = Math.abs(npc.vy);
              }
            }

            clampPointInsideRoundedRink(npc, 28);
            npc.headingRad = rotateShortest(
              npc.headingRad,
              Math.atan2(npc.vy, npc.vx),
              dt * 12
            );
            return;
          }

          const coupleCfg =
            isSlowSkating && p.hallGameMode === 'free-skate'
              ? slowSkateCouples[npc.id]
              : undefined;

          const trainSlotIdx = shuffleTrainMemberIds.indexOf(npc.id);

          const orbitDirSign = isClockwiseSkate ? 1 : -1;

          if (trainSlotIdx !== -1 && !isSpringerStaffelShow) {
            // Synchronized 4-skater Shuffle-Skate-Train gliding rhythmically on the middle lane!
            const trainLeader = trackNpcs.find(
              (n) => n.id === shuffleTrainMemberIds[0]
            );
            if (trainSlotIdx === 0) {
              npc.orbitAngle = normalizeAngle(
                npc.orbitAngle + orbitDirSign * 0.52 * dt
              );
            } else if (trainLeader) {
              npc.orbitAngle = normalizeAngle(
                trainLeader.orbitAngle - orbitDirSign * trainSlotIdx * 0.115
              );
            }
            const trainSway = Math.sin(now * 0.0085 - trainSlotIdx * 0.55) * 14;
            const trackPt = computeTrackOvalPoint(
              rink.centerX,
              rink.centerY,
              548 + trainSway,
              274 + trainSway * 0.5,
              npc.orbitAngle,
              false,
              isClockwiseSkate
            );
            npc.vx = (trackPt.x - npc.x) / Math.max(0.016, dt);
            npc.vy = (trackPt.y - npc.y) / Math.max(0.016, dt);
            npc.x += (trackPt.x - npc.x) * Math.min(1, dt * 14);
            npc.y += (trackPt.y - npc.y) * Math.min(1, dt * 14);
            npc.headingRad = rotateShortest(
              npc.headingRad,
              trackPt.tangentRad,
              dt * 15
            );
          } else if (coupleCfg && !isSpringerStaffelShow) {
            if (!coupleCfg.isBackwardsPartner) {
              npc.orbitAngle = normalizeAngle(
                npc.orbitAngle + orbitDirSign * coupleCfg.orbitSpeed * dt
              );
            } else {
              const leader = trackNpcs.find((n) => n.id === coupleCfg.leaderId);
              if (leader) {
                npc.orbitAngle = leader.orbitAngle;
              }
            }

            const trackPt = computeTrackOvalPoint(
              rink.centerX,
              rink.centerY,
              coupleCfg.rx,
              coupleCfg.ry,
              npc.orbitAngle,
              coupleCfg.rx > 600,
              isClockwiseSkate
            );

            const tanCos = Math.cos(trackPt.tangentRad);
            const tanSin = Math.sin(trackPt.tangentRad);
            const normCos = -tanSin;
            const normSin = tanCos;

            const alongOffset = coupleCfg.isBackwardsPartner ? 18 : -18;
            const sideOffset = coupleCfg.isBackwardsPartner ? -6 : 6;

            const targetX =
              trackPt.x + tanCos * alongOffset + normCos * sideOffset;
            const targetY =
              trackPt.y + tanSin * alongOffset + normSin * sideOffset;

            npc.vx = (targetX - npc.x) / Math.max(0.016, dt);
            npc.vy = (targetY - npc.y) / Math.max(0.016, dt);
            npc.x += (targetX - npc.x) * Math.min(1, dt * 14);
            npc.y += (targetY - npc.y) * Math.min(1, dt * 14);

            const desiredHeading = coupleCfg.isBackwardsPartner
              ? normalizeAngle(trackPt.tangentRad + Math.PI)
              : trackPt.tangentRad;

            npc.headingRad = rotateShortest(
              npc.headingRad === 0 ? desiredHeading : npc.headingRad,
              desiredHeading,
              dt * 14
            );
          } else if (
            isSlowSkating &&
            p.hallGameMode === 'free-skate' &&
            !isSpringerStaffelShow &&
            slowFlirtPartnerId === npc.id
          ) {
            // Rule #3: Accepted Singleplayer Slow-Skate Partner skates synchronously hand-in-hand beside the player!
            const sideNormX = -Math.sin(player.headingRad);
            const sideNormY = Math.cos(player.headingRad);
            const targetX = player.x + sideNormX * 28;
            const targetY = player.y + sideNormY * 28;
            npc.vx = player.vx;
            npc.vy = player.vy;
            npc.x += (targetX - npc.x) * Math.min(1, dt * 12);
            npc.y += (targetY - npc.y) * Math.min(1, dt * 12);
            npc.headingRad = rotateShortest(
              npc.headingRad,
              player.headingRad,
              dt * 14
            );
          } else if (isSpringerStaffelShow && npc.role !== 'guard') {
            // Ordered Springer-Staffel-Show: Participating skaters line up one behind another on the exact high-jump approach lane (rx=525, ry=250) and jump sequentially over HOCHSPRUNG 1..4!
            const leaderNpc = trackNpcs[0];
            const relaySpeed = 0.72;
            if (npcIdx === 0 || !leaderNpc) {
              npc.orbitAngle = normalizeAngle(
                npc.orbitAngle + orbitDirSign * relaySpeed * dt
              );
            } else {
              const desiredSlotAngle = normalizeAngle(
                leaderNpc.orbitAngle - orbitDirSign * npcIdx * 0.25
              );
              npc.orbitAngle = rotateShortest(
                npc.orbitAngle,
                desiredSlotAngle,
                dt * 2.4
              );
            }

            const trackPt = computeTrackOvalPoint(
              rink.centerX,
              rink.centerY,
              525,
              250,
              npc.orbitAngle,
              false,
              isClockwiseSkate
            );

            // Trigger high-jump arc & short (~1.0s) height badge exclusively right at takeoff over any of the 4 Hochsprung bars!
            const nearBarX =
              Math.abs(npc.x - 760) < 34 || Math.abs(npc.x - 1240) < 34;
            const nearBarY =
              Math.abs(npc.y - 735) < 42 || Math.abs(npc.y - 235) < 42;
            if (nearBarX && nearBarY && (npc.jumpZ || 0) === 0) {
              npc.jumpVz =
                255 + Math.min(90, (activeSpringerstaffelHeightCm - 60) * 0.5);
              npc.speechText = `${activeSpringerstaffelHeightCm} cm!`;
              npc.speechTimer = 1.0;
            }

            const blend = Math.min(1, dt * 12);
            const nextX = npc.x + (trackPt.x - npc.x) * blend;
            const nextY = npc.y + (trackPt.y - npc.y) * blend;
            npc.vx = (nextX - npc.x) / Math.max(0.016, dt);
            npc.vy = (nextY - npc.y) / Math.max(0.016, dt);
            npc.x = nextX;
            npc.y = nextY;
            npc.headingRad = rotateShortest(
              npc.headingRad === 0 ? trackPt.tangentRad : npc.headingRad,
              trackPt.tangentRad,
              dt * 14
            );
          } else {
            // Strict closed-oval skating for ALL AI skaters on the outer oval rink (CCW in normal mode, CW & relaxed in Richtungswechsel / Slow-Skate mode!)
            // During Slalom ('slalom'), only at most 3 designated skaters ('reg-4', 'speed-1', 'reg-12') weave through the slalom cones with wide spacing; all others stay calmly on the outer oval!
            const isDesignatedSlalomSkater =
              p.hallGameMode === 'slalom' &&
              (npc.id === 'reg-4' ||
                npc.id === 'speed-1' ||
                npc.id === 'reg-12');
            const speedMult = isClockwiseSkate ? 0.45 : 1.0;
            npc.orbitAngle = normalizeAngle(
              npc.orbitAngle + orbitDirSign * npc.baseSpeed * speedMult * dt
            );

            // Smooth lateral lane-shifting (overtaking) so faster skaters glide past slower skaters without ever turning around
            let desiredLaneShift = 0;
            for (const other of trackNpcs) {
              if (
                other.id === npc.id ||
                other.eliminated ||
                other.sittingBarrierSpot
              )
                continue;
              const d = Math.hypot(other.x - npc.x, other.y - npc.y);
              if (d < 85 && d > 1) {
                const radDiff = npc.laneRadiusX - other.laneRadiusX;
                if (Math.abs(radDiff) < 36) {
                  desiredLaneShift += radDiff >= 0 ? 26 : -26;
                }
              }
            }
            desiredLaneShift = Math.max(-36, Math.min(36, desiredLaneShift));
            npc.laneOffset =
              (npc.laneOffset || 0) +
              (desiredLaneShift - (npc.laneOffset || 0)) * Math.min(1, dt * 3.5);

            const hasCustomManni = Boolean(p.customLayout?.npcAnchors?.['guard-1']);
            // In Slalom mode, non-designated AI skaters stay calmly on the outer oval lanes (rx >= 585, ry >= 292) outside the slalom cones
            const rawRx =
              npc.id === 'guard-1' && !hasCustomManni ? 596 : npc.laneRadiusX;
            const rawRy =
              npc.id === 'guard-1' && !hasCustomManni ? 294 : npc.laneRadiusY;
            const baseRx = isDesignatedSlalomSkater
              ? 515
              : p.hallGameMode === 'slalom'
              ? Math.max(588, rawRx)
              : Math.max(465, rawRx);
            const baseRy = isDesignatedSlalomSkater
              ? 250
              : p.hallGameMode === 'slalom'
              ? Math.max(292, rawRy)
              : Math.max(230, rawRy);
            const effectiveRx = Math.min(672, baseRx + (npc.laneOffset || 0));
            const effectiveRy = Math.min(334, baseRy + (npc.laneOffset || 0) * 0.5);
            const trackPt = computeTrackOvalPoint(
              rink.centerX,
              rink.centerY,
              effectiveRx,
              effectiveRy,
              npc.orbitAngle,
              npc.role === 'speed' || npc.id === 'guard-1',
              isClockwiseSkate
            );

            let targetX = trackPt.x;
            let targetY = trackPt.y;

            if (isDesignatedSlalomSkater && (trackPt.x >= 590 && trackPt.x <= 1310)) {
              // Smooth slalom weaving around the cones on the top/bottom straights for the 3 slalom skaters
              const slalomWave = Math.sin((trackPt.x - 630) * (Math.PI / 160)) * 28;
              targetY += slalomWave;
            } else if (npc.role === 'regular' && !isClockwiseSkate) {
              const sway = Math.sin(now * 0.004 + npc.laneRadiusX) * 8;
              targetX += Math.cos(npc.orbitAngle) * sway;
              targetY += Math.sin(npc.orbitAngle) * sway;
            }

            if (npc.id === 'guard-1' && player.afkSecondsOnTrack >= 15) {
              targetX = player.x - 24;
              targetY = player.y - 24;
              const distToAfk = Math.hypot(player.x - npc.x, player.y - npc.y);
              if (distToAfk < 65) {
                if (!player.guardEscortActive) {
                  player.guardEscortActive = true;
                  npc.speechText =
                    'Trrriiiiieeeet! Nicht auf der Bahn stehen!';
                  npc.speechTimer = 3.5;
                  if (p.skateGuardWhistleEnabled) {
                    soundFX.playSkateGuardWhistle();
                  }
                  speakNpcBubble(npc.speechText, npc.name, npc.gender);
                }
                player.vx = (1435 - player.x) * 1.4;
                player.vy = (850 - player.y) * 1.4;
              }
            }

            const blend = Math.min(1, dt * 14);
            const nextX = npc.x + (targetX - npc.x) * blend;
            const nextY = npc.y + (targetY - npc.y) * blend;
            npc.vx = (nextX - npc.x) / Math.max(0.016, dt);
            npc.vy = (nextY - npc.y) / Math.max(0.016, dt);
            npc.x = nextX;
            npc.y = nextY;

            npc.headingRad = rotateShortest(
              npc.headingRad === 0 ? trackPt.tangentRad : npc.headingRad,
              trackPt.tangentRad,
              dt * 14
            );

            if (npc.role === 'speed' && !isClockwiseSkate) {
              const behindX = npc.x - Math.cos(trackPt.tangentRad) * 65;
              const behindY = npc.y - Math.sin(trackPt.tangentRad) * 65;
              if (
                Math.hypot(player.x - behindX, player.y - behindY) < 82 &&
                speed > 110
              ) {
                player.isSlipstreamActive = true;
              }
            }
          }

          // Clamp NPC strictly inside the rounded blue rink barrier so AI skaters never clip through corners or right barrier
          clampPointInsideRoundedRink(npc, 26);

          // Skate Guard wrong-way (Geisterfahrer) whistle check
          if (npc.role === 'guard' && onRinkFloor && speed > 130) {
            const distGuard = Math.hypot(player.x - npc.x, player.y - npc.y);
            const angleDiff = Math.abs(
              normalizeAngle(player.headingRad - npc.headingRad)
            );
            if (distGuard < 210 && angleDiff > 2.35 && npc.speechTimer <= 0) {
              npc.speechText = isClockwiseSkate
                ? 'Trrriiiiieeeet! Richtungswechsel — jetzt im Uhrzeigersinn!'
                : 'Trrriiiiieeeet! Gegen den Uhrzeigersinn!';
              npc.speechTimer = 2.8;
              player.cleanLapsStreak = 0;
              if (p.skateGuardWhistleEnabled) {
                soundFX.playSkateGuardWhistle();
              }
              speakNpcBubble(npc.speechText, npc.name, npc.gender);
            }
          }

          // Player <-> NPC Collision & Slow-Skate Flirt Proximity Check
          if (
            isSlowSkating &&
            !p.isMultiplayerActive &&
            p.hallGameMode === 'free-skate' &&
            slowFlirtPartnerId === npc.id
          ) {
            return;
          }

          if (
            isSlowSkating &&
            !p.isMultiplayerActive &&
            p.hallGameMode === 'free-skate' &&
            !slowFlirtPartnerId &&
            slowFlirtCooldown <= 0 &&
            npc.role !== 'guard' &&
            !slowSkateCouples[npc.id]
          ) {
            const flirtDist = Math.hypot(player.x - npc.x, player.y - npc.y);
            if (flirtDist < 68) {
              if (
                slowFlirtAttemptCount === 0 &&
                !slowFlirtImpressedByTrick &&
                !slowFlirtRejectedIds.has(npc.id)
              ) {
                slowFlirtAttemptCount = 1;
                slowFlirtRejectedIds.add(npc.id);
                npc.speechText = '„Sorry, noch nicht mein Typ!“';
                npc.speechTimer = 3.6;
                player.speechBubble =
                  '😅 Korb #1! Versuch es beim nächsten oder mach einen 360°-Spin [Q]!';
                player.speechTimer = 3.2;
                slowFlirtCooldown = 3.2;
              } else if (
                slowFlirtAttemptCount === 1 &&
                !slowFlirtImpressedByTrick &&
                !slowFlirtRejectedIds.has(npc.id)
              ) {
                slowFlirtAttemptCount = 2;
                slowFlirtRejectedIds.add(npc.id);
                npc.speechText = '„Üb erstmal noch ein bisschen!“';
                npc.speechTimer = 3.6;
                player.speechBubble =
                  '🕺 Jetzt beim nächsten Versuch oder mit Spin [Q] / Sprung [J] klappt es!';
                player.speechTimer = 3.2;
                slowFlirtCooldown = 3.0;
              } else if (
                slowFlirtImpressedByTrick ||
                slowFlirtAttemptCount >= 2
              ) {
                slowFlirtPartnerId = npc.id;
                npc.speechText =
                  '„Na gut, fahren wir eine Runde zusammen!“';
                npc.speechTimer = 4.5;
                player.speechBubble = `💖 Hand-in-Hand mit ${npc.name}!`;
                player.speechTimer = 4.0;
                soundFX.playChallengeUnlocked();
                return;
              }
            }
          }

          if (
            !p.isPlayingArcade &&
            !player.isJumping &&
            player.medicRescueTimer <= 0
          ) {
            const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
            const minDist = player.radius + 24;
            if (dist < minDist && dist > 0.1) {
              const nx = (player.x - npc.x) / dist;
              const ny = (player.y - npc.y) / dist;
              const overlap = minDist - dist;
              player.x += nx * overlap;
              player.y += ny * overlap;

              // Elastic lateral push without knockdown wait time; silent counter dispatches Schwester Gudrun + Skate-Guard + 2 Paramedics with stretcher on the 10th collision!
              player.vx += nx * 135;
              player.vy += ny * 135;

              if (player.bumpCooldownTimer <= 0) {
                player.bumpCooldownTimer = 0.85;
                player.bumpCountSinceGudrun += 1;

                if (player.bumpCountSinceGudrun >= 10) {
                  player.bumpCountSinceGudrun = 0;
                  player.totalCrashes += 1;
                  player.crashTimer = 4.2;
                  player.medicRescueTimer = 6.0;
                  const nurseName =
                    p.crewNames?.nurse || 'Schwester Gudrun';
                  player.speechBubble = `🚑 10. Rempler! ${nurseName}, Skate-Guard & 2 Sanitäter mit Trage rücken an!`;
                  player.speechTimer = 4.2;
                  const guardNpc = trackNpcs.find((g) => g.role === 'guard');
                  if (guardNpc) {
                    guardNpc.speechText = `📣 TRRIIIIEEEET! Bahn frei für ${nurseName} & die Sanitäter mit Trage!`;
                    guardNpc.speechTimer = 4.5;
                  }
                  if (p.skateGuardWhistleEnabled) {
                    soundFX.playSkateGuardWhistle();
                  }
                  soundFX.playCrash(true);
                  triggerSaniNurseDispatch(player.x, player.y, true);
                } else if (player.speechTimer <= 0) {
                  player.speechBubble = Math.random() > 0.5 ? 'Hoppla!' : 'Uff!';
                  player.speechTimer = 1.0;
                  soundFX.playCrash(false);
                }
              }
            }
          }
        });

        for (let i = 0; i < trackNpcs.length; i++) {
          for (let j = i + 1; j < trackNpcs.length; j++) {
            const a = trackNpcs[i];
            const b = trackNpcs[j];
            if (
              a.sittingBarrierSpot ||
              b.sittingBarrierSpot ||
              a.eliminated ||
              b.eliminated
            )
              continue;
            const isCouple =
              isSlowSkating &&
              p.hallGameMode === 'free-skate' &&
              slowSkateCouples[a.id] &&
              slowSkateCouples[b.id] &&
              slowSkateCouples[a.id].leaderId ===
                slowSkateCouples[b.id].leaderId;
            if (isCouple) continue;
            const isSameTrain =
              shuffleTrainMemberIds.includes(a.id) &&
              shuffleTrainMemberIds.includes(b.id);
            if (isSameTrain) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minSep = 52;
            if (dist < minSep && dist > 0.1) {
              const push = (minSep - dist) * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;
              a.x -= nx * push;
              a.y -= ny * push;
              b.x += nx * push;
              b.y += ny * push;
              clampPointInsideRoundedRink(a, 24);
              clampPointInsideRoundedRink(b, 24);
            }
          }
        }

        if (player.isSlipstreamActive) {
          player.slipstreamAccumSec += dt;
          p.onChallengeProgress(
            'slipstream_10s',
            Math.floor(player.slipstreamAccumSec),
            true
          );
        }
      }

      if (!isSlowSkating) {
        slowFlirtPartnerId = null;
        slowFlirtAttemptCount = 0;
        slowFlirtImpressedByTrick = false;
        slowFlirtRejectedIds.clear();
      } else if (slowFlirtCooldown > 0) {
        slowFlirtCooldown = Math.max(0, slowFlirtCooldown - dt);
      }

      // ----------------------------------------------------------------------
      // G. HALLEN-SPIELE LOGIC (PLAYER-AS-GUARD BALLSPIEL, SLALOM, STUHLSPRUNG, SPRINGERSTAFFEL)
      // ----------------------------------------------------------------------
      if (p.hallGameMode === 'ballspiel') {
        // Strictly ONE single Ball object on the rink (`state: 'HELD' | 'THROWN' | 'FREE'`)
        // Rule #1: Player immediately starts with the ball (`holderId: 'player'`), only THROWN balls eliminate AI skaters,
        // and FREE lying balls are harmless and automatically roll back to the player after 2.5s!
        if (softballs.length === 0) {
          softballs.push({
            x: player.x + Math.cos(player.headingRad) * 24,
            y: player.y + Math.sin(player.headingRad) * 24,
            vx: 0,
            vy: 0,
            bouncesLeft: 2,
            color: '#39ff14',
            fromPlayer: true,
            state: 'HELD',
            holderId: 'player',
            holdTimer: 0,
            freeTimer: 0,
          });
        } else if (softballs.length > 1) {
          softballs.splice(1);
        }

        const ball = softballs[0];
        if (!ball.state) ball.state = 'HELD';
        const guardManni = trackNpcs.find((n) => n.id === 'guard-1');

        if (ball.state === 'HELD') {
          if (ball.holderId === 'guard-1' && guardManni) {
            ball.holdTimer = Math.max(0, (ball.holdTimer || 0) - dt);
            if (ball.manniAction === 'co_throw') {
              // Co-Thrower: Manni aims at the nearest active runner and fires a sharp shot!
              const activeRunners = trackNpcs.filter(
                (n) => n.role !== 'guard' && !n.eliminated && n.hitOutTimer <= 0
              );
              activeRunners.sort(
                (a, b) =>
                  Math.hypot(a.x - guardManni.x, a.y - guardManni.y) -
                  Math.hypot(b.x - guardManni.x, b.y - guardManni.y)
              );
              const targetRunner = activeRunners[0];
              const aimAngle = targetRunner
                ? Math.atan2(
                    targetRunner.y - guardManni.y,
                    targetRunner.x - guardManni.x
                  )
                : Math.atan2(
                    rink.centerY - guardManni.y,
                    rink.centerX - guardManni.x
                  );
              guardManni.headingRad = rotateShortest(
                guardManni.headingRad,
                aimAngle,
                dt * 14
              );
              ball.x = guardManni.x + Math.cos(guardManni.headingRad) * 24;
              ball.y = guardManni.y + Math.sin(guardManni.headingRad) * 24;
              ball.vx = 0;
              ball.vy = 0;
              ball.color = '#fde047';

              if ((ball.holdTimer || 0) <= 0) {
                if (targetRunner) {
                  const shotSpeed = 760;
                  ball.state = 'THROWN';
                  ball.holderId = null;
                  ball.fromPlayer = false;
                  ball.bouncesLeft = 2;
                  ball.color = '#39ff14';
                  ball.vx = Math.cos(aimAngle) * shotSpeed;
                  ball.vy = Math.sin(aimAngle) * shotSpeed;
                  guardManni.speechText = '⚡ Co-Wurf von Manni – Feuer frei!';
                  guardManni.speechTimer = 2.4;
                  soundFX.playBallThrowOrHit(false);
                } else {
                  ball.state = 'PASS_TO_PLAYER';
                  ball.holderId = null;
                  ball.color = '#00f0ff';
                }
              }
            } else {
              // Ball Retriever: Manni turns to JR and passes the retrieved ball cleanly back to JR!
              const passAngle = Math.atan2(
                player.y - guardManni.y,
                player.x - guardManni.x
              );
              guardManni.headingRad = rotateShortest(
                guardManni.headingRad,
                passAngle,
                dt * 14
              );
              ball.x = guardManni.x + Math.cos(guardManni.headingRad) * 24;
              ball.y = guardManni.y + Math.sin(guardManni.headingRad) * 24;
              ball.vx = 0;
              ball.vy = 0;
              ball.color = '#00f0ff';

              if ((ball.holdTimer || 0) <= 0) {
                ball.state = 'PASS_TO_PLAYER';
                ball.holderId = null;
                ball.fromPlayer = false;
                ball.color = '#00f0ff';
                guardManni.speechText = '🤝 Hier JR, dein Pass!';
                guardManni.speechTimer = 2.2;
                soundFX.playBallThrowOrHit(false);
              }
            }
          } else {
            ball.holderId = 'player';
            const aimX = hasMouseMovedOnCanvas
              ? mouseWorldX
              : player.x + Math.cos(player.headingRad) * 180;
            const aimY = hasMouseMovedOnCanvas
              ? mouseWorldY
              : player.y + Math.sin(player.headingRad) * 180;
            const holdAng =
              Math.hypot(aimX - player.x, aimY - player.y) > 12
                ? Math.atan2(aimY - player.y, aimX - player.x)
                : player.headingRad;
            ball.x = player.x + Math.cos(holdAng) * 24;
            ball.y = player.y + Math.sin(holdAng) * 24;
            ball.vx = player.vx;
            ball.vy = player.vy;
            ball.color = '#39ff14';
            ball.fromPlayer = true;
            ball.freeTimer = 0;
          }
        } else if (ball.state === 'PASS_TO_PLAYER') {
          // Harmless pass from Ordner Manni directly into JR's hands!
          const dxP = player.x - ball.x;
          const dyP = player.y - ball.y;
          const distP = Math.max(1, Math.hypot(dxP, dyP));
          const passSpd = 650;
          ball.vx = (dxP / distP) * passSpd;
          ball.vy = (dyP / distP) * passSpd;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          ball.color = '#00f0ff';
          if (distP < 42) {
            ball.state = 'HELD';
            ball.holderId = 'player';
            ball.fromPlayer = true;
            ball.freeTimer = 0;
            ball.color = '#39ff14';
            player.speechBubble = '🧤 Pass von Ordner Manni gefangen!';
            player.speechTimer = 1.8;
          }
        } else {
          // Ball is THROWN or FREE -> integrate velocity, drag & barrier / U-island reflection!
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          const drag = ball.state === 'FREE' ? 0.94 : 0.992;
          ball.vx *= Math.pow(drag, dt * 60);
          ball.vy *= Math.pow(drag, dt * 60);

          const minBx = rink.x + 22;
          const maxBx = rink.x + rink.width - 22;
          const minBy = rink.y + 22;
          const maxBy = rink.y + rink.height - 22;

          if (ball.x < minBx) {
            ball.x = minBx;
            ball.vx = Math.abs(ball.vx) * 0.78;
            if (ball.state === 'THROWN') {
              if (ball.bouncesLeft > 0) ball.bouncesLeft -= 1;
              else {
                ball.state = 'FREE';
                ball.freeTimer = 0;
              }
            }
          } else if (ball.x > maxBx) {
            ball.x = maxBx;
            ball.vx = -Math.abs(ball.vx) * 0.78;
            if (ball.state === 'THROWN') {
              if (ball.bouncesLeft > 0) ball.bouncesLeft -= 1;
              else {
                ball.state = 'FREE';
                ball.freeTimer = 0;
              }
            }
          }
          if (ball.y < minBy) {
            ball.y = minBy;
            ball.vy = Math.abs(ball.vy) * 0.78;
            if (ball.state === 'THROWN') {
              if (ball.bouncesLeft > 0) ball.bouncesLeft -= 1;
              else {
                ball.state = 'FREE';
                ball.freeTimer = 0;
              }
            }
          } else if (ball.y > maxBy) {
            ball.y = maxBy;
            ball.vy = -Math.abs(ball.vy) * 0.78;
            if (ball.state === 'THROWN') {
              if (ball.bouncesLeft > 0) ball.bouncesLeft -= 1;
              else {
                ball.state = 'FREE';
                ball.freeTimer = 0;
              }
            }
          }

          clampPointInsideRoundedRink(ball, 22);

          // Bounce off center U-Islands (`[` & `]`)
          if (
            ball.x > 700 &&
            ball.x < 1300 &&
            ball.y > 358 &&
            ball.y < 610
          ) {
            if (ball.y < rink.centerY) {
              ball.y = 356;
              ball.vy = -Math.abs(ball.vy) * 0.78;
            } else {
              ball.y = 612;
              ball.vy = Math.abs(ball.vy) * 0.78;
            }
            if (ball.state === 'THROWN') {
              ball.state = 'FREE';
              ball.freeTimer = 0;
            }
          }

          const ballSpd = Math.hypot(ball.vx, ball.vy);
          if (ball.state === 'THROWN' && ballSpd < 175) {
            ball.state = 'FREE';
            ball.freeTimer = 0;
          }

          // Co-Thrower Pass Check: If JR throws/passes the ball near Ordner Manni ('guard-1', within 40px), Manni catches & becomes Co-Thrower!
          if (
            ball.state === 'THROWN' &&
            ball.fromPlayer &&
            guardManni &&
            Math.hypot(ball.x - guardManni.x, ball.y - guardManni.y) <= 40 &&
            Math.hypot(player.x - guardManni.x, player.y - guardManni.y) > 45
          ) {
            ball.state = 'HELD';
            ball.holderId = 'guard-1';
            ball.manniAction = 'co_throw';
            ball.holdTimer = 0.42;
            ball.fromPlayer = false;
            ball.color = '#fde047';
            guardManni.speechText = '🤝 Pass gefangen! Ich nehme Maß!';
            guardManni.speechTimer = 2.4;
          }

          // Strictly ONLY flying THROWN balls eliminate AI skaters — with Anti-Farming checks
          // (lastScoredBallId, >= 2.5s cooldown, and minimum skated distance between scores!)
          ballDistanceSkatedSinceLastScore +=
            Math.hypot(player.vx, player.vy) * dt;
          if (ball.state === 'THROWN') {
            if (!ball.id) {
              ball.id = `ball_${ballThrowSeqCounter++}`;
            }
            for (const npc of trackNpcs) {
              if (npc.role === 'guard' || npc.eliminated || npc.hitOutTimer > 0)
                continue;
              if (Math.hypot(ball.x - npc.x, ball.y - npc.y) < 36) {
                const candidateBallScoreId = `${ball.id}_${npc.id}`;
                const cooldownElapsedMs = now - lastBallScoreTimeMs;
                const movedFromLastScoreSpot =
                  lastBallScoreTimeMs === 0 ||
                  ballDistanceSkatedSinceLastScore >= 85 ||
                  Math.hypot(
                    player.x - lastBallScorePlayerX,
                    player.y - lastBallScorePlayerY
                  ) >= 70;

                if (
                  candidateBallScoreId === lastScoredBallId ||
                  (lastBallScoreTimeMs > 0 && cooldownElapsedMs < 2500) ||
                  !movedFromLastScoreSpot
                ) {
                  // Anti-farming: ball bounces off without awarding duplicate/stationary points
                  ball.state = 'FREE';
                  ball.freeTimer = 0;
                  ball.vx = -ball.vx * 0.35;
                  ball.vy = -ball.vy * 0.35;
                  if (!movedFromLastScoreSpot) {
                    player.speechBubble =
                      '⚠️ Bitte erst weiterrollen vor dem nächsten Treffer!';
                    player.speechTimer = 1.6;
                  }
                  break;
                }

                lastScoredBallId = candidateBallScoreId;
                lastBallScoreTimeMs = now;
                lastBallScorePlayerX = player.x;
                lastBallScorePlayerY = player.y;
                ballDistanceSkatedSinceLastScore = 0;

                const elimCountSoFar = trackNpcs.filter(
                  (n) => n.eliminated
                ).length;
                npc.eliminated = true;
                npc.eliminatedOrder = elimCountSoFar;
                npc.sittingBarrierSpot = null;
                npc.speechText = 'Treffer! Ich stelle mich an den Rand!';
                npc.speechTimer = 3.2;
                speakNpcBubble(npc.speechText, npc.name, npc.gender);
                soundFX.playBallThrowOrHit(true);
                player.ballspielHits += 10;
                p.onChallengeProgress('ballspiel_5_hits', 1);

                // Spawn 16-Bit Arcade "+10" Floating Score Popup & Neon Hit Sparks directly above the hit skater!
                floatingScores.push({
                  x: npc.x,
                  y: npc.y - 32,
                  startY: npc.y - 32,
                  text: '+10',
                  age: 0,
                  duration: 1.15,
                });
                for (let s = 0; s < 10; s++) {
                  const ang = (s / 10) * Math.PI * 2 + Math.random() * 0.3;
                  const spd = 85 + Math.random() * 110;
                  sparks.push({
                    x: npc.x,
                    y: npc.y - 14,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - 30,
                    size: 3.5,
                    color: s % 2 === 0 ? '#39ff14' : '#fde047',
                    alpha: 1,
                  });
                }

                // After hit, ball becomes FREE (harmless) and Manni retrieves it or it rolls back after 2.5s
                ball.state = 'FREE';
                ball.freeTimer = 0;
                ball.vx = -ball.vx * 0.32;
                ball.vy = -ball.vy * 0.32;
                break;
              }
            }
          } else if (ball.state === 'FREE') {
            // Lying FREE balls are completely harmless; Ordner Manni ('guard-1') skates to retrieve & pass to JR, or JR picks it up!
            ball.freeTimer = (ball.freeTimer || 0) + dt;
            const distToPlayer = Math.hypot(
              player.x - ball.x,
              player.y - ball.y
            );
            const distToManni = guardManni
              ? Math.hypot(guardManni.x - ball.x, guardManni.y - ball.y)
              : 9999;

            if (distToPlayer < 48 && !player.isJumping) {
              ball.state = 'HELD';
              ball.holderId = 'player';
              ball.fromPlayer = true;
              ball.id = `ball_${ballThrowSeqCounter++}`;
              ball.freeTimer = 0;
              ball.color = '#39ff14';
            } else if (guardManni && distToManni < 40) {
              ball.state = 'HELD';
              ball.holderId = 'guard-1';
              ball.manniAction = 'pass_to_player';
              ball.holdTimer = 0.32;
              ball.freeTimer = 0;
              ball.color = '#00f0ff';
              guardManni.speechText = '🏃 Ball geholt – Pass zu dir, JR!';
              guardManni.speechTimer = 2.2;
            } else if ((ball.freeTimer || 0) >= 2.5) {
              const dxP = player.x - ball.x;
              const dyP = player.y - ball.y;
              const distP = Math.max(1, Math.hypot(dxP, dyP));
              const returnSpd = 560;
              ball.vx = (dxP / distP) * returnSpd;
              ball.vy = (dyP / distP) * returnSpd;
              if (distP < 56) {
                ball.state = 'HELD';
                ball.holderId = 'player';
                ball.fromPlayer = true;
                ball.id = `ball_${ballThrowSeqCounter++}`;
                ball.freeTimer = 0;
                ball.color = '#39ff14';
              }
            }
          }
        }

        // Ballspiel-Bestzeitjagd ("Last Skater Standing"): Live-Stoppuhr & 3 klare Stopp-Bedingungen
        const activeNonGuardNpcs = trackNpcs.filter((n) => n.role !== 'guard');
        const totalBallspielTargets = activeNonGuardNpcs.length;
        const remainingBallspielTargets = activeNonGuardNpcs.filter(
          (n) => !n.eliminated
        ).length;

        if (totalBallspielTargets === 0) {
          // 3. Abbruch bei leerer Bahn: Stoppt sofort und setzt sauber zurück
          ballspielElapsedSec = 0;
          ballspielRoundEnded = true;
        } else if (!ballspielRoundEnded) {
          ballspielElapsedSec += dt;
          if (remainingBallspielTargets === 0) {
            // 1. Regulärer Sieg: Alle anderen Skater abgeworfen (Last Skater Standing)
            ballspielRoundEnded = true;
            const finalSec = Math.round(ballspielElapsedSec * 10) / 10;
            soundFX.playChallengeUnlocked();
            player.speechBubble = `🏆 BAHN LEERGERÄUMT in ${finalSec.toFixed(1)}s!`;
            player.speechTimer = 4.5;
            p.onBallspielRoundFinished?.({
              elapsedSec: finalSec,
              totalSkaters: totalBallspielTargets,
              reason: 'victory',
            });
          } else if (ballspielElapsedSec >= 180.0) {
            // 2. Sicherheits-Zeitlimit: Automatisch nach 3:00 Minuten (180.0s) beenden
            ballspielElapsedSec = 180.0;
            ballspielRoundEnded = true;
            player.speechBubble =
              '⏱️ 3:00 Min. Zeitlimit erreicht! Ballspiel-Runde beendet.';
            player.speechTimer = 4.0;
            p.onBallspielRoundFinished?.({
              elapsedSec: 180.0,
              totalSkaters: totalBallspielTargets,
              reason: 'timeout',
            });
          }
        }
      } else {
        softballs.length = 0;
        ballspielElapsedSec = 0;
        ballspielRoundEnded = false;
      }

      if (p.hallGameMode === 'slalom') {
        if (
          !onRinkFloor &&
          (slalomRoundsCompleted > 0 || slalomGatesInCurrentRound > 0)
        ) {
          slalomRoundsCompleted = 0;
          slalomGatesInCurrentRound = 0;
          player.slalomCombo = 0;
          lastScoredPylonId = null;
          lastPassSide = null;
          player.speechBubble =
            '🚧 Parcours verlassen! Slalom-Runde & Tempo auf 100 % zurückgesetzt.';
          player.speechTimer = 1.6;
        }
        for (const cone of slalomCones) {
          if (cone.wobbleTimer > 0) {
            cone.wobbleTimer = Math.max(0, cone.wobbleTimer - dt);
          }
          const dist = Math.hypot(player.x - cone.x, player.y - cone.y);
          if (dist < 26 && !player.isJumping) {
            // Direct collision with cone: 0 points & reset slalom combo, round & speed bonus!
            if (cone.wobbleTimer <= 0) {
              cone.wobbleTimer = 1.5;
              player.slalomCombo = 0;
              slalomRoundsCompleted = 0;
              slalomGatesInCurrentRound = 0;
              lastScoredPylonId = cone.id;
              lastPassSide = null;
              cone.passed = false;
              player.speechBubble =
                '💥 Hütchen berührt! Runden-Zähler & Tempo auf 100 % zurückgesetzt!';
              player.speechTimer = 1.6;
              soundFX.playCrash(false);
            }
            continue;
          }

          // True Slalom Gate Pass Detection: check if skater crossed the pylon's X-axis plane
          const crossedConeX =
            (prevSlalomCheckX - cone.x) * (player.x - cone.x) <= 0 &&
            prevSlalomCheckX !== player.x;
          const lateralOffset = player.y - cone.y;
          const absLateral = Math.abs(lateralOffset);

          if (
            crossedConeX &&
            Math.abs(player.vx) > 30 &&
            absLateral >= 18 &&
            absLateral <= 95 &&
            cone.wobbleTimer <= 0
          ) {
            // Determine side ('left' | 'right') relative to the axis of the slalom straight
            // (Top straight y < 500 vs. bottom straight y >= 500)
            const rowCenterY = cone.y >= 500 ? 735 : 225;
            const currentSide: 'left' | 'right' =
              player.y < rowCenterY ? 'left' : 'right';

            if (cone.id === lastScoredPylonId) {
              // Rule 2: Turning around and re-passing the SAME pylon awards 0 points & resets combo!
              player.slalomCombo = 0;
              slalomGatesInCurrentRound = 0;
              lastPassSide = null;
              cone.passed = false;
              player.speechBubble =
                '⚠️ Wenden an derselben Pylone zählt nicht! Combo: 0x';
              player.speechTimer = 1.5;
            } else if (lastPassSide !== null && currentSide === lastPassSide) {
              // Rule 3: Passing on the SAME side as the previous pylon (no zigzag) awards 0 points & resets combo!
              player.slalomCombo = 0;
              slalomGatesInCurrentRound = 0;
              lastScoredPylonId = cone.id;
              lastPassSide = currentSide;
              cone.passed = false;
              player.speechBubble =
                '⚠️ Gleiche Seite! Echter Links-Rechts-Zickzack nötig!';
              player.speechTimer = 1.5;
            } else {
              // Valid alternating Left/Right Slalom Pass!
              cone.passed = true;
              lastScoredPylonId = cone.id;
              lastPassSide = currentSide;
              player.slalomCombo += 1;
              slalomGatesInCurrentRound += 1;
              soundFX.playSlalomCombo(player.slalomCombo);
              p.onAwardObstaclePoints?.(10);

              if (slalomGatesInCurrentRound >= 5) {
                slalomGatesInCurrentRound = 0;
                slalomRoundsCompleted += 1;
                const nextTempoPct =
                  100 + Math.min(80, slalomRoundsCompleted * 8);
                p.onSlalomRoundComplete?.(slalomRoundsCompleted, 2);
                floatingScores.push({
                  x: player.x,
                  y: player.y - 44,
                  startY: player.y - 44,
                  text: `🏁 SLALOM-RUNDE #${slalomRoundsCompleted} • +2 PIXEL • ${nextTempoPct}% TEMPO!`,
                  age: 0,
                  duration: 1.55,
                });
                player.speechBubble = `🏁 Slalom-Runde ${slalomRoundsCompleted} geschafft! +2 Pixel & Tempo ${nextTempoPct} %!`;
                player.speechTimer = 2.2;
              } else {
                floatingScores.push({
                  x: player.x,
                  y: player.y - 34,
                  startY: player.y - 34,
                  text: `+10 (${currentSide === 'left' ? 'LINKS' : 'RECHTS'})`,
                  age: 0,
                  duration: 1.15,
                });
              }

              p.onChallengeProgress(
                'slalom_10_gates',
                player.slalomCombo,
                true
              );
              if (player.slalomCombo >= 10) {
                p.onCertificateEvent?.('clean_slalom');
              }
              window.setTimeout(() => {
                cone.passed = false;
              }, 3500);
            }
          }
        }
        prevSlalomCheckX = player.x;
      } else {
        slalomRoundsCompleted = 0;
        slalomGatesInCurrentRound = 0;
      }

      if (p.hallGameMode === 'stuhlsprung') {
        const cheerMessages = [
          '👏 Stark gesprungen!',
          '🙌 Wahnsinn!',
          '🔥 Sauberer Satz!',
          '👏 Bravo!',
          '🎉 Mega Sprung!',
        ];
        for (const chair of jumpChairs) {
          if (chair.knockedOverTimer > 0) {
            chair.knockedOverTimer = Math.max(0, chair.knockedOverTimer - dt);
          }
          const relX = player.x - chair.x;
          const relY = player.y - chair.y;
          const cosA = Math.cos(-chair.angleRad);
          const sinA = Math.sin(-chair.angleRad);
          const localX = relX * cosA - relY * sinA;
          const localY = relX * sinA + relY * cosA;

          const inChairBox =
            Math.abs(localX) < chair.width / 2 + 16 &&
            Math.abs(localY) < chair.height / 2 + 16;

          if (inChairBox) {
            if (player.isJumping && player.jumpZ > 11) {
              if (!chair.clearedByPlayer) {
                chair.clearedByPlayer = true;
                chair.clearedInLap = true;
                p.onAwardObstaclePoints?.(10);
                floatingScores.push({
                  x: player.x,
                  y: player.y - 38,
                  startY: player.y - 38,
                  text: '+10 Pkt',
                  age: 0,
                  duration: 1.15,
                });
                const clearedCount = jumpChairs.filter(
                  (c) => c.clearedInLap
                ).length;

                if (clearedCount >= jumpChairs.length) {
                  player.speechBubble = `🏆 Komplette Stuhl-Runde (${jumpChairs.length}/${jumpChairs.length}) gemeistert!`;
                  player.speechTimer = 2.6;
                  p.onCertificateEvent?.('clean_jump');
                  jumpChairs.forEach((c) => {
                    c.clearedInLap = false;
                  });
                } else {
                  player.speechBubble =
                    chair.chairCount === 3
                      ? `🔥 3er-Stuhlreihe übersprungen! (${clearedCount}/${jumpChairs.length})`
                      : `Sauberer Sprung! (${clearedCount}/${jumpChairs.length})`;
                  player.speechTimer = 1.8;
                }

                if (chair.chairCount === 3) {
                  p.onChallengeProgress('chair_jump_3', 1);
                  if (Math.hypot(player.vx, player.vy) >= 210) {
                    p.onCertificateEvent?.('high_speed_jump');
                  }
                }

                trackNpcs.forEach((specNpc, sIdx) => {
                  if (sIdx % 2 === chair.id % 2) {
                    specNpc.speechText =
                      cheerMessages[(chair.id + sIdx) % cheerMessages.length];
                    specNpc.speechTimer = 2.0;
                    if (sIdx === 0) {
                      speakNpcBubble(
                        specNpc.speechText,
                        specNpc.name,
                        specNpc.gender
                      );
                    }
                    for (let k = 0; k < 5; k++) {
                      const ang = (Math.PI * 2 * k) / 5 + Math.random() * 0.5;
                      sparks.push({
                        x: specNpc.x,
                        y: specNpc.y - 24,
                        vx: Math.cos(ang) * 55,
                        vy: Math.sin(ang) * 55 - 25,
                        color: ['#39ff14', '#fde047', '#00f0ff', '#ff2a85'][
                          k % 4
                        ],
                        alpha: 1,
                        size: 3.5,
                      });
                    }
                  }
                });

                soundFX.playSlalomCombo(clearedCount);
              }
            } else if (chair.knockedOverTimer <= 0 && player.crashTimer <= 0) {
              chair.knockedOverTimer = 2.5;
              player.crashTimer = 3.2;
              player.totalCrashes += 1;
              player.vx *= -0.35;
              player.vy *= -0.35;
              player.speechBubble = 'Schepper! Zu spät abgesprungen!';
              player.speechTimer = 2.6;
              soundFX.playCrash(false);
              triggerSaniNurseDispatch(player.x, player.y);
            }
          } else if (Math.hypot(relX, relY) > 125) {
            chair.clearedByPlayer = false;
          }
        }
      } else if (p.hallGameMode === 'springerstaffel') {
        const relayGates = [
          { id: 1, x: 760, y: 735, label: 'GESTELL 1' },
          { id: 2, x: 1240, y: 735, label: 'GESTELL 2' },
          { id: 3, x: 1240, y: 235, label: 'GESTELL 3' },
          { id: 4, x: 760, y: 235, label: 'GESTELL 4' },
        ];
        for (const rg of relayGates) {
          const dx = Math.abs(player.x - rg.x);
          const dy = Math.abs(player.y - rg.y);
          if (dx < 26 && dy < 54) {
            if (player.isJumping && player.jumpZ > 10) {
              if (!springerstaffelClearedIds.has(rg.id)) {
                springerstaffelClearedIds.add(rg.id);
                const doneCount = springerstaffelClearedIds.size;
                soundFX.playSlalomCombo(doneCount);
                p.onAwardObstaclePoints?.(10);
                floatingScores.push({
                  x: player.x,
                  y: player.y - 38,
                  startY: player.y - 38,
                  text: '+10 Pkt',
                  age: 0,
                  duration: 1.15,
                });
                if (doneCount >= 4) {
                  p.onCertificateEvent?.('clean_jump');
                  if (
                    activeSpringerstaffelHeightCm >= 160 ||
                    Math.hypot(player.vx, player.vy) >= 220
                  ) {
                    p.onCertificateEvent?.('high_speed_jump');
                  }
                  activeSpringerstaffelHeightCm = Math.min(
                    220,
                    activeSpringerstaffelHeightCm + 20
                  );
                  springerstaffelClearedIds.clear();
                  player.speechBubble = `🤸‍♂️ Springerstaffel-Runde geschafft! Neue Latte: ${activeSpringerstaffelHeightCm} cm (+20 cm)!`;
                  player.speechTimer = 3.0;
                  djSpeechBubble = `🎤 "Wahnsinn! Die Hochsprung-Latte steigt auf ${activeSpringerstaffelHeightCm} cm!"`;
                  djSpeechTimer = 4.2;
                } else {
                  player.speechBubble = `🤸‍♂️ ${activeSpringerstaffelHeightCm} cm übersprungen! (${doneCount}/4)`;
                  player.speechTimer = 1.9;
                }
              }
            } else if (player.crashTimer <= 0) {
              player.crashTimer = 2.8;
              player.totalCrashes += 1;
              player.vx *= -0.35;
              player.vy *= -0.35;
              player.speechBubble = `💥 Hochsprung-Latte (${activeSpringerstaffelHeightCm} cm) gerissen!`;
              player.speechTimer = 2.6;
              soundFX.playCrash(false);
              triggerSaniNurseDispatch(player.x, player.y);
            }
          }
        }
      }

      // ----------------------------------------------------------------------
      // H. UPDATE SPARKS & TRAIL FADING
      // ----------------------------------------------------------------------
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.alpha -= dt * 1.4;
        if (sp.alpha <= 0.02) sparks.splice(i, 1);
      }
      for (let i = trails.length - 1; i >= 0; i--) {
        trails[i].alpha -= dt * 0.45;
        if (trails[i].alpha <= 0.02) trails.splice(i, 1);
      }
      for (let i = floatingScores.length - 1; i >= 0; i--) {
        const fs = floatingScores[i];
        fs.age += dt;
        fs.y = fs.startY - (fs.age / fs.duration) * 36;
        if (fs.age >= fs.duration) floatingScores.splice(i, 1);
      }

      // ----------------------------------------------------------------------
      // I. RENDER COMPLETE 16:9 WIDESCREEN ARENA
      // ----------------------------------------------------------------------
      const interpolatedRemotePlayers = Array.from(remotePlayersMap.values());
      renderCompleteScene(
        ctx,
        now,
        {
          ...p,
          centerStageMode: centerArenaRef.current,
          fogMachineEnabled: fogEnabledRef.current,
          arenaStyle: arenaStyleRef.current,
        },
        player,
        trackNpcs,
        interpolatedRemotePlayers,
        waxPatch,
        stageCloseProgress,
        slalomCones,
        jumpChairs,
        softballs,
        trails,
        sparks,
        djSpeechBubble,
        djHandsUpCheerTimer > 0,
        fogBurstTimer,
        saniNurse,
        jrEasterEggTimer,
        mouseWorldX,
        mouseWorldY,
        hasMouseMovedOnCanvas,
        slowFlirtPartnerId,
        floatingScores
      );

      // Mirror main canvas onto the single sticky Admin Live-Bahnkamera (with Lokal vs. Multiplayer-Halle camera switcher)
      const monitorEl = document.querySelector<HTMLCanvasElement>(
        '#admin-center-live-camera-canvas'
      );
      if (monitorEl) {
        const previewStyle = p.monitorPreviewStyle || arenaStyleRef.current;
        const forceMpView = p.monitorCameraMode === 'multiplayer';
        const mCtx = monitorEl.getContext('2d');
        if (mCtx) {
          mCtx.imageSmoothingEnabled = false;
          mCtx.clearRect(0, 0, monitorEl.width, monitorEl.height);
          if (
            previewStyle !== arenaStyleRef.current ||
            forceMpView !== Boolean(p.isMultiplayerActive)
          ) {
            mCtx.save();
            mCtx.scale(
              monitorEl.width / WORLD_WIDTH,
              monitorEl.height / WORLD_HEIGHT
            );
            renderCompleteScene(
              mCtx,
              now,
              {
                ...p,
                isMultiplayerActive: forceMpView
                  ? true
                  : p.isMultiplayerActive,
                centerStageMode: centerArenaRef.current,
                fogMachineEnabled: fogEnabledRef.current,
                arenaStyle: previewStyle,
                pixel16BitFiguresEnabled:
                  previewStyle === 'pixel-16bit' || p.pixel16BitFiguresEnabled,
              },
              player,
              trackNpcs,
              interpolatedRemotePlayers,
              waxPatch,
              stageCloseProgress,
              slalomCones,
              jumpChairs,
              softballs,
              trails,
              sparks,
              djSpeechBubble,
              djHandsUpCheerTimer > 0,
              fogBurstTimer,
              saniNurse,
              jrEasterEggTimer,
              mouseWorldX,
              mouseWorldY,
              hasMouseMovedOnCanvas,
              slowFlirtPartnerId,
              floatingScores
            );
            mCtx.restore();
          } else {
            mCtx.drawImage(canvas, 0, 0, monitorEl.width, monitorEl.height);
          }
        }
      }

      // ----------------------------------------------------------------------
      // I2. EMIT LOCAL SKATER STATE FOR MULTIPLAYER (~18x PER SECOND / EVERY 55ms)
      // ----------------------------------------------------------------------
      if (
        p.isMultiplayerActive &&
        p.onLocalPlayerState &&
        now - lastMultiplayerEmitTime >= 55
      ) {
        lastMultiplayerEmitTime = now;
        p.onLocalPlayerState({
          name:
            p.isAnonymousGuest || !p.playerName.trim()
              ? 'Gast-Skater'
              : p.playerName.trim(),
          shirtColor: p.playerShirtColor || '#1e1b4b',
          x: Math.round(player.x * 10) / 10,
          y: Math.round(player.y * 10) / 10,
          vx: Math.round(player.vx),
          vy: Math.round(player.vy),
          headingRad: Math.round(player.headingRad * 1000) / 1000,
          spinAngleOffset: Math.round(player.spinAngleOffset * 1000) / 1000,
          isSpinning: player.isSpinning,
          jumpZ: Math.round(player.jumpZ * 10) / 10,
          isJumping: player.isJumping,
          characterMode: p.characterMode,
          kengolHat: p.kengolHatEnabled,
          crashTimer: Math.round(player.crashTimer * 10) / 10,
          speechBubble: player.speechBubble,
          activeTrickMove: player.activeTrickMove,
          trickTimer: Math.round(player.trickTimer * 10) / 10,
          wristbandColor: p.upgrades.wristbandsEnabled
            ? p.upgrades.wristbandColor
            : undefined,
          activeCharm: p.upgrades.activeCharm || null,
          avatarRole: p.avatarRole || 'standard',
        });
      }

      // ----------------------------------------------------------------------
      // J. EMIT LIVE TELEMETRY TO REACT HUD
      // ----------------------------------------------------------------------
      if (now - lastTelemetryTime > 65) {
        lastTelemetryTime = now;
        const djDist = Math.hypot(
          player.x - ARENA_LAYOUT.djTower.centerX,
          player.y - ARENA_LAYOUT.djTower.centerY
        );
        const djProximity = Math.max(0.15, Math.min(1, 1 - djDist / 1350));
        const rentalCenterX =
          ARENA_LAYOUT.proShopAndRental.rentalBounds.x +
          ARENA_LAYOUT.proShopAndRental.rentalBounds.width / 2;

        const nonGuardNpcs = trackNpcs.filter((n) => n.role !== 'guard');
        const ballspielTotal = nonGuardNpcs.length || 15;
        const ballspielRemaining = nonGuardNpcs.filter(
          (n) => !n.eliminated
        ).length;

        p.onTelemetry({
          x: Math.round(player.x),
          y: Math.round(player.y),
          speed: Math.round(speed),
          laps: player.laps,
          cleanLapsStreak: player.cleanLapsStreak,
          crashes: player.totalCrashes,
          isSlipstreamActive: player.isSlipstreamActive,
          isOnWaxPatch: player.isOnWaxPatch,
          slushTimerSec: Math.ceil(player.slushRemainingSec),
          blobaColaTimerSec: Math.ceil(player.blobaColaRemainingSec),
          freeSlushCount: player.freeSlushCount,
          freeBlobaCount: player.freeBlobaCount,
          nearProShop:
            Math.hypot(
              player.x - ARENA_LAYOUT.proShopAndRental.proShopInteractX,
              player.y - ARENA_LAYOUT.proShopAndRental.proShopInteractY
            ) <= ARENA_LAYOUT.proShopAndRental.proShopInteractRadius,
          nearSkateRental:
            Math.hypot(
              player.x - ARENA_LAYOUT.proShopAndRental.rentalInteractX,
              player.y - ARENA_LAYOUT.proShopAndRental.rentalInteractY
            ) <= ARENA_LAYOUT.proShopAndRental.rentalInteractRadius,
          nearBistroCounter:
            Math.hypot(
              player.x - ARENA_LAYOUT.bistro.interactX,
              player.y - ARENA_LAYOUT.bistro.interactY
            ) <= ARENA_LAYOUT.bistro.interactRadius,
          nearDjTower:
            Math.hypot(
              player.x - ARENA_LAYOUT.djTower.egoTriggerX,
              player.y - ARENA_LAYOUT.djTower.egoTriggerY
            ) <= ARENA_LAYOUT.djTower.egoTriggerRadius,
          nearCashier:
            Math.hypot(
              player.x - ARENA_LAYOUT.bottomEntrance.cashierBooth.centerX,
              player.y - ARENA_LAYOUT.bottomEntrance.cashierBooth.centerY
            ) <= 130,
          hasSkatesEquipped,
          djAudioProximity: djProximity,
          gamepadConnected,
          gamepadName,
          activeSpeech: player.speechBubble,
          ballspielScore: player.ballspielHits,
          ballspielRemaining,
          ballspielTotal,
          slalomCombo: player.slalomCombo,
          activeTrickMove: player.activeTrickMove,
          nearLockers: Boolean(
            ARENA_LAYOUT.lockers &&
              Math.hypot(
                player.x -
                  (ARENA_LAYOUT.lockers.x + ARENA_LAYOUT.lockers.width / 2),
                player.y -
                  (ARENA_LAYOUT.lockers.y + ARENA_LAYOUT.lockers.height / 2)
              ) <=
                  Math.max(
                    ARENA_LAYOUT.lockers.width,
                    ARENA_LAYOUT.lockers.height
                  ) /
                    2 +
                    58
            ),
          nearNewspaperStand:
            propsRef.current.newspaperEnabled !== false &&
            Math.hypot(
              player.x -
                (ARENA_LAYOUT.bottomEntrance.cashierBooth.x +
                  ARENA_LAYOUT.bottomEntrance.cashierBooth.width / 2),
              player.y -
                (ARENA_LAYOUT.bottomEntrance.cashierBooth.y +
                  ARENA_LAYOUT.bottomEntrance.cashierBooth.height +
                  36)
            ) <= 84,
          nearLeaderboardBoard:
            Math.hypot(
              player.x -
                (ARENA_LAYOUT.bottomEntrance.cashierBooth.x +
                  ARENA_LAYOUT.bottomEntrance.cashierBooth.width +
                  66),
              player.y -
                (ARENA_LAYOUT.bottomEntrance.cashierBooth.y +
                  ARENA_LAYOUT.bottomEntrance.cashierBooth.height +
                  26)
            ) <= 88,
          nearCustomCrewId:
            (propsRef.current.customCrewMembers || []).find(
              (cm) => Math.hypot(player.x - cm.x, player.y - cm.y) <= 78
            )?.id || null,
          slalomRound: slalomRoundsCompleted,
          slalomSpeedPercent: 100 + Math.min(80, slalomRoundsCompleted * 8),
          nearArcadeMachine:
            (
              [
                { id: 'monkey-stomp' as const, x: 84, y: 264 },
                { id: 'disco-invaders' as const, x: 148, y: 264 },
                { id: 'pac-roller' as const, x: 212, y: 264 },
              ].find(
                (cab) =>
                  Math.hypot(player.x - cab.x, player.y - (cab.y + 18)) <= 76
              ) || null
            )?.id || null,
          ballspielElapsedSec: Math.round(ballspielElapsedSec * 10) / 10,
          isArcadeProtected: Boolean(p.isPlayingArcade),
        });
      }

      animFrameId = requestAnimationFrame(stepFrame);
    };

    animFrameId = requestAnimationFrame(stepFrame);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', applyCanvasHiDpiScale);
      document.removeEventListener('fullscreenchange', applyCanvasHiDpiScale);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
      window.removeEventListener('gamepadconnected', onGamepadConn);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconn);
      canvas.removeEventListener('mousedown', handleCanvasClick);
      canvas.removeEventListener('mousemove', handleCanvasMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      className="w-full h-full block select-none pixel-crisp-canvas"
    />
  );
};

// ============================================================================
// COLLISION SOLVER (COMPLETE ROUNDED BLUE RINK BARRIER, DJ-TOWER, SHOPS, ETC.)
// ============================================================================

/**
 * Keeps AI track skaters strictly inside the rounded blue rink barrier AND
 * dynamically pushes them out of any moved room modules / Schleusen baffles!
 */
function clampPointInsideRoundedRink(
  entity: { x: number; y: number; vx?: number; vy?: number },
  margin = 24
): void {
  const { rink, djTower, uIslands, gates, proShopAndRental, bistro } =
    ARENA_LAYOUT;
  const minX = rink.x + margin;
  const maxX = rink.x + rink.width - margin;
  const minY = rink.y + margin;
  const maxY = rink.y + rink.height - margin;

  if (entity.x < minX) entity.x = minX;
  if (entity.x > maxX) entity.x = maxX;
  if (entity.y < minY) entity.y = minY;
  if (entity.y > maxY) entity.y = maxY;

  // Bottom-Left & Bottom-Right rounded corners (cornerRadius = 190)
  const cr = rink.cornerRadius;
  const maxCornerDist = cr - margin;

  // Bottom-Right corner arc center: (rink.x + rink.width - cr, rink.y + rink.height - cr) = (1520, 670)
  const brCx = rink.x + rink.width - cr;
  const brCy = rink.y + rink.height - cr;
  if (entity.x > brCx && entity.y > brCy) {
    const dx = entity.x - brCx;
    const dy = entity.y - brCy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxCornerDist && dist > 0.01) {
      entity.x = brCx + (dx / dist) * maxCornerDist;
      entity.y = brCy + (dy / dist) * maxCornerDist;
    }
  }

  // Bottom-Left corner arc center: (rink.x + cr, rink.y + rink.height - cr) = (480, 670)
  const blCx = rink.x + cr;
  const blCy = rink.y + rink.height - cr;
  if (entity.x < blCx && entity.y > blCy) {
    const dx = entity.x - blCx;
    const dy = entity.y - blCy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxCornerDist && dist > 0.01) {
      entity.x = blCx + (dx / dist) * maxCornerDist;
      entity.y = blCy + (dy / dist) * maxCornerDist;
    }
  }

  // Top-Left curved DJ-Tower arc
  const djDist = Math.hypot(
    entity.x - djTower.cornerX,
    entity.y - djTower.cornerY
  );
  const minDjDist = 315 + margin;
  if (djDist < minDjDist && djDist > 0.01) {
    entity.x = djTower.cornerX + ((entity.x - djTower.cornerX) / djDist) * minDjDist;
    entity.y = djTower.cornerY + ((entity.y - djTower.cornerY) / djDist) * minDjDist;
  }

  // Dynamic module hitbox avoidance for AI skaters (Schleusen baffles, U-Islands/Stage, Shop, Rental, Bistro)
  const pushOutBox = (bx: number, by: number, bw: number, bh: number, pad = 14) => {
    const closestX = Math.max(bx, Math.min(entity.x, bx + bw));
    const closestY = Math.max(by, Math.min(entity.y, by + bh));
    const dx = entity.x - closestX;
    const dy = entity.y - closestY;
    const dist = Math.hypot(dx, dy);
    if (dist < pad) {
      if (dist > 0.01) {
        entity.x += (dx / dist) * (pad - dist);
        entity.y += (dy / dist) * (pad - dist);
      } else {
        entity.y = by - pad;
      }
    }
  };

  pushOutBox(
    gates.bottomLeftSchwingtuer.baffleXStart,
    gates.bottomLeftSchwingtuer.baffleY - 5,
    gates.bottomLeftSchwingtuer.baffleXEnd -
      gates.bottomLeftSchwingtuer.baffleXStart,
    10,
    14
  );
  pushOutBox(
    gates.bottomRightEntrance.baffleXStart,
    gates.bottomRightEntrance.baffleY - 5,
    gates.bottomRightEntrance.baffleXEnd -
      gates.bottomRightEntrance.baffleXStart,
    10,
    14
  );
  pushOutBox(
    uIslands.leftDefaultX,
    uIslands.topY,
    uIslands.wallThickness,
    uIslands.height,
    14
  );
  pushOutBox(
    uIslands.rightDefaultX + uIslands.width - uIslands.wallThickness,
    uIslands.topY,
    uIslands.wallThickness,
    uIslands.height,
    14
  );
  pushOutBox(
    proShopAndRental.proShopBounds.x,
    proShopAndRental.proShopBounds.y,
    proShopAndRental.proShopBounds.width,
    proShopAndRental.proShopBounds.height,
    14
  );
  pushOutBox(
    proShopAndRental.rentalCounter.x,
    proShopAndRental.rentalCounter.y,
    proShopAndRental.rentalCounter.width,
    proShopAndRental.rentalCounter.height,
    14
  );
  pushOutBox(
    bistro.counter.x,
    bistro.counter.y,
    bistro.counter.width,
    bistro.counter.height,
    14
  );
  if (ARENA_LAYOUT.lockers) {
    pushOutBox(
      ARENA_LAYOUT.lockers.x,
      ARENA_LAYOUT.lockers.y,
      ARENA_LAYOUT.lockers.width,
      ARENA_LAYOUT.lockers.height,
      14
    );
  }
}

function resolvePlayerArenaCollisions(
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
  },
  stageCloseProgress: number
): void {
  const r = player.radius;

  if (player.x < 24 + r) {
    player.x = 24 + r;
    player.vx = Math.abs(player.vx) * 0.55;
  }
  if (player.x > WORLD_WIDTH - 24 - r) {
    player.x = WORLD_WIDTH - 24 - r;
    player.vx = -Math.abs(player.vx) * 0.55;
  }
  if (
    player.x >= ARENA_LAYOUT.slopedBackWall.bottomLeftX - r &&
    player.y < ARENA_LAYOUT.slopedBackWall.bottomY + r
  ) {
    player.y = ARENA_LAYOUT.slopedBackWall.bottomY + r;
    player.vy = Math.abs(player.vy) * 0.55;
  }
  if (player.y < 16 + r) {
    player.y = 16 + r;
    player.vy = Math.abs(player.vy) * 0.55;
  }
  if (player.y > WORLD_HEIGHT - 24 - r) {
    player.y = WORLD_HEIGHT - 24 - r;
    player.vy = -Math.abs(player.vy) * 0.55;
  }

  const collideBox = (bx: number, by: number, bw: number, bh: number) => {
    const closestX = Math.max(bx, Math.min(player.x, bx + bw));
    const closestY = Math.max(by, Math.min(player.y, by + bh));
    const dx = player.x - closestX;
    const dy = player.y - closestY;
    const dist = Math.hypot(dx, dy);
    if (dist < r) {
      if (dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        player.x += nx * (r - dist);
        player.y += ny * (r - dist);
        const dot = player.vx * nx + player.vy * ny;
        if (dot < 0) {
          player.vx -= 1.45 * dot * nx;
          player.vy -= 1.45 * dot * ny;
        }
      } else {
        player.y -= r;
      }
    }
  };

  const collideRotatedBox = (
    cx: number,
    cy: number,
    bw: number,
    bh: number,
    angleRad: number
  ) => {
    const cosA = Math.cos(-angleRad);
    const sinA = Math.sin(-angleRad);
    const relX = player.x - cx;
    const relY = player.y - cy;
    const localX = relX * cosA - relY * sinA;
    const localY = relX * sinA + relY * cosA;
    const closestX = Math.max(-bw / 2, Math.min(localX, bw / 2));
    const closestY = Math.max(-bh / 2, Math.min(localY, bh / 2));
    const ldx = localX - closestX;
    const ldy = localY - closestY;
    const dist = Math.hypot(ldx, ldy);
    if (dist < r && dist > 0.001) {
      const lnx = ldx / dist;
      const lny = ldy / dist;
      const cosW = Math.cos(angleRad);
      const sinW = Math.sin(angleRad);
      const nx = lnx * cosW - lny * sinW;
      const ny = lnx * sinW + lny * cosW;
      player.x += nx * (r - dist);
      player.y += ny * (r - dist);
      const dot = player.vx * nx + player.vy * ny;
      if (dot < 0) {
        player.vx -= 1.45 * dot * nx;
        player.vy -= 1.45 * dot * ny;
      }
    }
  };

  // Collides player against a circular barrier arc (from both inside and outside the rink!)
  const collideCircularArc = (
    cx: number,
    cy: number,
    arcRadius: number,
    startAngle: number,
    endAngle: number,
    halfThickness = 6
  ) => {
    const dx = player.x - cx;
    const dy = player.y - cy;
    const ang = Math.atan2(dy, dx);
    // Check if angle is within [startAngle, endAngle]
    if (ang >= startAngle && ang <= endAngle) {
      const dist = Math.hypot(dx, dy);
      const minSeparation = r + halfThickness;
      const delta = dist - arcRadius;
      if (Math.abs(delta) < minSeparation && dist > 0.01) {
        const sign = delta >= 0 ? 1 : -1;
        const nx = (dx / dist) * sign;
        const ny = (dy / dist) * sign;
        const push = minSeparation - Math.abs(delta);
        player.x += nx * push;
        player.y += ny * push;
        const dot = player.vx * nx + player.vy * ny;
        if (dot < 0) {
          player.vx -= 1.45 * dot * nx;
          player.vy -= 1.45 * dot * ny;
        }
      }
    } else {
      // Check arc endpoints so there are no gaps between straight walls and corner arcs
      for (const a of [startAngle, endAngle]) {
        const ex = cx + Math.cos(a) * arcRadius;
        const ey = cy + Math.sin(a) * arcRadius;
        const edx = player.x - ex;
        const edy = player.y - ey;
        const edist = Math.hypot(edx, edy);
        const minSep = r + halfThickness;
        if (edist < minSep && edist > 0.01) {
          const nx = edx / edist;
          const ny = edy / edist;
          player.x += nx * (minSep - edist);
          player.y += ny * (minSep - edist);
          const dot = player.vx * nx + player.vy * ny;
          if (dot < 0) {
            player.vx -= 1.45 * dot * nx;
            player.vy -= 1.45 * dot * ny;
          }
        }
      }
    }
  };

  const {
    rink,
    gates,
    uIslands,
    djTower,
    mirrorWall,
    rightWallBenches,
    bistro,
    proShopAndRental,
    bottomEntrance,
  } = ARENA_LAYOUT;

  // 2. Quarter-Circle Curved Corner DJ-Tower Collision (Pushed deep into the top-left corner (16, 6))
  const djCornerDist = Math.hypot(
    player.x - djTower.cornerX,
    player.y - djTower.cornerY
  );
  const djArcRadius = 315 + r;
  if (djCornerDist < djArcRadius && djCornerDist > 0.01) {
    const nx = (player.x - djTower.cornerX) / djCornerDist;
    const ny = (player.y - djTower.cornerY) / djCornerDist;
    player.x = djTower.cornerX + nx * djArcRadius;
    player.y = djTower.cornerY + ny * djArcRadius;
    const dot = player.vx * nx + player.vy * ny;
    if (dot < 0) {
      player.vx -= 1.45 * dot * nx;
      player.vy -= 1.45 * dot * ny;
    }
  }

  // Vertical Left Mirror Wall Collision
  collideBox(mirrorWall.x, mirrorWall.y, mirrorWall.width, mirrorWall.height);

  // 3. COMPLETE ROUNDED BLUE RINK BARRIER COLLISION (Closed left barrier x=290 + TWO offset Schleusen-Banden on bottom!):
  const cr = rink.cornerRadius; // 190
  const rightBarrierX = rink.x + rink.width; // 1710
  const bottomBarrierY = rink.y + rink.height; // 860

  // 3a. Top Rink Barrier (from bevelTopX = 442 to rightBarrierX = 1710 at y = 108)
  collideBox(
    djTower.bevelTopX,
    rink.y - 6,
    rightBarrierX - djTower.bevelTopX,
    12
  );

  // 3b. Right Rink Barrier straight segment (from y = 108 down to start of bottom-right curve y = 860 - 190 = 670)
  collideBox(rightBarrierX - 6, rink.y, 12, rink.height - cr);

  // 3c. Bottom-Right Rounded Barrier Arc (center = (1520, 670), radius = 190, angle 0..PI/2)
  collideCircularArc(
    rightBarrierX - cr,
    bottomBarrierY - cr,
    cr,
    0,
    Math.PI * 0.5,
    6
  );

  // 3d. Bottom Rink Barrier straight segments (open ONLY at Schleusen-Bande 1 [480..600] and Schleusen-Bande 2 [1350..1470])
  if (gates.bottomLeftSchwingtuer.xStart > rink.x + cr) {
    collideBox(
      rink.x + cr,
      bottomBarrierY - 6,
      gates.bottomLeftSchwingtuer.xStart - (rink.x + cr),
      12
    );
  }
  collideBox(
    gates.bottomLeftSchwingtuer.xEnd,
    bottomBarrierY - 6,
    gates.bottomRightEntrance.xStart - gates.bottomLeftSchwingtuer.xEnd,
    12
  );
  if (rightBarrierX - cr > gates.bottomRightEntrance.xEnd) {
    collideBox(
      gates.bottomRightEntrance.xEnd,
      bottomBarrierY - 6,
      rightBarrierX - cr - gates.bottomRightEntrance.xEnd,
      12
    );
  }

  // Offset parallel Schleusen-Banden (48px wide baffle bars recessed 95px inward at y = 765)
  collideBox(
    gates.bottomLeftSchwingtuer.baffleXStart,
    gates.bottomLeftSchwingtuer.baffleY - 5,
    gates.bottomLeftSchwingtuer.baffleXEnd -
      gates.bottomLeftSchwingtuer.baffleXStart,
    10
  );
  collideBox(
    gates.bottomRightEntrance.baffleXStart,
    gates.bottomRightEntrance.baffleY - 5,
    gates.bottomRightEntrance.baffleXEnd -
      gates.bottomRightEntrance.baffleXStart,
    10
  );

  // 3e. Bottom-Left Rounded Barrier Arc (completely closed from angle PI/2 to PI!)
  collideCircularArc(
    rink.x + cr,
    bottomBarrierY - cr,
    cr,
    Math.PI * 0.5,
    Math.PI,
    6
  );

  // 3f. Left Rink Barrier straight segment (completely closed from curved DJ-Tower y = 260 down to bottom-left curve y = 670!)
  collideBox(
    rink.x - 6,
    djTower.bevelLeftY,
    12,
    bottomBarrierY - cr - djTower.bevelLeftY
  );

  // 4. 90°-Rotated Center U-Islands (`[` on the Left and `]` on the Right) OR Solid Center Stage (including frame & top info banner)
  const w = uIslands.width;
  const h = uIslands.height;
  const t = uIslands.wallThickness;
  const topY = uIslands.topY;

  if (stageCloseProgress > 0.25) {
    collideBox(
      uIslands.closedStageX - 10,
      uIslands.closedStageY - 28,
      uIslands.closedStageWidth + 20,
      uIslands.closedStageHeight + 36
    );
  } else {
    const lx = uIslands.leftDefaultX;
    collideBox(lx, topY, t, h);
    collideBox(lx, topY, w, t);
    collideBox(lx, topY + h - t, w, t);

    const rx = uIslands.rightDefaultX;
    collideBox(rx + w - t, topY, t, h);
    collideBox(rx, topY, w, t);
    collideBox(rx, topY + h - t, w, t);
  }

  // 5. Right Wall Benches & Right-Wall Tech Double Door
  for (const rb of rightWallBenches) {
    collideBox(rb.x, rb.y, rb.width, rb.height);
  }
  collideBox(
    ARENA_LAYOUT.rightWallTechDoor.x,
    ARENA_LAYOUT.rightWallTechDoor.y,
    ARENA_LAYOUT.rightWallTechDoor.width,
    ARENA_LAYOUT.rightWallTechDoor.height
  );
  collideBox(
    ARENA_LAYOUT.putzraumDoor.x,
    ARENA_LAYOUT.putzraumDoor.y,
    ARENA_LAYOUT.putzraumDoor.width,
    ARENA_LAYOUT.putzraumDoor.height
  );

  // 6. Pushed-Back Bottom-Left Bistro Counter, 80s Seating Group Benches & Bistro Tables
  collideBox(
    bistro.counter.x,
    bistro.counter.y,
    bistro.counter.width,
    bistro.counter.height
  );
  for (const wb of bistro.wallBenches) {
    collideBox(wb.x, wb.y, wb.width, wb.height);
  }
  for (const mt of bistro.marbleTables) {
    const dx = player.x - mt.x;
    const dy = player.y - mt.y;
    const dist = Math.hypot(dx, dy);
    const minDist = mt.radius + 4 + r;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      player.x = mt.x + nx * minDist;
      player.y = mt.y + ny * minDist;
    }
  }

  // 7. Right-Wall Cashier Booth -> Compact Mini-Stand Pro-Shop -> Compact Rollschuhverleih (Counter + Back-Wall Shoe Shelves)
  collideRotatedBox(
    bottomEntrance.cashierBooth.centerX,
    bottomEntrance.cashierBooth.centerY,
    bottomEntrance.cashierBooth.width,
    bottomEntrance.cashierBooth.height,
    bottomEntrance.cashierBooth.angleRad
  );
  collideBox(
    proShopAndRental.proShopBounds.x,
    proShopAndRental.proShopBounds.y,
    proShopAndRental.proShopBounds.width,
    proShopAndRental.proShopBounds.height
  );
  collideBox(
    proShopAndRental.dividerWall.x,
    proShopAndRental.dividerWall.y,
    proShopAndRental.dividerWall.width,
    proShopAndRental.dividerWall.height
  );
  // Rollschuhverleih front counter + back-wall shoe shelves with collision protection
  collideBox(
    proShopAndRental.rentalCounter.x,
    proShopAndRental.rentalCounter.y,
    proShopAndRental.rentalCounter.width,
    proShopAndRental.rentalCounter.height
  );
  for (const shelf of proShopAndRental.rentalShelves) {
    collideBox(shelf.x, shelf.y, shelf.width, shelf.height);
  }
  collideBox(
    proShopAndRental.rentalBounds.x,
    proShopAndRental.rentalBounds.y,
    10,
    proShopAndRental.rentalBounds.height
  );
  collideBox(
    proShopAndRental.rentalBounds.x + proShopAndRental.rentalBounds.width - 10,
    proShopAndRental.rentalBounds.y,
    10,
    proShopAndRental.rentalBounds.height
  );

  // 8. 80s Locker Row ("SPINDE") dynamic collision hitbox
  if (ARENA_LAYOUT.lockers) {
    collideBox(
      ARENA_LAYOUT.lockers.x,
      ARENA_LAYOUT.lockers.y,
      ARENA_LAYOUT.lockers.width,
      ARENA_LAYOUT.lockers.height
    );
  }
}

// ============================================================================
// WIDESCREEN 2D/2.5D RENDERER (ALL ZONES, CURVED DJ-TOWER, KENGOL BREAKDANCERS)
// ============================================================================

let activeArenaStyle: ArenaVisualStyle = 'classic-neon';
let activePixel16BitFigures = false;
let activeCrewNames: CrewNamesConfig = { ...DEFAULT_CREW_NAMES };
let activeSpringerstaffelHeightCm = 60;

interface DeferredOverlayItem {
  kind: 'badge' | 'bubble';
  worldX: number;
  worldY: number;
  text: string;
  borderColor?: string;
  hasMultiplayerStar?: boolean;
}
let isDeferringOverlays = false;
const deferredOverlayQueue: DeferredOverlayItem[] = [];

function renderCompleteScene(
  ctx: CanvasRenderingContext2D,
  now: number,
  p: {
    playerName: string;
    playerShirtColor?: string;
    isAnonymousGuest: boolean;
    showNames: boolean;
    nameDisplayMode?: NameDisplayMode;
    characterMode: PlayerCharacterMode;
    cameraMode: CameraViewMode;
    lightingMode: LightingMode;
    centerStageMode: CenterStageMode;
    concertLightingMode: ConcertLightingMode;
    arenaStyle: ArenaVisualStyle;
    fullHallPutzlichtEnabled?: boolean;
    pixel16BitFiguresEnabled?: boolean;
    backgroundDancersEnabled?: boolean;
    cinemaCountdownEnabled?: boolean;
    cinemaCountdownTitle?: string;
    cinemaCountdownTargetIso?: string;
    cinemaWeekdays?: string[];
    cinemaStartTime?: string;
    crewNames?: CrewNamesConfig;
    activeDjName: string;
    activeBandName: string;
    bandSkinTone: BandSkinToneMode;
    bandGender: BandGenderMode;
    hallGameMode: HallGameMode;
    djTickerText: string;
    specialSkaters: string[];
    ghostSkatersEnabled: boolean;
    kengolHatEnabled: boolean;
    upgrades: ProShopUpgradesState;
    fogMachineEnabled: boolean;
    hasOwnSkates: boolean;
    hasRentedSkates: boolean;
    drinkChipAvailable: boolean;
    isMultiplayerActive?: boolean;
    buildModeEnabled?: boolean;
    customLayout?: CustomArenaLayoutState;
    selectedBuildItemId?: string | null;
    showAiNames?: boolean;
    showOwnName?: boolean;
    showSpeechBubbles?: boolean;
    vipDiscoSkatesEquipped?: boolean;
    skateDirection?: 'ccw' | 'cw';
    springerStaffelShowActive?: boolean;
    neonLightboxesEnabled?: boolean;
    neonLightboxLine1?: string;
    neonLightboxLine2?: string;
    neonLightboxLine3?: string;
    mobilitySelected?: boolean;
    avatarRole?: 'standard' | 'kid' | 'stammgast';
    sundayCliqueActive?: boolean;
    customCrewMembers?: CustomCrewStationMember[];
    newspaperEnabled?: boolean;
    newspaperHasNewBadge?: boolean;
    isPlayingArcade?: boolean;
  },
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    headingRad: number;
    radius: number;
    spinAngleOffset: number;
    isSpinning: boolean;
    jumpZ: number;
    isJumping: boolean;
    stridePhase: number;
    crashTimer: number;
    medicRescueTimer: number;
    slushRemainingSec: number;
    blobaColaRemainingSec: number;
    isSlipstreamActive: boolean;
    isOnWaxPatch: boolean;
    speechBubble: string | null;
    activeTrickMove?: TrickMoveId | null;
    trickTimer?: number;
  },
  trackNpcs: TrackNpc[],
  remotePlayers: InterpolatedRemotePlayer[],
  waxPatch: { x: number; y: number; radiusX: number; radiusY: number },
  stageCloseProgress: number,
  slalomCones: SlalomCone[],
  jumpChairs: JumpObstacleChair[],
  softballs: NeonSoftball[],
  trails: WheelTrailPoint[],
  sparks: SparkParticle[],
  djSpeechBubble: string | null,
  djHandsUpActive: boolean,
  fogBurstTimer: number,
  saniNurse: {
    active: boolean;
    withStretcherTeam?: boolean;
    phase: 'idle' | 'running-in' | 'kneeling' | 'walking-out';
    x: number;
    y: number;
    headingRad: number;
    speechText: string | null;
  },
  jrEasterEggTimer = 0,
  mouseWorldX = 1000,
  mouseWorldY = 480,
  hasMouseMovedOnCanvas = false,
  slowFlirtPartnerId: string | null = null,
  floatingScores: {
    x: number;
    y: number;
    startY: number;
    text: string;
    age: number;
    duration: number;
  }[] = []
): void {
  const isPutzlicht =
    p.lightingMode === 'putzlicht' && p.fullHallPutzlichtEnabled !== false;
  const isBlacklight = p.lightingMode === 'blacklight';
  const isSlowSkating = p.lightingMode === 'slow-skating';
  activeArenaStyle = p.arenaStyle || 'classic-neon';
  activePixel16BitFigures =
    activeArenaStyle === 'pixel-16bit' || Boolean(p.pixel16BitFiguresEnabled);
  activeCrewNames = p.crewNames || DEFAULT_CREW_NAMES;

  // Defer all skater/NPC name badges & speech bubbles so they are drawn ABOVE the fog and floor spots!
  deferredOverlayQueue.length = 0;
  isDeferringOverlays = true;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = isPutzlicht
    ? '#475569'
    : isBlacklight
    ? '#110726'
    : isSlowSkating
    ? '#080412'
    : activeArenaStyle === 'palladium-1989'
    ? '#080612'
    : activeArenaStyle === 'pixel-16bit'
    ? '#121024'
    : '#181B24';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  if (p.cameraMode === 'chase') {
    const zoomX = 1.48;
    const zoomY = 1.32;
    const camX = Math.max(420, Math.min(WORLD_WIDTH - 420, player.x));
    const camY = Math.max(300, Math.min(WORLD_HEIGHT - 300, player.y));
    ctx.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.scale(zoomX, zoomY);
    ctx.translate(-camX, -camY);
  } else if (p.cameraMode === 'ego') {
    const zoomX = 1.92;
    const zoomY = 1.72;
    const lookAheadX = Math.max(
      340,
      Math.min(WORLD_WIDTH - 340, player.x + Math.cos(player.headingRad) * 115)
    );
    const lookAheadY = Math.max(
      240,
      Math.min(WORLD_HEIGHT - 240, player.y + Math.sin(player.headingRad) * 115)
    );
    ctx.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.scale(zoomX, zoomY);
    ctx.translate(-lookAheadX, -lookAheadY);
  } else if (
    typeof window !== 'undefined' &&
    window.innerWidth <= 1024 &&
    !p.buildModeEnabled
  ) {
    // 3b. Responsive Follow-Cam Zoom on Mobile & Tablet (max-width: 1024px)
    const followZoom = window.innerWidth < 640 ? 1.56 : 1.32;
    const halfW = WORLD_WIDTH / (2 * followZoom);
    const halfH = WORLD_HEIGHT / (2 * followZoom);
    const camX = Math.max(halfW, Math.min(WORLD_WIDTH - halfW, player.x));
    const camY = Math.max(halfH, Math.min(WORLD_HEIGHT - halfH, player.y));
    ctx.translate(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.scale(followZoom, followZoom);
    ctx.translate(-camX, -camY);
  }

  // 1. OUTER HALL FLOOR & EPOCH STYLE WALL/FLOOR TREATMENT
  switch (activeArenaStyle) {
    case 'palladium-1989': {
      // Windowless dark 1989 hall floor & side wall neon/chrome ornaments
      ctx.fillStyle = isPutzlicht ? '#334155' : '#090714';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Subtle chrome/violet 1989 carpet grid outside the rink
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.09)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < WORLD_WIDTH; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, WORLD_HEIGHT);
        ctx.stroke();
      }
      for (let gy = 0; gy < WORLD_HEIGHT; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(WORLD_WIDTH, gy);
        ctx.stroke();
      }

      // Windowless 1989 Right & Bottom Wall Geometric Neon/Chrome Line Ornaments
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 8, WORLD_WIDTH - 20, WORLD_HEIGHT - 16);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.38)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(14, 12, WORLD_WIDTH - 28, WORLD_HEIGHT - 24);
      ctx.restore();
      break;
    }
    case 'pixel-16bit': {
      // 16-Bit Arcade checkerboard tile floor
      ctx.fillStyle = isPutzlicht ? '#3b4262' : '#141229';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      for (let gx = 0; gx < WORLD_WIDTH; gx += 32) {
        for (let gy = 0; gy < WORLD_HEIGHT; gy += 32) {
          if (((gx + gy) / 32) % 2 === 0) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
            ctx.fillRect(gx, gy, 32, 32);
          }
        }
      }
      break;
    }
    case 'classic-neon':
    default: {
      ctx.fillStyle = isPutzlicht
        ? '#475569'
        : isBlacklight
        ? '#110726'
        : isSlowSkating
        ? '#090514'
        : '#232631';
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      ctx.strokeStyle = isPutzlicht
        ? 'rgba(255,255,255,0.08)'
        : isBlacklight
        ? 'rgba(139,92,246,0.12)'
        : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < WORLD_WIDTH; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, WORLD_HEIGHT);
        ctx.stroke();
      }
      for (let gy = 0; gy < WORLD_HEIGHT; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(WORLD_WIDTH, gy);
        ctx.stroke();
      }
      break;
    }
  }

  // 2. SEAMLESS WARM DARK HARDWOOD PARQUET WITH CURVED QUARTER-CIRCLE TOP-LEFT TRANSITION TO DJ-TOWER
  const { rink, gates, slopedBackWall, djTower } = ARENA_LAYOUT;
  const r = rink.cornerRadius;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(djTower.bevelTopX, rink.y);
  ctx.lineTo(rink.x + rink.width, rink.y);
  ctx.lineTo(rink.x + rink.width, rink.y + rink.height - r);
  ctx.arcTo(
    rink.x + rink.width,
    rink.y + rink.height,
    rink.x + rink.width - r,
    rink.y + rink.height,
    r
  );
  ctx.lineTo(rink.x + r, rink.y + rink.height);
  ctx.arcTo(
    rink.x,
    rink.y + rink.height,
    rink.x,
    rink.y + rink.height - r,
    r
  );
  ctx.lineTo(djTower.bevelLeftX, djTower.bevelLeftY);
  // Harmonious quarter-circle curve bowed back into the top-left corner!
  ctx.quadraticCurveTo(
    djTower.curveCtrlX,
    djTower.curveCtrlY,
    djTower.bevelTopX,
    djTower.bevelTopY
  );
  ctx.closePath();
  ctx.clip();

  const woodGrad = ctx.createRadialGradient(
    rink.centerX,
    rink.centerY,
    80,
    rink.centerX,
    rink.centerY,
    840
  );
  if (isPutzlicht) {
    woodGrad.addColorStop(0, '#6b3e23');
    woodGrad.addColorStop(1, '#522e18');
  } else if (isBlacklight) {
    woodGrad.addColorStop(0, '#271238');
    woodGrad.addColorStop(1, '#180926');
  } else if (isSlowSkating) {
    woodGrad.addColorStop(0, '#241016');
    woodGrad.addColorStop(1, '#12070b');
  } else if (activeArenaStyle === 'palladium-1989') {
    woodGrad.addColorStop(0, '#2a160d');
    woodGrad.addColorStop(1, '#170b06');
  } else if (activeArenaStyle === 'pixel-16bit') {
    woodGrad.addColorStop(0, '#4a2511');
    woodGrad.addColorStop(1, '#2d1508');
  } else {
    woodGrad.addColorStop(0, '#3f2213');
    woodGrad.addColorStop(1, '#2b160c');
  }
  ctx.fillStyle = woodGrad;
  ctx.fillRect(rink.x, rink.y, rink.width, rink.height);

  // In 'pixel-16bit' mode, draw stepped retro 16-bit parquet planks & pixel track border!
  if (activeArenaStyle === 'pixel-16bit') {
    ctx.fillStyle = 'rgba(5, 8, 17, 0.22)';
    for (let py = rink.y; py < rink.y + rink.height; py += 16) {
      ctx.fillRect(rink.x, py, rink.width, 2);
    }
    ctx.strokeStyle = '#050811';
    ctx.lineWidth = 4;
    ctx.strokeRect(rink.x + 12, rink.y + 12, rink.width - 24, rink.height - 24);
  }

  // Subtle green neon reflection glow on the parquet directly in front of the "✦✦ PALLADIUM HANAU ✦✦" back-wall sign!
  const signGlowGrad = ctx.createRadialGradient(
    slopedBackWall.neonSignCenterX,
    rink.y + 10,
    15,
    slopedBackWall.neonSignCenterX,
    rink.y + 35,
    310
  );
  signGlowGrad.addColorStop(0, 'rgba(57, 255, 20, 0.24)');
  signGlowGrad.addColorStop(0.55, 'rgba(57, 255, 20, 0.09)');
  signGlowGrad.addColorStop(1, 'rgba(57, 255, 20, 0)');
  ctx.fillStyle = signGlowGrad;
  ctx.fillRect(slopedBackWall.neonSignCenterX - 350, rink.y, 700, 220);

  // Centered 2-line Center-Court Inlaid Retro Logo (cleanly framed between the two U-Islands, never clipped!)
  ctx.save();
  ctx.translate(rink.centerX, rink.centerY);
  ctx.fillStyle = isBlacklight
    ? 'rgba(0, 240, 255, 0.24)'
    : 'rgba(245, 158, 11, 0.18)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px "Outfit", sans-serif';
  ctx.fillText('ROLLER DISCO', 0, -13);
  ctx.font = 'bold 23px "Outfit", sans-serif';
  ctx.fillText('PALLADIUM HANAU', 0, 14);
  ctx.restore();

  // UNANNOUNCED BOHNERWACHS-RUTSCHZONE
  const waxShimmer = 0.11 + Math.sin(now * 0.005) * 0.04;
  const waxGrad = ctx.createRadialGradient(
    waxPatch.x,
    waxPatch.y,
    8,
    waxPatch.x,
    waxPatch.y,
    waxPatch.radiusX
  );
  waxGrad.addColorStop(0, `rgba(255, 255, 255, ${waxShimmer})`);
  waxGrad.addColorStop(0.6, `rgba(186, 230, 253, ${waxShimmer * 0.55})`);
  waxGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = waxGrad;
  ctx.beginPath();
  ctx.ellipse(
    waxPatch.x,
    waxPatch.y,
    waxPatch.radiusX,
    waxPatch.radiusY,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Render Wheel Underglow / Slush Trails on the Parquet
  for (const tr of trails) {
    ctx.strokeStyle = tr.color;
    ctx.globalAlpha = tr.alpha;
    ctx.lineWidth = tr.width;
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Render Visible Slipstream (Windschatten) behind the outer Speed-Skater Paceline (only in Solo mode)
  if (!p.isMultiplayerActive) {
    const speedSkaters = trackNpcs.filter((n) => n.role === 'speed');
    for (const sp of speedSkaters) {
      const tailX = sp.x - Math.cos(sp.headingRad) * 52;
      const tailY = sp.y - Math.sin(sp.headingRad) * 52;
      ctx.strokeStyle = isBlacklight
        ? 'rgba(0, 240, 255, 0.42)'
        : 'rgba(186, 230, 253, 0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(
        sp.x - Math.cos(sp.headingRad) * 18,
        sp.y - Math.sin(sp.headingRad) * 18
      );
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
  }

  ctx.restore(); // End Rink Clip

  // 3. RINK BARRIER: CONTINUOUS CLOSED LEFT BARRIER (x=290) + TWO OFFSET SCHLEUSEN-BANDEN ON THE BOTTOM!
  const barrierColor = isBlacklight ? '#00f0ff' : '#38bdf8';
  const gLeft = gates.bottomLeftSchwingtuer;
  const gRight = gates.bottomRightEntrance;

  ctx.save();
  ctx.strokeStyle = barrierColor;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Segment A: Top-Left Curved DJ-Tower -> Continuous Closed Left Barrier (x=290) -> Bottom-Left Curve up to Schleusen-Bande 1 (x=485)
  ctx.beginPath();
  ctx.moveTo(djTower.bevelTopX, djTower.bevelTopY);
  ctx.quadraticCurveTo(
    djTower.curveCtrlX,
    djTower.curveCtrlY,
    djTower.bevelLeftX,
    djTower.bevelLeftY
  );
  ctx.lineTo(rink.x, rink.y + rink.height - r);
  ctx.arcTo(
    rink.x,
    rink.y + rink.height,
    rink.x + r,
    rink.y + rink.height,
    r
  );
  ctx.lineTo(gLeft.xStart, rink.y + rink.height);
  ctx.stroke();

  // Segment B: Bottom Barrier between Schleusen-Bande 1 (x=655) and Schleusen-Bande 2 (x=1345)
  ctx.beginPath();
  ctx.moveTo(gLeft.xEnd, rink.y + rink.height);
  ctx.lineTo(gRight.xStart, rink.y + rink.height);
  ctx.stroke();

  // Segment C: From Schleusen-Bande 2 (x=1525) -> Bottom-Right Curve -> Right Barrier -> Top Barrier
  ctx.beginPath();
  ctx.moveTo(gRight.xEnd, rink.y + rink.height);
  ctx.arcTo(
    rink.x + rink.width,
    rink.y + rink.height,
    rink.x + rink.width,
    rink.y + rink.height - r,
    r
  );
  ctx.lineTo(rink.x + rink.width, rink.y);
  ctx.lineTo(djTower.bevelTopX, rink.y);
  ctx.stroke();

  // Draw the TWO parallel offset Schleusen-Banden (48px wide baffle bars recessed 95px inward at y = 765):
  const drawSchleusenBaffle = (
    bxStart: number,
    bxEnd: number,
    by: number,
    openStart: number,
    openEnd: number
  ) => {
    // Wide unobstructed left & right lane guidance lines between main barrier (y=860) and recessed baffle (y=765)
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(openStart + 16, rink.y + rink.height + 10);
    ctx.lineTo(openStart + 16, by + 6);
    ctx.moveTo(openEnd - 16, rink.y + rink.height + 10);
    ctx.lineTo(openEnd - 16, by + 6);
    ctx.stroke();
    ctx.restore();

    // Main turquoise offset baffle barrier (48px wide, 95px inward)
    ctx.save();
    ctx.shadowColor = barrierColor;
    ctx.shadowBlur = isBlacklight ? 12 : 6;
    ctx.strokeStyle = barrierColor;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bxStart, by);
    ctx.lineTo(bxEnd, by);
    ctx.stroke();

    // Rounded end caps on both main barrier ends and baffle ends
    ctx.fillStyle = '#e0f2fe';
    [
      [openStart, rink.y + rink.height],
      [openEnd, rink.y + rink.height],
      [bxStart, by],
      [bxEnd, by],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 3.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  drawSchleusenBaffle(
    gLeft.baffleXStart,
    gLeft.baffleXEnd,
    gLeft.baffleY,
    gLeft.xStart,
    gLeft.xEnd
  );
  drawSchleusenBaffle(
    gRight.baffleXStart,
    gRight.baffleXEnd,
    gRight.baffleY,
    gRight.xStart,
    gRight.xEnd
  );
  ctx.restore();

  const crewAiNamesVisible =
    p.showAiNames !== undefined ? p.showAiNames : Boolean(p.showNames);
  const crewSpeechBubblesVisible =
    p.showSpeechBubbles !== undefined ? p.showSpeechBubbles : true;

  // 4. SLOPED 2.5D TOP BACK WALL + VERTICAL 90° LEFT MIRROR WALL + KENGOL BREAKDANCERS + PUTZRAUM DOOR
  renderSloped25DBackWallAndVerticalMirror(
    ctx,
    now,
    crewAiNamesVisible,
    isBlacklight,
    djHandsUpActive,
    p.neonLightboxesEnabled !== false,
    p.neonLightboxLine1 ?? 'RESIDENT DJ',
    p.neonLightboxLine2 ?? 'DJ MAGIC FORCE',
    p.neonLightboxLine3 ?? 'AB 20:00 UHR'
  );

  // 5. 90°-ROTATED CENTER U-ISLANDS (`[` LEFT & `]` RIGHT), JAM-SKATERS IN BETWEEN, OR COLLAPSIBLE EVENT STAGE
  const fogIntensity =
    fogBurstTimer > 0 ? 1.35 : p.fogMachineEnabled ? 0.85 : 0;
  const activeBallspielPlayersCount = trackNpcs.filter(
    (n) => n.role !== 'guard' && !n.eliminated
  ).length;
  renderCenterIslandsOrStage(
    ctx,
    now,
    stageCloseProgress,
    p.centerStageMode,
    p.activeBandName,
    p.bandSkinTone,
    p.bandGender,
    crewAiNamesVisible,
    isBlacklight,
    djHandsUpActive,
    fogIntensity,
    Boolean(p.isMultiplayerActive),
    Boolean(p.cinemaCountdownEnabled),
    p.cinemaCountdownTitle || 'NÄCHSTER PALLADIUM LIVE-STREAM',
    p.cinemaCountdownTargetIso || '',
    p.cinemaWeekdays || ['Mi', 'Sa'],
    p.cinemaStartTime || '20:00',
    p.hallGameMode === 'ballspiel',
    activeBallspielPlayersCount,
    p.backgroundDancersEnabled !== false
  );

  // JR Easter-Egg Overlay above the center Palladium logo ("✨ CREATED BY JÜRGEN BECKER (JR) ✨" for 6 seconds!)
  if (jrEasterEggTimer > 0) {
    ctx.save();
    ctx.translate(rink.centerX, rink.centerY - 46);
    ctx.fillStyle = 'rgba(9, 13, 28, 0.94)';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(-215, -20, 430, 40, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 15px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ CREATED BY JÜRGEN BECKER (JR) ✨', 0, 1);
    ctx.restore();
  }

  // 6. CURVED QUARTER-CIRCLE TOP-LEFT CORNER DJ-TOWER ("KLECKNIX" TURNTABLES + VINYL CABINET + BACKSTAGE CONSOLE & CASES)
  renderCurvedDjTowerCorner(
    ctx,
    now,
    p.djTickerText,
    p.activeDjName || activeCrewNames.dj || 'DJ Magic Force',
    crewAiNamesVisible,
    isBlacklight,
    crewSpeechBubblesVisible ? djSpeechBubble : null
  );

  // 7. HALL TOUR: RIGHT WALL GLASS FACADE, COMPACT SIDE-WINDOW CASHIER + SECURITY-SAMMY -> PRO-SHOP -> VERLEIH -> BISTRO
  renderHallTourZonesAndStaff(
    ctx,
    now,
    crewAiNamesVisible,
    isBlacklight,
    p.hasOwnSkates || p.hasRentedSkates || Boolean(p.vipDiscoSkatesEquipped),
    p.drinkChipAvailable,
    Boolean(p.isMultiplayerActive)
  );

  // 7b. FLOOR LIGHTING & CONCERT STAGE SPOTLIGHT VEIL (RENDERED ON THE PARQUET UNDERNEATH ALL SKATERS SO SKATERS NEVER HAVE A TRANSPARENT "GHOST LOOK"!)
  const isBandPlayingShowCycle = (now * 0.001) % 48 < 41;
  const isConcertLightingActive =
    !isPutzlicht &&
    (p.concertLightingMode === 'on' ||
      (p.concertLightingMode === 'auto' &&
        p.centerStageMode === 'band' &&
        isBandPlayingShowCycle));

  if (!isPutzlicht) {
    renderFloorDiscoLighting(
      ctx,
      now,
      isBlacklight,
      isSlowSkating,
      p.centerStageMode === 'band',
      p.hallGameMode === 'ballspiel'
    );
  } else {
    ctx.fillStyle = 'rgba(255, 255, 245, 0.22)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  if (isConcertLightingActive) {
    renderConcertStageSpotlightOverlay(ctx, now, stageCloseProgress);
  }

  // 8. HALLEN-SPIELE PROPS (SLALOM CONES, FOLDING CHAIRS, SINGLE BALLSPIEL BALL)
  if (p.hallGameMode === 'slalom') {
    for (const cone of slalomCones) {
      const wobbleX = cone.wobbleTimer > 0 ? Math.sin(now * 0.04) * 6 : 0;
      ctx.fillStyle = cone.passed ? '#39ff14' : '#f97316';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cone.x + wobbleX, cone.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (p.hallGameMode === 'stuhlsprung') {
    for (const ch of jumpChairs) {
      ctx.save();
      ctx.translate(ch.x, ch.y);
      ctx.rotate(ch.angleRad + (ch.knockedOverTimer > 0 ? 0.45 : 0));
      for (let c = 0; c < ch.chairCount; c++) {
        const cx = -ch.width / 2 + 16 + c * 30;
        ctx.fillStyle = ch.clearedInLap ? '#15803d' : '#78350f';
        ctx.strokeStyle = ch.clearedInLap ? '#39ff14' : '#fde047';
        ctx.lineWidth = 2.2;
        ctx.fillRect(cx - 12, -18, 24, 36);
        ctx.strokeRect(cx - 12, -18, 24, 36);
        ctx.fillStyle = ch.clearedInLap ? '#39ff14' : '#fde047';
        ctx.fillRect(cx - 10, -15, 20, 4);
      }
      ctx.restore();

      // Clear 1er/2er/3er-Klappstuhlreihe badge above the obstacle
      ctx.save();
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ch.clearedInLap ? '#39ff14' : '#fde047';
      ctx.fillText(
        ch.chairCount === 1
          ? '🪑 1er-STUHL'
          : ch.chairCount === 2
          ? '🪑🪑 2er-REIHE'
          : '🪑🪑🪑 3er-REIHE',
        ch.x,
        ch.y - 28
      );
      ctx.restore();
    }
  } else if (
    p.hallGameMode === 'springerstaffel' ||
    Boolean(p.springerStaffelShowActive)
  ) {
    // 4 Authentic 80s Hochsprung-Gestelle starting at 60 cm (+20 cm per completed round)!
    const relayBars = [
      { x: 760, y: 735, label: 'HOCHSPRUNG 1' },
      { x: 1240, y: 735, label: 'HOCHSPRUNG 2' },
      { x: 1240, y: 235, label: 'HOCHSPRUNG 3' },
      { x: 760, y: 235, label: 'HOCHSPRUNG 4' },
    ];
    const barLiftPx = Math.min(26, Math.round((activeSpringerstaffelHeightCm - 60) * 0.16));
    for (const rb of relayBars) {
      ctx.save();
      ctx.translate(rb.x, rb.y);
      // Left & Right Upright High-Jump Standards (Teleskop-Ständer)
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.fillRect(-14, -52, 8, 104);
      ctx.strokeRect(-14, -52, 8, 104);
      ctx.fillRect(6, -52, 8, 104);
      ctx.strokeRect(6, -52, 8, 104);

      // Base plates
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-18, -56, 16, 6);
      ctx.fillRect(-18, 50, 16, 6);

      // Red-White Striped Crossbar elevated by barLiftPx
      const barX = -4 - barLiftPx * 0.35;
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, -48, 8, 96);
      ctx.fillStyle = '#ffffff';
      for (let sy = -42; sy <= 38; sy += 16) {
        ctx.fillRect(barX, sy, 8, 8);
      }
      ctx.shadowBlur = 0;

      // Height & Round label
      ctx.fillStyle = '#050811';
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-52, -74, 104, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${rb.label}: ${activeSpringerstaffelHeightCm} cm`,
        0,
        -63
      );
      ctx.restore();
    }
  }

  for (const b of softballs) {
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (b.state === 'FREE') {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 16 + Math.sin(now * 0.01) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 16-BIT NEON CROSSHAIR & GREEN AIMING LINE FOR BALLSPIEL:
  // Rule #4: Strictly visible ONLY while JR actively holds the ball (state === 'HELD' && holderId === 'player')!
  if (p.hallGameMode === 'ballspiel') {
    const ballHeldByPlayer = Boolean(
      softballs[0] &&
        softballs[0].state === 'HELD' &&
        softballs[0].holderId === 'player'
    );
    const hasEnoughThrowSpeed =
      Math.hypot(player.vx, player.vy) >= 355 * 0.35;

    if (ballHeldByPlayer && hasEnoughThrowSpeed) {
      const crossX = Math.round(
        hasMouseMovedOnCanvas
          ? mouseWorldX
          : player.x + Math.cos(player.headingRad) * 190
      );
      const crossY = Math.round(
        hasMouseMovedOnCanvas
          ? mouseWorldY
          : player.y + Math.sin(player.headingRad) * 190
      );

      ctx.save();
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.42)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(crossX, crossY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crisp 16-Bit Pixel Neon Green Crosshair
      ctx.fillStyle = '#050811';
      ctx.fillRect(crossX - 15, crossY - 3, 9, 6);
      ctx.fillRect(crossX + 6, crossY - 3, 9, 6);
      ctx.fillRect(crossX - 3, crossY - 15, 6, 9);
      ctx.fillRect(crossX - 3, crossY + 6, 6, 9);
      ctx.fillRect(crossX - 3, crossY - 3, 6, 6);

      ctx.fillStyle = '#39ff14';
      ctx.fillRect(crossX - 14, crossY - 2, 7, 4);
      ctx.fillRect(crossX + 7, crossY - 2, 7, 4);
      ctx.fillRect(crossX - 2, crossY - 14, 4, 7);
      ctx.fillRect(crossX - 2, crossY + 7, 4, 7);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(crossX - 2, crossY - 2, 4, 4);
      ctx.restore();
    }
  }

  // 9. RENDER TRACK NPCS ON TOP OF FLOOR LIGHTING (100% OPAQUE, ZERO GHOST-LOOK!)
  if (!p.isMultiplayerActive) {
    // Hand-holding connection for the permanent backward-skating couple ('couple-b-1' & 'couple-f-2') in Free-Skate
    if (p.hallGameMode === 'free-skate') {
      const cb1 = trackNpcs.find((n) => n.id === 'couple-b-1');
      const cf2 = trackNpcs.find((n) => n.id === 'couple-f-2');
      if (cb1 && cf2) {
        const midX = (cb1.x + cf2.x) / 2;
        const midY = (cb1.y + cf2.y) / 2;
        const dx = cf2.x - cb1.x;
        const dy = cf2.y - cb1.y;
        const perpX = -dy * 0.22;
        const perpY = dx * 0.22;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = 4.2;
        ctx.strokeStyle = cb1.shirtColor;
        ctx.beginPath();
        ctx.moveTo(cb1.x + perpX * 0.45, cb1.y + perpY * 0.45);
        ctx.lineTo(midX + perpX * 0.75, midY + perpY * 0.75);
        ctx.stroke();
        ctx.strokeStyle = cf2.shirtColor;
        ctx.beginPath();
        ctx.moveTo(cf2.x + perpX * 0.45, cf2.y + perpY * 0.45);
        ctx.lineTo(midX + perpX * 0.75, midY + perpY * 0.75);
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(midX + perpX * 0.75, midY + perpY * 0.75, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = cb1.shirtColor;
        ctx.beginPath();
        ctx.moveTo(cb1.x - perpX * 0.45, cb1.y - perpY * 0.45);
        ctx.lineTo(midX - perpX * 0.75, midY - perpY * 0.75);
        ctx.stroke();
        ctx.strokeStyle = cf2.shirtColor;
        ctx.beginPath();
        ctx.moveTo(cf2.x - perpX * 0.45, cf2.y - perpY * 0.45);
        ctx.lineTo(midX - perpX * 0.75, midY - perpY * 0.75);
        ctx.stroke();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(midX - perpX * 0.75, midY - perpY * 0.75, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (isSlowSkating && p.hallGameMode === 'free-skate') {
      const pairIds = [
        ['reg-1', 'reg-2'],
        ['speed-3', 'speed-2'],
        ['speed-1', 'speed-4'],
      ];
      pairIds.forEach(([idA, idB], pairIdx) => {
        const a = trackNpcs.find((n) => n.id === idA);
        const b = trackNpcs.find((n) => n.id === idB);
        if (a && b) {
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const perpX = -dy * 0.22;
          const perpY = dx * 0.22;

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineWidth = 4.2;
          ctx.strokeStyle = a.shirtColor;
          ctx.beginPath();
          ctx.moveTo(a.x + perpX * 0.5, a.y + perpY * 0.5);
          ctx.lineTo(midX + perpX * 0.8, midY + perpY * 0.8);
          ctx.stroke();

          ctx.strokeStyle = b.shirtColor;
          ctx.beginPath();
          ctx.moveTo(b.x + perpX * 0.5, b.y + perpY * 0.5);
          ctx.lineTo(midX + perpX * 0.8, midY + perpY * 0.8);
          ctx.stroke();

          ctx.fillStyle = '#fde68a';
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(midX + perpX * 0.8, midY + perpY * 0.8, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.lineWidth = 3.6;
          ctx.strokeStyle = a.shirtColor;
          ctx.beginPath();
          ctx.moveTo(a.x - perpX * 0.5, a.y - perpY * 0.5);
          ctx.lineTo(midX - perpX * 0.8, midY - perpY * 0.8);
          ctx.stroke();
          ctx.strokeStyle = b.shirtColor;
          ctx.beginPath();
          ctx.moveTo(b.x - perpX * 0.5, b.y - perpY * 0.5);
          ctx.lineTo(midX - perpX * 0.8, midY - perpY * 0.8);
          ctx.stroke();
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(midX - perpX * 0.8, midY - perpY * 0.8, 3.8, 0, Math.PI * 2);
          ctx.fill();

          for (let hIdx = 0; hIdx < 2; hIdx++) {
            const cycle = (now * 0.0009 + pairIdx * 0.7 + hIdx * 0.5) % 1.0;
            const floatY = midY - 22 - cycle * 32;
            const swayX =
              midX + Math.sin(now * 0.005 + pairIdx + hIdx * 2) * 10;
            const alpha = Math.sin(cycle * Math.PI);
            ctx.globalAlpha = Math.max(0.15, alpha * 0.92);
            ctx.fillStyle = hIdx % 2 === 0 ? '#ff2a85' : '#ef4444';
            ctx.font = 'bold 13px "Silkscreen", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('♥', swayX, floatY);
          }
          ctx.restore();
        }
      });

      // Render hand-holding connection & floating hearts between Player and accepted Singleplayer Slow-Skate Flirt Partner!
      if (slowFlirtPartnerId) {
        const partnerNpc = trackNpcs.find((n) => n.id === slowFlirtPartnerId);
        if (partnerNpc) {
          const midX = (player.x + partnerNpc.x) / 2;
          const midY = (player.y + partnerNpc.y) / 2;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineWidth = 4.2;
          ctx.strokeStyle = p.playerShirtColor || '#1e1b4b';
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.lineTo(midX, midY);
          ctx.stroke();

          ctx.strokeStyle = partnerNpc.shirtColor;
          ctx.beginPath();
          ctx.moveTo(partnerNpc.x, partnerNpc.y);
          ctx.lineTo(midX, midY);
          ctx.stroke();

          ctx.fillStyle = '#fde68a';
          ctx.strokeStyle = '#ff2a85';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(midX, midY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          for (let hIdx = 0; hIdx < 2; hIdx++) {
            const cycle = (now * 0.001 + hIdx * 0.5) % 1.0;
            const floatY = midY - 24 - cycle * 34;
            const swayX = midX + Math.sin(now * 0.006 + hIdx * 2) * 10;
            ctx.globalAlpha = Math.max(0.2, Math.sin(cycle * Math.PI));
            ctx.fillStyle = hIdx % 2 === 0 ? '#ff2a85' : '#ef4444';
            ctx.font = 'bold 14px "Silkscreen", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('♥', swayX, floatY);
          }
          ctx.restore();
        }
      }
    }

    const aiNamesEnabled =
      p.showAiNames !== undefined ? p.showAiNames : Boolean(p.showNames);
    const ownNameEnabled =
      p.showOwnName !== undefined ? p.showOwnName : true;
    const speechBubblesEnabled =
      p.showSpeechBubbles !== undefined ? p.showSpeechBubbles : true;

    const isClockwiseRender =
      isSlowSkating || p.skateDirection === 'cw';
    for (const npc of trackNpcs) {
      const isNpcBackward =
        p.hallGameMode !== 'ballspiel' &&
        (npc.id === 'couple-b-1' ||
          (isClockwiseRender &&
            (npc.id === 'reg-2' ||
              npc.id === 'reg-5' ||
              npc.id === 'reg-9' ||
              npc.id === 'reg-13' ||
              npc.id === 'speed-2' ||
              npc.id === 'speed-4')));

      const showNpcBadge = aiNamesEnabled;

      renderCharacterSprite(ctx, now, {
        x: npc.x,
        y: npc.y,
        headingRad: npc.headingRad,
        jumpZ: npc.jumpZ || 0,
        gender: npc.gender,
        isWheelchair: npc.role === 'wheelchair-npc',
        isSkateGuard: npc.role === 'guard',
        isSpeedSkater: npc.role === 'speed',
        isGhost: false,
        isPalladiumanerStaff: false,
        shirtColor: npc.shirtColor,
        accentColor: npc.accentColor,
        wheelColor: npc.wheelColor,
        legwarmerColor: npc.legwarmerColor,
        skateBootColor: npc.skateBootColor,
        name: npc.name,
        showName: showNpcBadge,
        isBlacklight,
        crashTimer: npc.crashTimer,
        speechBubble: speechBubblesEnabled ? npc.speechText : null,
        isBackwardGliding: isNpcBackward,
        wristbandColor:
          npc.role === 'speed'
            ? 'cyan'
            : npc.role === 'guard'
            ? 'green'
            : undefined,
      });

      // Cult NPC signature 80s visual details (Skate Cat ears & tail, Walkman-Moni foam headphones, Breakdance-Benni headband)
      if (npc.id === 'cult-skate-cat') {
        ctx.save();
        ctx.translate(npc.x, npc.y - (npc.jumpZ || 0));
        ctx.rotate(npc.headingRad);
        // Orange-Gold Cat Tail wagging behind
        const wag = Math.sin(now * 0.012) * 5;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.quadraticCurveTo(-22, wag, -26, wag * 1.4);
        ctx.stroke();
        // Cute Cat Ears on head
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.2;
        [-7, 7].forEach((ey) => {
          ctx.beginPath();
          ctx.moveTo(4, ey - 3);
          ctx.lineTo(10, ey);
          ctx.lineTo(2, ey + 3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      } else if (npc.id === 'cult-walkman-moni') {
        ctx.save();
        ctx.translate(npc.x, npc.y - (npc.jumpZ || 0));
        ctx.rotate(npc.headingRad);
        // 80s Silver Headband & Bright Orange Foam Walkman Earpads
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(0, 11);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, -11, 3.6, 0, Math.PI * 2);
        ctx.arc(0, 11, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (npc.id === 'cult-breakdance-benni') {
        ctx.save();
        ctx.translate(npc.x, npc.y - (npc.jumpZ || 0));
        ctx.rotate(npc.headingRad);
        // Neon Yellow/Red 80s Breakdance Headband
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, 10, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render Special Ghost Skaters (When enabled in Admin Terminal — only in Solo mode!)
    if (p.ghostSkatersEnabled) {
      p.specialSkaters.forEach((ghostName, idx) => {
        let gx: number;
        let gy: number;
        let gHeading: number;

        if (p.hallGameMode === 'stuhlsprung') {
          gx = 268;
          gy = 395 + idx * 80;
          gHeading = Math.atan2(player.y - gy, player.x - gx);
        } else {
          const ghostAngle = normalizeAngle(
            -now * 0.00058 -
              (idx * Math.PI * 2) / Math.max(1, p.specialSkaters.length)
          );
          gx = rink.centerX + Math.cos(ghostAngle) * 355;
          gy = rink.centerY + Math.sin(ghostAngle) * 195;
          const tx = Math.sin(ghostAngle) * 355;
          const ty = -Math.cos(ghostAngle) * 195;
          gHeading = Math.atan2(ty, tx);

          const perpX = -Math.sin(gHeading) * 11;
          const perpY = Math.cos(gHeading) * 11;
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.24)';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([5, 5]);
          [-1, 1].forEach((side) => {
            const sx = gx + perpX * side;
            const sy = gy + perpY * side;
            ctx.beginPath();
            ctx.moveTo(
              sx - Math.cos(gHeading) * 10,
              sy - Math.sin(gHeading) * 10
            );
            ctx.lineTo(
              sx - Math.cos(gHeading) * 46,
              sy - Math.sin(gHeading) * 46
            );
            ctx.stroke();
          });
          ctx.restore();
        }

        renderCharacterSprite(ctx, now, {
          x: gx,
          y: gy,
          headingRad: gHeading,
          jumpZ: 0,
          gender: 'male',
          isWheelchair: false,
          isSkateGuard: false,
          isSpeedSkater: false,
          isGhost: true,
          isPalladiumanerStaff: false,
          shirtColor: '#00f0ff',
          accentColor: '#ffffff',
          wheelColor: '#00f0ff',
          name: `👻 ${ghostName}`,
          showName: aiNamesEnabled,
          isBlacklight,
          crashTimer: 0,
          speechBubble: null,
        });
      });
    }
  }

  // 9b. RENDER CONNECTED HUMAN MULTIPLAYER SKATERS (WITH SMOOTH INTERPOLATION, TRICK MOVES, NEON WRISTBANDS & GOLDEN/TURQUOISE STAR BADGE!)
  const speechBubblesOn =
    p.showSpeechBubbles !== undefined ? p.showSpeechBubbles : true;
  const ownNameOn = p.showOwnName !== undefined ? p.showOwnName : true;
  if (p.isMultiplayerActive && remotePlayers.length > 0) {
    for (const rp of remotePlayers) {
      renderCharacterSprite(ctx, now, {
        x: rp.renderX,
        y: rp.renderY,
        headingRad: rp.renderHeading,
        jumpZ: rp.renderJumpZ,
        gender: 'male',
        isWheelchair: rp.characterMode === 'wheelchair',
        isSkateGuard: false,
        isSpeedSkater: false,
        isGhost: false,
        isPalladiumanerStaff: false,
        shirtColor: rp.shirtColor || '#00f0ff',
        accentColor: '#fde047',
        wheelColor: rp.kengolHat ? '#ff2a85' : '#00f0ff',
        kengolHat: rp.kengolHat,
        kengoShoesWhitePink: rp.kengolHat,
        isCustomOwnSkates: !rp.kengolHat,
        name: rp.name || 'Gast-Skater',
        showName: true,
        isBlacklight,
        crashTimer: rp.crashTimer || 0,
        speechBubble: speechBubblesOn ? rp.speechBubble || null : null,
        hasMultiplayerStar: true,
        activeTrickMove: rp.activeTrickMove || null,
        isBackwardGliding: rp.activeTrickMove === 'backward',
        wristbandColor: rp.wristbandColor,
        activeCharm: rp.activeCharm || null,
        avatarRole: rp.avatarRole || 'standard',
      });
    }
  }

  // 9c. RENDER 80s NEWSPAPER STAND ("DER PALLADIUM-KURIER") IN FRONT ENTRANCE / RECEPTION AREA
  if (p.newspaperEnabled !== false) {
    const cb = ARENA_LAYOUT.bottomEntrance.cashierBooth;
    const nsX = cb.x + cb.width / 2;
    const nsY = cb.y + cb.height + 36;
    ctx.save();
    ctx.translate(nsX, nsY);

    // Vintage 80s Wire Rack & Newspaper Stack Base
    ctx.fillStyle = '#1e1b4b';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-36, -18, 72, 36, 6);
    ctx.fill();
    ctx.stroke();

    // Folded 80s Newspaper Icon on Rack
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-26, -12, 22, 16);
    ctx.strokeRect(-26, -12, 22, 16);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-24, -10, 18, 3);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-24, -5, 8, 6);
    ctx.fillRect(-14, -5, 8, 2);
    ctx.fillRect(-14, -1, 8, 2);

    // Label: "KURIER"
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PALLADIUM', -1, -3);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('KURIER 📰', -1, 8);

    // Blinking "NEU!" Badge when unread issue is available
    if (p.newspaperHasNewBadge) {
      const blinkOn = Math.floor(now / 380) % 2 === 0;
      ctx.save();
      ctx.translate(28, -18);
      ctx.fillStyle = blinkOn ? '#ef4444' : '#fde047';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-16, -8, 32, 15, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = blinkOn ? '#ffffff' : '#0f172a';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NEU!', 0, 2.5);
      ctx.restore();
    }

    ctx.restore();
  }

  // 9c-2. RENDER CLICKABLE 80s ARCADE LEADERBOARD ("🏆 EHRENTAFEL") ON ENTRANCE WALL
  {
    const cb = ARENA_LAYOUT.bottomEntrance.cashierBooth;
    const lbX = cb.x + cb.width + 66;
    const lbY = cb.y + cb.height + 26;
    ctx.save();
    ctx.translate(lbX, lbY);

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-40, -18, 80, 36, 6);
    ctx.fill();
    ctx.stroke();

    // Mini Arcade Trophy & Highscore Bars
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('🏆', -34, 4);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('EHRENTAFEL', -17, -3);
    ctx.fillStyle = '#39ff14';
    ctx.fillText('TOP 10 [E]', -17, 8);

    ctx.restore();
  }

  // 9c-3. RENDER 3 CLICKABLE 80s RETRO ARCADE CABINETS IN THE ARCADE CORNER NEAR THE DJ-KANZEL
  {
    const arcadeMachines: {
      id: 'monkey-stomp' | 'disco-invaders' | 'pac-roller';
      title: string;
      shortTag: string;
      x: number;
      y: number;
      cabColor: string;
      trimColor: string;
      screenColor: string;
      icon: string;
    }[] = [
      {
        id: 'monkey-stomp',
        title: 'MONKEY STOMP',
        shortTag: 'DONKEY-86',
        x: 84,
        y: 264,
        cabColor: '#451a03',
        trimColor: '#f59e0b',
        screenColor: '#fde047',
        icon: '🦍',
      },
      {
        id: 'disco-invaders',
        title: 'DISCO INVADERS',
        shortTag: 'SPACE-86',
        x: 148,
        y: 264,
        cabColor: '#0f172a',
        trimColor: '#00f0ff',
        screenColor: '#38bdf8',
        icon: '👾',
      },
      {
        id: 'pac-roller',
        title: 'PAC-ROLLER',
        shortTag: 'MAZE-86',
        x: 212,
        y: 264,
        cabColor: '#1e1b4b',
        trimColor: '#fde047',
        screenColor: '#39ff14',
        icon: '🍒',
      },
    ];

    // Subtle neon carpet runner under the 3 arcade cabinets
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(48, 240, 200, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 7.5px "Silkscreen", "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🕹️ 80er ARCADE-ECKE [KLICK / E]', 148, 235);
    ctx.restore();

    for (const mac of arcadeMachines) {
      const distPlayer = Math.hypot(player.x - mac.x, player.y - (mac.y + 18));
      const isNear = distPlayer <= 76;
      ctx.save();
      ctx.translate(mac.x, mac.y);

      if (isNear) {
        ctx.shadowColor = mac.trimColor;
        ctx.shadowBlur = 12;
      }

      // Cabinet Housing
      ctx.fillStyle = mac.cabColor;
      ctx.strokeStyle = mac.trimColor;
      ctx.lineWidth = isNear ? 2.4 : 1.8;
      ctx.beginPath();
      ctx.roundRect(-24, -18, 48, 36, 5);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Illuminated Top Marquee
      ctx.fillStyle = mac.trimColor;
      ctx.fillRect(-21, -15, 42, 6);
      ctx.fillStyle = '#050811';
      ctx.font = 'bold 5.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(mac.shortTag, 0, -10.5);

      // Glowing CRT Screen with animated scanline pulse
      ctx.fillStyle = '#050814';
      ctx.fillRect(-18, -7, 36, 15);
      ctx.strokeStyle = mac.screenColor;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(-18, -7, 36, 15);

      const pulseX = Math.sin(now * 0.006 + mac.x) * 6;
      ctx.fillStyle = mac.screenColor;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(mac.icon, pulseX, 4);

      // Control Panel (Red Joystick + Arcade Buttons)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-20, 9, 40, 6);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-9, 12, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(4, 10.5, 3, 3);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(9, 10.5, 3, 3);

      if (isNear) {
        ctx.fillStyle = '#050811';
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.roundRect(-28, 20, 56, 12, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 6.5px "JetBrains Mono", monospace';
        ctx.fillText('[E] SPIELEN', 0, 28);
      }

      ctx.restore();
    }
  }

  // 9d. RENDER CUSTOM CREW MEMBERS FROM "12. ADMIN-CREW-GALERIE" AS INTERACTIVE 16-BIT NPCS ON THE RINK
  if (p.customCrewMembers && p.customCrewMembers.length > 0) {
    for (const cm of p.customCrewMembers) {
      // Subtle station pedestal ring under custom crew member
      ctx.save();
      ctx.translate(cm.x, cm.y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.strokeStyle = cm.accentColor || '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 14, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Station title mini sign below feet
      ctx.fillStyle = '#050811';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-48, 22, 96, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        (cm.stationTitle || 'CREW-STATION').slice(0, 18),
        0,
        31.5
      );
      ctx.restore();

      const distToPlayer = Math.hypot(player.x - cm.x, player.y - cm.y);
      renderCharacterSprite(ctx, now, {
        x: cm.x,
        y: cm.y,
        headingRad: Math.atan2(player.y - cm.y, player.x - cm.x),
        jumpZ: 0,
        gender: 'male',
        isWheelchair: false,
        isSkateGuard: false,
        isSpeedSkater: false,
        isGhost: false,
        isPalladiumanerStaff: true,
        shirtColor: cm.shirtColor || '#ec4899',
        accentColor: cm.accentColor || '#00f0ff',
        wheelColor: '#fde047',
        name: `👾 ${cm.crewName}`,
        showName: true,
        isBlacklight,
        crashTimer: 0,
        speechBubble:
          distToPlayer <= 135 && speechBubblesOn
            ? `💬 [Klick / E] ${cm.quote}`
            : null,
      });
    }
  }

  // 10. RENDER PLAYER CHARACTER (Supports [H] Kengol-Bucket-Hat, VIP Disco-Rollschuhe, 80s Trick Moves [1]-[4], & Neon Wristbands!)
  const displayPlayerName =
    p.isAnonymousGuest || !p.playerName.trim() ? 'JR' : p.playerName.trim();

  const playerHasSkates =
    p.characterMode === 'wheelchair' ||
    p.hasOwnSkates ||
    p.hasRentedSkates ||
    Boolean(p.vipDiscoSkatesEquipped);

  renderCharacterSprite(ctx, now, {
    x: player.x,
    y: player.y,
    headingRad: player.headingRad + player.spinAngleOffset,
    jumpZ: player.jumpZ,
    gender: 'male',
    isWheelchair: p.characterMode === 'wheelchair',
    isSkateGuard: p.hallGameMode === 'ballspiel',
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: false,
    shirtColor:
      p.hallGameMode === 'ballspiel'
        ? '#070a10'
        : p.playerShirtColor || '#1e1b4b',
    accentColor: p.vipDiscoSkatesEquipped ? '#fde047' : '#39ff14',
    wheelColor: p.vipDiscoSkatesEquipped
      ? '#fde047'
      : p.kengolHatEnabled
      ? '#ff2a85'
      : p.hasOwnSkates
      ? '#39ff14'
      : '#38bdf8',
    kengolHat: p.kengolHatEnabled,
    kengoShoesWhitePink: p.kengolHatEnabled,
    isStreetShoes: !playerHasSkates,
    isRentalSkates:
      !p.hasOwnSkates &&
      p.hasRentedSkates &&
      !p.kengolHatEnabled &&
      !p.vipDiscoSkatesEquipped,
    isCustomOwnSkates:
      (p.hasOwnSkates || Boolean(p.vipDiscoSkatesEquipped)) &&
      !p.kengolHatEnabled,
    name: displayPlayerName,
    showName: ownNameOn && displayPlayerName.length > 0,
    isBlacklight,
    crashTimer: player.crashTimer,
    speechBubble: speechBubblesOn ? player.speechBubble : null,
    underglowColor: p.vipDiscoSkatesEquipped
      ? 'gold'
      : p.upgrades.underglowEnabled && playerHasSkates
      ? p.upgrades.underglowColor
      : undefined,
    hasMultiplayerStar: Boolean(p.isMultiplayerActive),
    activeTrickMove: player.activeTrickMove,
    isBackwardGliding: player.activeTrickMove === 'backward',
    wristbandColor: p.upgrades.wristbandsEnabled
      ? p.upgrades.wristbandColor
      : undefined,
    activeCharm: p.upgrades.activeCharm || null,
    avatarRole: p.avatarRole || 'standard',
  });

  // 10a. RENDER PARK- & SCHUTZ-MODUS SHIELD WHEN PLAYER IS PLAYING AN 80s ARCADE CABINET
  if (p.isPlayingArcade) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const pulse = 0.65 + Math.sin(now * 0.008) * 0.25;
    ctx.strokeStyle = `rgba(0, 240, 255, ${pulse})`;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#050811';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-58, 22, 116, 15, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ PARK-SCHUTZ AKTIV', 0, 32);
    ctx.restore();
  }

  // 10b. WARME SONNTAGS-CLIQUE NACHMITTAGSBELEUCHTUNG (Golden Hour Sunlight Tint)
  if (p.sundayCliqueActive && !isPutzlicht) {
    ctx.save();
    const sunGrad = ctx.createRadialGradient(
      rink.centerX,
      rink.centerY - 60,
      90,
      rink.centerX,
      rink.centerY,
      820
    );
    sunGrad.addColorStop(0, 'rgba(251, 191, 36, 0.16)');
    sunGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.10)');
    sunGrad.addColorStop(1, 'rgba(217, 119, 6, 0.03)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(rink.x, rink.y, rink.width, rink.height);
    ctx.restore();
  }

  // Render Nurse / Paramedic ("SANI-SANDRA") in White Coat with Red Cross Symbol when active!
  if (saniNurse.active) {
    renderSaniNurseSprite(
      ctx,
      now,
      saniNurse,
      p.showAiNames !== undefined ? p.showAiNames : Boolean(p.showNames)
    );
  }

  for (const sp of sparks) {
    ctx.fillStyle = sp.color;
    ctx.globalAlpha = sp.alpha;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 11. CEILING MIRROR BALL FIXTURE (Rendered at the exact center of the ceiling; floor spots were already drawn under skaters!)
  if (!isPutzlicht) {
    renderCeilingMirrorBallFixture(ctx, now, isSlowSkating);
  }

  // 11c. VISIBLE 80s HALL FOG CLOUDS (Directed Disco-Tower fog jets swirled by passing skaters, UNDER all Name Badges & HUD Overlays!):
  const shouldRenderHallFog =
    p.fogMachineEnabled ||
    p.centerStageMode === 'band' ||
    fogBurstTimer > 0;
  if (shouldRenderHallFog) {
    const burstBoost =
      fogBurstTimer > 0 ? Math.min(1.0, fogBurstTimer / 5.0) : 0;
    render80sDancefloorFogBanks(
      ctx,
      now,
      p.fogMachineEnabled || p.centerStageMode === 'band',
      burstBoost,
      isBlacklight,
      isSlowSkating,
      isConcertLightingActive,
      player,
      trackNpcs
    );
  }

  // 11d. FLUSH DEFERRED NAME BADGES & SPEECH BUBBLES ON TOP OF FOG & LIGHTING!
  isDeferringOverlays = false;
  for (const item of deferredOverlayQueue) {
    if (item.kind === 'badge') {
      drawRetroNameBadge(
        ctx,
        item.worldX,
        item.worldY,
        item.text,
        item.borderColor || '#00f0ff',
        item.hasMultiplayerStar
      );
    }
  }
  if (speechBubblesOn) {
    for (const item of deferredOverlayQueue) {
      if (item.kind === 'bubble') {
        drawSpeechBubble(ctx, item.worldX, item.worldY, item.text);
      }
    }
  }

  // 11d-2. FLOATING 16-BIT "+10" SCORE POPUPS IN BALLSPIEL
  if (floatingScores.length > 0) {
    for (const fs of floatingScores) {
      const progress = Math.min(1, fs.age / fs.duration);
      const alpha = progress < 0.65 ? 1 : Math.max(0, 1 - (progress - 0.65) / 0.35);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px "Silkscreen", "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#050811';
      ctx.strokeText(fs.text, Math.round(fs.x), Math.round(fs.y));
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 10;
      ctx.fillStyle = progress < 0.35 ? '#39ff14' : '#fde047';
      ctx.fillText(fs.text, Math.round(fs.x), Math.round(fs.y));
      ctx.restore();
    }
  }

  // 11e. BUILD MODE OVERLAY (Dashed selection frames + resize handles + thin red collision & interaction debug hitboxes!)
  if (p.buildModeEnabled) {
    renderBuildModeDebugOverlay(ctx, now, p, trackNpcs, stageCloseProgress);
  }

  ctx.restore(); // End world camera transform

  // 12. FULLSCREEN CAMERA FIX: RENDER CRISP RADAR-MINIMAP TOP-RIGHT WHEN IN CHASE OR EGO VIEW
  if (p.cameraMode === 'chase' || p.cameraMode === 'ego') {
    renderRadarMinimap(
      ctx,
      player,
      p.isMultiplayerActive ? [] : trackNpcs,
      remotePlayers,
      p.cameraMode
    );
  }
}

function renderBuildModeDebugOverlay(
  ctx: CanvasRenderingContext2D,
  now: number,
  p: {
    selectedBuildItemId?: string | null;
    customLayout?: CustomArenaLayoutState;
    centerStageMode: CenterStageMode;
    isMultiplayerActive?: boolean;
  },
  trackNpcs: TrackNpc[],
  stageCloseProgress: number
): void {
  const {
    proShopAndRental,
    bottomEntrance,
    bistro,
    uIslands,
    djTower,
    gates,
  } = ARENA_LAYOUT;
  const selectedId = p.selectedBuildItemId || null;

  ctx.save();

  // 1. THIN RED COLLISION HITBOXES & INTERACTION ZONES (Single Source of Truth)
  const drawRedDebugRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    tag?: string
  ) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.92)';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    if (tag) {
      ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tag).width + 8;
      ctx.fillRect(x, Math.max(4, y - 13), tw, 12);
      ctx.fillStyle = '#fecaca';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, x + 4, Math.max(10, y - 7));
    }
    ctx.restore();
  };

  const drawRedDebugCircle = (
    cx: number,
    cy: number,
    r: number,
    tag: string
  ) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.88)';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.07)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tag, cx, cy - r - 4);
    ctx.restore();
  };

  // Dynamic Collision Hitboxes for all Room Modules
  // A) KASSE & EINGANG
  drawRedDebugRect(
    bottomEntrance.cashierBooth.x,
    bottomEntrance.cashierBooth.y,
    bottomEntrance.cashierBooth.width,
    bottomEntrance.cashierBooth.height,
    'HITBOX: KASSE'
  );

  // B) PRO-SHOP
  drawRedDebugRect(
    proShopAndRental.proShopCounter.x,
    proShopAndRental.proShopCounter.y,
    proShopAndRental.proShopCounter.width,
    proShopAndRental.proShopCounter.height,
    'HITBOX: PRO-SHOP THEKE'
  );
  drawRedDebugCircle(
    proShopAndRental.proShopInteractX,
    proShopAndRental.proShopInteractY,
    proShopAndRental.proShopInteractRadius,
    '[E] ZONE PRO-SHOP'
  );

  // C) ROLLSCHUHVERLEIH (Theke + Schuhregale)
  drawRedDebugRect(
    proShopAndRental.rentalCounter.x,
    proShopAndRental.rentalCounter.y,
    proShopAndRental.rentalCounter.width,
    proShopAndRental.rentalCounter.height,
    'HITBOX: VERLEIH-THEKE'
  );
  for (const shelf of proShopAndRental.rentalShelves) {
    drawRedDebugRect(
      shelf.x,
      shelf.y,
      shelf.width,
      shelf.height,
      'HITBOX: SCHUHREGAL'
    );
  }
  drawRedDebugCircle(
    proShopAndRental.rentalInteractX ??
      proShopAndRental.rentalBounds.x +
        proShopAndRental.rentalBounds.width / 2,
    proShopAndRental.rentalInteractY ?? proShopAndRental.rentalBounds.y + 40,
    proShopAndRental.rentalInteractRadius ?? 125,
    '[E] ZONE VERLEIH'
  );

  // D) SLUSH & BLOB (Theke + Bänke + Bistro-Tische)
  drawRedDebugRect(
    bistro.counter.x,
    bistro.counter.y,
    bistro.counter.width,
    bistro.counter.height,
    'HITBOX: SLUSH-THEKE'
  );
  for (const wb of bistro.wallBenches) {
    drawRedDebugRect(wb.x, wb.y, wb.width, wb.height, 'HITBOX: BANK');
  }
  for (const mt of bistro.marbleTables) {
    drawRedDebugCircle(mt.x, mt.y, mt.radius + 9, 'HITBOX: TISCH');
  }
  drawRedDebugCircle(
    bistro.interactX,
    bistro.interactY,
    bistro.interactRadius,
    '[E] ZONE BISTRO'
  );

  // E) MITTEL-BÜHNE (inkl. Rahmen und oberem Info-Banner)
  const w = uIslands.width;
  const h = uIslands.height;
  const topY = uIslands.topY;
  const leftX =
    uIslands.leftDefaultX +
    (uIslands.closedStageX - uIslands.leftDefaultX) * stageCloseProgress;
  const rightX =
    uIslands.rightDefaultX -
    (uIslands.rightDefaultX -
      (uIslands.closedStageX + uIslands.closedStageWidth - w)) *
      stageCloseProgress;
  const stageLeft = leftX - 10;
  const stageRight = rightX + w + 10;
  const stageTop = topY - 40;
  const stageBottom = topY + h + 10;
  drawRedDebugRect(
    stageLeft,
    stageTop,
    stageRight - stageLeft,
    stageBottom - stageTop,
    'HITBOX: MITTEL-BÜHNE + BANNER'
  );

  // F) DISCO-TOWER / BACKSTAGE
  drawRedDebugRect(
    djTower.deskX,
    djTower.deskY,
    djTower.deskW,
    djTower.deskH,
    'HITBOX: DJ-PULT'
  );
  drawRedDebugRect(
    djTower.cornerX,
    djTower.cornerY,
    djTower.bevelTopX - djTower.cornerX,
    djTower.bevelLeftY - djTower.cornerY,
    'HITBOX: DISCO-TOWER / BACKSTAGE'
  );
  drawRedDebugCircle(
    djTower.centerX,
    djTower.centerY,
    djTower.egoTriggerRadius,
    '[1-5] DJ-SOUNDBOARD ZONE'
  );

  // G) SCHLEUSEN-BALKEN 1 & 2 + DYNAMIC WAYPOINTS gateLeft & gateRight
  const gLeft = gates.bottomLeftSchwingtuer;
  const gRight = gates.bottomRightEntrance;
  drawRedDebugRect(
    gLeft.baffleXStart,
    gLeft.baffleY - 6,
    gLeft.baffleXEnd - gLeft.baffleXStart,
    12,
    'HITBOX: SCHLEUSE 1'
  );
  drawRedDebugRect(
    gRight.baffleXStart,
    gRight.baffleY - 6,
    gRight.baffleXEnd - gRight.baffleXStart,
    12,
    'HITBOX: SCHLEUSE 2'
  );

  // H) SPINDE (80s Locker Row)
  if (ARENA_LAYOUT.lockers) {
    drawRedDebugRect(
      ARENA_LAYOUT.lockers.x,
      ARENA_LAYOUT.lockers.y,
      ARENA_LAYOUT.lockers.width,
      ARENA_LAYOUT.lockers.height,
      'HITBOX: SPINDE'
    );
  }

  // Dynamic Green Waypoint Markers for gateLeft & gateRight in active Baumenü
  const gateWaypoints = [
    { id: 'gateLeft', pt: gates.gateLeft || { x: 494, y: 860 } },
    { id: 'gateRight', pt: gates.gateRight || { x: 1456, y: 860 } },
  ];
  for (const gw of gateWaypoints) {
    ctx.save();
    ctx.fillStyle = 'rgba(57, 255, 20, 0.24)';
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gw.pt.x, gw.pt.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.arc(gw.pt.x, gw.pt.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `⚓ ${gw.id} (${gw.pt.x},${gw.pt.y})`,
      gw.pt.x,
      gw.pt.y - 15
    );
    ctx.restore();
  }

  // 2. DASHED SELECTION FRAMES WITH NAME + X/Y/W/H/ROT LABEL & BOTTOM-RIGHT RESIZE HANDLE FOR ALL 9 MOVABLE MODULES
  const activeMods =
    p.customLayout?.modules || DEFAULT_CUSTOM_ARENA_LAYOUT.modules;
  const moduleKeys = Object.keys(activeMods) as EditableModuleId[];
  for (const modId of moduleKeys) {
    const mod = activeMods[modId];
    if (!mod) continue;
    const eff = getModuleCollisionRect(mod);
    const itemKey = `mod:${modId}`;
    const isSel = selectedId === itemKey;
    ctx.save();
    ctx.strokeStyle = isSel ? '#fde047' : '#00f0ff';
    ctx.lineWidth = isSel ? 2.6 : 1.8;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(eff.x - 3, eff.y - 3, eff.width + 6, eff.height + 6);
    ctx.setLineDash([]);

    // Bottom-right Resize-Handle (Zieh-Eck) on selected or hovered module
    const handleX = eff.x + eff.width + 3;
    const handleY = eff.y + eff.height + 3;
    ctx.fillStyle = isSel ? '#fde047' : 'rgba(0, 240, 255, 0.85)';
    ctx.strokeStyle = '#050811';
    ctx.lineWidth = 1.6;
    const hs = isSel ? 11 : 8;
    ctx.fillRect(handleX - hs / 2, handleY - hs / 2, hs, hs);
    ctx.strokeRect(handleX - hs / 2, handleY - hs / 2, hs, hs);

    const rotLabel = eff.rot ? ` • ${eff.rot}°` : '';
    const labelText = `🛠️ ${mod.label} (${Math.round(mod.x)},${Math.round(mod.y)} | ${Math.round(mod.width)}×${Math.round(mod.height)}${rotLabel})`;
    ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
    const textW = ctx.measureText(labelText).width + 12;
    const badgeX = eff.x - 3;
    const badgeY = Math.max(6, eff.y - 22);
    ctx.fillStyle = isSel
      ? 'rgba(250, 204, 21, 0.96)'
      : 'rgba(8, 15, 30, 0.92)';
    ctx.strokeStyle = isSel ? '#ffffff' : '#00f0ff';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, textW, 17, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSel ? '#090d16' : '#00f0ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, badgeX + 6, badgeY + 8.5);
    ctx.restore();
  }

  // 3. DASHED SELECTION FRAMES + ANCHOR CROSSHAIR FOR ALL AI SKATERS & CREW FIGURES
  if (!p.isMultiplayerActive) {
    const pulse = 0.7 + Math.sin(now * 0.008) * 0.3;
    for (const npc of trackNpcs) {
      const itemKey = `npc:${npc.id}`;
      const isSel = selectedId === itemKey;
      const boxW = 48;
      const boxH = 54;
      const bx = npc.x - boxW / 2;
      const by = npc.y - boxH / 2 - 4;

      ctx.save();
      ctx.strokeStyle = isSel
        ? '#fde047'
        : npc.role === 'guard'
        ? '#39ff14'
        : '#f472b6';
      ctx.lineWidth = isSel ? 2.5 : 1.6;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.setLineDash([]);

      // Anchor point marker (homeX / homeY)
      const hx = npc.homeX ?? npc.x;
      const hy = npc.homeY ?? npc.y;
      ctx.strokeStyle = isSel
        ? `rgba(253, 224, 71, ${pulse})`
        : 'rgba(57, 255, 20, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx - 6, hy);
      ctx.lineTo(hx + 6, hy);
      ctx.moveTo(hx, hy - 6);
      ctx.lineTo(hx, hy + 6);
      ctx.stroke();

      // Compact Name + Anchor Coordinate Label above skater
      const npcLabel = `${npc.name} (${Math.round(hx)}, ${Math.round(hy)})`;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const lw = ctx.measureText(npcLabel).width + 10;
      const lx = npc.x - lw / 2;
      const ly = by - 16;
      ctx.fillStyle = isSel
        ? 'rgba(250, 204, 21, 0.96)'
        : 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = isSel ? '#ffffff' : '#f472b6';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(lx, ly, lw, 14, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSel ? '#090d16' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(npcLabel, npc.x, ly + 7);
      ctx.restore();
    }
  }

  ctx.restore();
}

// ============================================================================
// SUB-RENDERERS: 2.5D BACK WALL, VERTICAL LEFT MIRROR WALL & KENGOL BREAKDANCERS
// ============================================================================

function renderSloped25DBackWallAndVerticalMirror(
  ctx: CanvasRenderingContext2D,
  now: number,
  showNames: boolean,
  isBlacklight: boolean,
  djHandsUpActive: boolean,
  neonLightboxesEnabled = true,
  neonLightboxLine1 = 'RESIDENT DJ',
  neonLightboxLine2 = 'DJ MAGIC FORCE',
  neonLightboxLine3 = 'AB 20:00 UHR'
): void {
  const { slopedBackWall, mirrorWall, putzraumDoor } = ARENA_LAYOUT;
  const {
    topY,
    bottomY,
    topLeftX,
    topRightX,
    bottomLeftX,
    bottomRightX,
    neonSignCenterX,
    neonSignCenterY,
  } = slopedBackWall;

  // 1. Trapezoidal Sloped 2.5D Interior Wall Face
  const wallGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
  if (isBlacklight) {
    wallGrad.addColorStop(0, '#090314');
    wallGrad.addColorStop(1, '#1e0b3b');
  } else {
    wallGrad.addColorStop(0, '#0d111a');
    wallGrad.addColorStop(1, '#1e2536');
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bottomLeftX, bottomY);
  ctx.lineTo(topLeftX, topY);
  ctx.lineTo(topRightX, topY);
  ctx.lineTo(bottomRightX, bottomY);
  ctx.closePath();
  ctx.fillStyle = wallGrad;
  ctx.fill();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1.5;
  const numRibs = 14;
  for (let i = 1; i < numRibs; i++) {
    const frac = i / numRibs;
    const tx = topLeftX + (topRightX - topLeftX) * frac;
    const bx = bottomLeftX + (bottomRightX - bottomLeftX) * frac;
    ctx.beginPath();
    ctx.moveTo(tx, topY);
    ctx.lineTo(bx, bottomY);
    ctx.stroke();
  }

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(topLeftX, topY);
  ctx.lineTo(topRightX, topY);
  ctx.stroke();

  ctx.strokeStyle = '#5c3418';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bottomLeftX, bottomY);
  ctx.lineTo(bottomRightX, bottomY);
  ctx.stroke();

  // PALLADIUM 1989 EPOCH LOOK: Windowless dark walls with geometric 80s line ornaments under violet Blacklight ceiling tubes!
  if (activeArenaStyle === 'palladium-1989') {
    // Violet Blacklight UV Ceiling Tubes along the top cornice
    const tubeSegments = 6;
    const spanW = topRightX - topLeftX - 80;
    for (let t = 0; t < tubeSegments; t++) {
      const tx1 = topLeftX + 40 + (spanW / tubeSegments) * t + 10;
      const tx2 = topLeftX + 40 + (spanW / tubeSegments) * (t + 1) - 10;
      ctx.save();
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(tx1, topY + 6);
      ctx.lineTo(tx2, topY + 6);
      ctx.stroke();
      ctx.restore();
    }

    // Geometric 80s Line Ornaments (Triangles, Chevrons & Parallel Stripes in Cyan, Magenta & Gold)
    ctx.save();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(bottomLeftX + 20, bottomY - 16);
    ctx.lineTo(bottomRightX - 20, bottomY - 16);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 42, 133, 0.42)';
    ctx.beginPath();
    ctx.moveTo(bottomLeftX + 24, bottomY - 22);
    ctx.lineTo(bottomRightX - 24, bottomY - 22);
    ctx.stroke();

    // 80s geometric zig-zag / triangle ornaments Left & Right of the center neon sign (only if neon lightboxes are turned off)
    if (!neonLightboxesEnabled) {
      [625, 1525].forEach((ox) => {
        const oy = (topY + bottomY) / 2 + 4;
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
        ctx.beginPath();
        ctx.moveTo(ox - 55, oy + 14);
        ctx.lineTo(ox - 28, oy - 18);
        ctx.lineTo(ox, oy + 14);
        ctx.lineTo(ox + 28, oy - 18);
        ctx.lineTo(ox + 55, oy + 14);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  ctx.restore();

  // 2. ELEGANT 80s CUT-OUT NEON SIGN "PALLADIUM HANAU" + NEON WINGED ROLLER SKATE & PULSATING PA SPEAKER BOXES
  const wallCenterY = (topY + bottomY) / 2;

  drawCutoutNeonPalladiumSignAndWingedSkate(
    ctx,
    neonSignCenterX,
    neonSignCenterY,
    now,
    isBlacklight
  );

  // 4 Symmetrical Large Black 80s PA Speaker Boxes (Two round woofers + top horn tweeter, membranes pulsing to the current beat!)
  // Positioned symmetrically left (525, 725) and right (1425, 1625) of the center "✦ PALLADIUM HANAU ✦" neon sign (center = 1075)
  draw80sPASpeakerBox(ctx, 525, wallCenterY, 44, 82, 0.08, now, isBlacklight);
  draw80sPASpeakerBox(ctx, 725, wallCenterY, 44, 82, 0, now, isBlacklight);
  draw80sPASpeakerBox(ctx, 1425, wallCenterY, 44, 82, 0, now, isBlacklight);
  draw80sPASpeakerBox(ctx, 1625, wallCenterY, 44, 82, -0.08, now, isBlacklight);

  // ZWEI RUHIGE 80ER-NEON-LEUCHTKÄSTEN ZWISCHEN DEN LAUTSPRECHER-BOXEN (exakt in den Lücken x=625 und x=1525)
  if (neonLightboxesEnabled) {
    const boxW = 156;
    const boxH = 70;
    const l1 = (neonLightboxLine1 || '').trim();
    const l2 = (neonLightboxLine2 || '').trim();
    const l3 = (neonLightboxLine3 || '').trim();
    [625, 1525].forEach((cx) => {
      const bx = cx - boxW / 2;
      const by = wallCenterY - boxH / 2;
      ctx.save();

      // Dark brushed 80s chrome/acrylic lightbox casing (high contrast backdrop)
      const bgGrad = ctx.createLinearGradient(bx, by, bx, by + boxH);
      bgGrad.addColorStop(0, '#040711');
      bgGrad.addColorStop(0.5, '#090f20');
      bgGrad.addColorStop(1, '#040711');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 6);
      ctx.fill();

      // Outer metallic housing border
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#475569';
      ctx.stroke();

      // Calm inner 80s neon tube frame (steady cyan/magenta dual rim)
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = isBlacklight ? 14 : 9;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(bx + 4, by + 4, boxW - 8, boxH - 8, 4);
      ctx.stroke();
      ctx.restore();

      // Subtle corner mounting rivets
      ctx.fillStyle = '#94a3b8';
      [
        [bx + 8, by + 8],
        [bx + boxW - 8, by + 8],
        [bx + 8, by + boxH - 8],
        [bx + boxW - 8, by + boxH - 8],
      ].forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.arc(rx, ry, 1.3, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Zeile 1 (ca. 45 % größer & fetter, hoher Kontrast: "RESIDENT DJ")
      if (l1) {
        ctx.save();
        ctx.font = '900 12px "Courier New", "JetBrains Mono", monospace';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#020617';
        ctx.strokeText(l1.slice(0, 24), cx, by + 16, boxW - 14);
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#e0f2fe';
        ctx.fillText(l1.slice(0, 24), cx, by + 16, boxW - 14);
        ctx.restore();
      }

      // Zeile 2 (groß, leuchtend in der Mitte: "DJ MAGIC FORCE")
      if (l2) {
        ctx.save();
        ctx.font = '900 13px "Arial Black", Impact, sans-serif';
        ctx.shadowColor = '#ff2a85';
        ctx.shadowBlur = 11;
        ctx.fillStyle = '#fdf2f8';
        ctx.fillText(l2.slice(0, 22), cx, by + 35, boxW - 12);
        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 0.7;
        ctx.strokeText(l2.slice(0, 22), cx, by + 35, boxW - 12);
        ctx.restore();
      }

      // Zeile 3 (ca. 45 % größer & fetter, hoher Kontrast: "AB 21:00 UHR")
      if (l3) {
        ctx.save();
        ctx.font = '900 12px "Courier New", "JetBrains Mono", monospace';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = '#020617';
        ctx.strokeText(l3.slice(0, 24), cx, by + 54, boxW - 14);
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fef08a';
        ctx.fillText(l3.slice(0, 24), cx, by + 54, boxW - 14);
        ctx.restore();
      }

      ctx.restore();
    });
  }

  // 3. 90°-ROTATED VERTICAL MIRROR WALL FLUSH AGAINST THE LEFT HALL OUTER WALL (Below curved DJ-Tower)
  ctx.save();
  const mirrorGrad = ctx.createLinearGradient(
    mirrorWall.x,
    mirrorWall.y,
    mirrorWall.x + mirrorWall.width,
    mirrorWall.y
  );
  mirrorGrad.addColorStop(0, '#0f172a');
  mirrorGrad.addColorStop(0.55, '#1e293b');
  mirrorGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = mirrorGrad;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(
    mirrorWall.x,
    mirrorWall.y,
    mirrorWall.width,
    mirrorWall.height,
    6
  );
  ctx.fill();
  ctx.stroke();

  // Diagonal glass sheen lines down the vertical mirror wall
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.25)';
  ctx.lineWidth = 2;
  for (
    let my = mirrorWall.y + 24;
    my < mirrorWall.y + mirrorWall.height - 20;
    my += 52
  ) {
    ctx.beginPath();
    ctx.moveTo(mirrorWall.x + 4, my + 12);
    ctx.lineTo(mirrorWall.x + mirrorWall.width - 4, my);
    ctx.stroke();
  }

  // Vertical label "SPIEGELWAND - JAM-DANCE"
  ctx.save();
  ctx.translate(
    mirrorWall.x + mirrorWall.width / 2,
    mirrorWall.y + mirrorWall.height / 2
  );
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 10.5px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIEGELWAND - JAM-DANCE', 0, 0);
  ctx.restore();

  // Subtle linoleum breakdance mat in front of the vertical mirror wall
  ctx.fillStyle = isBlacklight
    ? 'rgba(56, 189, 248, 0.08)'
    : 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.26)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(
    mirrorWall.x + mirrorWall.width + 8,
    mirrorWall.y + 8,
    185,
    mirrorWall.height - 16,
    10
  );
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. SUBTLY ILLUMINATED "PUTZRAUM" DOOR ON THE LEFT OUTER WALL (Warm-yellow frame, crisp sign & light beam under door gap)
  ctx.save();
  const prRightX = putzraumDoor.x + putzraumDoor.width;
  const prLightGrad = ctx.createLinearGradient(
    prRightX,
    putzraumDoor.y + putzraumDoor.height / 2,
    prRightX + 54,
    putzraumDoor.y + putzraumDoor.height / 2
  );
  prLightGrad.addColorStop(0, 'rgba(253, 224, 71, 0.42)');
  prLightGrad.addColorStop(0.45, 'rgba(251, 191, 36, 0.16)');
  prLightGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = prLightGrad;
  ctx.beginPath();
  ctx.moveTo(prRightX, putzraumDoor.y + 4);
  ctx.lineTo(prRightX + 54, putzraumDoor.y - 10);
  ctx.lineTo(prRightX + 54, putzraumDoor.y + putzraumDoor.height + 10);
  ctx.lineTo(prRightX, putzraumDoor.y + putzraumDoor.height - 4);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(
    putzraumDoor.x,
    putzraumDoor.y,
    putzraumDoor.width,
    putzraumDoor.height,
    3
  );
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bright warm-yellow light slit along the door threshold
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(prRightX + 0.5, putzraumDoor.y + 5);
  ctx.lineTo(prRightX + 0.5, putzraumDoor.y + putzraumDoor.height - 5);
  ctx.stroke();

  // Door handle & keyhole on the right inner edge
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(
    putzraumDoor.x + putzraumDoor.width - 4,
    putzraumDoor.y + putzraumDoor.height / 2,
    2.6,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // High-contrast illuminated door sign "PUTZRAUM"
  ctx.save();
  ctx.translate(
    putzraumDoor.x + putzraumDoor.width / 2,
    putzraumDoor.y + putzraumDoor.height / 2
  );
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.6;
  ctx.fillRect(-38, -8, 76, 16);
  ctx.strokeRect(-38, -8, 76, 16);
  ctx.shadowColor = '#fde047';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PUTZRAUM', 0, 0.5);
  ctx.restore();
  ctx.restore();

  // 5. BREAKDANCERS IN FRONT OF VERTICAL MIRROR WALL (NO ROLLER SKATES! KENGOL BUCKET HAT + WHITE-PINK KENGO SNEAKERS!)
  // Both dancers alternate synchronously between standing up in front of the mirror (Toprock, Electric Boogie waves, synchronized spins, arms up)
  // and dropping to the floor for Windmills, belly/back spins, and Handstand-Freezes!
  const breakdancers = [
    {
      name: 'Break-Benni',
      gender: 'male' as const,
      x: mirrorWall.danceFloorX,
      y: mirrorWall.y + 102,
      suitCol: '#dc2626',
      hatCol: '#111827',
      phaseOffset: 0,
    },
    {
      name: 'Jam-Queen Nelly',
      gender: 'female' as const,
      x: mirrorWall.danceFloorX + 8,
      y: mirrorWall.y + 258,
      suitCol: '#0284c7',
      hatCol: '#f59e0b',
      phaseOffset: 0, // Synchronized choreography phase!
    },
  ];

  for (const bd of breakdancers) {
    renderKengolBreakdancer(
      ctx,
      now,
      bd,
      mirrorWall.x + 14,
      showNames,
      isBlacklight,
      djHandsUpActive
    );
  }

  // 6. 3 RELAXED SPECTATORS AT THE EDGE OF THE SPIEGELWAND - JAM-DANCE ZONE
  // Mixed group of girls and guys with diverse skin tones and 80s outfits, cleanly outside the skating lane!
  const jamSpectators = [
    {
      x: mirrorWall.x + mirrorWall.width + 18,
      y: mirrorWall.y + 32,
      gender: 'female' as const,
      skinCol: '#6b3e26',
      shirtCol: '#ec4899',
      accentCol: '#fde047',
      hairCol: '#171717',
      phase: 0.3,
    },
    {
      x: mirrorWall.x + mirrorWall.width + 20,
      y: mirrorWall.y + 182,
      gender: 'male' as const,
      skinCol: '#fde68a',
      shirtCol: '#06b6d4',
      accentCol: '#ff2a85',
      hairCol: '#78350f',
      phase: 1.9,
    },
    {
      x: mirrorWall.x + mirrorWall.width + 18,
      y: mirrorWall.y + 348,
      gender: 'female' as const,
      skinCol: '#d97742',
      shirtCol: '#a855f7',
      accentCol: '#39ff14',
      hairCol: '#1e1b4b',
      phase: 3.6,
    },
  ];

  jamSpectators.forEach((sp, idx) => {
    const bob = Math.sin(now * 0.008 + sp.phase) * 2.5;
    const clapCycle = (now * 0.001 + idx * 2.7) % 9.0;
    const isClapping = clapCycle < 2.4 || djHandsUpActive;
    const clapOffset = isClapping ? Math.abs(Math.sin(now * 0.025 + idx)) * 5 : 2;

    ctx.save();
    ctx.translate(sp.x, sp.y + bob);

    // Subtle floor shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sneakers facing right toward the Jam-Dancers (+X)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-3, -11, 10, 4.5);
    ctx.fillRect(-3, 6.5, 10, 4.5);
    ctx.fillStyle = sp.accentCol;
    ctx.fillRect(0, -10, 6, 2);
    ctx.fillRect(0, 7.5, 6, 2);

    // 80s Jacket / Top
    const shSpan = sp.gender === 'female' ? 24 : 28;
    ctx.fillStyle = sp.shirtCol;
    ctx.strokeStyle = isBlacklight ? '#00f0ff' : sp.accentCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-9, -shSpan / 2, 18, shSpan, 7);
    ctx.fill();
    ctx.stroke();

    // Clapping / cheering arms in front (+X)
    ctx.strokeStyle = sp.skinCol;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, -8);
    ctx.lineTo(13, -1.5 - clapOffset);
    ctx.moveTo(4, 8);
    ctx.lineTo(13, 1.5 + clapOffset);
    ctx.stroke();

    // Head & Hair
    ctx.fillStyle = sp.skinCol;
    ctx.beginPath();
    ctx.arc(1, 0, 7.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = sp.hairCol;
    if (sp.gender === 'female') {
      ctx.beginPath();
      ctx.arc(-1, 0, 7.5, 0.7, -0.7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-9, 0, 5.5, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(-1, 0, 7.5, 0.8, -0.8);
      ctx.fill();
      ctx.fillStyle = sp.accentCol;
      ctx.fillRect(2, -6.5, 2.5, 13);
    }

    // Occasional brief compact clap/cheer icon (no large name badges!)
    if (clapCycle < 1.5) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(idx === 1 ? '🙌' : '👏', 2, -18);
    }

    ctx.restore();
  });
}

/**
 * Pure Cut-Out 80s Neon Sign on the Dark 2.5D Back Wall:
 * "✦ PALLADIUM HANAU ✦" + Cut-Out Neon Winged Roller Skate (No box background!)
 */
function drawCutoutNeonPalladiumSignAndWingedSkate(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  now: number,
  isBlacklight: boolean
): void {
  const pulse = 0.88 + Math.sin(now * 0.006) * 0.12;

  ctx.save();
  ctx.translate(cx, cy);

  // Subtle ambient neon wall-wash glow directly on the dark sloped wall (NO box frame!)
  const wallGlow = ctx.createRadialGradient(0, 0, 12, 0, 0, 260);
  wallGlow.addColorStop(0, 'rgba(57, 255, 20, 0.22)');
  wallGlow.addColorStop(0.55, 'rgba(0, 240, 255, 0.10)');
  wallGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = wallGlow;
  ctx.beginPath();
  ctx.ellipse(0, 0, 260, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1. TWO SYMMETRICAL CUT-OUT NEON WINGED ROLLER SKATES (Left at x = -212, Mirrored Right at x = +212!)
  [-1, 1].forEach((sideSign) => {
    ctx.save();
    ctx.translate(sideSign * 212, 2);
    ctx.scale(sideSign === -1 ? 1.18 : -1.18, 1.18);

    // Neon Yellow/Gold Wing Tubes
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = isBlacklight ? 18 : 13;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-42, -16);
    ctx.lineTo(-31, -7);
    ctx.lineTo(-44, -2);
    ctx.lineTo(-29, 3);
    ctx.lineTo(-36, 8);
    ctx.lineTo(-10, 6);
    ctx.stroke();

    // Inner bright core of wing tubes
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fef9c3';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Neon Green Roller Skate Boot Outline (pure line art, no solid fill!)
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = isBlacklight ? 20 : 14;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-12, -16);
    ctx.lineTo(4, -16);
    ctx.lineTo(7, -2);
    ctx.lineTo(20, 2);
    ctx.quadraticCurveTo(25, 7, 19, 11);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.stroke();

    // Inner white-green core of skate boot tube
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#dcfce7';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Neon Cyan Laces & Sole Rail
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(2, -12);
    ctx.lineTo(7, -10);
    ctx.moveTo(3, -8);
    ctx.lineTo(8, -6);
    ctx.moveTo(5, -4);
    ctx.lineTo(11, -2);
    ctx.moveTo(-13, 14);
    ctx.lineTo(18, 14);
    ctx.stroke();

    // Neon Violet Toe-Stop
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(23, 11, 3.6, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Glowing Neon-Pink Roller Wheels
    ctx.shadowColor = '#ff2a85';
    ctx.shadowBlur = isBlacklight ? 18 : 13;
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 2.3;
    [-10, -2, 6, 14].forEach((wx) => {
      ctx.beginPath();
      ctx.arc(wx, 18, 4.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(wx, 18, 1.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });

  // 2. SYMMETRICALLY CENTERED CUT-OUT 80s NEON TUBES: "✦ PALLADIUM ✦" (x = 0)
  ctx.save();
  ctx.translate(0, 0);

  // Top & bottom sleek neon accent rails (cyan/magenta)
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-165, -24);
  ctx.lineTo(165, -24);
  ctx.stroke();

  ctx.shadowColor = '#ff2a85';
  ctx.strokeStyle = '#ff2a85';
  ctx.beginPath();
  ctx.moveTo(-145, 25);
  ctx.lineTo(145, 25);
  ctx.stroke();

  // Main Neon Green "✦ PALLADIUM ✦" Tube Lettering
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = (isBlacklight ? 28 : 20) * pulse;
  ctx.font = 'italic 900 26px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 4.2;
  ctx.strokeText('✦ PALLADIUM ✦', 0, -4);

  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ecfccb';
  ctx.fillText('✦ PALLADIUM ✦', 0, -4);

  // Glowing Neon Cyan Subtitle "H A N A U  •  R O L L E R  D I S C O"
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 14;
  ctx.font = 'bold 11.5px "Orbitron", "Outfit", sans-serif';
  ctx.fillStyle = '#67e8f9';
  ctx.fillText('H A N A U   •   R O L L E R   D I S C O', 0, 15);
  ctx.restore();

  ctx.restore();
}


/**
 * Large Black 80s PA Speaker Cabinet (2 round woofers + top horn tweeter)
 * Membranes pulse rhythmically to the current beat!
 */
function draw80sPASpeakerBox(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  tiltRad: number,
  now: number,
  isBlacklight: boolean
): void {
  const audioBands = soundFX.getSmoothedAudioBands(now);
  const beatPulse = audioBands.bass; // Flicker-free EMA smoothed bass envelope (0..1)

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tiltRad);

  // Outer black 80s PA cabinet with protective metal corners
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = isBlacklight ? '#a855f7' : '#475569';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 5);
  ctx.fill();
  ctx.stroke();

  // Inner recessed baffle board
  ctx.fillStyle = '#111827';
  ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);

  // Top High-Frequency Horn Tweeter ("Hochton-Horn")
  ctx.fillStyle = '#030712';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#64748b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 7, -h / 2 + 7, w - 14, 13, 2);
  ctx.fill();
  ctx.stroke();

  // Two Round Woofers ("Tieftöner") pulsing rhythmically with the beat
  [-5, 21].forEach((wy) => {
    const baseRadius = 11.5;
    const coneRadius = baseRadius + beatPulse * 2.4;

    // Woofer surround ring
    ctx.fillStyle = '#030712';
    ctx.strokeStyle = isBlacklight
      ? `rgba(0, 240, 255, ${0.55 + beatPulse * 0.45})`
      : `rgba(148, 163, 184, ${0.5 + beatPulse * 0.4})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, wy, coneRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pulsating inner paper membrane & silver dust cap
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, wy, coneRadius * 0.68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isBlacklight ? '#ff2a85' : '#cbd5e1';
    ctx.beginPath();
    ctx.arc(0, wy, 3.2 + beatPulse * 1.4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Subtle sound-pressure wave arcs radiating downward on bass hits
  if (beatPulse > 0.35) {
    ctx.strokeStyle = isBlacklight
      ? `rgba(57, 255, 20, ${beatPulse * 0.55})`
      : `rgba(56, 189, 248, ${beatPulse * 0.45})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, h / 2 + 2, 14 + beatPulse * 10, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders an authentic 80s Breakdancer in front of the vertical mirror wall:
 * - NO roller skates!
 * - Iconic Kengol-Bucket-Hat (with kangaroo emblem)
 * - White-and-pink Kengo sneakers (glowing in Blacklight UV mode!)
 * - Alternates synchronously between:
 *   - Upright Mirror-Choreography (80s Toprock, Electric-Boogie waves, synchronized spins, arms up)
 *   - Floor Powermoves (Windmills, belly/back spins, Handstand-Freezes)
 */
function renderKengolBreakdancer(
  ctx: CanvasRenderingContext2D,
  now: number,
  bd: {
    name: string;
    gender: 'male' | 'female';
    x: number;
    y: number;
    suitCol: string;
    hatCol: string;
    phaseOffset: number;
  },
  mirrorGlassX: number,
  showNames: boolean,
  isBlacklight: boolean,
  djHandsUpActive: boolean
): void {
  // 16-second synchronized routine:
  // Phase 0 (0..4s): Upright Synchronized 80s Toprock & Arms-Up Groove facing the mirror
  // Phase 1 (4..8s): Upright Electric-Boogie Body-Wave & Synchronized Standing Spin
  // Phase 2 (8..12s): Floor Powermove — Windmill & Belly/Back Spin (Bauch-/Rücken-Spin)
  // Phase 3 (12..16s): Floor Powermove — Handstand V-Split Freeze
  const cycleSec = (now * 0.001 + bd.phaseOffset) % 16.0;
  const moveIndex = djHandsUpActive ? 0 : Math.floor(cycleSec / 4.0);
  const t = now * 0.005 + bd.phaseOffset;
  const syncBounce = Math.sin(now * 0.01) * 3.5;

  // 1. Mirror Reflection inside the vertical left Mirror Wall (reflects standing/floor movement!)
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = bd.suitCol;
  ctx.beginPath();
  ctx.arc(mirrorGlassX, bd.y + syncBounce * 0.5, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff2a85';
  ctx.fillRect(mirrorGlassX - 4, bd.y - 12 + syncBounce * 0.5, 8, 4);
  ctx.restore();

  // 2. Breakdancer Figure
  ctx.save();
  ctx.translate(bd.x, bd.y);

  // Floor shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 26, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  const drawKengoSneaker = (sx: number, sy: number, angle: number) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    // Crisp White Kengo Sneaker Base
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = isBlacklight ? '#ff2a85' : '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-9, -5, 18, 10, 4);
    ctx.fill();
    ctx.stroke();
    // Glowing Neon-Pink Kengo Side Stripes & Sole Accent!
    if (isBlacklight) {
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(-7, -3, 14, 3);
    ctx.fillRect(2, -5, 5, 10);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawKengolBucketHat = (hx: number, hy: number) => {
    ctx.save();
    ctx.translate(hx, hy);
    // Female ponytail sticking out from under the Kengol hat
    if (bd.gender === 'female') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(12, 2, 7, 4.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff2a85';
      ctx.beginPath();
      ctx.arc(6, 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Kengol Bucket Hat Brim
    ctx.fillStyle = bd.hatCol;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Bucket Crown + Hatband
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
    ctx.stroke();
    // Tiny Golden/White Kangaroo Silhouette Logo on front of hat
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(-4, 1);
    ctx.lineTo(1, -3);
    ctx.lineTo(4, -1);
    ctx.lineTo(1, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  if (moveIndex === 0) {
    // PHASE 1 (UPRIGHT): SYNCHRONIZED 80s TOPROCK & ARMS-UP GROOVE IN FRONT OF THE MIRROR
    const stepShift = Math.sin(t * 2.4) * 9;
    const armWave = Math.cos(t * 2.4) * 7;

    // Synchronized Toprock stepping legs in white-pink Kengo sneakers
    ctx.strokeStyle = bd.suitCol;
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-10 - stepShift * 0.4, 14);
    ctx.moveTo(3, 2);
    ctx.lineTo(-6 + stepShift, -12);
    ctx.stroke();

    drawKengoSneaker(-12 - stepShift * 0.4, 16, -0.15);
    drawKengoSneaker(-8 + stepShift, -14, 0.25);

    // Upright Tracksuit Torso facing the mirror (-X)
    const shW = bd.gender === 'female' ? 21 : 25;
    ctx.fillStyle = bd.suitCol;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-10, -shW / 2 + syncBounce * 0.3, 20, shW, 8);
    ctx.fill();
    ctx.stroke();

    // Raised arms grooving in the air ("Put your hands up!" / Toprock)
    ctx.strokeStyle = bd.suitCol;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-4, -shW / 2 + 2);
    ctx.lineTo(-20, -16 - armWave);
    ctx.moveTo(-4, shW / 2 - 2);
    ctx.lineTo(-20, 16 + armWave);
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(-22, -17 - armWave, 4.2, 0, Math.PI * 2);
    ctx.arc(-22, 17 + armWave, 4.2, 0, Math.PI * 2);
    ctx.fill();

    drawKengolBucketHat(0, syncBounce * 0.3);
  } else if (moveIndex === 1) {
    // PHASE 2 (UPRIGHT): ELECTRIC-BOOGIE WAVE & SYNCHRONIZED UPRIGHT SPIN
    const subPhase = cycleSec - 4.0;
    const isSpinning = subPhase > 2.2;
    const bodyRot = isSpinning ? (subPhase - 2.2) * Math.PI * 3.5 : Math.sin(t * 2.0) * 0.35;
    const boogieWave = Math.sin(t * 3.2) * 8;

    ctx.save();
    ctx.rotate(bodyRot);

    // Sneakers planted / pivoting in synchronized spin
    drawKengoSneaker(-6, -13, -0.2);
    drawKengoSneaker(-6, 13, 0.2);

    // Electric-Boogie waving arms
    ctx.strokeStyle = bd.suitCol;
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-14, -20 + boogieWave);
    ctx.moveTo(0, 10);
    ctx.lineTo(14, 20 - boogieWave);
    ctx.stroke();

    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(-16, -21 + boogieWave, 4, 0, Math.PI * 2);
    ctx.arc(16, 21 - boogieWave, 4, 0, Math.PI * 2);
    ctx.fill();

    const shW = bd.gender === 'female' ? 21 : 25;
    ctx.fillStyle = bd.suitCol;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-10, -shW / 2, 20, shW, 8);
    ctx.fill();
    ctx.stroke();

    drawKengolBucketHat(0, 0);
    ctx.restore();
  } else if (moveIndex === 2) {
    // PHASE 3 (FLOOR POWERMOVE): WINDMILL & BELLY/BACK SPIN (Spinning rapidly on floor with V-legs & white-pink Kengo sneakers!)
    const spinAng = now * 0.012;
    ctx.save();
    ctx.rotate(spinAng);

    // Outstretched V-legs in tracksuit pants
    ctx.strokeStyle = bd.suitCol;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-22, -16);
    ctx.moveTo(0, 0);
    ctx.lineTo(22, 16);
    ctx.stroke();

    // White racing stripe on tracksuit legs
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(-20, -15);
    ctx.moveTo(4, 3);
    ctx.lineTo(20, 15);
    ctx.stroke();

    // White-Pink Kengo Sneakers at the ends of both legs
    drawKengoSneaker(-25, -18, -0.6);
    drawKengoSneaker(25, 18, 0.6);

    // Torso spinning on floor
    ctx.fillStyle = bd.suitCol;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawKengolBucketHat(0, 0);
    ctx.restore();
  } else {
    // PHASE 4 (FLOOR POWERMOVE): HANDSTAND / FREEZE (Legs split high up in the air showing off the white-pink Kengo sneakers!)
    const freezeSway = Math.sin(t * 1.8) * 5;
    // Supporting hands on the floor
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(-10, 10, 4.5, 0, Math.PI * 2);
    ctx.arc(10, 10, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Inverted Torso
    ctx.fillStyle = bd.suitCol;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-11, -10, 22, 20, 7);
    ctx.fill();
    ctx.stroke();

    // High V-Split Legs in the air
    ctx.strokeStyle = bd.suitCol;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(-20 + freezeSway, -26);
    ctx.moveTo(5, -8);
    ctx.lineTo(20 + freezeSway, -26);
    ctx.stroke();

    // Prominently visible White-Pink Kengo Sneakers held high in the air!
    drawKengoSneaker(-22 + freezeSway, -29, -0.4);
    drawKengoSneaker(22 + freezeSway, -29, 0.4);

    drawKengolBucketHat(0, 3);
  }

  ctx.restore();

  if (djHandsUpActive && bd.gender === 'male') {
    drawSpeechBubble(ctx, bd.x + 12, bd.y - 54, '🙌 YEAH! HANDS UP!');
  }

  if (showNames) {
    drawRetroNameBadge(
      ctx,
      bd.x + 6,
      bd.y - 44,
      bd.name,
      '#ff2a85'
    );
  }
}

// ============================================================================
// CENTER U-ISLANDS (`[` & `]`), JAM-SKATERS IN BETWEEN, OR COLLAPSIBLE STAGE
// ============================================================================

function renderCenterIslandsOrStage(
  ctx: CanvasRenderingContext2D,
  now: number,
  stageCloseProgress: number,
  centerStageMode: CenterStageMode,
  activeBandName: string,
  bandSkinTone: BandSkinToneMode,
  bandGender: BandGenderMode,
  showNames: boolean,
  isBlacklight: boolean,
  djHandsUpActive: boolean,
  fogIntensity: number,
  isMultiplayerActive = false,
  cinemaCountdownEnabled = false,
  cinemaCountdownTitle = 'NÄCHSTER LIVE-STREAM',
  cinemaCountdownTargetIso = '',
  cinemaWeekdays: string[] = ['Mi', 'Sa'],
  cinemaStartTime = '20:00',
  isBallspielMode = false,
  ballspielPlayersRemaining = 15,
  backgroundDancersEnabled = true
): void {
  const { uIslands } = ARENA_LAYOUT;
  const w = uIslands.width;
  const h = uIslands.height;
  const t = uIslands.wallThickness;
  const topY = uIslands.topY;
  const stageCenterX = uIslands.closedStageX + uIslands.closedStageWidth / 2;
  const stageCenterY = uIslands.closedStageY + uIslands.closedStageHeight / 2;

  const leftX =
    uIslands.leftDefaultX +
    (uIslands.closedStageX - uIslands.leftDefaultX) * stageCloseProgress;
  const rightX =
    uIslands.rightDefaultX -
    (uIslands.rightDefaultX -
      (uIslands.closedStageX + uIslands.closedStageWidth - w)) *
      stageCloseProgress;

  // ABGERUNDETER MITTEL-ARENA-RAHMEN (#8):
  // Clean rounded inner track/island frame matching the rounded outer rink geometry
  ctx.save();
  ctx.strokeStyle = isBlacklight
    ? 'rgba(0, 240, 255, 0.34)'
    : 'rgba(236, 72, 153, 0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(
    leftX - 10,
    topY - 8,
    rightX + w - leftX + 20,
    h + 16,
    46
  );
  ctx.stroke();
  ctx.restore();

  // Subtle floor marking for the widened 280px Jam- & Freestyle center aisle under the mirror ball
  if (stageCloseProgress < 0.25 && centerStageMode === 'islands') {
    const aisleLeft = leftX + w + 10;
    const aisleRight = rightX - 10;
    const aisleWidth = Math.max(40, aisleRight - aisleLeft);
    ctx.save();
    ctx.strokeStyle = isBlacklight
      ? 'rgba(0, 240, 255, 0.22)'
      : 'rgba(236, 72, 153, 0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.roundRect(aisleLeft, topY + 8, aisleWidth, h - 16, 18);
    ctx.stroke();
    ctx.restore();
  }

  // 1. Draw Left U-Island (`[` shape with harmonious rounded outer corners)
  ctx.fillStyle = '#1e1b2e';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#ec4899';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(leftX, topY, w, h, [42, 14, 14, 42]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2d1b36';
  ctx.beginPath();
  ctx.roundRect(leftX + t, topY + t, w - t, h - t * 2, [22, 8, 8, 22]);
  ctx.fill();

  // 2. Draw Right U-Island (`]` shape with harmonious rounded outer corners)
  ctx.fillStyle = '#1e1b2e';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#ec4899';
  ctx.beginPath();
  ctx.roundRect(rightX, topY, w, h, [14, 42, 42, 14]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2d1b36';
  ctx.beginPath();
  ctx.roundRect(rightX, topY + t, w - t, w > t ? h - t * 2 : h, [8, 22, 22, 8]);
  ctx.fill();

  // BALLSPIEL LIVE CENTER SCOREBOARD OVERLAY
  if (isBallspielMode) {
    ctx.save();
    const boardW = 430;
    const boardH = 38;
    const boardX = stageCenterX - boardW / 2;
    const boardY = topY - 26;
    ctx.fillStyle = 'rgba(9, 13, 22, 0.94)';
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#39ff14';
    ctx.font = 'bold 13.5px "Silkscreen", "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `🏐 BALLSPIEL LIVE | NOCH IM SPIEL: ${ballspielPlayersRemaining} SPIELER`,
      stageCenterX,
      boardY + boardH / 2
    );
    ctx.restore();
  }

  // STRICT EITHER-OR SWITCH FOR MITTEL-ARENA ('islands' | 'band' | 'cinema')!
  switch (centerStageMode) {
    case 'islands': {
      // Subtle 80s Ground-Fog wisps around the center U-islands when Fog Machine is active in 'islands' mode
      if (fogIntensity > 0) {
        render80sStageGroundFog(
          ctx,
          now,
          uIslands.closedStageX,
          uIslands.closedStageY,
          uIslands.closedStageWidth,
          uIslands.closedStageHeight,
          fogIntensity * 0.75,
          isBlacklight
        );
      }

      // 4 Synchronized 16-Bit Jam-Roller-Dancers in the center aisle (leg-kicks, 180° spins & split-slides) when not in Ballspiel!
      if (!isMultiplayerActive && !isBallspielMode && stageCloseProgress < 0.3) {
        const jamMovePhase = Math.floor(now * 0.00045) % 3; // 0: Synced Leg-Kicks, 1: 180-Spin, 2: Split-Slide
        const syncBeat = now * 0.0065;
        const centerJamSkaters = [
          {
            name: 'Electric-Mia',
            gender: 'female' as const,
            baseX: stageCenterX - 48,
            baseY: stageCenterY - 54,
            col: '#38bdf8',
            legwarmerColor: '#ff2a85',
            bootCol: 'white' as const,
            idx: 0,
          },
          {
            name: 'Spin-Sammy',
            gender: 'male' as const,
            baseX: stageCenterX + 48,
            baseY: stageCenterY - 54,
            col: '#39ff14',
            legwarmerColor: undefined,
            bootCol: 'black' as const,
            idx: 1,
          },
          {
            name: 'Boogie-Bea',
            gender: 'female' as const,
            baseX: stageCenterX - 48,
            baseY: stageCenterY + 58,
            col: '#ff2a85',
            legwarmerColor: '#00f0ff',
            bootCol: 'white' as const,
            idx: 2,
          },
          {
            name: 'Groove-Gino',
            gender: 'male' as const,
            baseX: stageCenterX + 48,
            baseY: stageCenterY + 58,
            col: '#facc15',
            legwarmerColor: undefined,
            bootCol: 'black' as const,
            idx: 3,
          },
        ];

        for (const js of centerJamSkaters) {
          let jx = js.baseX;
          let jy = js.baseY;
          let heading = Math.PI * 0.5;
          let jumpZ = 0;

          if (jamMovePhase === 0) {
            // Synchronized 80s Jam-Kicks & Side-Groove
            jx += Math.sin(syncBeat) * 20;
            jy += Math.cos(syncBeat * 2) * 8;
            heading = Math.PI * 0.5 + Math.sin(syncBeat) * 0.45;
            jumpZ = Math.max(0, Math.sin(syncBeat * 2)) * 5.5;
          } else if (jamMovePhase === 1) {
            // Synchronized 180° / 360° Pirouette Spins
            jx += Math.cos(syncBeat * 0.7 + js.idx) * 14;
            jy += Math.sin(syncBeat * 0.7 + js.idx) * 10;
            heading = (now * 0.011) % (Math.PI * 2);
            jumpZ = Math.abs(Math.sin(syncBeat)) * 4;
          } else {
            // Synchronized Split-Slide & Crossover Formation
            const slide = Math.sin(syncBeat * 0.85) * 32;
            jx += js.idx % 2 === 0 ? slide : -slide;
            jy += Math.cos(syncBeat * 0.85) * 12;
            heading = js.idx % 2 === 0 ? 0 : Math.PI;
            jumpZ = djHandsUpActive ? Math.abs(Math.sin(syncBeat)) * 6 : 1.5;
          }

          renderCharacterSprite(ctx, now, {
            x: jx,
            y: jy,
            headingRad: heading,
            jumpZ,
            gender: js.gender,
            isWheelchair: false,
            isSkateGuard: false,
            isSpeedSkater: false,
            isGhost: false,
            isPalladiumanerStaff: false,
            shirtColor: js.col,
            accentColor: '#ffffff',
            wheelColor: '#fde047',
            skateBootColor: js.bootCol,
            legwarmerColor: js.legwarmerColor,
            name: js.name,
            showName: showNames,
            isBlacklight,
            crashTimer: 0,
            speechBubble:
              djHandsUpActive && js.idx === 0
                ? '🙌 HANDS UP!'
                : jamMovePhase === 1 && js.idx === 1 && Math.sin(now * 0.002) > 0.75
                ? '🕺 JAM SPIN!'
                : null,
          });
        }
      }
      break;
    }

    case 'band': {
      // ONLY in 'band' mode: draw the Live-Band-Bühne, musicians, truss & concert lighting!
      const sx = uIslands.closedStageX;
      const sy = uIslands.closedStageY;
      const sw = uIslands.closedStageWidth;
      const sh = uIslands.closedStageHeight;

      ctx.fillStyle = '#13111c';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(sx + 12, sy + 12, sw - 24, sh - 24, 24);
      ctx.fill();
      ctx.stroke();

      const audioBands = soundFX.getSmoothedAudioBands(now);
      const beatPulse = audioBands.bass;

      // A. STAGE BANNER AT THE VERY TOP EDGE OF THE STAGE
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.8;
      ctx.fillRect(sx + 32, sy + 18, sw - 64, 28);
      ctx.strokeRect(sx + 32, sy + 18, sw - 64, 28);
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 14.5px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`★ LIVE: ${activeBandName} ★`, stageCenterX, sy + 37);

      // B. 80s STAGE FOG MACHINES (LEFT & RIGHT) + BILLOWY SEMI-TRANSPARENT GROUND FOG WISPS
      const fogBoxes = [
        { fx: sx + 22, fy: sy + 152 },
        { fx: sx + sw - 44, fy: sy + 152 },
      ];
      for (const fb of fogBoxes) {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = fogIntensity > 0 ? '#38bdf8' : '#475569';
        ctx.lineWidth = 1.5;
        ctx.fillRect(fb.fx, fb.fy, 22, 16);
        ctx.strokeRect(fb.fx, fb.fy, 22, 16);
        ctx.fillStyle = fogIntensity > 0 ? '#39ff14' : '#ef4444';
        ctx.beginPath();
        ctx.arc(fb.fx + 11, fb.fy + 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (fogIntensity > 0) {
        render80sStageGroundFog(
          ctx,
          now,
          sx,
          sy,
          sw,
          sh,
          fogIntensity,
          isBlacklight
        );
      }

      // C. 80s LATTICE LIGHTING TRUSS ("GITTER-TRAVERSE / LICHTBRÜCKE") + 6 COLORFUL PAR SPOTLIGHT CONES
      const trussX = sx + 38;
      const trussY = sy + 50;
      const trussW = sw - 76;
      const trussH = 12;

      const parSpotlights = [
        {
          sx: trussX + 28,
          tx: stageCenterX - 118,
          ty: sy + 162,
          col: '#ef4444', // Red
          rgba: '239, 68, 68',
        },
        {
          sx: trussX + 86,
          tx: stageCenterX - 118,
          ty: sy + 162,
          col: '#f59e0b', // Warm Yellow/Amber
          rgba: '245, 158, 11',
        },
        {
          sx: trussX + 144,
          tx: stageCenterX,
          ty: sy + 92,
          col: '#00f0ff', // Neon Blue
          rgba: '0, 240, 255',
        },
        {
          sx: trussX + 204,
          tx: stageCenterX,
          ty: sy + 242,
          col: '#39ff14', // Emerald Green
          rgba: '57, 255, 20',
        },
        {
          sx: trussX + 262,
          tx: stageCenterX + 118,
          ty: sy + 162,
          col: '#ff2a85', // Magenta
          rgba: '255, 42, 133',
        },
        {
          sx: trussX + 320,
          tx: stageCenterX + 118,
          ty: sy + 162,
          col: '#fde047', // Gold
          rgba: '253, 224, 71',
        },
      ];

      // Draw soft, semi-transparent PAR spotlight cones sweeping forward over the stage (flicker-free Sound-to-Light!)
      ctx.save();
      const coneAlphaBoost = fogIntensity > 0 ? 1.38 : 1.0;
      parSpotlights.forEach((sp, idx) => {
        const sway = Math.sin(now * 0.003 + idx * 1.1) * 14;
        const targetX = sp.tx + sway;
        const targetY = sp.ty;
        const coneGrad = ctx.createLinearGradient(
          sp.sx,
          trussY + trussH,
          targetX,
          targetY + 26
        );
        const bandMod =
          idx % 3 === 0
            ? audioBands.bass
            : idx % 3 === 1
            ? audioBands.mid
            : audioBands.high;
        const baseAlpha = (0.16 + bandMod * 0.14) * coneAlphaBoost;
        coneGrad.addColorStop(
          0,
          `rgba(${sp.rgba}, ${Math.min(0.42, baseAlpha)})`
        );
        coneGrad.addColorStop(
          0.65,
          `rgba(${sp.rgba}, ${Math.min(0.24, baseAlpha * 0.55)})`
        );
        coneGrad.addColorStop(1, `rgba(${sp.rgba}, 0)`);

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(sp.sx - 5, trussY + trussH);
        ctx.lineTo(sp.sx + 5, trussY + trussH);
        ctx.lineTo(targetX + 38, targetY + 28);
        ctx.lineTo(targetX - 38, targetY + 28);
        ctx.closePath();
        ctx.fill();
      });
      ctx.restore();

      // Draw Silvery-Dark Lattice Box Truss ("Gitter-Traverse")
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.fillRect(trussX, trussY, trussW, trussH);
      ctx.strokeRect(trussX, trussY, trussW, trussH);

      // Diagonal cross-bracing struts along the truss
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let tx = trussX; tx < trussX + trussW - 14; tx += 16) {
        ctx.moveTo(tx, trussY + trussH);
        ctx.lineTo(tx + 8, trussY);
        ctx.lineTo(tx + 16, trussY + trussH);
      }
      ctx.stroke();

      // Draw the 6 PAR Spotlight Cans mounted on the truss
      parSpotlights.forEach((sp) => {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(sp.sx - 6, trussY + trussH - 2, 12, 9, 2);
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = sp.col;
        ctx.shadowBlur = 10;
        ctx.fillStyle = sp.col;
        ctx.beginPath();
        ctx.arc(sp.sx, trussY + trussH + 6, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.restore();

      // D. TWO 4-CHANNEL 80s LIGHT ORGANS ("4-KANAL-80ER-LICHTORGELN") AT THE FRONT STAGE CORNERS
      const lightOrgans = [
        { lx: sx + 24, ly: sy + sh - 74 },
        { lx: sx + sw - 42, ly: sy + sh - 74 },
      ];
      const organColors = ['#ef4444', '#fde047', '#39ff14', '#00f0ff'];
      const activeChamber = Math.floor(now * 0.005) % 4;
      for (const lo of lightOrgans) {
        ctx.save();
        ctx.fillStyle = '#090d16';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(lo.lx, lo.ly, 18, 48, 3);
        ctx.fill();
        ctx.stroke();

        for (let c = 0; c < 4; c++) {
          const isLit =
            c === activeChamber ||
            (beatPulse > 0.5 && (c + activeChamber) % 2 === 0);
          const col = organColors[c];
          ctx.fillStyle = isLit ? col : 'rgba(30, 41, 59, 0.8)';
          if (isLit) {
            ctx.shadowColor = col;
            ctx.shadowBlur = 10;
          }
          ctx.fillRect(lo.lx + 3, lo.ly + 3 + c * 11, 12, 8.5);
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }

      // E. 4 STANDING BAND MUSICIANS WITH FLOOR SHADOWS, SHOULDERS/ARMS & INSTRUMENTS
      const darkTones = ['#6b3e26', '#5c3317', '#784421', '#4e2a14'] as const;
      const lightTones = ['#fde68a', '#fed7aa', '#fcd34d', '#fde68a'] as const;
      const getMusicianSkin = (idx: 0 | 1 | 2 | 3) => {
        const isDark =
          bandSkinTone === 'black'
            ? true
            : bandSkinTone === 'white'
            ? false
            : idx % 2 === 0;
        return {
          isDark,
          skinColor: isDark ? darkTones[idx] : lightTones[idx],
        };
      };
      const getMusicianIsFemale = (idx: 0 | 1 | 2 | 3) => {
        if (bandGender === 'female') return true;
        if (bandGender === 'male') return false;
        return idx === 1 || idx === 3;
      };

      const drawMusicianHeadAndHair = (
        bx: number,
        headY: number,
        isFemale: boolean,
        isDark: boolean,
        skinColor: string,
        roleIdx: 0 | 1 | 2 | 3
      ) => {
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(bx, headY, 8.6, 0, Math.PI * 2);
        ctx.fill();

        if (isFemale) {
          const hairCol = isDark
            ? '#170d08'
            : roleIdx === 2
            ? '#f59e0b'
            : roleIdx === 1
            ? '#9333ea'
            : '#b45309';
          ctx.fillStyle = hairCol;
          ctx.beginPath();
          ctx.arc(bx - 7.5, headY + 1, 5.2, 0, Math.PI * 2);
          ctx.arc(bx + 7.5, headY + 1, 5.2, 0, Math.PI * 2);
          ctx.arc(bx, headY - 3.5, 8.8, Math.PI * 0.95, Math.PI * 0.05);
          ctx.fill();

          if (isDark) {
            ctx.beginPath();
            ctx.arc(bx - 5, headY - 6.5, 4.8, 0, Math.PI * 2);
            ctx.arc(bx + 5, headY - 6.5, 4.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.ellipse(bx + 9.5, headY - 4, 4.5, 2.8, -0.4, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.strokeStyle = roleIdx % 2 === 0 ? '#00f0ff' : '#ff2a85';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - 8, headY - 3);
          ctx.lineTo(bx + 8, headY - 3);
          ctx.stroke();

          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(bx - 9.2, headY + 2.5, 2.2, 0, Math.PI * 2);
          ctx.arc(bx + 9.2, headY + 2.5, 2.2, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const hairCol = isDark
            ? '#140c08'
            : roleIdx === 2
            ? '#f59e0b'
            : roleIdx === 0
            ? '#451a03'
            : '#1e1b4b';
          ctx.fillStyle = hairCol;
          if (isDark) {
            ctx.beginPath();
            ctx.arc(bx, headY - 2.5, 10.2, Math.PI * 0.85, Math.PI * 0.15);
            ctx.arc(bx - 6.5, headY - 4, 4.6, 0, Math.PI * 2);
            ctx.arc(bx + 6.5, headY - 4, 4.6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(bx, headY - 2, 8.6, Math.PI * 0.88, Math.PI * 0.12);
            ctx.fill();
            ctx.fillRect(bx - 7.5, headY - 2, 3, 6);
            ctx.fillRect(bx + 4.5, headY - 2, 3, 6);
          }

          if (roleIdx === 0 || roleIdx === 3) {
            ctx.strokeStyle = roleIdx === 0 ? '#ef4444' : '#39ff14';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(bx - 8.2, headY - 2.2);
            ctx.lineTo(bx + 8.2, headY - 2.2);
            ctx.stroke();
          }
        }
      };

      // 1) REAR DRUMMER (at bx = stageCenterX, by = sy + 92)
      {
        const bx = stageCenterX;
        const by = sy + 92;
        const bounce = Math.sin(now * 0.014) * 2.5;
        const stickSwing = Math.sin(now * 0.028) * 7;
        const { isDark, skinColor } = getMusicianSkin(0);
        const isFemale = getMusicianIsFemale(0);
        const torsoW = isFemale ? 26 : 30;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.ellipse(bx + 4, by + 12, 30, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isFemale ? '#ec4899' : '#f59e0b';
        ctx.strokeStyle = isFemale ? '#fde047' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(
          bx - torsoW / 2,
          by - 14 + bounce,
          torsoW,
          16,
          isFemale ? 9 : 7
        );
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 12, by - 4 + bounce);
        ctx.lineTo(bx - 9, by + 8 + stickSwing * 0.4);
        ctx.moveTo(bx + 12, by - 4 + bounce);
        ctx.lineTo(bx + 9, by + 8 - stickSwing * 0.4);
        ctx.stroke();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx - 9, by + 8 + stickSwing * 0.4);
        ctx.lineTo(bx - 5, by + 15 + stickSwing * 0.6);
        ctx.moveTo(bx + 9, by + 8 - stickSwing * 0.4);
        ctx.lineTo(bx + 5, by + 15 - stickSwing * 0.6);
        ctx.stroke();

        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx - 14, by + 8, 28, 12, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(bx - 13, by + 10, 6.5, 0, Math.PI * 2);
        ctx.arc(bx + 13, by + 10, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(bx - 24, by + 6, 8, 4.5, -0.2, 0, Math.PI * 2);
        ctx.ellipse(bx + 24, by + 6, 8, 4.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        drawMusicianHeadAndHair(
          bx,
          by - 7 + bounce,
          isFemale,
          isDark,
          skinColor,
          0
        );
        ctx.restore();
      }

      // 2) LEFT STANDING GUITARIST (at bx = stageCenterX - 118, by = sy + 162)
      {
        const bx = stageCenterX - 118;
        const by = sy + 162;
        const bounce = Math.sin(now * 0.011 + 1.2) * 3;
        const strum = Math.sin(now * 0.024) * 3.5;
        const { isDark, skinColor } = getMusicianSkin(1);
        const isFemale = getMusicianIsFemale(1);
        const torsoW = isFemale ? 26 : 30;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + 14, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isFemale ? '#fdf4ff' : '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx - 10, by + 5, 8, 10);
        ctx.fillRect(bx + 2, by + 5, 8, 10);
        if (isFemale) {
          ctx.fillStyle = '#ff2a85';
          ctx.fillRect(bx - 10, by + 5, 8, 5);
          ctx.fillRect(bx + 2, by + 5, 8, 5);
        }

        ctx.fillStyle = isFemale ? '#a855f7' : '#0284c7';
        ctx.strokeStyle = isFemale ? '#fde047' : '#00f0ff';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(
          bx - torsoW / 2,
          by - 11 + bounce,
          torsoW,
          18,
          isFemale ? 10 : 8
        );
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by - 10 + bounce);
        ctx.lineTo(bx + 8, by + 5 + bounce);
        ctx.stroke();

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx - 2, by + 2 + bounce);
        ctx.lineTo(bx + 24, by - 7 + bounce + strum * 0.3);
        ctx.stroke();

        ctx.fillStyle = '#ff2a85';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(bx - 4, by + 3 + bounce, 10, 6.5, -0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 12, by - 2 + bounce);
        ctx.lineTo(bx - 3, by + 3 + bounce + strum);
        ctx.moveTo(bx + 12, by - 2 + bounce);
        ctx.lineTo(bx + 16, by - 4 + bounce + strum * 0.25);
        ctx.stroke();

        drawMusicianHeadAndHair(
          bx,
          by - 6 + bounce,
          isFemale,
          isDark,
          skinColor,
          1
        );
        ctx.restore();
      }

      // 3) RIGHT STANDING GUITARIST / KEYTARIST (at bx = stageCenterX + 118, by = sy + 162)
      {
        const bx = stageCenterX + 118;
        const by = sy + 162;
        const bounce = Math.sin(now * 0.011 + 2.6) * 3;
        const strum = Math.cos(now * 0.024) * 3.5;
        const { isDark, skinColor } = getMusicianSkin(2);
        const isFemale = getMusicianIsFemale(2);
        const torsoW = isFemale ? 26 : 30;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + 14, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isFemale ? '#fdf4ff' : '#0f172a';
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx - 10, by + 5, 8, 10);
        ctx.fillRect(bx + 2, by + 5, 8, 10);
        if (isFemale) {
          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(bx - 10, by + 5, 8, 5);
          ctx.fillRect(bx + 2, by + 5, 8, 5);
        }

        ctx.fillStyle = isFemale ? '#06b6d4' : '#15803d';
        ctx.strokeStyle = isFemale ? '#fde047' : '#39ff14';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(
          bx - torsoW / 2,
          by - 11 + bounce,
          torsoW,
          18,
          isFemale ? 10 : 8
        );
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(bx + 10, by - 10 + bounce);
        ctx.lineTo(bx - 8, by + 5 + bounce);
        ctx.stroke();

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + 2, by + 2 + bounce);
        ctx.lineTo(bx - 24, by - 7 + bounce + strum * 0.3);
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(bx - 6, by - 2 + bounce, 18, 9, 3);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx + 12, by - 2 + bounce);
        ctx.lineTo(bx + 4, by + 3 + bounce + strum);
        ctx.moveTo(bx - 12, by - 2 + bounce);
        ctx.lineTo(bx - 16, by - 4 + bounce + strum * 0.25);
        ctx.stroke();

        drawMusicianHeadAndHair(
          bx,
          by - 6 + bounce,
          isFemale,
          isDark,
          skinColor,
          2
        );
        ctx.restore();
      }

      // 4) FRONTMAN / LEAD SINGER WITH MICROPHONE STAND (at bx = stageCenterX, by = sy + 242)
      {
        const bx = stageCenterX;
        const by = sy + 242;
        const bounce = Math.sin(now * 0.012 + 0.5) * 3.2;
        const armGesture = Math.sin(now * 0.016) * 5;
        const { isDark, skinColor } = getMusicianSkin(3);
        const isFemale = getMusicianIsFemale(3);
        const torsoW = isFemale ? 27 : 32;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + 14, 23, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 10, by + 5, 8, 9);
        ctx.fillRect(bx + 2, by + 5, 8, 9);
        if (isFemale) {
          ctx.fillStyle = '#fde047';
          ctx.fillRect(bx - 10, by + 5, 8, 4.5);
          ctx.fillRect(bx + 2, by + 5, 8, 4.5);
        }

        ctx.fillStyle = isFemale ? '#f43f5e' : '#db2777';
        ctx.strokeStyle = isFemale ? '#00f0ff' : '#fde047';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(
          bx - torsoW / 2,
          by - 11 + bounce,
          torsoW,
          18,
          isFemale ? 10 : 8
        );
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(bx - 6, by - 2 + bounce, 1.6, 0, Math.PI * 2);
        ctx.arc(bx + 6, by - 2 + bounce, 1.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 12, by - 1 + bounce);
        ctx.lineTo(bx - 2, by + 11 + bounce * 0.5);
        ctx.moveTo(bx + 13, by - 1 + bounce);
        ctx.lineTo(bx + 21, by + 7 + armGesture);
        ctx.stroke();

        drawMusicianHeadAndHair(
          bx,
          by - 5 + bounce,
          isFemale,
          isDark,
          skinColor,
          3
        );

        const micX = bx;
        const micY = by + 16;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(micX, micY + 3, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(micX, micY + 3);
        ctx.lineTo(micX, micY - 9 + bounce * 0.4);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(micX, micY - 10 + bounce * 0.4, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5) OPTIONAL 80s BACKGROUND DANCERS ("💃 Background-Tänzer: AN / AUS" in Regie!)
      if (backgroundDancersEnabled) {
        const bgDancers = [
          {
            dx: stageCenterX - 66,
            dy: sy + 216,
            col: '#ec4899',
            accent: '#00f0ff',
            phase: 0,
          },
          {
            dx: stageCenterX + 66,
            dy: sy + 216,
            col: '#00f0ff',
            accent: '#ff2a85',
            phase: Math.PI,
          },
        ];
        bgDancers.forEach((d, dIdx) => {
          const stepX = Math.sin(now * 0.01 + d.phase) * 9;
          const stepY = Math.abs(Math.cos(now * 0.02)) * -4.5;
          const armWave = Math.sin(now * 0.018 + d.phase) * 8;
          const bx = d.dx + stepX;
          const by = d.dy + stepY;

          ctx.save();
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.ellipse(bx + 3, d.dy + 12, 18, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          // 80s Aerobic Legwarmers & Sneakers
          ctx.fillStyle = d.accent;
          ctx.fillRect(bx - 8, by + 4, 6, 8);
          ctx.fillRect(bx + 2, by + 4, 6, 8);

          // 80s Dance Outfit
          ctx.fillStyle = d.col;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bx - 12, by - 9, 24, 15, 8);
          ctx.fill();
          ctx.stroke();

          // Synchronized Choreo Arms
          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 3.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx - 11, by - 2);
          ctx.lineTo(bx - 18, by - 10 + armWave);
          ctx.moveTo(bx + 11, by - 2);
          ctx.lineTo(bx + 18, by - 10 - armWave);
          ctx.stroke();

          drawMusicianHeadAndHair(
            bx,
            by - 4,
            true,
            dIdx % 2 === 0,
            dIdx % 2 === 0 ? '#6b3e26' : '#fde68a',
            (dIdx === 0 ? 1 : 2) as 1 | 2
          );
          ctx.restore();
        });
      }
      break;
    }

    case 'cinema': {
      // ONLY in 'cinema' mode: Hide the Live-Band-Bühne completely and draw the large Kino-Leinwand
      // mounted on the white center pillar, small spectator bench in front, 80s CRT projector & flickering light cone!
      const sx = uIslands.closedStageX;
      const sy = uIslands.closedStageY;
      const sw = uIslands.closedStageWidth;
      const sh = uIslands.closedStageHeight;
      const scr = uIslands.cinemaScreenRect;
      const projX = stageCenterX;
      const projY = scr.y - 14;

      ctx.save();
      // Rounded dark cinema center platform
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle =
        activeArenaStyle === 'palladium-1989' ? '#ffffff' : '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(sx + 12, sy + 12, sw - 24, sh - 24, 24);
      ctx.fill();
      ctx.stroke();

      // 1. White Structural Center Pillar & Ceiling Projector Mount ("weiße Mittelsäule / Deckenhalterung") above top center of screen
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(stageCenterX - 28, scr.y - 32, 56, 36, 6);
      ctx.fill();
      ctx.stroke();

      // 2. Large Cinema Projection Screen Frame on the Center Pillar
      ctx.fillStyle = '#050814';
      ctx.strokeStyle =
        activeArenaStyle === 'palladium-1989' ? '#ffffff' : '#38bdf8';
      ctx.lineWidth = 5;
      ctx.fillRect(scr.x, scr.y, scr.width, scr.height);
      ctx.strokeRect(scr.x, scr.y, scr.width, scr.height);

      // 2B. Animated 80s Neon Equalizer / "PALLADIUM LIVE" Screen & Optional 7-Segment Countdown Clock directly on Canvas!
      // (Visible in the Admin Rearview Monitor AND whenever a Twitch/YouTube iframe is offline/blocked or in Countdown mode!)
      ctx.save();
      ctx.beginPath();
      ctx.rect(scr.x + 4, scr.y + 4, scr.width - 8, scr.height - 8);
      ctx.clip();

      const screenGlow = ctx.createLinearGradient(
        scr.x,
        scr.y,
        scr.x,
        scr.y + scr.height
      );
      screenGlow.addColorStop(0, '#0f0728');
      screenGlow.addColorStop(0.55, '#070b19');
      screenGlow.addColorStop(1, '#1e0b36');
      ctx.fillStyle = screenGlow;
      ctx.fillRect(scr.x + 4, scr.y + 4, scr.width - 8, scr.height - 8);

      // Retro 80s perspective synthwave grid on the lower half of the screen
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)';
      ctx.lineWidth = 1;
      for (let gy = scr.y + scr.height * 0.56; gy < scr.y + scr.height; gy += 16) {
        ctx.beginPath();
        ctx.moveTo(scr.x + 6, gy);
        ctx.lineTo(scr.x + scr.width - 6, gy);
        ctx.stroke();
      }

      const audioBands = soundFX.getSmoothedAudioBands(now);
      const numBars = 22;
      const barAreaW = scr.width - 48;
      const barW = Math.floor(barAreaW / numBars) - 3;
      const baseBarY = scr.y + scr.height - 16;

      for (let b = 0; b < numBars; b++) {
        const wave =
          Math.abs(Math.sin(now * 0.006 + b * 0.45)) * 0.55 +
          (b < 7
            ? audioBands.bass
            : b < 15
            ? audioBands.mid
            : audioBands.high) *
            0.65;
        const maxH = cinemaCountdownEnabled ? 46 : 88;
        const bh = Math.max(8, Math.min(maxH, wave * maxH));
        const bx = scr.x + 24 + b * (barW + 3);
        const barCol =
          b % 3 === 0 ? '#ff2a85' : b % 3 === 1 ? '#00f0ff' : '#39ff14';
        ctx.fillStyle = barCol;
        ctx.fillRect(bx, baseBarY - bh, barW, bh);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(bx, baseBarY - bh - 4, barW, 2.5);
      }

      if (cinemaCountdownEnabled) {
        // 80s DIGITAL 7-SEGMENT COUNTDOWN CLOCK ("TAGE : STD : MIN : SEK")
        const targetMs = cinemaCountdownTargetIso
          ? new Date(cinemaCountdownTargetIso).getTime()
          : Date.now() + 3600 * 1000;
        const diffSec = Math.max(
          0,
          Math.floor((targetMs - Date.now()) / 1000)
        );
        const days = Math.floor(diffSec / 86400);
        const hours = Math.floor((diffSec % 86400) / 3600);
        const mins = Math.floor((diffSec % 3600) / 60);
        const secs = diffSec % 60;
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const clockStr = `${pad2(days)} : ${pad2(hours)} : ${pad2(mins)} : ${pad2(secs)}`;

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 12px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `⏳ ${(cinemaCountdownTitle || 'NÄCHSTER LIVE-STREAM').toUpperCase()}`,
          stageCenterX,
          scr.y + 32
        );

        // Digital 7-segment display box
        const boxW = scr.width - 56;
        const boxH = 56;
        const boxX = stageCenterX - boxW / 2;
        const boxY = scr.y + 44;
        ctx.fillStyle = 'rgba(4, 7, 17, 0.92)';
        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#39ff14';
        ctx.font = 'bold 24px "JetBrains Mono", "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(clockStr, stageCenterX, boxY + 31);
        ctx.restore();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillText(
          'TAGE       STD        MIN        SEK',
          stageCenterX,
          boxY + 48
        );

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillText(
          `AUTO-KINO: ${cinemaWeekdays.join(', ')} • AB ${cinemaStartTime} UHR`,
          stageCenterX,
          scr.y + 118
        );
      } else {
        // 80s PALLADIUM LIVE VISUALIZER HEADER
        ctx.save();
        ctx.shadowColor = '#ff2a85';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff2a85';
        ctx.font = 'bold 18px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ PALLADIUM LIVE ★', stageCenterX, scr.y + 42);
        ctx.restore();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          '80s ROLLER DISCO TELEVISION • STEREO VISUALIZER',
          stageCenterX,
          scr.y + 64
        );
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillText(
          `SENDETERMINE: ${cinemaWeekdays.join(', ')} AB ${cinemaStartTime} UHR`,
          stageCenterX,
          scr.y + 84
        );
      }
      ctx.restore();

      // 3. Small Wooden Spectator Bench in front of the screen ("kleine Zuschauerbank davor")
      const benchW = 148;
      const benchH = 16;
      const benchX = stageCenterX - benchW / 2;
      const benchY = scr.y + scr.height + 10;
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(benchX, benchY, benchW, benchH, 4);
      ctx.fill();
      ctx.stroke();

      // 4. Flickering Downward Projector Light Cone from Top Ceiling Projector onto the Cinema Screen (leaving skating track below 100% clear!)
      const flicker =
        0.14 + Math.sin(now * 0.03) * 0.025 + Math.cos(now * 0.07) * 0.015;
      const coneGrad = ctx.createLinearGradient(
        projX,
        projY + 8,
        stageCenterX,
        scr.y + scr.height - 6
      );
      coneGrad.addColorStop(0, `rgba(224, 242, 254, ${flicker * 1.55})`);
      coneGrad.addColorStop(0.45, `rgba(186, 230, 253, ${flicker * 0.95})`);
      coneGrad.addColorStop(1, `rgba(56, 189, 248, ${flicker * 0.25})`);
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(projX - 12, projY + 8);
      ctx.lineTo(projX + 12, projY + 8);
      ctx.lineTo(scr.x + scr.width - 8, scr.y + scr.height - 4);
      ctx.lineTo(scr.x + 8, scr.y + scr.height - 4);
      ctx.closePath();
      ctx.fill();

      // 5. Top-Mounted 80s Large-Screen RGB CRT Projector on the White Ceiling/Wall Bracket ("oben an der weißen Deckenhalterung")
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(projX - 24, projY - 12, 48, 22, 4);
      ctx.fill();
      ctx.stroke();
      ['#ef4444', '#22c55e', '#3b82f6'].forEach((lensCol, lIdx) => {
        ctx.fillStyle = lensCol;
        ctx.beginPath();
        ctx.arc(projX - 11 + lIdx * 11, projY + 3, 3.8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle =
        activeArenaStyle === 'palladium-1989' ? '#f8fafc' : '#38bdf8';
      ctx.font = 'bold 12px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        activeArenaStyle === 'palladium-1989'
          ? '📼 PALLADIUM 1989 GROSSPROJEKTOR & MITTELSÄULEN-LEINWAND'
          : '🎬 PALLADIUM KINO-LEINWAND & 80ER GROSSPROJEKTOR',
        stageCenterX,
        scr.y - 36
      );
      ctx.restore();
      break;
    }
  }
}

/**
 * Renders soft, billowy, highly semi-transparent 80s ground-fog wisps
 * across the stage and stage border without obscuring skaters or name badges.
 */
function render80sStageGroundFog(
  ctx: CanvasRenderingContext2D,
  now: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  intensity: number,
  isBlacklight: boolean
): void {
  ctx.save();
  const puffs = [
    { ox: 0.22, oy: 0.36, rx: 115, ry: 52, speed: 0.0007, phase: 0.2 },
    { ox: 0.78, oy: 0.38, rx: 115, ry: 52, speed: -0.0006, phase: 1.5 },
    { ox: 0.5, oy: 0.52, rx: 145, ry: 64, speed: 0.0005, phase: 2.8 },
    { ox: 0.3, oy: 0.76, rx: 125, ry: 55, speed: -0.0008, phase: 4.1 },
    { ox: 0.7, oy: 0.78, rx: 125, ry: 55, speed: 0.0007, phase: 5.3 },
    { ox: 0.5, oy: 0.92, rx: 155, ry: 58, speed: -0.0005, phase: 3.4 },
  ];

  for (const pf of puffs) {
    const driftX = Math.sin(now * pf.speed + pf.phase) * 34;
    const driftY = Math.cos(now * pf.speed * 1.2 + pf.phase) * 14;
    const px = sx + sw * pf.ox + driftX;
    const py = sy + sh * pf.oy + driftY;
    const rMax = pf.rx * (0.92 + Math.sin(now * 0.002 + pf.phase) * 0.12);

    const fogGrad = ctx.createRadialGradient(px, py, 8, px, py, rMax);
    const alpha = Math.min(0.22, 0.12 * intensity);
    if (isBlacklight) {
      fogGrad.addColorStop(0, `rgba(192, 132, 252, ${alpha})`);
      fogGrad.addColorStop(0.55, `rgba(56, 189, 248, ${alpha * 0.55})`);
      fogGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      fogGrad.addColorStop(0, `rgba(226, 232, 240, ${alpha})`);
      fogGrad.addColorStop(0.55, `rgba(186, 230, 253, ${alpha * 0.55})`);
      fogGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }

    ctx.fillStyle = fogGrad;
    ctx.beginPath();
    ctx.ellipse(px, py, rMax, pf.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================================
// CURVED QUARTER-CIRCLE TOP-LEFT CORNER DJ-TOWER (SYMMETRICAL AXIS & DJ SPEECH BUBBLES)
// ============================================================================

function renderCurvedDjTowerCorner(
  ctx: CanvasRenderingContext2D,
  now: number,
  djTickerText: string,
  activeDjName: string,
  showNames: boolean,
  isBlacklight: boolean,
  djSpeechBubble: string | null
): void {
  const { djTower, slopedBackWall } = ARENA_LAYOUT;

  // 1. QUARTER-CIRCLE CORNER BOOTH SHELL (Flush with top wall y = 6 and left wall x = 16, zero empty space behind!)
  ctx.save();
  const boothGrad = ctx.createRadialGradient(
    djTower.cornerX + 40,
    djTower.cornerY + 40,
    20,
    djTower.cornerX + 140,
    djTower.cornerY + 140,
    360
  );
  boothGrad.addColorStop(0, '#090514');
  boothGrad.addColorStop(0.65, '#170d2e');
  boothGrad.addColorStop(1, '#271447');

  ctx.beginPath();
  ctx.moveTo(djTower.cornerX, djTower.cornerY);
  ctx.lineTo(slopedBackWall.topLeftX, djTower.cornerY);
  ctx.lineTo(djTower.bevelTopX, djTower.bevelTopY);
  // Smoothly curved pulpit front edge connecting (442, 108) and (290, 260)
  ctx.quadraticCurveTo(
    djTower.curveCtrlX,
    djTower.curveCtrlY,
    djTower.bevelLeftX,
    djTower.bevelLeftY
  );
  ctx.lineTo(djTower.cornerX, djTower.bevelLeftY);
  ctx.closePath();
  ctx.fillStyle = boothGrad;
  ctx.fill();
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Clip interior elements strictly to the curved pink DJ-Tower shell so nothing ever protrudes outside!
  ctx.save();
  ctx.clip();

  // 2. ROTATED INTERIOR OF THE CURVED DJ-TOWER (-45° facing the rink, ALL elements strictly centered on x = 0!)
  ctx.translate(djTower.centerX, djTower.centerY);
  ctx.rotate(djTower.angleRad);

  // A. BACK-WALL VINYL RECORD CABINET / SHELF ("VINYL-ARCHIV", shortened to 156px & centered at x = 0 so it sits cleanly inside the pink frame!)
  const shelfW = 156;
  const shelfH = 18;
  const shelfX = -shelfW / 2;
  const shelfY = -74;

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VINYL-ARCHIV', 0, shelfY - 4);

  ctx.fillStyle = '#291509';
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.8;
  ctx.fillRect(shelfX, shelfY, shelfW, shelfH);
  ctx.strokeRect(shelfX, shelfY, shelfW, shelfH);

  // Tightly packed colorful 80s vinyl record sleeves inside the cabinet
  const sleevePalette = [
    '#ff2a85',
    '#00f0ff',
    '#39ff14',
    '#fde047',
    '#a855f7',
    '#f97316',
    '#38bdf8',
    '#ffffff',
  ];
  for (let vx = shelfX + 4; vx < shelfX + shelfW - 5; vx += 4.5) {
    ctx.fillStyle = sleevePalette[Math.floor(Math.abs(vx)) % sleevePalette.length];
    ctx.fillRect(vx, shelfY + 2.5, 3, shelfH - 5);
  }

  // B. NEON SIGN: ">> DANGER RYTM CREW <<" (Centered at x = 0!)
  ctx.save();
  ctx.shadowColor = '#ff2a85';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ff2a85';
  ctx.font = 'bold 11.5px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('>> DANGER RYTM CREW <<', 0, -43);
  ctx.restore();

  // C. 80s LED-MATRIX SCROLLING TICKER (Shortened to 176px & centered at x = 0 inside the pink frame!)
  const tickerW = 176;
  const tickerH = 18;
  const tickerX = -tickerW / 2;
  const tickerY = -36;

  ctx.fillStyle = '#050811';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.8;
  ctx.fillRect(tickerX, tickerY, tickerW, tickerH);
  ctx.strokeRect(tickerX, tickerY, tickerW, tickerH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(tickerX + 3, tickerY, tickerW - 6, tickerH);
  ctx.clip();
  const scrollOffset = (now * 0.085) % 1100;
  ctx.fillStyle = '#39ff14';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${djTickerText}   ${djTickerText}`,
    tickerX + tickerW - scrollOffset,
    tickerY + 13
  );
  ctx.restore();

  // D. DJ MAGIC FORCE AT THE MIXER & BACKSTAGE LIGHTING DESK FOR "LJ LASER-LUTZ" IN THE REAR CORNER!
  const djBob = Math.sin(now * 0.006) * 4;
  ctx.fillStyle = '#3b0764';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-22 + djBob, -17, 34, 18, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(-5 + djBob, -8, 8, 0, Math.PI * 2);
  ctx.fill();

  // Rear Disco-Tower Backstage Desk ("LICHT-REGIE") for LJ Laser-Lutz in the backstage corner!
  const ljDeskX = 32;
  const ljDeskY = -20;
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(ljDeskX, ljDeskY, 54, 16, 4);
  ctx.fill();
  ctx.stroke();

  // Glowing DMX Light Organ Sliders & Laser Buttons on LJ Laser-Lutz's Backstage Desk
  const dmxCols = ['#39ff14', '#00f0ff', '#ff2a85', '#fde047'];
  for (let d = 0; d < 4; d++) {
    ctx.fillStyle = dmxCols[(d + Math.floor(now * 0.006)) % 4];
    ctx.fillRect(ljDeskX + 6 + d * 11, ljDeskY + 4, 7, 4);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(ljDeskX + 8 + d * 11, ljDeskY + 10, 3, 4);
  }

  const ljBob = Math.cos(now * 0.0065) * 3;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(ljDeskX + 13 - ljBob, ljDeskY - 13, 28, 13, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(ljDeskX + 27 - ljBob, ljDeskY - 6.5, 6.8, 0, Math.PI * 2);
  ctx.fill();

  if (showNames) {
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 6.8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      activeCrewNames.lightJockey || 'LJ Laser-Lutz',
      ljDeskX + 27,
      ljDeskY - 15
    );
  }

  // E. CURVED DJ DESK WITH COMPACT MIXER + TWO "KLECKNIX" TURNTABLES FLUSH LEFT & RIGHT OF MIXER (Centered at x = 0!)
  const deskW = 192;
  const deskH = 42;
  const deskX = -deskW / 2;
  const deskY = 0;

  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(deskX, deskY, deskW, deskH, [6, 6, 16, 16]);
  ctx.fill();
  ctx.stroke();

  // Center 80s DJ Mixer (`-22 .. +22`) with Blinking VU-Meters
  const mixerW = 44;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-mixerW / 2, deskY + 4, mixerW, 34);
  ctx.strokeRect(-mixerW / 2, deskY + 4, mixerW, 34);

  const vuColors = ['#39ff14', '#39ff14', '#fde047', '#ef4444'];
  for (let col = 0; col < 4; col++) {
    const activeRows =
      1 + Math.floor(Math.abs(Math.sin(now * 0.012 + col)) * 4);
    for (let r = 0; r < activeRows; r++) {
      ctx.fillStyle = vuColors[r];
      ctx.fillRect(-16 + col * 8.5, deskY + 28 - r * 5.2, 6, 3.2);
    }
  }

  // Two "KLECKNIX" Turntables positioned DIRECTLY FLUSH LEFT (-50) & RIGHT (+50) next to the Mixer!
  const vinylAngle = now * 0.0045;
  [-50, 50].forEach((tx) => {
    const ty = deskY + 21;

    // Silver/Anthracite 80s "KLECKNIX" Turntable Deck Housing flush beside mixer
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(tx - 26, deskY + 4, 52, 34);
    ctx.strokeRect(tx - 26, deskY + 4, 52, 34);

    // "KLECKNIX" Label on the Turntable Housing
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 6px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KLECKNIX', tx, deskY + 10);

    // Rotating Vinyl Platter with LIVE-ROTATING "KLECKNIX" Text on the Platter!
    ctx.save();
    ctx.translate(tx, ty + 2.5);
    ctx.rotate(vinylAngle);

    ctx.fillStyle = '#050811';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center record label
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Rotating "KLECKNIX" inscription directly on the spinning platter!
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 4.8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KLECKNIX', 0, -7);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('1210-MK', 0, 7);
    ctx.restore();
  });

  // F. SYMMETRICALLY CENTERED "DJ & LIGHT JOCKEY • ► PULT [KLICK]" FRONT PULPIT BADGE (x = 0!)
  const badgeW = 204;
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-badgeW / 2, deskY + deskH + 3, badgeW, 20, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const cleanDjLabel = (activeCrewNames.dj || activeDjName || 'DJ MAGIC FORCE').toUpperCase();
  const cleanLjLabel = (activeCrewNames.lightJockey || 'LJ LASER-LARS').toUpperCase();
  ctx.fillText(
    showNames
      ? `🎧 ${cleanDjLabel} & 💡 ${cleanLjLabel}`
      : '► DJ- & LICHT-PULT [KLICK] ◄',
    0,
    deskY + deskH + 16
  );

  ctx.restore(); // end clip & rotation
  ctx.restore(); // end outer booth save

  // Architectural Corner Posts at (290, 260) and (442, 108) where the curved DJ-Tower meets the barrier
  [
    { x: djTower.bevelLeftX, y: djTower.bevelLeftY },
    { x: djTower.bevelTopX, y: djTower.bevelTopY },
  ].forEach((pt) => {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // 3. PROMINENT 80s NEON DJ SPEECH BUBBLE POPPING UP ABOVE THE DJ-TOWER!
  if (djSpeechBubble) {
    ctx.save();
    const bx = 258;
    const by = 84 + Math.sin(now * 0.008) * 3;
    ctx.font = 'bold 12px "Outfit", sans-serif';
    const textW = ctx.measureText(djSpeechBubble).width;
    const padX = 16;
    const bw = Math.max(210, textW + padX * 2);
    const bh = 32;

    ctx.shadowColor = '#ff2a85';
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(15, 7, 30, 0.96)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    // Pointer triangle pointing down-left toward DJ Magic Force
    ctx.beginPath();
    ctx.moveTo(bx - 35, by + bh / 2);
    ctx.lineTo(bx - 52, by + bh / 2 + 12);
    ctx.lineTo(bx - 18, by + bh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#39ff14';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(djSpeechBubble, bx, by + 1);
    ctx.restore();
  }
}

// ============================================================================
// HALL TOUR: RIGHT BENCHES, TECH DOUBLE DOOR + NOTAUSGANG, MIRRORED CASHIER, SHOPS & BISTRO WITH MARBLE TABLES
// ============================================================================

function renderHallTourZonesAndStaff(
  ctx: CanvasRenderingContext2D,
  now: number,
  showNames: boolean,
  isBlacklight: boolean,
  hasSkatesEquipped = true,
  drinkChipAvailable = true,
  isMultiplayerActive = false
): void {
  const {
    rightWallBenches,
    rightWallTechDoor,
    bottomEntrance,
    proShopAndRental,
    bistro,
  } = ARENA_LAYOUT;

  // ==========================================================================
  // A. RIGHT WALL: 4 BROWN WOODEN SLAT BENCHES (Pushed flush to the right outer wall x = 1848!)
  // ==========================================================================
  for (const rb of rightWallBenches) {
    ctx.fillStyle = '#451a03';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(rb.x, rb.y, rb.width, rb.height, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    for (let s = 0; s < 3; s++) {
      ctx.fillRect(rb.x + 6 + s * 13, rb.y + 8, 7, rb.height - 16);
    }
  }

  // ==========================================================================
  // A2. WIDE METAL DOUBLE DOOR ("TECHNIK & EQUIPMENT" + DIAMOND-PLATE THRESHOLD)
  //     & GLOWING GREEN "NOTAUSGANG" SIGN IN THE MIDDLE OF THE RIGHT OUTER WALL!
  // ==========================================================================
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.fillRect(
    rightWallTechDoor.x - 14,
    rightWallTechDoor.y + 4,
    14,
    rightWallTechDoor.height - 8
  );
  ctx.strokeRect(
    rightWallTechDoor.x - 14,
    rightWallTechDoor.y + 4,
    14,
    rightWallTechDoor.height - 8
  );
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  for (
    let ry = rightWallTechDoor.y + 10;
    ry < rightWallTechDoor.y + rightWallTechDoor.height - 10;
    ry += 10
  ) {
    ctx.beginPath();
    ctx.moveTo(rightWallTechDoor.x - 11, ry);
    ctx.lineTo(rightWallTechDoor.x - 5, ry + 4);
    ctx.stroke();
  }

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(
    rightWallTechDoor.x,
    rightWallTechDoor.y,
    rightWallTechDoor.width,
    rightWallTechDoor.height,
    4
  );
  ctx.fill();
  ctx.stroke();

  const doorMidY = rightWallTechDoor.y + rightWallTechDoor.height / 2;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(rightWallTechDoor.x, doorMidY);
  ctx.lineTo(rightWallTechDoor.x + rightWallTechDoor.width, doorMidY);
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(rightWallTechDoor.x + 5, doorMidY - 18, 5, 14);
  ctx.fillRect(rightWallTechDoor.x + 5, doorMidY + 4, 5, 14);

  ctx.save();
  ctx.translate(rightWallTechDoor.x + 26, doorMidY);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TECHNIK & EQUIPMENT', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(rightWallTechDoor.x - 28, doorMidY);
  ctx.rotate(-Math.PI / 2);
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = isBlacklight ? 18 : 12;
  ctx.fillStyle = '#052e16';
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-56, -11, 112, 22, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(-53, -8, 106, 16);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏃➔ NOTAUSGANG', 0, 0.5);
  ctx.restore();
  ctx.restore();

  // ==========================================================================
  // B. 1) KASSE & EINGANG PALLADIUM (FLUSH AT RIGHT OUTER WALL, LEFT WINDOW + KATJA & SECURITY-SAMMY)
  // ==========================================================================
  const { cashierBooth, entranceSpawn } = bottomEntrance;

  ctx.save();
  ctx.translate(cashierBooth.centerX, cashierBooth.centerY);
  ctx.rotate(cashierBooth.angleRad);

  const cw = cashierBooth.width;
  const ch = cashierBooth.height;

  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 8);
  ctx.fill();
  ctx.stroke();

  // Left/Inner Gang-Side Cashier Window facing the wide entrance walkway
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.2;
  ctx.fillRect(-cw / 2 - 2, -28, 16, 56);
  ctx.strokeRect(-cw / 2 - 2, -28, 16, 56);

  ctx.fillStyle = '#39ff14';
  ctx.font = 'bold 9.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1) KASSE', 4, -ch / 2 + 16);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
  ctx.fillText('EINGANG', 4, ch / 2 - 10);
  ctx.restore();

  // Kassiererin Katja inside the booth behind the left-side cashier window
  renderCharacterSprite(ctx, now, {
    x: cashierBooth.x + 34,
    y: cashierBooth.centerY,
    headingRad: Math.PI,
    jumpZ: 0,
    gender: 'female',
    isWheelchair: false,
    isSkateGuard: false,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#fde047',
    wheelColor: '#ffffff',
    isStreetShoes: true,
    name: 'Kassiererin Katja (KASSE)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // Security-Sammy opposite the left cashier window guarding the wide entrance walkway
  renderCharacterSprite(ctx, now, {
    x: entranceSpawn.securityX,
    y: entranceSpawn.securityY,
    headingRad: 0,
    jumpZ: 0,
    gender: 'male',
    isWheelchair: false,
    isSkateGuard: true,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#39ff14',
    wheelColor: '#ffffff',
    isStreetShoes: true,
    name: activeCrewNames.security || 'Security-Sammy (EINLASS)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // ==========================================================================
  // C. 2) COMPACT PRO-SHOP MINI-STAND [E] (~48% WIDTH, NO OVAL EMBLEM)
  // ==========================================================================
  const {
    proShopBounds,
    proShopCounter,
    proShopInteractX,
    proShopInteractY,
    dividerWall,
    rentalBounds,
    rentalCounter,
    rentalShelves,
  } = proShopAndRental;

  ctx.fillStyle = '#0f241d';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(
    proShopBounds.x,
    proShopBounds.y,
    proShopBounds.width,
    proShopBounds.height,
    8
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#064e3b';
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2.5;
  ctx.fillRect(
    proShopCounter.x,
    proShopCounter.y,
    proShopCounter.width,
    proShopCounter.height
  );
  ctx.strokeRect(
    proShopCounter.x,
    proShopCounter.y,
    proShopCounter.width,
    proShopCounter.height
  );

  const itemColors = ['#ff2a85', '#00f0ff', '#39ff14', '#fde047'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = itemColors[i];
    ctx.beginPath();
    ctx.arc(
      proShopCounter.x + 22 + i * 34,
      proShopCounter.y + 15,
      6.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(proShopInteractX, proShopInteractY, 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 11.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'PRO-SHOP [E]',
    proShopBounds.x + proShopBounds.width / 2,
    proShopBounds.y + proShopBounds.height - 10
  );

  renderCharacterSprite(ctx, now, {
    x: proShopBounds.x + proShopBounds.width / 2 + Math.sin(now * 0.0018) * 10,
    y: proShopBounds.y + 52,
    headingRad: -Math.PI / 2,
    jumpZ: 0,
    gender: 'male',
    isWheelchair: false,
    isSkateGuard: false,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#39ff14',
    wheelColor: '#ffffff',
    name: 'Pro-Shop (PALLADIUMANER)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(
    dividerWall.x,
    dividerWall.y,
    dividerWall.width,
    dividerWall.height
  );

  // ==========================================================================
  // D. 3) COMPACT ROLLSCHUHVERLEIH (~32% SMALLER, BACK-WALL SHOE SHELVES & AISLE STAFF)
  // ==========================================================================
  ctx.fillStyle = '#131c2e';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(
    rentalBounds.x,
    rentalBounds.y,
    rentalBounds.width,
    rentalBounds.height,
    8
  );
  ctx.fill();
  ctx.stroke();

  // Front rental counter
  ctx.fillStyle = '#1e3a8a';
  ctx.strokeStyle = '#38bdf8';
  ctx.fillRect(
    rentalCounter.x,
    rentalCounter.y,
    rentalCounter.width,
    rentalCounter.height
  );
  ctx.strokeRect(
    rentalCounter.x,
    rentalCounter.y,
    rentalCounter.width,
    rentalCounter.height
  );

  // Shoe shelves flush against the back wall (y = 1038)
  for (const shelf of rentalShelves) {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);
    ctx.strokeRect(shelf.x, shelf.y, shelf.width, shelf.height);
    for (let sx = shelf.x + 10; sx < shelf.x + shelf.width - 16; sx += 24) {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(sx, shelf.y + 4, 8, 7);
      ctx.fillRect(sx + 10, shelf.y + 4, 8, 7);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx, shelf.y + 13, 8, 7);
      ctx.fillRect(sx + 10, shelf.y + 13, 8, 7);
    }
  }

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 11.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'ROLLSCHUHVERLEIH',
    rentalBounds.x + rentalBounds.width / 2,
    rentalCounter.y + 18
  );

  const rentalInteractX =
    proShopAndRental.rentalInteractX ??
    rentalBounds.x + rentalBounds.width / 2;
  const rentalInteractY =
    proShopAndRental.rentalInteractY ?? rentalBounds.y + 40;
  ctx.save();
  ctx.strokeStyle = !hasSkatesEquipped
    ? `rgba(250, 204, 21, ${0.65 + Math.sin(now * 0.008) * 0.3})`
    : 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = !hasSkatesEquipped ? 3 : 2;
  ctx.beginPath();
  ctx.arc(rentalInteractX, rentalInteractY, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = !hasSkatesEquipped ? '#fde047' : '#7dd3fc';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    !hasSkatesEquipped && drinkChipAvailable
      ? '🛼 LEIH-SKATES HOLEN [E]'
      : '🛼 LEIH-SKATES HOLEN [E]',
    rentalInteractX,
    rentalCounter.y - 7
  );
  ctx.restore();

  // 2 ANIMATED STAFF MEMBERS IN THE CLEAR AISLE IN FRONT OF THE BACK-WALL SHOE SHELVES:
  // 1) Verleih-Biggi in the left aisle between counter and shelves
  const verleihBiggiX =
    rentalBounds.x + rentalBounds.width * 0.32 + Math.sin(now * 0.0022) * 16;
  renderCharacterSprite(ctx, now, {
    x: verleihBiggiX,
    y: rentalBounds.y + 44,
    headingRad: -Math.PI / 2 + Math.cos(now * 0.0022) * 0.15,
    jumpZ: 0,
    gender: 'female',
    isWheelchair: false,
    isSkateGuard: false,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#39ff14',
    wheelColor: '#ffffff',
    legwarmerColor: '#38bdf8',
    name: 'Verleih-Biggi (CREW)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // 2) Verleih-Tommy in the right aisle in front of the shoe shelves
  const verleihTommyX =
    rentalBounds.x + rentalBounds.width * 0.72 + Math.cos(now * 0.0019) * 18;
  renderCharacterSprite(ctx, now, {
    x: verleihTommyX,
    y: rentalBounds.y + 44,
    headingRad: -Math.PI / 2 - Math.sin(now * 0.0019) * 0.15,
    jumpZ: 0,
    gender: 'male',
    isWheelchair: false,
    isSkateGuard: false,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#38bdf8',
    wheelColor: '#ffffff',
    name: 'Verleih-Tommy (CREW)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // ==========================================================================
  // D2. 80ER-SPINDREIHE („SPINDE“ — 16-Bit grey-blue metal lockers with vents & numbers)
  // ==========================================================================
  const lk = ARENA_LAYOUT.lockers;
  if (lk) {
    ctx.save();
    const lkCx = lk.x + lk.width / 2;
    const lkCy = lk.y + lk.height / 2;
    ctx.translate(lkCx, lkCy);
    const lkRot = ((lk.rot || 0) % 360 + 360) % 360;
    const isRotated90 = lkRot === 90 || lkRot === 270;
    const drawW = isRotated90 ? lk.height : lk.width;
    const drawH = isRotated90 ? lk.width : lk.height;
    ctx.rotate((lkRot * Math.PI) / 180);

    // Outer 16-bit steel cabinet frame
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = isBlacklight ? '#38bdf8' : '#94a3b8';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-drawW / 2, -drawH / 2, drawW, drawH, 4);
    ctx.fill();
    ctx.stroke();

    // Top 80s neon trim strip
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(-drawW / 2 + 2, -drawH / 2 + 2, drawW - 4, 4);

    // Individual grey-blue metal locker doors with 3 ventilation slits, number plate & chrome handle
    const compartmentCount = Math.max(3, Math.min(12, Math.round(drawW / 28)));
    const compW = (drawW - 8) / compartmentCount;
    for (let i = 0; i < compartmentCount; i++) {
      const cx = -drawW / 2 + 4 + i * compW;
      const cy = -drawH / 2 + 8;
      const cw = compW - 3;
      const ch = Math.max(14, drawH - 12);

      // Door panel
      ctx.fillStyle = i % 2 === 0 ? '#334155' : '#293548';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeRect(cx, cy, cw, ch);

      // Number badge (01..12)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx + 3, cy + 2, Math.min(16, cw - 6), 8);
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 6.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        String(i + 1).padStart(2, '0'),
        cx + 3 + Math.min(16, cw - 6) / 2,
        cy + 8
      );

      // 16-Bit ventilation slits
      ctx.fillStyle = '#090d16';
      const slitYStart = cy + Math.min(13, ch * 0.42);
      for (let s = 0; s < 3; s++) {
        if (slitYStart + s * 3.2 < cy + ch - 4) {
          ctx.fillRect(cx + 4, slitYStart + s * 3.2, Math.max(4, cw - 8), 1.6);
        }
      }

      // Chrome keyhole / latch
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cx + cw - 5, cy + ch * 0.55, 2.5, 4.5);
    }

    // "SPINDE [E]" interactive label on front base
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8.5px "Silkscreen", "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🗄️ SPINDE [E / KLICK]', 0, -drawH / 2 - 4);
    ctx.restore();
  }

  // ==========================================================================
  // E. 4) BISTRO & GARNET-LOUNGE WITH 80s SEATING GROUP (BENCHES + BISTRO TABLES & SLUSH CUPS)
  // ==========================================================================
  const bDx = bistro.bounds.x - 24;
  const bDy = bistro.bounds.y - 795;
  ctx.save();
  ctx.fillStyle = '#181326';
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(24 + bDx, 795 + bDy);
  ctx.lineTo(270 + bDx, 795 + bDy);
  ctx.lineTo(415 + bDx, 922 + bDy);
  ctx.lineTo(745 + bDx, 922 + bDy);
  ctx.lineTo(745 + bDx, 1064 + bDy);
  ctx.lineTo(24 + bDx, 1064 + bDy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const wc = bistro.wcSign;
  ctx.save();
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = isBlacklight ? 18 : 12;
  ctx.fillStyle = '#090d1e';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(wc.x, wc.y, wc.width, wc.height, 6);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff2a85';
  ctx.font = 'bold 12px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🚺🚹', wc.x + 8, wc.y + 19);
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 12px "Silkscreen", monospace';
  ctx.fillText('WC', wc.x + 42, wc.y + 19);
  ctx.restore();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('↑ WC / LOUNGE', wc.x + wc.width + 10, wc.y + 18);

  ctx.fillStyle = '#f472b6';
  ctx.font = 'bold 12px "Outfit", sans-serif';
  ctx.fillText('80er BISTRO & SLUSH-LOUNGE', 38 + bDx, 868 + bDy);

  // 1. 80s Garnet-Lounge Upholstered Benches along the bottom wall (y = 1024)
  for (const wb of bistro.wallBenches) {
    ctx.fillStyle = '#500724';
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(wb.x, wb.y, wb.width, wb.height, 6);
    ctx.fill();
    ctx.stroke();

    // Retro stitched cushion ribs
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.38)';
    ctx.lineWidth = 1.2;
    for (let sx = wb.x + 18; sx < wb.x + wb.width - 10; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(sx, wb.y + 4);
      ctx.lineTo(sx, wb.y + wb.height - 4);
      ctx.stroke();
    }
  }

  // 2. Small 80s Bistro Tables with Slush-Becher Decor (leaving >= 82px clear walkway to barriers!)
  for (const mt of bistro.marbleTables) {
    const chairAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.5];
    for (const ang of chairAngles) {
      const chX = mt.x + Math.cos(ang) * (mt.radius + 7);
      const chY = mt.y + Math.sin(ang) * (mt.radius + 7);
      ctx.save();
      ctx.translate(chX, chY);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-7, -6, 14, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#cbd5e1';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(mt.x, mt.y, mt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Slush-Puppie Cups with Neon Straws on each Bistro Table
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(mt.x - 6, mt.y - 2, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(mt.x - 6, mt.y - 2);
    ctx.lineTo(mt.x - 10, mt.y - 7);
    ctx.stroke();

    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.arc(mt.x + 6, mt.y + 3, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mt.x + 6, mt.y + 3);
    ctx.lineTo(mt.x + 10, mt.y - 2);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Pushed-Back Beverage Counter (y = 984 -> 124px wide lower corridor!) with Slush-Puppie Machine & "BLOBA COLA" Dispenser
  ctx.fillStyle = '#2e1065';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(
    bistro.counter.x,
    bistro.counter.y,
    bistro.counter.width,
    bistro.counter.height,
    8
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(bistro.slushMachine.x, bistro.slushMachine.y, 24, 26);
  ctx.fillStyle = '#ff2a85';
  ctx.fillRect(bistro.slushMachine.x + 28, bistro.slushMachine.y, 24, 26);

  ctx.fillStyle = '#7c2d12';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.fillRect(bistro.blobaColaTap.x, bistro.blobaColaTap.y, 58, 26);
  ctx.strokeRect(bistro.blobaColaTap.x, bistro.blobaColaTap.y, 58, 26);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 8px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'BLOBA COLA',
    bistro.blobaColaTap.x + 29,
    bistro.blobaColaTap.y + 16
  );

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bistro.interactX, bistro.interactY, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'SLUSH & BLOBA [E]',
    bistro.counter.x + bistro.counter.width / 2,
    bistro.counter.y - 7
  );
  ctx.restore();

  // 2 ANIMATED STAFF MEMBERS IN THE BISTRO:
  // 1) Bistro-Marco serving at the Bloba-Cola tap
  renderCharacterSprite(ctx, now, {
    x: bistro.counter.x + bistro.counter.width * 0.68 + Math.sin(now * 0.0021) * 14,
    y: bistro.counter.y + 54,
    headingRad: -Math.PI / 2 + Math.sin(now * 0.003) * 0.15,
    jumpZ: 0,
    gender: 'male',
    isWheelchair: false,
    isSkateGuard: false,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#39ff14',
    wheelColor: '#ffffff',
    name: 'Bistro-Marco (CREW)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // 2) Slush-Steffi mixing blue & pink Slush-Puppies at the left side of the counter
  renderCharacterSprite(ctx, now, {
    x: bistro.counter.x + bistro.counter.width * 0.28 + Math.cos(now * 0.0024) * 12,
    y: bistro.counter.y + 54,
    headingRad: -Math.PI / 2 - Math.cos(now * 0.0028) * 0.15,
    jumpZ: 0,
    gender: 'female',
    isWheelchair: false,
    isSkateGuard: false,
    isSpeedSkater: false,
    isGhost: false,
    isPalladiumanerStaff: true,
    shirtColor: '#070a10',
    accentColor: '#ff2a85',
    wheelColor: '#ffffff',
    legwarmerColor: '#00f0ff',
    name: 'Slush-Steffi (CREW)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // ANIMATED AI VISITORS AT THE BISTRO TABLES IN SINGLEPLAYER MODE (benches removed):
  if (!isMultiplayerActive) {
    const cornerTableVisitors = [
      {
        x: (bistro.marbleTables[0]?.x ?? 92) + Math.cos(-Math.PI * 0.75) * 28,
        y: (bistro.marbleTables[0]?.y ?? 942) + Math.sin(-Math.PI * 0.75) * 28,
        headingRad: Math.PI * 0.25,
        gender: 'female' as const,
        shirtColor: '#ec4899',
        accentColor: '#00f0ff',
        hairColor: '#f59e0b',
        drinkColor: '#00f0ff',
        phase: 0.4,
      },
      {
        x: 1852,
        y: 222,
        headingRad: Math.PI,
        gender: 'female' as const,
        shirtColor: '#f97316',
        accentColor: '#fde047',
        hairColor: '#b45309',
        drinkColor: '#ff2a85',
        phase: 5.3,
      },
    ];

    for (const v of cornerTableVisitors) {
      drawAnimatedTableVisitor(ctx, now, v, isBlacklight);
    }
  }
}

function drawAnimatedTableVisitor(
  ctx: CanvasRenderingContext2D,
  now: number,
  v: {
    x: number;
    y: number;
    headingRad: number;
    gender: 'female' | 'male';
    shirtColor: string;
    accentColor: string;
    hairColor: string;
    drinkColor: string;
    phase: number;
  },
  isBlacklight: boolean
): void {
  const sway = Math.sin(now * 0.0045 + v.phase) * 0.14;
  const armGesture = Math.sin(now * 0.007 + v.phase * 1.5) * 3.5;

  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.headingRad + sway);

  // Subtle seated shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.arc(0, 2, 13, 0, Math.PI * 2);
  ctx.fill();

  // Animated arms in jacket color reaching toward the table / drink cup
  const shSpan = v.gender === 'female' ? 22 : 25;
  ctx.strokeStyle = v.shirtColor;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, -shSpan / 2 + 2);
  ctx.lineTo(11 + armGesture * 0.5, -6);
  ctx.moveTo(2, shSpan / 2 - 2);
  ctx.lineTo(11 - armGesture * 0.4, 6);
  ctx.stroke();

  // Hands
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(12 + armGesture * 0.5, -6, 2.8, 0, Math.PI * 2);
  ctx.arc(12 - armGesture * 0.4, 6, 2.8, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders / 80s Jacket
  ctx.fillStyle = v.shirtColor;
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : v.accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-8, -shSpan / 2, 16, shSpan, 7);
  ctx.fill();
  ctx.stroke();

  // Head & 80s Hair
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(1, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = v.hairColor;
  ctx.beginPath();
  ctx.arc(-1, 0, 7.2, 0.75, -0.75);
  ctx.fill();
  if (v.gender === 'female') {
    ctx.beginPath();
    ctx.ellipse(-8, 0, 4.8, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// RADAR-MINIMAP FOR FULLSCREEN CHASE-CAM & EGO-PERSPECTIVE
// ============================================================================

function renderRadarMinimap(
  ctx: CanvasRenderingContext2D,
  player: { x: number; y: number; headingRad: number },
  trackNpcs: TrackNpc[],
  remotePlayers: InterpolatedRemotePlayer[],
  cameraMode: CameraViewMode
): void {
  const mapW = 230;
  const mapH = 130;
  const mapX = WORLD_WIDTH - mapW - 18;
  const mapY = 54;
  const scaleX = mapW / WORLD_WIDTH;
  const scaleY = mapH / WORLD_HEIGHT;

  ctx.save();
  ctx.fillStyle = 'rgba(7, 10, 18, 0.88)';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(mapX, mapY, mapW, mapH, 8);
  ctx.fill();
  ctx.stroke();

  const { rink, uIslands, djTower } = ARENA_LAYOUT;
  ctx.fillStyle = 'rgba(63, 34, 19, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapX + djTower.bevelTopX * scaleX, mapY + rink.y * scaleY);
  ctx.lineTo(mapX + (rink.x + rink.width) * scaleX, mapY + rink.y * scaleY);
  ctx.lineTo(
    mapX + (rink.x + rink.width) * scaleX,
    mapY + (rink.y + rink.height) * scaleY
  );
  ctx.lineTo(mapX + rink.x * scaleX, mapY + (rink.y + rink.height) * scaleY);
  ctx.lineTo(
    mapX + djTower.bevelLeftX * scaleX,
    mapY + djTower.bevelLeftY * scaleY
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    mapX + uIslands.leftDefaultX * scaleX,
    mapY + uIslands.topY * scaleY,
    uIslands.width * scaleX,
    uIslands.height * scaleY
  );
  ctx.strokeRect(
    mapX + uIslands.rightDefaultX * scaleX,
    mapY + uIslands.topY * scaleY,
    uIslands.width * scaleX,
    uIslands.height * scaleY
  );

  for (const npc of trackNpcs) {
    ctx.fillStyle =
      npc.role === 'speed'
        ? '#ef4444'
        : npc.role === 'guard'
        ? '#39ff14'
        : '#38bdf8';
    ctx.beginPath();
    ctx.arc(mapX + npc.x * scaleX, mapY + npc.y * scaleY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const rp of remotePlayers) {
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
      mapX + rp.renderX * scaleX,
      mapY + rp.renderY * scaleY,
      3.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }

  const px = mapX + player.x * scaleX;
  const py = mapY + player.y * scaleY;
  ctx.fillStyle = '#39ff14';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(
    px + Math.cos(player.headingRad) * 11,
    py + Math.sin(player.headingRad) * 11
  );
  ctx.stroke();

  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `RADAR • ${cameraMode === 'ego' ? 'EGO-PERSPEKTIVE' : '2.5D CHASE-CAM'}`,
    mapX + 8,
    mapY + mapH - 6
  );
  ctx.restore();
}

// ============================================================================
// SCALED 2.5D CHARACTER SPRITE RENDERER (ANIMATED ARMS, HANDS, NEON WRISTBANDS & TRICK POSES)
// ============================================================================

const WRISTBAND_HEX_MAP: Record<NeonWristbandColor, string> = {
  pink: '#ff2a85',
  cyan: '#00f0ff',
  green: '#39ff14',
  gold: '#fde047',
};

function renderCharacterSprite(
  ctx: CanvasRenderingContext2D,
  now: number,
  opts: {
    x: number;
    y: number;
    headingRad: number;
    jumpZ: number;
    gender?: 'female' | 'male';
    isWheelchair: boolean;
    isSkateGuard: boolean;
    isSpeedSkater: boolean;
    isGhost: boolean;
    isPalladiumanerStaff: boolean;
    shirtColor: string;
    accentColor: string;
    wheelColor: string;
    skateBootColor?: 'white' | 'black';
    legwarmerColor?: string;
    kengolHat?: boolean;
    kengoShoesWhitePink?: boolean;
    isStreetShoes?: boolean;
    isRentalSkates?: boolean;
    isCustomOwnSkates?: boolean;
    name: string;
    showName: boolean;
    isBlacklight: boolean;
    crashTimer: number;
    speechBubble: string | null;
    underglowColor?: string;
    hasMultiplayerStar?: boolean;
    activeTrickMove?: TrickMoveId | null;
    isBackwardGliding?: boolean;
    wristbandColor?: NeonWristbandColor;
    activeCharm?: SkateCharmId | null;
    avatarRole?: 'standard' | 'kid' | 'stammgast';
  }
): void {
  if (activePixel16BitFigures) {
    render16BitPixelCharacterSprite(ctx, now, opts);
    return;
  }

  const isFemale = opts.gender === 'female';
  const isCrewOrGuard = opts.isSkateGuard || opts.isPalladiumanerStaff;
  const jacketColor = isCrewOrGuard ? '#070a10' : opts.shirtColor;
  const isFlamingo = opts.activeTrickMove === 'flamingo';
  const isStarJump = opts.activeTrickMove === 'starjump';
  const isSpin360 = opts.activeTrickMove === 'spin360';
  const isBackward = Boolean(
    opts.isBackwardGliding || opts.activeTrickMove === 'backward'
  );

  ctx.save();
  ctx.translate(opts.x, opts.y);

  if (opts.isGhost) {
    ctx.globalAlpha = 0.65;
  }

  const shadowScale = Math.max(0.45, 1 - opts.jumpZ / 160);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 24 * shadowScale, 16 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -opts.jumpZ);

  if (opts.underglowColor || isFlamingo || isStarJump || isSpin360) {
    const glowMap: Record<string, string> = {
      pink: '#ff2a85',
      cyan: '#00f0ff',
      green: '#39ff14',
      gold: '#fde047',
    };
    const gCol = isStarJump
      ? '#fde047'
      : isFlamingo
      ? '#ff2a85'
      : isSpin360
      ? '#00f0ff'
      : glowMap[opts.underglowColor || 'cyan'] || '#00f0ff';
    ctx.fillStyle = gCol;
    ctx.globalAlpha = 0.34;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = opts.isGhost ? 0.65 : 1;
  }

  ctx.save();
  if (opts.avatarRole === 'kid') {
    ctx.scale(0.84, 0.84);
  } else if (opts.avatarRole === 'stammgast') {
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Rotate 180° when backward-gliding ([Taste 2] or backward couple partner) so skater faces against travel direction!
  ctx.rotate(opts.headingRad + (isBackward ? Math.PI : 0));

  // Shoulder width differentiation: Female narrower (31px), Male broader (37px)
  const shoulderSpan = isFemale ? 31 : 37;
  const torsoOffsetX = opts.isSpeedSkater ? 4 : 0;

  // Rhythmically swinging skate stride & arm swing (zero grey side bars!)
  const stridePhase = now * (opts.isSpeedSkater ? 0.014 : 0.01) + (opts.x + opts.y) * 0.015;
  const legStride = opts.isPalladiumanerStaff ? 0 : Math.sin(stridePhase) * 3.2;

  if (opts.isWheelchair) {
    // Accessible 80s Sport Wheelchair with glowing Neon Wheels (#00f0ff / #ff2a85)
    ctx.save();
    const neonWheelPrimary = '#00f0ff';
    const neonWheelAccent = '#ff2a85';
    ctx.shadowColor = neonWheelPrimary;
    ctx.shadowBlur = 11;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = neonWheelPrimary;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.roundRect(-17, -24, 26, 6.5, 3);
    ctx.roundRect(-17, 17.5, 26, 6.5, 3);
    ctx.fill();
    ctx.stroke();

    // Dual-tone neon hub & rim stripes on both wheelchair wheels
    ctx.fillStyle = neonWheelAccent;
    ctx.fillRect(-9, -23, 10, 4.5);
    ctx.fillRect(-9, 18.5, 10, 4.5);
    ctx.restore();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-13, -15, 20, 30);
    ctx.fillStyle = opts.accentColor;
    ctx.fillRect(-16, -14, 4, 28);
  } else if (opts.isStreetShoes) {
    // Normal 80s Street Sneakers
    ctx.fillStyle = '#334155';
    ctx.fillRect(-9 + legStride, -18, 18, 7);
    ctx.fillRect(-9 - legStride, 11, 18, 7);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-7 + legStride, -16, 13, 2.5);
    ctx.fillRect(-7 - legStride, 13, 13, 2.5);
  } else {
    // Roller Skates (In Flamingo mode [Taste 3], right skate is lifted & trailed gracefully behind!)
    const wheelCol = opts.kengoShoesWhitePink
      ? '#ff2a85'
      : opts.isRentalSkates
      ? '#38bdf8'
      : opts.isBlacklight
      ? '#00f0ff'
      : opts.wheelColor;

    const leftX = isFlamingo ? 2 : -10 + legStride;
    const rightX = isFlamingo ? -22 : -10 - legStride;
    const rightY = isFlamingo ? 13 : 16;

    ctx.fillStyle = wheelCol;
    if ((opts.kengoShoesWhitePink || opts.isCustomOwnSkates) && opts.isBlacklight) {
      ctx.shadowColor = wheelCol;
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(leftX, -21, 18, 5);
    ctx.fillRect(rightX, rightY, 18, 5);

    if (opts.isCustomOwnSkates) {
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(leftX + 9, -21, 9, 5);
      ctx.fillRect(rightX + 9, rightY, 9, 5);
    }

    ctx.fillStyle = opts.isRentalSkates
      ? '#b45309'
      : opts.skateBootColor === 'black'
      ? '#111827'
      : '#ffffff';
    ctx.fillRect(leftX - 1, -18, 20, 7);
    ctx.fillRect(rightX - 1, rightY - 5, 20, 7);
    if (opts.kengoShoesWhitePink) {
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(leftX + 1, -16, 16, 3);
      ctx.fillRect(rightX + 1, rightY - 3, 16, 3);
    } else if (opts.isCustomOwnSkates) {
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(leftX + 1, -16, 16, 2.5);
      ctx.fillRect(rightX + 1, rightY - 3, 16, 2.5);
    } else if (opts.isRentalSkates) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(leftX + 2, -16, 14, 2);
      ctx.fillRect(rightX + 2, rightY - 3, 14, 2);
    } else if (opts.skateBootColor === 'black') {
      ctx.fillStyle = wheelCol;
      ctx.fillRect(leftX + 2, -16, 14, 2);
      ctx.fillRect(rightX + 2, rightY - 3, 14, 2);
    }
    ctx.shadowBlur = 0;

    if (isFemale && opts.legwarmerColor) {
      ctx.fillStyle = opts.legwarmerColor;
      ctx.fillRect(leftX + 2, -17, 11, 6);
      ctx.fillRect(rightX + 2, rightY - 4, 11, 6);
    }

    // 80s Roller-Skate Charms ("80er-Rollschuh-Anhänger" - Pro-Shop Category 6) visibly attached to skates!
    if (opts.activeCharm) {
      const charmPositions = [
        { cx: leftX + 14, cy: -15 },
        { cx: rightX + 14, cy: rightY - 2 },
      ];
      for (const cp of charmPositions) {
        if (opts.activeCharm === 'bell') {
          // 🔔 Golden Klingel-Glöckchen
          ctx.fillStyle = '#fde047';
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cp.cx, cp.cy, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(cp.cx - 1, cp.cy - 1, 2, 2);
        } else if (opts.activeCharm === 'teddy') {
          // 🧸 Mini-Teddybärchen
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.arc(cp.cx - 2.5, cp.cy - 2.5, 2.2, 0, Math.PI * 2);
          ctx.arc(cp.cx + 2.5, cp.cy - 2.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(cp.cx, cp.cy, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(cp.cx - 1.2, cp.cy - 1, 2.4, 2);
        } else if (opts.activeCharm === 'pompons') {
          // 🎀 Neon-Plüsch-Pompons (Pink + Cyan double pompon)
          ctx.fillStyle = '#ff2a85';
          ctx.beginPath();
          ctx.arc(cp.cx - 1.5, cp.cy - 1, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(cp.cx + 2, cp.cy + 1.5, 3.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (opts.activeCharm === 'dice') {
          // 🎲 Retro-Plüschwürfel
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#ff2a85';
          ctx.lineWidth = 1.2;
          ctx.fillRect(cp.cx - 4, cp.cy - 4, 8, 8);
          ctx.strokeRect(cp.cx - 4, cp.cy - 4, 8, 8);
          ctx.fillStyle = '#090d16';
          ctx.fillRect(cp.cx - 2.5, cp.cy - 2.5, 1.6, 1.6);
          ctx.fillRect(cp.cx + 1, cp.cy + 1, 1.6, 1.6);
          ctx.fillRect(cp.cx - 0.8, cp.cy - 0.8, 1.6, 1.6);
        }
      }
    }
  }

  // ANIMATED TOP-DOWN ARMS IN JACKET COLOR + HANDS + 80s NEON WRISTBANDS (#14):
  const armSwing = opts.isPalladiumanerStaff
    ? Math.sin(now * 0.005 + opts.x) * 3.5
    : -legStride * 2.1;

  let leftHandX = 8 + armSwing + torsoOffsetX;
  let leftHandY = -shoulderSpan / 2 - 4;
  let rightHandX = 8 - armSwing + torsoOffsetX;
  let rightHandY = shoulderSpan / 2 + 4;

  if (isBackward) {
    // Outstretched balance arms when skating backwards
    leftHandX = 2 + Math.sin(now * 0.012) * 3;
    leftHandY = -shoulderSpan / 2 - 10;
    rightHandX = 2 - Math.sin(now * 0.012) * 3;
    rightHandY = shoulderSpan / 2 + 10;
  } else if (isFlamingo) {
    // Graceful aero-outstretched Flamingo wings
    leftHandX = 14;
    leftHandY = -shoulderSpan / 2 - 9;
    rightHandX = -10;
    rightHandY = shoulderSpan / 2 + 11;
  } else if (isStarJump) {
    // High cheering V-arms during Star-Jump
    leftHandX = 16;
    leftHandY = -shoulderSpan / 2 - 8;
    rightHandX = 16;
    rightHandY = shoulderSpan / 2 + 8;
  } else if (opts.speechBubble?.includes('Danger Rytm Crew')) {
    // High-Five raised right hand when greeting a Danger Rytm Crew member!
    rightHandX = 18;
    rightHandY = shoulderSpan / 2 + 6;
  }

  // Draw Left & Right Sleeves in Jacket Color
  ctx.strokeStyle = jacketColor;
  ctx.lineWidth = isFemale ? 5.5 : 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(torsoOffsetX, -shoulderSpan / 2 + 3);
  ctx.lineTo(leftHandX, leftHandY);
  ctx.moveTo(torsoOffsetX, shoulderSpan / 2 - 3);
  ctx.lineTo(rightHandX, rightHandY);
  ctx.stroke();

  // Optional 80s Neon Sweatbands / Glowstick Wristbands ("80er-Neon-Schweißbänder & Knicklicht-Armbänder") on both wrists!
  if (opts.wristbandColor) {
    const wbHex = WRISTBAND_HEX_MAP[opts.wristbandColor] || '#00f0ff';
    const lwX = torsoOffsetX * 0.25 + leftHandX * 0.75;
    const lwY = (-shoulderSpan / 2 + 3) * 0.25 + leftHandY * 0.75;
    const rwX = torsoOffsetX * 0.25 + rightHandX * 0.75;
    const rwY = (shoulderSpan / 2 - 3) * 0.25 + rightHandY * 0.75;

    ctx.save();
    ctx.shadowColor = wbHex;
    ctx.shadowBlur = opts.isBlacklight ? 12 : 7;
    ctx.strokeStyle = wbHex;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.arc(lwX, lwY, 2.6, 0, Math.PI * 2);
    ctx.arc(rwX, rwY, 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Left & Right Hands at the ends of the arms
  ctx.fillStyle = opts.isGhost ? '#cffafe' : '#fde68a';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(leftHandX, leftHandY, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rightHandX, rightHandY, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Sparkling Golden High-Five Star ("✦") on Crew Greeting ("🙌 Danger Rytm Crew!!")
  if (opts.speechBubble?.includes('Danger Rytm Crew')) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦', rightHandX + 7, rightHandY + 2);
    ctx.restore();
  }

  // Torso / 80s Shoulder Jacket
  ctx.fillStyle = jacketColor;
  ctx.strokeStyle = opts.isGhost
    ? '#ffffff'
    : isCrewOrGuard
    ? '#39ff14'
    : opts.isBlacklight
    ? '#00f0ff'
    : opts.accentColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(
    -13 + torsoOffsetX,
    -shoulderSpan / 2,
    24,
    shoulderSpan,
    isFemale ? 12 : 9
  );
  ctx.fill();
  ctx.stroke();

  if (isCrewOrGuard) {
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 6;
    ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(opts.isSkateGuard ? 'GUARD' : 'CREW', 0, -2 + torsoOffsetX);
    ctx.restore();
  }

  if (opts.isSkateGuard) {
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(5, 0, 9, -0.7, 0.7);
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(13, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head & Hair / Hat Differentiation
  ctx.fillStyle = opts.isGhost ? '#cffafe' : '#fde68a';
  ctx.beginPath();
  ctx.arc(3 + torsoOffsetX, 0, 10.5, 0, Math.PI * 2);
  ctx.fill();

  if (opts.kengolHat) {
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(3 + torsoOffsetX, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(3 + torsoOffsetX, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(5 + torsoOffsetX, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (isFemale) {
    const hairCol = '#f59e0b';
    ctx.fillStyle = hairCol;
    ctx.beginPath();
    ctx.arc(1 + torsoOffsetX, 0, 9.5, 0.7, -0.7);
    ctx.fill();
    const tailWag = Math.sin(now * 0.01 + opts.x) * 2.5;
    ctx.fillStyle = hairCol;
    ctx.beginPath();
    ctx.ellipse(-13 + torsoOffsetX, tailWag, 8.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opts.legwarmerColor || '#ff2a85';
    ctx.beginPath();
    ctx.arc(-6 + torsoOffsetX, tailWag * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.arc(1 + torsoOffsetX, 0, 9.5, 0.8, -0.8);
    ctx.fill();
    ctx.fillStyle = opts.accentColor;
    ctx.beginPath();
    ctx.arc(6 + torsoOffsetX, 0, 9, -0.85, 0.85);
    ctx.fill();
  }

  ctx.restore(); // End heading rotation

  // Orbiting golden stars during Palladium Star-Jump ([Taste 4]) or Crash
  if (opts.crashTimer > 0 || isStarJump) {
    const count = isStarJump ? 4 : 3;
    for (let s = 0; s < count; s++) {
      const ang = now * 0.01 + (s * Math.PI * 2) / count;
      ctx.fillStyle = isStarJump && s % 2 === 1 ? '#00f0ff' : '#fde047';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(
        '★',
        Math.cos(ang) * 24 - 6,
        (isStarJump ? -12 : -28) + Math.sin(ang) * 12
      );
    }
  }

  ctx.restore();

  if (opts.showName && opts.name) {
    drawRetroNameBadge(
      ctx,
      opts.x,
      opts.y - opts.jumpZ - 34,
      opts.name,
      isCrewOrGuard ? '#39ff14' : opts.accentColor,
      opts.hasMultiplayerStar
    );
  }

  if (opts.speechBubble) {
    const bubbleY =
      opts.showName && opts.name
        ? opts.y - opts.jumpZ - 64
        : opts.y - opts.jumpZ - 46;
    drawSpeechBubble(ctx, opts.x, bubbleY, opts.speechBubble);
  }
}

/** Clamps all name badges inside the canvas edges so nothing is ever cut off! */
function drawRetroNameBadge(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  text: string,
  borderColor: string,
  hasMultiplayerStar?: boolean
): void {
  if (isDeferringOverlays) {
    deferredOverlayQueue.push({
      kind: 'badge',
      worldX,
      worldY,
      text,
      borderColor,
      hasMultiplayerStar,
    });
    return;
  }
  ctx.save();
  ctx.font = 'bold 10px "Silkscreen", "JetBrains Mono", monospace';
  const metrics = ctx.measureText(text);
  const starExtraW = hasMultiplayerStar ? 20 : 0;
  const padX = 6;
  const w = metrics.width + padX * 2 + starExtraW;
  const h = 18;

  const cx = Math.max(w / 2 + 8, Math.min(WORLD_WIDTH - w / 2 - 8, worldX));
  const cy = Math.max(h / 2 + 8, Math.min(WORLD_HEIGHT - h / 2 - 36, worldY));

  ctx.fillStyle = 'rgba(5, 8, 17, 0.92)';
  ctx.strokeStyle = hasMultiplayerStar ? '#00f0ff' : borderColor;
  ctx.lineWidth = hasMultiplayerStar ? 1.8 : 1.6;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();

  if (hasMultiplayerStar) {
    const badgeX = cx - w / 2 + 10;
    ctx.fillStyle = '#083344';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(badgeX, cy, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 9.5px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', badgeX, cy + 0.5);

    ctx.font = 'bold 10px "Silkscreen", "JetBrains Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx + starExtraW / 2 - 1, cy + 0.5);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 0.5);
  }
  ctx.restore();
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  text: string
): void {
  if (isDeferringOverlays) {
    deferredOverlayQueue.push({
      kind: 'bubble',
      worldX,
      worldY,
      text,
    });
    return;
  }
  ctx.save();
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  const w = ctx.measureText(text).width + 20;
  const h = 26;

  const cx = Math.max(w / 2 + 10, Math.min(WORLD_WIDTH - w / 2 - 10, worldX));
  const cy = Math.max(h / 2 + 10, Math.min(WORLD_HEIGHT - h / 2 - 38, worldY));

  ctx.fillStyle = '#fde047';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#090d16';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
  ctx.restore();
}

function renderSaniNurseSprite(
  ctx: CanvasRenderingContext2D,
  now: number,
  saniNurse: {
    withStretcherTeam?: boolean;
    phase: 'idle' | 'running-in' | 'kneeling' | 'walking-out';
    x: number;
    y: number;
    headingRad: number;
    speechText: string | null;
  },
  showNames: boolean
): void {
  const isKneeling = saniNurse.phase === 'kneeling';
  const isRunning = saniNurse.phase === 'running-in';
  const stride = isKneeling
    ? 0
    : Math.sin(now * (isRunning ? 0.022 : 0.012)) * (isRunning ? 8 : 4.5);

  // On the 10th bump gag: Render the 2 Paramedics carrying a red-cross stretcher ("Trage") + escorting Skate-Guard whistling the track clear!
  if (saniNurse.withStretcherTeam) {
    ctx.save();
    ctx.translate(saniNurse.x - 44, saniNurse.y + 18);

    // Stretcher frame & orange emergency mat
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-30, -7);
    ctx.lineTo(30, -7);
    ctx.moveTo(-30, 7);
    ctx.lineTo(30, 7);
    ctx.stroke();

    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-22, -8, 44, 16, 4);
    ctx.fill();
    ctx.stroke();

    // White cross on stretcher
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, -2, 10, 4);
    ctx.fillRect(-2, -5, 4, 10);

    // 2 Paramedics at left (-28) and right (+28) ends of the stretcher
    [-28, 28].forEach((px) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px - 8, -11, 16, 22, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(px, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Escorting Skate-Guard whistling the lane clear
    const gx = 54;
    const gy = -22;
    ctx.fillStyle = '#070a10';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gx - 9, gy - 11, 18, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(gx, gy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(saniNurse.x, saniNurse.y);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
  ctx.beginPath();
  ctx.ellipse(0, 8, isKneeling ? 22 : 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(saniNurse.headingRad);

  if (!isKneeling) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-8 + stride, -15, 14, 6, 3);
    ctx.roundRect(-8 - stride, 9, 14, 6, 3);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-13, -16, 24, 32, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-7, -2.2, 12, 4.4);
  ctx.fillRect(-3.2, -6, 4.4, 12);

  const kitX = isKneeling ? 14 : 2;
  const kitY = isKneeling ? 15 : 20;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(kitX - 8, kitY - 6, 16, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(kitX - 4, kitY - 1.5, 8, 3);
  ctx.fillRect(kitX - 1.5, kitY - 4, 3, 8);

  if (isKneeling) {
    const careMotion = Math.sin(now * 0.015) * 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(18 + careMotion, -5);
    ctx.moveTo(8, 10);
    ctx.lineTo(18 - careMotion, 5);
    ctx.stroke();

    // Visible cyan 80s Ice-Pack ("🧊 KÜHLPACK") applied by Schwester Gudrun
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(15 + careMotion * 0.6, -6, 10, 12, 3);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(3, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-11, 0, 6.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-2, -9, 9, 18, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(0.5, -3.5, 4, 7);
  ctx.fillRect(-1, -2, 7, 4);

  ctx.restore();
  ctx.restore();

  if (showNames) {
    drawRetroNameBadge(
      ctx,
      saniNurse.x,
      saniNurse.y - 36,
      `➕ ${activeCrewNames.nurse || 'Schwester Gudrun'}`,
      '#ef4444'
    );
  }
  if (saniNurse.speechText) {
    drawSpeechBubble(
      ctx,
      saniNurse.x,
      showNames ? saniNurse.y - 66 : saniNurse.y - 46,
      saniNurse.speechText
    );
  }
}

// ============================================================================
// FLOOR DISCO LIGHTING (RENDERED UNDERNEATH SKATERS FOR ZERO GHOST-LOOK!)
// & CEILING MIRROR BALL FIXTURE
// ============================================================================

function renderFloorDiscoLighting(
  ctx: CanvasRenderingContext2D,
  now: number,
  isBlacklight: boolean,
  isSlowSkating: boolean,
  skipOuterLightCones = false,
  isBallspielMode = false
): void {
  const { rink, djTower } = ARENA_LAYOUT;
  const cx = rink.centerX;
  const cy = rink.centerY;
  const audioBands = soundFX.getSmoothedAudioBands(now);

  // BALLSPIEL RINK-ONLY SPOTLIGHTS (Kein milchig-weißer Schleier über dem ganzen Raum!):
  // Only the roller rink parquet itself is brightly illuminated with warm overhead spotlights,
  // while Disco-Tower, Jam-Dance, Bistro, and Cashier stay in cozy 80s hall darkness!
  if (isBallspielMode) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(djTower.bevelTopX, rink.y);
    ctx.lineTo(rink.x + rink.width - rink.cornerRadius, rink.y);
    ctx.quadraticCurveTo(
      rink.x + rink.width,
      rink.y,
      rink.x + rink.width,
      rink.y + rink.cornerRadius
    );
    ctx.lineTo(
      rink.x + rink.width,
      rink.y + rink.height - rink.cornerRadius
    );
    ctx.quadraticCurveTo(
      rink.x + rink.width,
      rink.y + rink.height,
      rink.x + rink.width - rink.cornerRadius,
      rink.y + rink.height
    );
    ctx.lineTo(rink.x + rink.cornerRadius, rink.y + rink.height);
    ctx.quadraticCurveTo(
      rink.x,
      rink.y + rink.height,
      rink.x,
      rink.y + rink.height - rink.cornerRadius
    );
    ctx.lineTo(djTower.bevelLeftX, djTower.bevelLeftY);
    ctx.quadraticCurveTo(
      djTower.curveCtrlX,
      djTower.curveCtrlY,
      djTower.bevelTopX,
      djTower.bevelTopY
    );
    ctx.closePath();
    ctx.clip();

    // Warm overhead sport-spotlights strictly inside the roller rink barrier
    const rinkSpotPositions = [
      { x: rink.x + 290, y: rink.y + 195, r: 340 },
      { x: cx, y: rink.y + 185, r: 360 },
      { x: rink.x + rink.width - 290, y: rink.y + 195, r: 340 },
      { x: rink.x + 290, y: rink.y + rink.height - 195, r: 340 },
      { x: cx, y: rink.y + rink.height - 185, r: 360 },
      { x: rink.x + rink.width - 290, y: rink.y + rink.height - 195, r: 340 },
    ];
    for (const sp of rinkSpotPositions) {
      const g = ctx.createRadialGradient(sp.x, sp.y, 20, sp.x, sp.y, sp.r);
      g.addColorStop(0, 'rgba(254, 249, 195, 0.24)');
      g.addColorStop(0.55, 'rgba(253, 230, 138, 0.12)');
      g.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (isSlowSkating) {
    // 1. SLOW-SKATING MODE: Deep romantic night-blue/violet darkness so only soft warm spotlights & mirror-ball reflections wander across the parquet!
    ctx.fillStyle = 'rgba(6, 3, 18, 0.56)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Soft warm romantic spotlights wandering gently across the couples on the rink
    const warmRomanticPools = [
      {
        x: cx + Math.cos(now * 0.00045) * 390,
        y: cy + Math.sin(now * 0.00055) * 210,
        col: 'rgba(251, 191, 36, 0.16)',
      },
      {
        x: cx + Math.cos(now * 0.0004 + 2.4) * 410,
        y: cy + Math.sin(now * 0.0005 + 1.7) * 215,
        col: 'rgba(244, 114, 182, 0.15)',
      },
      {
        x: cx + Math.cos(now * 0.00038 + 4.5) * 360,
        y: cy + Math.sin(now * 0.00048 + 3.6) * 195,
        col: 'rgba(167, 139, 250, 0.14)',
      },
    ];
    for (const wp of warmRomanticPools) {
      const wg = ctx.createRadialGradient(wp.x, wp.y, 12, wp.x, wp.y, 240);
      wg.addColorStop(0, wp.col);
      wg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, 240, 0, Math.PI * 2);
      ctx.fill();
    }

    const rot = now * 0.00022;
    const numDots = 84;
    for (let i = 0; i < numDots; i++) {
      const ring = (i % 6) + 1;
      const angle = rot * (ring % 2 === 0 ? 1 : -1.2) + (i * Math.PI * 2) / 14;
      const distX = ring * 115 + Math.sin(now * 0.001 + i) * 24;
      const distY = ring * 68 + Math.cos(now * 0.001 + i) * 18;
      const rx = cx + Math.cos(angle) * distX;
      const ry = cy + Math.sin(angle) * distY;

      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(253, 224, 71, 0.52)'
          : i % 3 === 1
          ? 'rgba(255, 255, 255, 0.44)'
          : 'rgba(244, 114, 182, 0.42)';
      ctx.beginPath();
      ctx.ellipse(rx, ry, 5.5, 3.8, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Two ceiling pin-spot beams shining onto the Mirror Ball
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(cx - 380, 0);
    ctx.lineTo(cx - 28, cy);
    ctx.lineTo(cx + 28, cy);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 380, 0);
    ctx.lineTo(cx - 28, cy);
    ctx.lineTo(cx + 28, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // Concert Focus (#9): When Live-Band ('band') is active, turn off outer wandering floor light cones so all focus is on the center stage!
  if (skipOuterLightCones) {
    return;
  }

  if (isBlacklight) {
    // 2. BLACKLIGHT UV MODE: Deep UV floor pools modulated smoothly by audioBands.bass
    const uvAlphaBoost = 1 + audioBands.bass * 0.25;
    const uvSpots = [
      {
        x: cx + Math.cos(now * 0.0008) * 420,
        y: cy + Math.sin(now * 0.0011) * 230,
        col: `rgba(139, 92, 246, ${(0.15 * uvAlphaBoost).toFixed(3)})`,
      },
      {
        x: cx + Math.cos(now * 0.0009 + 2) * 440,
        y: cy + Math.sin(now * 0.0007 + 1) * 240,
        col: `rgba(0, 240, 255, ${(0.13 * uvAlphaBoost).toFixed(3)})`,
      },
      {
        x: cx + Math.cos(now * 0.0007 + 4) * 390,
        y: cy + Math.sin(now * 0.001 + 3) * 220,
        col: `rgba(217, 70, 239, ${(0.14 * uvAlphaBoost).toFixed(3)})`,
      },
    ];
    for (const s of uvSpots) {
      const grad = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, 260);
      grad.addColorStop(0, s.col);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 260, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 3. DISCO-SPOTS MODE: Flicker-free Sound-to-Light floor pools & soft spotlight beams (NO harsh strobe flashing!)
    const coolWhiteSpots = [
      {
        sx: cx - 420,
        sy: 110,
        tx: cx + Math.cos(now * 0.0009) * 410,
        ty: cy + Math.sin(now * 0.0011) * 225,
        band: audioBands.bass,
      },
      {
        sx: cx + 420,
        sy: 110,
        tx: cx + Math.cos(now * 0.0008 + 2.2) * 420,
        ty: cy + Math.sin(now * 0.0009 + 1.4) * 230,
        band: audioBands.mid,
      },
      {
        sx: cx - 220,
        sy: 110,
        tx: cx + Math.cos(now * 0.0007 + 4.1) * 370,
        ty: cy + Math.sin(now * 0.001 + 3.2) * 210,
        band: audioBands.high,
      },
      {
        sx: cx + 220,
        sy: 110,
        tx: cx + Math.cos(now * 0.001 + 5.2) * 350,
        ty: cy + Math.sin(now * 0.0008 + 4.5) * 205,
        band: audioBands.energy,
      },
    ];

    ctx.save();
    for (const sp of coolWhiteSpots) {
      const beamAlpha = 0.06 + sp.band * 0.05;
      const poolAlpha = 0.1 + sp.band * 0.07;

      const beamGrad = ctx.createLinearGradient(sp.sx, sp.sy, sp.tx, sp.ty);
      beamGrad.addColorStop(0, `rgba(224, 242, 254, ${beamAlpha.toFixed(3)})`);
      beamGrad.addColorStop(1, 'rgba(186, 230, 253, 0.01)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(sp.sx - 8, sp.sy);
      ctx.lineTo(sp.sx + 8, sp.sy);
      ctx.lineTo(sp.tx + 95, sp.ty);
      ctx.lineTo(sp.tx - 95, sp.ty);
      ctx.closePath();
      ctx.fill();

      const poolGrad = ctx.createRadialGradient(
        sp.tx,
        sp.ty,
        12,
        sp.tx,
        sp.ty,
        195
      );
      poolGrad.addColorStop(0, `rgba(240, 249, 255, ${poolAlpha.toFixed(3)})`);
      poolGrad.addColorStop(
        0.55,
        `rgba(186, 230, 253, ${(poolAlpha * 0.45).toFixed(3)})`
      );
      poolGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.arc(sp.tx, sp.ty, 195, 0, Math.PI * 2);
      ctx.fill();
    }

    // PALLADIUM 1989 EPOCH LOOK: Golden disco-ball light dots orbiting across the dark floor!
    if (activeArenaStyle === 'palladium-1989') {
      const rot89 = now * 0.00028;
      for (let i = 0; i < 72; i++) {
        const ring = (i % 6) + 1;
        const angle =
          rot89 * (ring % 2 === 0 ? 1 : -1.15) + (i * Math.PI * 2) / 13;
        const rx = cx + Math.cos(angle) * (ring * 116);
        const ry = cy + Math.sin(angle) * (ring * 66);
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(253, 224, 71, 0.48)'
            : i % 3 === 1
            ? 'rgba(254, 243, 199, 0.36)'
            : 'rgba(245, 158, 11, 0.34)';
        ctx.beginPath();
        ctx.ellipse(rx, ry, 5.5, 3.8, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function renderCeilingMirrorBallFixture(
  ctx: CanvasRenderingContext2D,
  now: number,
  isSlowSkating: boolean
): void {
  const { rink } = ARENA_LAYOUT;
  const cx = rink.centerX;
  const cy = rink.centerY;

  ctx.save();
  if (isSlowSkating) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 24;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    const facetShift = (now * 0.016) % 10;
    for (let fy = -24; fy <= 24; fy += 10) {
      const rowWidth = Math.sqrt(Math.max(0, 32 * 32 - fy * fy));
      for (let fx = -rowWidth + facetShift; fx < rowWidth - 4; fx += 10) {
        ctx.fillStyle =
          Math.floor(fx + fy) % 2 === 0 ? '#ffffff' : '#fde047';
        ctx.fillRect(cx + fx - 3, cy + fy - 3, 6.5, 6.5);
      }
    }
  } else if (activeArenaStyle === 'palladium-1989') {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 22;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#422006';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    const facetShift = (now * 0.015) % 10;
    for (let fy = -23; fy <= 23; fy += 10) {
      const rowWidth = Math.sqrt(Math.max(0, 31 * 31 - fy * fy));
      for (let fx = -rowWidth + facetShift; fx < rowWidth - 4; fx += 10) {
        ctx.fillStyle =
          Math.floor(fx + fy) % 2 === 0 ? '#fef08a' : '#f59e0b';
        ctx.fillRect(cx + fx - 3, cy + fy - 3, 6, 6);
      }
    }
  } else {
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (let fy = -22; fy <= 22; fy += 11) {
      const rowWidth = Math.sqrt(Math.max(0, 29 * 29 - fy * fy));
      for (let fx = -rowWidth; fx < rowWidth - 4; fx += 11) {
        ctx.fillStyle = Math.floor(fx + fy) % 2 === 0 ? '#334155' : '#1e293b';
        ctx.fillRect(cx + fx - 3, cy + fy - 3, 5.5, 5.5);
      }
    }
  }
  ctx.restore();
}

/**
 * REALISTIC 80s DISCO FOG PLUMES & SKATER TURBULENCE:
 * Replaces hard grey ovals with soft radial-gradient fog plumes (`alpha: 0.03–0.08`, zero hard borders)
 * shooting as a directed jet from the nozzles at the Disco-Tower, expanding across the rink,
 * reflecting the hall's neon/UV/spotlight colors, and getting swirled/pushed aside by passing skaters!
 */
interface DiscoFogParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  tintIndex: number;
  age: number;
  maxAge: number;
}

const discoFogParticles: DiscoFogParticle[] = [];
let lastFogUpdateMs = 0;

function render80sDancefloorFogBanks(
  ctx: CanvasRenderingContext2D,
  now: number,
  baseActive: boolean,
  burstBoost: number,
  isBlacklight: boolean,
  isSlowSkating: boolean,
  isConcertLightingActive: boolean,
  player?: { x: number; y: number; vx: number; vy: number },
  trackNpcs?: TrackNpc[]
): void {
  if (!baseActive && burstBoost <= 0.01) {
    discoFogParticles.length = 0;
    return;
  }

  const { djTower, rink } = ARENA_LAYOUT;
  const dt = Math.min(0.05, Math.max(0.008, (now - (lastFogUpdateMs || now)) / 1000));
  lastFogUpdateMs = now;

  // Dual fog nozzles mounted at the front bevel of the Disco-Tower shooting toward the rink center (+X, +Y)
  const nozzles = [
    { x: djTower.bevelLeftX + 34, y: djTower.bevelLeftY - 30, dirX: 0.78, dirY: 0.62 },
    { x: djTower.bevelTopX - 28, y: djTower.bevelTopY + 34, dirX: 0.82, dirY: 0.57 },
  ];

  const targetCount = Math.min(56, Math.round(36 + burstBoost * 18));
  while (discoFogParticles.length < targetCount) {
    const nz = nozzles[discoFogParticles.length % nozzles.length];
    const initialProgress =
      discoFogParticles.length < 28 ? (discoFogParticles.length / 28) * 9.5 : 0;
    const spreadAngle =
      Math.atan2(nz.dirY, nz.dirX) +
      Math.sin(now * 0.0017 + discoFogParticles.length * 1.3) * 0.42;
    const speed = 58 + (discoFogParticles.length % 7) * 11 + burstBoost * 38;
    const vx = Math.cos(spreadAngle) * speed;
    const vy = Math.sin(spreadAngle) * speed;

    discoFogParticles.push({
      x: nz.x + vx * initialProgress,
      y: nz.y + vy * initialProgress,
      vx,
      vy,
      radius: 68 + initialProgress * 18 + (discoFogParticles.length % 5) * 14,
      alpha: 0.036 + (discoFogParticles.length % 4) * 0.01,
      tintIndex: discoFogParticles.length % 3,
      age: initialProgress,
      maxAge: 11 + (discoFogParticles.length % 6) * 2.2,
    });
  }

  ctx.save();
  for (let i = 0; i < discoFogParticles.length; i++) {
    const p = discoFogParticles[i];
    p.age += dt;

    if (
      p.age >= p.maxAge ||
      p.x > rink.x + rink.width - 40 ||
      p.y > rink.y + rink.height - 40
    ) {
      const nz = nozzles[i % nozzles.length];
      const spreadAngle =
        Math.atan2(nz.dirY, nz.dirX) + Math.sin(now * 0.0023 + i * 1.7) * 0.38;
      const jetSpeed = 68 + (i % 6) * 12 + burstBoost * 45;
      p.x = nz.x + Math.cos(spreadAngle) * 14;
      p.y = nz.y + Math.sin(spreadAngle) * 14;
      p.vx = Math.cos(spreadAngle) * jetSpeed;
      p.vy = Math.sin(spreadAngle) * jetSpeed;
      p.radius = 52 + (i % 4) * 10;
      p.alpha = 0.035 + (i % 5) * 0.008;
      p.age = 0;
      p.maxAge = 10.5 + (i % 5) * 2.4;
    }

    // Gentle air drag as the directed jet expands into wide, billowing dancefloor clouds
    p.vx *= 1 - dt * 0.14;
    p.vy *= 1 - dt * 0.14;
    p.radius = Math.min(240, p.radius + dt * (15 + burstBoost * 8));

    // Swirl / displacement when the player or NPC skaters glide through the fog!
    if (player) {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 155 * 155 && distSq > 4) {
        const dist = Math.sqrt(distSq);
        const falloff = (1 - dist / 155) * 0.85;
        p.vx += (player.vx * 0.32 + (dx / dist) * 48) * falloff * dt * 8;
        p.vy += (player.vy * 0.32 + (dy / dist) * 48) * falloff * dt * 8;
      }
    }
    if (trackNpcs) {
      for (let n = 0; n < trackNpcs.length; n += 2) {
        const npc = trackNpcs[n];
        const dx = p.x - npc.x;
        const dy = p.y - npc.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 125 * 125 && distSq > 4) {
          const dist = Math.sqrt(distSq);
          const falloff = (1 - dist / 125) * 0.55;
          p.vx += (npc.vx * 0.25 + (dx / dist) * 34) * falloff * dt * 6;
          p.vy += (npc.vy * 0.25 + (dy / dist) * 34) * falloff * dt * 6;
        }
      }
    }

    p.x += p.vx * dt + Math.sin(now * 0.0008 + i) * 0.25;
    p.y += p.vy * dt + Math.cos(now * 0.0007 + i) * 0.2;

    const lifeRatio = p.age / p.maxAge;
    const envelope =
      lifeRatio < 0.15
        ? lifeRatio / 0.15
        : lifeRatio > 0.72
        ? Math.max(0, (1 - lifeRatio) / 0.28)
        : 1;
    const effAlpha = Math.min(
      0.08,
      Math.max(0.0, (p.alpha + burstBoost * 0.022) * envelope)
    );
    if (effAlpha <= 0.003) continue;

    // Color tinting from the active hall lighting (UV Blacklight, Slow-Skating, Concert, or 80s Neon)
    let coreRgb = '216, 236, 255';
    let midRgb = '165, 216, 255';
    if (isBlacklight) {
      coreRgb = p.tintIndex === 0 ? '192, 132, 252' : '56, 189, 248';
      midRgb = p.tintIndex === 0 ? '139, 92, 246' : '34, 211, 238';
    } else if (isSlowSkating) {
      coreRgb = p.tintIndex === 0 ? '244, 114, 182' : p.tintIndex === 1 ? '251, 191, 36' : '167, 139, 250';
      midRgb = '192, 132, 252';
    } else if (isConcertLightingActive) {
      coreRgb = p.tintIndex === 0 ? '255, 42, 133' : p.tintIndex === 1 ? '0, 240, 255' : '253, 224, 71';
      midRgb = '147, 197, 253';
    } else {
      coreRgb = p.tintIndex === 0 ? '224, 242, 254' : p.tintIndex === 1 ? '245, 208, 254' : '186, 230, 253';
      midRgb = '148, 163, 184';
    }

    const g = ctx.createRadialGradient(p.x, p.y, p.radius * 0.08, p.x, p.y, p.radius);
    g.addColorStop(0, `rgba(${coreRgb}, ${effAlpha.toFixed(4)})`);
    g.addColorStop(0.55, `rgba(${midRgb}, ${(effAlpha * 0.52).toFixed(4)})`);
    g.addColorStop(1, `rgba(${midRgb}, 0)`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 16-BIT ARCADE FULL-BODY PIXEL CHARACTER RENDERER ('pixel-16bit' & 'pixel16BitFiguresEnabled')
 * Draws skaters, NPCs, and ghosts as oblique front/side 24×32 full-body pixel characters
 * (`ctx.imageSmoothingEnabled = false`, 1px dark outlines) with recognizable head, eyes,
 * 80s hairstyles (Vokuhila/mullet, perm/Dauerwelle, headband/Stirnband), varied skin tones,
 * colorful 80s jackets/shirts, jeans/skirts, animated skating legs & roller skates,
 * and semi-transparent cyan-glowing full-body silhouettes with shimmering pixel outlines for Ghost Skaters!
 */
let offscreen16BitCharCanvas: HTMLCanvasElement | null = null;

function render16BitPixelCharacterSprite(
  ctx: CanvasRenderingContext2D,
  now: number,
  opts: {
    x: number;
    y: number;
    headingRad: number;
    jumpZ: number;
    gender?: 'female' | 'male';
    isWheelchair: boolean;
    isSkateGuard: boolean;
    isSpeedSkater: boolean;
    isGhost: boolean;
    isPalladiumanerStaff: boolean;
    shirtColor: string;
    accentColor: string;
    wheelColor: string;
    skateBootColor?: 'white' | 'black';
    legwarmerColor?: string;
    kengolHat?: boolean;
    kengoShoesWhitePink?: boolean;
    isStreetShoes?: boolean;
    isRentalSkates?: boolean;
    isCustomOwnSkates?: boolean;
    name: string;
    showName: boolean;
    isBlacklight: boolean;
    crashTimer: number;
    speechBubble: string | null;
    underglowColor?: string;
    hasMultiplayerStar?: boolean;
    activeTrickMove?: TrickMoveId | null;
    isBackwardGliding?: boolean;
    wristbandColor?: NeonWristbandColor;
    activeCharm?: SkateCharmId | null;
  }
): void {
  const isFemale = opts.gender === 'female';
  const isCrewOrGuard = opts.isSkateGuard || opts.isPalladiumanerStaff;
  const isBackward = Boolean(
    opts.isBackwardGliding || opts.activeTrickMove === 'backward'
  );
  const pxSnap = (v: number) => Math.round(v / 2) * 2;
  const x = pxSnap(opts.x);
  const y = pxSnap(opts.y);

  // Deterministic character traits from name hash (skin tone & 80s hairstyle: 0=Vokuhila, 1=Dauerwelle, 2=Stirnband)
  let nameHash = 0;
  for (let i = 0; i < (opts.name || 'S').length; i++) {
    nameHash = (nameHash * 31 + opts.name.charCodeAt(i)) | 0;
  }
  const absHash = Math.abs(nameHash);
  const skinTones = ['#fde68a', '#f5cba7', '#d99b66', '#8d5524'];
  const skinCol = opts.isGhost
    ? '#67e8f9'
    : skinTones[absHash % skinTones.length];
  const hairStyleIdx = absHash % 3; // 0: Vokuhila/Mullet, 1: Dauerwelle/Perm, 2: Stirnband/Headband
  const hairPalette = ['#451a03', '#f59e0b', '#1c1917', '#b45309', '#7c2d12'];
  const hairCol = opts.isGhost
    ? '#a5f3fc'
    : hairPalette[(absHash >> 2) % hairPalette.length];

  const effHeading = opts.headingRad + (isBackward ? Math.PI : 0);
  const facingLeft = Math.cos(effHeading) < -0.15;
  const flipX = facingLeft ? -1 : 1;

  // 4-frame skating leg & arm stride animation
  const animPhase = Math.floor(now * (opts.isSpeedSkater ? 0.014 : 0.01) + absHash) % 4;
  const legStride =
    opts.isPalladiumanerStaff
      ? 0
      : animPhase === 0
      ? -1
      : animPhase === 2
      ? 1
      : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);

  // Clean oval ground shadow under skates (NO rectangular bounding box!)
  const shadowScale = Math.max(0.45, 1 - opts.jumpZ / 160);
  ctx.fillStyle = opts.isGhost
    ? 'rgba(0, 240, 255, 0.24)'
    : 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 15 * shadowScale, 6.5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(0, -pxSnap(opts.jumpZ));

  // Optional Underglow or Ghost Cyan Aura: strictly a soft oval at the skates — NEVER a rectangular box around the body!
  if (opts.underglowColor || opts.isGhost) {
    const glowMap: Record<string, string> = {
      pink: '#ff2a85',
      cyan: '#00f0ff',
      green: '#39ff14',
      gold: '#fde047',
    };
    ctx.save();
    ctx.fillStyle = opts.isGhost
      ? '#00f0ff'
      : glowMap[opts.underglowColor || 'cyan'] || '#00f0ff';
    ctx.globalAlpha = opts.isGhost
      ? 0.22 + Math.sin(now * 0.01) * 0.06
      : 0.28;
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Offscreen 16-Bit Sprite Canvas with explicit clearRect(0, 0, width, height) and strict alpha = 0 cleanup
  const spriteW = 48;
  const spriteH = 60;
  if (!offscreen16BitCharCanvas) {
    offscreen16BitCharCanvas = document.createElement('canvas');
    offscreen16BitCharCanvas.width = spriteW;
    offscreen16BitCharCanvas.height = spriteH;
  }
  const sCtx = offscreen16BitCharCanvas.getContext('2d');
  if (!sCtx) {
    ctx.restore();
    return;
  }
  sCtx.imageSmoothingEnabled = false;
  sCtx.clearRect(0, 0, spriteW, spriteH);

  // Helper to draw a crisp pixel block on the 24x32 full-body grid onto the cleared offscreen canvas
  const P = 1.75; // 24 * 1.75 = 42px wide, 32 * 1.75 = 56px tall
  const ox = 3;
  const oy = 2;
  const rectPx = (gx: number, gy: number, gw: number, gh: number, col: string) => {
    sCtx.fillStyle = col;
    sCtx.fillRect(
      Math.round(ox + gx * P),
      Math.round(oy + gy * P),
      Math.max(1, Math.round(gw * P)),
      Math.max(1, Math.round(gh * P))
    );
  };

  // Shimmering pixel outline for Ghost Skaters, crisp 1px dark outline (#050811) for regular skaters
  const outlineCol = opts.isGhost
    ? Math.floor(now * 0.015) % 2 === 0
      ? '#00f0ff'
      : '#cffafe'
    : '#050811';

  const jacketCol = opts.isGhost
    ? '#0891b2'
    : isCrewOrGuard
    ? '#0f172a'
    : opts.shirtColor;
  const trimCol = opts.isGhost
    ? '#a5f3fc'
    : isCrewOrGuard
    ? '#39ff14'
    : opts.isBlacklight
    ? '#00f0ff'
    : opts.accentColor;
  const pantsOrSkirtCol = opts.isGhost
    ? '#0e7490'
    : isFemale
    ? '#db2777'
    : '#1d4ed8';
  const wheelCol = opts.isGhost
    ? '#cffafe'
    : opts.kengoShoesWhitePink
    ? '#ff2a85'
    : opts.isRentalSkates
    ? '#38bdf8'
    : opts.isBlacklight
    ? '#00f0ff'
    : opts.wheelColor;
  const bootCol = opts.isGhost
    ? '#22d3ee'
    : opts.isStreetShoes
    ? '#334155'
    : opts.isRentalSkates
    ? '#b45309'
    : opts.skateBootColor === 'black'
    ? '#1e293b'
    : '#ffffff';

  // ==========================================================================
  // 1. HEAD, EYES & 80s HAIRSTYLES (Rows gy = 2..11)
  // ==========================================================================
  // Head 1px dark/shimmering outline
  rectPx(7, 3, 10, 9, outlineCol);
  // Face skin
  rectPx(8, 4, 8, 7, skinCol);
  // Crisp oblique front/side Eyes + 80s Sunglasses for Guards/Crew
  if (opts.isSkateGuard) {
    rectPx(10, 6, 6, 2, '#050811');
    rectPx(11, 6, 2, 1, '#38bdf8');
  } else {
    rectPx(11, 6, 2, 2, opts.isGhost ? '#ffffff' : '#090d16');
    rectPx(14, 6, 2, 2, opts.isGhost ? '#ffffff' : '#090d16');
    // Smile / mouth pixel
    rectPx(12, 9, 3, 1, opts.isGhost ? '#cffafe' : '#be123c');
  }

  if (opts.kengolHat) {
    // Iconic 80s Kengol Bucket Hat
    rectPx(6, 1, 12, 4, outlineCol);
    rectPx(7, 2, 10, 3, '#111827');
    rectPx(7, 4, 10, 1, '#ff2a85');
    rectPx(11, 2, 2, 2, '#fde047');
  } else if (hairStyleIdx === 0) {
    // 80s VOKUHILA / MULLET (Short spiked front, long flowing neck mane in back!)
    rectPx(7, 2, 10, 3, outlineCol);
    rectPx(8, 2, 8, 2, hairCol);
    rectPx(5, 4, 3, 8, outlineCol);
    rectPx(6, 4, 2, 7, hairCol);
  } else if (hairStyleIdx === 1) {
    // 80s VOLUMINOUS DAUERWELLE / PERM CURLS
    rectPx(5, 1, 14, 5, outlineCol);
    rectPx(6, 2, 12, 3, hairCol);
    rectPx(5, 4, 4, 6, hairCol);
    rectPx(15, 4, 3, 4, hairCol);
  } else {
    // 80s AEROBIC STIRNBAND / NEON HEADBAND + PONYTAIL
    rectPx(7, 2, 10, 3, hairCol);
    rectPx(7, 4, 10, 2, trimCol);
    if (isFemale) {
      rectPx(4, 4, 3, 5, hairCol);
    }
  }

  // ==========================================================================
  // 2. 80s JACKET / SHIRT TORSO & ANIMATED ARMS (Rows gy = 11..20)
  // ==========================================================================
  rectPx(6, 11, 12, 9, outlineCol);
  rectPx(7, 12, 10, 7, jacketCol);
  // 80s Neon V-Chevron / Shoulder Stripes on Jacket
  rectPx(7, 12, 3, 2, trimCol);
  rectPx(14, 12, 3, 2, trimCol);
  rectPx(9, 14, 6, 2, trimCol);

  // Left & Right Arms (animated with stride or outstretched for couple hand-holding)
  const leftArmY = 12 + legStride;
  const rightArmY = 12 - legStride;
  rectPx(3, leftArmY, 4, 6, outlineCol);
  rectPx(4, leftArmY + 1, 2, 4, jacketCol);
  rectPx(17, rightArmY, 4, 6, outlineCol);
  rectPx(18, rightArmY + 1, 2, 4, jacketCol);

  if (opts.wristbandColor) {
    const wbCol = WRISTBAND_HEX_MAP[opts.wristbandColor] || '#00f0ff';
    rectPx(4, leftArmY + 4, 2, 1, wbCol);
    rectPx(18, rightArmY + 4, 2, 1, wbCol);
  }
  // Pixel Hands
  rectPx(4, leftArmY + 5, 2, 2, skinCol);
  rectPx(18, rightArmY + 5, 2, 2, skinCol);

  // ==========================================================================
  // 3. 80s JEANS / SKIRT, LEGWARMERS & ANIMATED ROLLER SKATES (Rows gy = 19..31)
  // ==========================================================================
  if (opts.isWheelchair) {
    rectPx(4, 18, 16, 12, outlineCol);
    rectPx(6, 19, 12, 8, '#1e293b');
    rectPx(4, 20, 3, 9, wheelCol);
    rectPx(17, 20, 3, 9, wheelCol);
  } else {
    const lLegY = 20 + legStride;
    const rLegY = 20 - legStride;

    if (isFemale) {
      // 80s Neon Mini-Skirt + Legwarmers (Stulpen)
      rectPx(6, 19, 12, 4, outlineCol);
      rectPx(7, 19, 10, 3, pantsOrSkirtCol);
      // Legs
      rectPx(7, lLegY + 2, 4, 5, outlineCol);
      rectPx(8, lLegY + 2, 2, 4, skinCol);
      rectPx(13, rLegY + 2, 4, 5, outlineCol);
      rectPx(14, rLegY + 2, 2, 4, skinCol);
      // Neon 80s Legwarmers
      const lwCol = opts.legwarmerColor || '#ff2a85';
      rectPx(8, lLegY + 4, 2, 3, lwCol);
      rectPx(14, rLegY + 4, 2, 3, lwCol);
    } else {
      // 80s Blue Jeans / Tracksuit Pants
      rectPx(7, 19, 10, 3, outlineCol);
      rectPx(8, 19, 8, 2, pantsOrSkirtCol);
      rectPx(7, lLegY, 4, 7, outlineCol);
      rectPx(8, lLegY, 2, 6, pantsOrSkirtCol);
      rectPx(13, rLegY, 4, 7, outlineCol);
      rectPx(14, rLegY, 2, 6, pantsOrSkirtCol);
    }

    // Left & Right Roller Skates (Boot + 2 distinct glowing wheels each!)
    rectPx(6, lLegY + 6, 6, 4, outlineCol);
    rectPx(7, lLegY + 6, 4, 3, bootCol);
    rectPx(12, rLegY + 6, 6, 4, outlineCol);
    rectPx(13, rLegY + 6, 4, 3, bootCol);

    if (!opts.isStreetShoes) {
      // Quad Skate Wheels
      rectPx(6, lLegY + 9, 2, 2, wheelCol);
      rectPx(10, lLegY + 9, 2, 2, wheelCol);
      rectPx(12, rLegY + 9, 2, 2, wheelCol);
      rectPx(16, rLegY + 9, 2, 2, wheelCol);

      // 80s Roller-Skate Charms ("80er-Rollschuh-Anhänger") in 16-Bit Pixel View
      if (opts.activeCharm === 'bell') {
        rectPx(10, lLegY + 5, 2, 2, '#fde047');
        rectPx(16, rLegY + 5, 2, 2, '#fde047');
      } else if (opts.activeCharm === 'teddy') {
        rectPx(10, lLegY + 5, 3, 3, '#d97706');
        rectPx(16, rLegY + 5, 3, 3, '#d97706');
      } else if (opts.activeCharm === 'pompons') {
        rectPx(10, lLegY + 5, 2, 2, '#ff2a85');
        rectPx(11, lLegY + 6, 2, 2, '#00f0ff');
        rectPx(16, rLegY + 5, 2, 2, '#ff2a85');
        rectPx(17, rLegY + 6, 2, 2, '#00f0ff');
      } else if (opts.activeCharm === 'dice') {
        rectPx(10, lLegY + 5, 3, 3, '#ffffff');
        rectPx(11, lLegY + 6, 1, 1, '#ff2a85');
        rectPx(16, rLegY + 5, 3, 3, '#ffffff');
        rectPx(17, rLegY + 6, 1, 1, '#ff2a85');
      }
    }
  }

  // Enforce strict transparency on offscreen sprite: set any pixel with alpha < 128 to (0, 0, 0, 0)
  const spriteImgData = sCtx.getImageData(0, 0, spriteW, spriteH);
  const sData = spriteImgData.data;
  for (let i = 0; i < sData.length; i += 4) {
    if (sData[i + 3] < 128) {
      sData[i] = 0;
      sData[i + 1] = 0;
      sData[i + 2] = 0;
      sData[i + 3] = 0;
    } else {
      sData[i + 3] = 255;
    }
  }
  sCtx.putImageData(spriteImgData, 0, 0);

  ctx.save();
  ctx.scale(flipX, 1);
  if (opts.isGhost) {
    ctx.globalAlpha = 0.72 + Math.sin(now * 0.012 + absHash) * 0.1;
  }
  ctx.drawImage(
    offscreen16BitCharCanvas,
    Math.round(-12 * P - ox),
    Math.round(-22 * P - oy)
  );
  ctx.restore();
  ctx.restore();

  if (opts.showName && opts.name) {
    drawRetroNameBadge(
      ctx,
      opts.x,
      opts.y - opts.jumpZ - 38,
      opts.name,
      opts.isGhost ? '#00f0ff' : isCrewOrGuard ? '#39ff14' : opts.accentColor,
      opts.hasMultiplayerStar
    );
  }
  if (opts.speechBubble) {
    const bubbleY =
      opts.showName && opts.name
        ? opts.y - opts.jumpZ - 66
        : opts.y - opts.jumpZ - 48;
    drawSpeechBubble(ctx, opts.x, bubbleY, opts.speechBubble);
  }
}

/**
 * CONCERT LIGHTING OVERLAY ("🔦 KONZERTBELEUCHTUNG"):
 * Dims the surrounding hall with a dark veil (`rgba(5, 6, 18, 0.52)`) while keeping
 * the Live-Band-Bühne cut out and illuminated by sweeping 80s spotlights (Warm White, Magenta, Cyan).
 */
function renderConcertStageSpotlightOverlay(
  ctx: CanvasRenderingContext2D,
  now: number,
  stageCloseProgress: number
): void {
  const { uIslands, rink } = ARENA_LAYOUT;
  const sx = uIslands.closedStageX - 24;
  const sy = uIslands.closedStageY - 26;
  const sw = uIslands.closedStageWidth + 48;
  const sh = uIslands.closedStageHeight + 52;

  ctx.save();
  ctx.fillStyle = `rgba(5, 6, 18, ${0.46 + 0.14 * stageCloseProgress})`;
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.roundRect(sx, sy, sw, sh, 44);
  ctx.fill('evenodd');

  ctx.strokeStyle = 'rgba(255, 42, 133, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 44);
  ctx.stroke();

  const stageSpots = [
    {
      ox: uIslands.closedStageX + 55,
      oy: uIslands.closedStageY + 12,
      tx: rink.centerX - 95 + Math.sin(now * 0.0022) * 85,
      ty: uIslands.closedStageY + 195 + Math.cos(now * 0.0018) * 35,
      colStart: 'rgba(254, 243, 199, 0.28)',
      colEnd: 'rgba(254, 243, 199, 0.02)',
    },
    {
      ox: rink.centerX,
      oy: uIslands.closedStageY + 10,
      tx: rink.centerX + Math.cos(now * 0.0026 + 1.2) * 115,
      ty: uIslands.closedStageY + 215 + Math.sin(now * 0.002) * 30,
      colStart: 'rgba(255, 42, 133, 0.26)',
      colEnd: 'rgba(255, 42, 133, 0.02)',
    },
    {
      ox: uIslands.closedStageX + uIslands.closedStageWidth - 55,
      oy: uIslands.closedStageY + 12,
      tx: rink.centerX + 95 + Math.sin(now * 0.0024 + 2.5) * 85,
      ty: uIslands.closedStageY + 195 + Math.cos(now * 0.0019 + 1) * 35,
      colStart: 'rgba(0, 240, 255, 0.26)',
      colEnd: 'rgba(0, 240, 255, 0.02)',
    },
  ];

  for (const cone of stageSpots) {
    const g = ctx.createLinearGradient(cone.ox, cone.oy, cone.tx, cone.ty);
    g.addColorStop(0, cone.colStart);
    g.addColorStop(1, cone.colEnd);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cone.ox - 10, cone.oy);
    ctx.lineTo(cone.ox + 10, cone.oy);
    ctx.lineTo(cone.tx + 72, cone.ty);
    ctx.lineTo(cone.tx - 72, cone.ty);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}


