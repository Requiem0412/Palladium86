import React, { useEffect, useRef } from 'react';
import {
  ARENA_LAYOUT,
  ArenaVisualStyle,
  BandGenderMode,
  BandSkinToneMode,
  CameraViewMode,
  CenterStageMode,
  ChallengeId,
  ConcertLightingMode,
  CrewNamesConfig,
  DEFAULT_CREW_NAMES,
  HallGameMode,
  LightingMode,
  NeonWristbandColor,
  PlayerCharacterMode,
  ProShopUpgradesState,
  TrickMoveId,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/arenaConfig';
import { soundFX } from '../utils/soundEffects';
import { SingleplayerDifficulty } from '../utils/storageAndStats';

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
}

export interface MultiplayerPlayerState {
  peerId: string;
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
  characterMode: PlayerCharacterMode;
  difficulty: SingleplayerDifficulty;
  hasOwnSkates: boolean;
  hasRentedSkates: boolean;
  drinkChipAvailable: boolean;
  npcVoicesEnabled: boolean;
  skateGuardWhistleEnabled: boolean;
  fullHallPutzlichtEnabled?: boolean;
  pixel16BitFiguresEnabled?: boolean;
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
}

interface TrackNpc {
  id: string;
  name: string;
  gender: 'female' | 'male';
  role: 'regular' | 'speed' | 'guard' | 'ghost' | 'wheelchair-npc';
  orbitAngle: number;
  laneRadiusX: number;
  laneRadiusY: number;
  laneOffset?: number;
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
}

interface NeonSoftball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncesLeft: number;
  color: string;
  fromPlayer: boolean;
  state?: 'HELD' | 'THROWN' | 'FREE';
  holderId?: 'player' | string | null;
  holdTimer?: number;
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
  isOuterSpeedTrack: boolean
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
    const tx = sinA * rx;
    const ty = -cosA * ry;
    return { x: cur.x, y: cur.y, tangentRad: Math.atan2(ty, tx) };
  }

  const pExp = 0.78;
  const rawX =
    centerX + Math.sign(cosA) * Math.pow(Math.abs(cosA), pExp) * rx;
  const rawY =
    centerY + Math.sign(sinA) * Math.pow(Math.abs(sinA), pExp) * ry;
  const cur = deflectCorner(rawX, rawY);

  const dAngle = -0.02;
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
function buildTrackNpcsForDifficulty(diff: SingleplayerDifficulty): TrackNpc[] {
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
      wheelColor: '#00f0ff',
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
    const pt = computeTrackOvalPoint(
      rink.centerX,
      rink.centerY,
      npc.laneRadiusX,
      npc.laneRadiusY,
      npc.orbitAngle,
      npc.role === 'speed'
    );
    return {
      ...npc,
      x: pt.x,
      y: pt.y,
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
  });

  useEffect(() => {
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
  ]);

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
      radius: 26,
      spinAngleOffset: 0,
      isSpinning: false,
      jumpZ: 0,
      jumpVz: 0,
      isJumping: false,
      stridePhase: 0,
      crashTimer: 0,
      consecutiveCrashes: 0,
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
      speechBubble: null as string | null,
      speechTimer: 0,
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

    // Nurse / Paramedic ("SANI-SANDRA") Rescue Sequence State
    // Enters and exits exclusively through one of the two offset Schleusen-Banden!
    const saniNurse = {
      active: false,
      phase: 'idle' as 'idle' | 'running-in' | 'kneeling' | 'walking-out',
      x: 1435,
      y: 912,
      startX: 1435,
      startY: 912,
      gateX: 1435,
      gateY: 842,
      targetX: 1400,
      targetY: 700,
      headingRad: -Math.PI / 2,
      phaseTimer: 0,
      phaseDuration: 3.0,
      speechText: null as string | null,
    };

    const triggerSaniNurseDispatch = (crashX: number, crashY: number) => {
      if (saniNurse.active) return;
      // Pick the nearest of the two offset Schleusen-Banden (Schleuse 1 left x=570, Schleuse 2 right x=1435)
      const useLeftSchleuse = Math.abs(crashX - 570) < Math.abs(crashX - 1435);
      const gateCenterX = useLeftSchleuse ? 570 : 1435;
      const spawnX = useLeftSchleuse ? 495 : 1358;
      const spawnY = 910;
      saniNurse.active = true;
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
      saniNurse.speechText = '🚑 Sani-Sandra eilt durch die Schleuse herbei!';
      speakNpcBubble(saniNurse.speechText, 'SANI-SANDRA', 'female');
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

    // Particles, Trails & Projectiles
    const sparks: SparkParticle[] = [];
    const trails: WheelTrailPoint[] = [];
    const softballs: NeonSoftball[] = [];
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
    // 2. INITIALIZE TRACK NPCS SCALED BY SINGLEPLAYER DIFFICULTY
    // ========================================================================
    const trackNpcs: TrackNpc[] = buildTrackNpcsForDifficulty(initP.difficulty);

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

    const triggerPlayerJump = () => {
      if (player.isJumping || player.crashTimer > 0) return;
      player.isJumping = true;
      const hasHighTopUpgrade = propsRef.current.upgrades.aluPlatesHighTop;
      const hasBlobaKick = player.blobaColaRemainingSec > 0;
      // Shortened jump duration & height impulse (~38% shorter airtime & forward impulse)
      player.jumpVz =
        (hasHighTopUpgrade ? 245 : 205) * (hasBlobaKick ? 1.1 : 1.0);
      player.vx *= 0.8;
      player.vy *= 0.8;
      soundFX.playJump();
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
        player.activeTrickMove = 'starjump';
        player.trickTimer = 0.85;
        player.isSpinning = true;
        player.spinAngleOffset = 0;
        triggerPlayerJump();
        player.jumpVz = Math.max(player.jumpVz, 265);
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

      // 0. Check Rollschuh-Verleih Counter proximity (Redeem Freigetränk-Chip for 80s Rental Skates!)
      const rentalCenterX =
        ARENA_LAYOUT.proShopAndRental.rentalBounds.x +
        ARENA_LAYOUT.proShopAndRental.rentalBounds.width / 2;
      const rentalInteractY = 895;
      const distRental = Math.hypot(
        player.x - rentalCenterX,
        player.y - rentalInteractY
      );
      if (distRental <= 135) {
        if (!p.hasOwnSkates && !p.hasRentedSkates) {
          p.onRedeemDrinkChipAtRental();
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
        if (!p.hasOwnSkates && !p.hasRentedSkates) {
          player.speechBubble =
            '🎟️ Du brauchst deinen Chip zuerst am Rollschuh-Verleih für Leih-Skates!';
          player.speechTimer = 3.5;
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

      // 2. Check Pro-Shop proximity
      const distShop = Math.hypot(
        player.x - ARENA_LAYOUT.proShopAndRental.proShopInteractX,
        player.y - ARENA_LAYOUT.proShopAndRental.proShopInteractY
      );
      if (distShop <= ARENA_LAYOUT.proShopAndRental.proShopInteractRadius) {
        p.onOpenProShopModal();
        return;
      }

      // 2b. Check DJ-Tower proximity for live DJ shoutout with activeDjName!
      const distDj = Math.hypot(
        player.x - ARENA_LAYOUT.djTower.centerX,
        player.y - ARENA_LAYOUT.djTower.centerY
      );
      if (distDj <= 210) {
        const djName = p.activeDjName || 'DJ Magic Force';
        djSpeechBubble = `🎤 "${djName}: Grüße von den Klecknix Twin-Decks ans Palladium Hanau!"`;
        djSpeechTimer = 5.5;
        speakNpcBubble(djSpeechBubble, djName, 'male');
        player.speechBubble = `🎧 Shoutout an ${djName} am Pult!`;
        player.speechTimer = 2.8;
        return;
      }

      // 3. In "Ballspiel" mode: Single-Ball Throw if player is holding the ball (or if ball is near player)
      if (p.hallGameMode === 'ballspiel') {
        const singleBall = softballs[0];
        if (
          singleBall &&
          (singleBall.holderId === 'player' ||
            (singleBall.state === 'FREE' &&
              Math.hypot(singleBall.x - player.x, singleBall.y - player.y) < 75))
        ) {
          const speed = 680;
          singleBall.state = 'THROWN';
          singleBall.holderId = undefined;
          singleBall.x = player.x + Math.cos(player.headingRad) * 28;
          singleBall.y = player.y + Math.sin(player.headingRad) * 28;
          singleBall.vx = Math.cos(player.headingRad) * speed;
          singleBall.vy = Math.sin(player.headingRad) * speed;
          singleBall.bouncesLeft = 2;
          singleBall.color = '#39ff14';
          singleBall.fromPlayer = true;
          soundFX.playBallThrowOrHit(false);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputFocused =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        activeTag === 'SELECT';
      if (isInputFocused) return;

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
        } else if (propsRef.current.hallGameMode === 'stuhlsprung') {
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
      const worldX = ((e.clientX - rect.left) / rect.width) * WORLD_WIDTH;
      const worldY = ((e.clientY - rect.top) / rect.height) * WORLD_HEIGHT;

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

      // Check click on the curved top-left DJ-Pult ("▶ DJ-PULT [KLICK] ◀")
      const { djTower, proShopAndRental } = ARENA_LAYOUT;
      if (
        Math.hypot(worldX - djTower.centerX, worldY - djTower.centerY) <=
        djTower.clickRadius
      ) {
        propsRef.current.onToggleTwitchStream?.();
        return;
      }

      // Check click on Rollschuh-Verleih counter to redeem Freigetränk-Chip for rental skates!
      const rb = proShopAndRental.rentalBounds;
      if (
        worldX >= rb.x &&
        worldX <= rb.x + rb.width &&
        worldY >= rb.y - 45 &&
        worldY <= rb.y + rb.height
      ) {
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
          return;
        }
      }

      // Check click on Pro-Shop showcase
      const sb = proShopAndRental.proShopBounds;
      if (
        worldX >= sb.x &&
        worldX <= sb.x + sb.width &&
        worldY >= sb.y - 40 &&
        worldY <= sb.y + sb.height
      ) {
        propsRef.current.onOpenProShopModal();
        return;
      }

      if (propsRef.current.hallGameMode === 'ballspiel') {
        triggerInteractOrThrowBall();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousedown', handleCanvasClick);

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
        p.hasOwnSkates ||
        p.hasRentedSkates ||
        p.characterMode === 'wheelchair';

      // Sync difficulty roster or starting position when entering the hall or changing pre-entry settings
      if (
        p.difficulty !== prevDifficulty ||
        p.hasOwnSkates !== prevHasOwnSkates ||
        (!prevIsCurtainOpen && p.isCurtainOpen)
      ) {
        if (p.difficulty !== prevDifficulty) {
          prevDifficulty = p.difficulty;
          const nextNpcs = buildTrackNpcsForDifficulty(p.difficulty);
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

      if (p.hallGameMode !== prevHallGameMode) {
        prevHallGameMode = p.hallGameMode;
        if (p.hallGameMode === 'ballspiel') {
          // Lock a fixed 15-NPC participant roster for the Ballspiel round (2 guards + 15 target skaters = 17 total)
          const fullRoster = buildTrackNpcsForDifficulty('pro');
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
              ballspielTargetX: 520 + (sIdx % 5) * 235,
              ballspielTargetY: 220 + Math.floor(sIdx / 5) * 240,
              ballspielRetargetTimer: 0.8 + (sIdx % 4) * 0.45,
            }));
          trackNpcs.splice(0, trackNpcs.length, ...guardsOnly, ...skaters15);
          player.ballspielHits = 0;

          // Initialize strictly ONE single Ballspiel ball held by guard-1
          const g1 = guardsOnly[0];
          softballs.splice(0, softballs.length, {
            x: g1 ? g1.x : 1000,
            y: g1 ? g1.y : 250,
            vx: 0,
            vy: 0,
            bouncesLeft: 2,
            color: '#ff2a85',
            fromPlayer: false,
            state: 'HELD',
            holderId: 'guard-1',
            holdTimer: 1.4,
          });

          djSpeechBubble =
            '🎤 "Jägerball startet! 15 Skater im Spiel — wer getroffen wird, fährt raus!"';
          djSpeechTimer = 5.5;
          speakNpcBubble(djSpeechBubble, p.activeDjName || 'DJ MAGIC FORCE', 'male');
        } else {
          // Restore normal difficulty NPC roster when leaving Ballspiel
          const restoredNpcs = buildTrackNpcsForDifficulty(p.difficulty).map(
            (n) => ({
              ...n,
              eliminated: false,
              eliminatedOrder: undefined,
              hitOutTimer: 0,
            })
          );
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
            djSpeechBubble =
              '🎤 "Slalom-Parcours eröffnet! Zeigt eure saubersten Kurven!"';
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

          for (let b = 0; b < 16; b++) {
            prevPadButtons[b] = isPressed(b);
          }
        }
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
      if (player.medicRescueTimer > 0) {
        player.medicRescueTimer = Math.max(0, player.medicRescueTimer - dt);
      }

      // Update Nurse / Paramedic ("SANI-SANDRA") Rescue Sequence (via nearest Schleusen-Bande!)
      if (saniNurse.active) {
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
            saniNurse.speechText =
              '🩹 Erste Hilfe: Eisspray & Pflaster drauf!';
            speakNpcBubble(saniNurse.speechText, 'SANI-SANDRA', 'female');
            player.crashTimer = Math.max(player.crashTimer, 3.2);
            player.speechBubble = '🩹 Danke, Sani-Sandra!';
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
            saniNurse.speechText = '👍 Wieder fit! Gute Weiterfahrt!';
            speakNpcBubble(saniNurse.speechText, 'SANI-SANDRA', 'female');
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

      // Compact Jump physics (~38% shorter duration via steeper gravity 920)
      if (player.isJumping) {
        player.jumpZ += player.jumpVz * dt;
        player.jumpVz -= 920 * dt;
        if (player.jumpZ <= 0) {
          player.jumpZ = 0;
          player.jumpVz = 0;
          player.isJumping = false;
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

      let inputX = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0) + padAxisX;
      let inputY = (keyDown ? 1 : 0) - (keyUp ? 1 : 0) + padAxisY;
      const inputMag = Math.hypot(inputX, inputY);
      if (inputMag > 1) {
        inputX /= inputMag;
        inputY /= inputMag;
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

      const maxSpeed =
        355 *
        ownSkatesSpeedBonus *
        streetShoesPenalty *
        bearingsMult *
        slushMult *
        slipstreamMult;
      const airControlMult = player.isJumping ? 0.65 : 1.0;
      const accel =
        540 *
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

      // Prevent stepping onto the wooden rink parquet in street shoes (!hasSkatesEquipped)
      const { rink, djTower } = ARENA_LAYOUT;
      if (
        !hasSkatesEquipped &&
        player.x > rink.x - 10 &&
        player.x < rink.x + rink.width + 10 &&
        player.y > rink.y - 10 &&
        player.y < rink.y + rink.height + 8
      ) {
        if (player.y > rink.y + rink.height - 65) {
          player.y = rink.y + rink.height + 12;
          player.vy = Math.max(0, player.vy);
        } else if (player.x < rink.x + 65) {
          player.x = rink.x - 12;
          player.vx = Math.min(0, player.vx);
        } else {
          player.y = rink.y + rink.height + 12;
          player.vy = 0;
        }
        if (player.speechTimer <= 0.4) {
          player.speechBubble =
            '🛑 Erst am Rollschuh-Verleih (unten Mitte) Skates gegen deinen Chip holen! [E]';
          player.speechTimer = 3.2;
          speakNpcBubble(
            'Halt! Nicht mit Straßenschuhen aufs Parkett! Hol dir erst Leih-Rollschuhe am Verleih!',
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

      if (!p.isMultiplayerActive) {
        // Random Barrier-Sitting Event: Every ~13–18s in free-skate (NEVER during Slow-Skating!), a regular NPC sits on the blue outer barrier
        if (p.hallGameMode === 'free-skate' && !isSlowSkating) {
          if (!activeBarrierSitterId) {
            barrierSitTimer -= dt;
            if (barrierSitTimer <= 0) {
              const regulars = trackNpcs.filter(
                (n) => n.role === 'regular' && n.hitOutTimer <= 0
              );
              if (regulars.length > 0) {
                const chosen =
                  regulars[Math.floor(Math.random() * regulars.length)];
                const spot =
                  barrierSitSpots[
                    Math.floor(Math.random() * barrierSitSpots.length)
                  ];
                chosen.sittingBarrierSpot = spot;
                chosen.speechText = 'Kurz auf der Bande sitzen...';
                chosen.speechTimer = 4.5;
                speakNpcBubble(chosen.speechText, chosen.name, chosen.gender);
                activeBarrierSitterId = chosen.id;
              }
              barrierSitTimer = 14 + Math.random() * 6;
            }
          }
        } else if (activeBarrierSitterId) {
          trackNpcs.forEach((n) => {
            n.sittingBarrierSpot = null;
          });
          activeBarrierSitterId = null;
        }

        const activeSitterNpc = activeBarrierSitterId
          ? trackNpcs.find((n) => n.id === activeBarrierSitterId)
          : null;

        // Find nearest Skate Guard to intercept any NPC sitting on the blue barrier
        let assignedBarrierGuardId: string | null = null;
        if (
          !isSlowSkating &&
          activeSitterNpc &&
          activeSitterNpc.sittingBarrierSpot
        ) {
          const guards = trackNpcs.filter((n) => n.role === 'guard');
          if (guards.length > 0) {
            guards.sort(
              (a, b) =>
                Math.hypot(
                  a.x - activeSitterNpc.x,
                  a.y - activeSitterNpc.y
                ) -
                Math.hypot(b.x - activeSitterNpc.x, b.y - activeSitterNpc.y)
            );
            assignedBarrierGuardId = guards[0].id;
          }
        }

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

          // Eliminated Ballspiel KIs skate out through the nearest Schleusen-Bande and line up cleanly in Zone A (benches right) & Zone B (bottom railing) with 58–60px spacing!
          if (npc.eliminated) {
            const orderIdx =
              typeof npc.eliminatedOrder === 'number'
                ? npc.eliminatedOrder
                : npcIdx;
            // Zone A: first 5 eliminated skaters at right benches / back right (x = 1762, y = 210..450, 60px spacing)
            // Zone B: remaining eliminated skaters along the entire bottom railing (x = 460..1480, y = 905, 62px spacing)
            const isZoneA = orderIdx < 5;
            const targetStandX = isZoneA
              ? 1762
              : 455 + (orderIdx - 5) * 68;
            const targetStandY = isZoneA ? 210 + orderIdx * 60 : 906;

            const useRightSchleuse =
              isZoneA || Math.abs(npc.x - 1435) < Math.abs(npc.x - 570);
            const gateCenterX = useRightSchleuse ? 1435 : 570;
            const gateGapExitX = useRightSchleuse ? 1512 : 495;
            const gateY = 860;

            if (npc.y < gateY - 4 && npc.x < 1715) {
              // Step 1: Inside the rink -> skate to the Schleuse opening at y = 858
              const dxE = gateCenterX - npc.x;
              const dyE = gateY + 6 - npc.y;
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
            } else if (npc.y < 898 && npc.x < 1715) {
              // Step 2: Route around the offset Schleusen-Bande baffle (baffleY = 888) into the outer corridor (y = 904)
              const dxG = gateGapExitX - npc.x;
              const dyG = 904 - npc.y;
              const distG = Math.max(1, Math.hypot(dxG, dyG));
              npc.vx = (dxG / distG) * 250;
              npc.vy = (dyG / distG) * 250;
              npc.x += npc.vx * dt;
              npc.y += npc.vy * dt;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dyG, dxG),
                dt * 10
              );
            } else {
              // Step 3: Glide to assigned spectator spot in Zone A or Zone B with clean 60px spacing
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

          // If an active AI skater is ever outside the rink barrier (e.g. in the Bistro or Foyer), route them actively through the nearest Schleusen-Bande onto the track!
          if (
            !npc.sittingBarrierSpot &&
            (npc.x < rink.x + 14 ||
              npc.x > rink.x + rink.width - 14 ||
              npc.y > rink.y + rink.height - 8)
          ) {
            const useLeft = Math.abs(npc.x - 570) < Math.abs(npc.x - 1435);
            const entryX = useLeft ? 570 : 1435;
            const entryY = 820;
            const dxIn = entryX - npc.x;
            const dyIn = entryY - npc.y;
            const distIn = Math.max(1, Math.hypot(dxIn, dyIn));
            const spdIn = 260;
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

            // Check if this NPC is the closest chaser to a FREE ball
            let chasingFreeBall = false;
            if (singleBall && singleBall.state === 'FREE') {
              if (npc.role === 'guard') {
                chasingFreeBall = true;
              } else {
                const dBall = Math.hypot(
                  singleBall.x - npc.x,
                  singleBall.y - npc.y
                );
                if (dBall < 290) {
                  chasingFreeBall = true;
                }
              }
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

            // Keep Ballspiel skaters out of the center U-islands (`[` and `]`)
            if (
              npc.x > 690 &&
              npc.x < 1310 &&
              npc.y > 350 &&
              npc.y < 618
            ) {
              if (npc.y < rink.centerY) {
                npc.y = 348;
                npc.vy = -Math.abs(npc.vy);
              } else {
                npc.y = 620;
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

          if (!isSlowSkating && npc.sittingBarrierSpot) {
            const spot = npc.sittingBarrierSpot;
            npc.x += (spot.x - npc.x) * Math.min(1, dt * 4.5);
            npc.y += (spot.y - npc.y) * Math.min(1, dt * 4.5);
            npc.vx = 0;
            npc.vy = 0;
            npc.headingRad = rotateShortest(
              npc.headingRad,
              spot.normalRad,
              dt * 8
            );
            return;
          }

          if (
            !isSlowSkating &&
            npc.id === assignedBarrierGuardId &&
            activeSitterNpc &&
            activeSitterNpc.sittingBarrierSpot
          ) {
            const spot = activeSitterNpc.sittingBarrierSpot;
            const targetGuardX = spot.x + Math.cos(spot.normalRad) * 48;
            const targetGuardY = spot.y + Math.sin(spot.normalRad) * 48;
            const dxG = targetGuardX - npc.x;
            const dyG = targetGuardY - npc.y;
            const distG = Math.hypot(dxG, dyG);

            if (distG > 22) {
              const stepG = Math.min(distG, 360 * dt);
              npc.vx = (dxG / distG) * 360;
              npc.vy = (dyG / distG) * 360;
              npc.x += (dxG / distG) * stepG;
              npc.y += (dyG / distG) * stepG;
              npc.headingRad = rotateShortest(
                npc.headingRad,
                Math.atan2(dyG, dxG),
                dt * 12
              );
            } else {
              if (p.skateGuardWhistleEnabled) {
                soundFX.playSkateGuardWhistle();
              }
              npc.speechText = '📣 TRILLER! Nicht auf der Bande sitzen!';
              npc.speechTimer = 3.4;
              speakNpcBubble(npc.speechText, npc.name, npc.gender);
              activeSitterNpc.sittingBarrierSpot = null;
              activeSitterNpc.speechText = 'Ups, schon wieder unten!';
              activeSitterNpc.speechTimer = 2.4;
              activeSitterNpc.x += Math.cos(spot.normalRad) * 44;
              activeSitterNpc.y += Math.sin(spot.normalRad) * 44;
              activeBarrierSitterId = null;
              barrierSitTimer = 15 + Math.random() * 6;
            }
            return;
          }

          const coupleCfg =
            isSlowSkating && p.hallGameMode === 'free-skate'
              ? slowSkateCouples[npc.id]
              : undefined;

          const trainSlotIdx = shuffleTrainMemberIds.indexOf(npc.id);

          if (trainSlotIdx !== -1) {
            // Synchronized 4-skater Shuffle-Skate-Train gliding rhythmically on the middle lane!
            const trainLeader = trackNpcs.find(
              (n) => n.id === shuffleTrainMemberIds[0]
            );
            if (trainSlotIdx === 0) {
              npc.orbitAngle = normalizeAngle(npc.orbitAngle - 0.52 * dt);
            } else if (trainLeader) {
              npc.orbitAngle = normalizeAngle(
                trainLeader.orbitAngle + trainSlotIdx * 0.115
              );
            }
            const trainSway = Math.sin(now * 0.0085 - trainSlotIdx * 0.55) * 14;
            const trackPt = computeTrackOvalPoint(
              rink.centerX,
              rink.centerY,
              548 + trainSway,
              274 + trainSway * 0.5,
              npc.orbitAngle,
              false
            );
            npc.vx = (trackPt.x - npc.x) / Math.max(0.016, dt);
            npc.vy = (trackPt.y - npc.y) / Math.max(0.016, dt);
            npc.x = trackPt.x;
            npc.y = trackPt.y;
            npc.headingRad = rotateShortest(
              npc.headingRad,
              trackPt.tangentRad,
              dt * 15
            );
          } else if (coupleCfg) {
            if (!coupleCfg.isBackwardsPartner) {
              npc.orbitAngle = normalizeAngle(
                npc.orbitAngle - coupleCfg.orbitSpeed * dt
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
              coupleCfg.rx > 600
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
            npc.x = targetX;
            npc.y = targetY;

            const desiredHeading = coupleCfg.isBackwardsPartner
              ? normalizeAngle(trackPt.tangentRad + Math.PI)
              : trackPt.tangentRad;

            npc.headingRad = rotateShortest(
              npc.headingRad === 0 ? desiredHeading : npc.headingRad,
              desiredHeading,
              dt * 14
            );
          } else {
            const speedMult = isSlowSkating ? 0.58 : 1.0;
            npc.orbitAngle = normalizeAngle(
              npc.orbitAngle - npc.baseSpeed * speedMult * dt
            );

            const effectiveRx = npc.laneRadiusX + (npc.laneOffset || 0);
            const effectiveRy = npc.laneRadiusY + (npc.laneOffset || 0) * 0.5;
            const trackPt = computeTrackOvalPoint(
              rink.centerX,
              rink.centerY,
              effectiveRx,
              effectiveRy,
              npc.orbitAngle,
              npc.role === 'speed'
            );

            let targetX = trackPt.x;
            let targetY = trackPt.y;

            if (npc.role === 'regular' && !isSlowSkating) {
              const sway = Math.sin(now * 0.004 + npc.laneRadiusX) * 10;
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

            const dx = targetX - npc.x;
            const dy = targetY - npc.y;
            npc.vx = dx / Math.max(0.016, dt);
            npc.vy = dy / Math.max(0.016, dt);
            npc.x = targetX;
            npc.y = targetY;

            npc.headingRad = rotateShortest(
              npc.headingRad === 0 ? trackPt.tangentRad : npc.headingRad,
              trackPt.tangentRad,
              dt * 14
            );

            if (npc.role === 'speed' && !isSlowSkating) {
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
          clampPointInsideRoundedRink(npc, 24);

          // Skate Guard wrong-way (Geisterfahrer) whistle check
          if (npc.role === 'guard' && onRinkFloor && speed > 130) {
            const distGuard = Math.hypot(player.x - npc.x, player.y - npc.y);
            const angleDiff = Math.abs(
              normalizeAngle(player.headingRad - npc.headingRad)
            );
            if (distGuard < 210 && angleDiff > 2.35 && npc.speechTimer <= 0) {
              npc.speechText = 'Trrriiiiieeeet! Gegen den Uhrzeigersinn!';
              npc.speechTimer = 2.8;
              player.cleanLapsStreak = 0;
              if (p.skateGuardWhistleEnabled) {
                soundFX.playSkateGuardWhistle();
              }
              speakNpcBubble(npc.speechText, npc.name, npc.gender);
            }
          }

          // Player <-> NPC Collision
          if (!player.isJumping && player.medicRescueTimer <= 0) {
            const dist = Math.hypot(player.x - npc.x, player.y - npc.y);
            const minDist = player.radius + 24;
            if (dist < minDist && dist > 0.1) {
              const nx = (player.x - npc.x) / dist;
              const ny = (player.y - npc.y) / dist;
              const overlap = minDist - dist;
              player.x += nx * overlap;
              player.y += ny * overlap;

              const relSpeed = Math.hypot(
                player.vx - npc.vx,
                player.vy - npc.vy
              );
              if (relSpeed > 250 && player.crashTimer <= 0) {
                player.crashTimer = 3.4;
                player.totalCrashes += 1;
                player.consecutiveCrashes += 1;
                player.vx = nx * 120;
                player.vy = ny * 120;
                player.speechBubble = 'Autsch! Sturz auf dem Parkett!';
                player.speechTimer = 3.0;
                npc.speechText = 'Uff! Alles okay?!';
                npc.speechTimer = 2.4;
                speakNpcBubble(npc.speechText, npc.name, npc.gender);

                triggerSaniNurseDispatch(player.x, player.y);

                if (player.consecutiveCrashes >= 3) {
                  player.consecutiveCrashes = 0;
                  player.medicRescueTimer = 6.5;
                  player.speechBubble =
                    '🚑 Sanitäterin Sani-Sandra übernimmt die Erstversorgung!';
                  player.speechTimer = 4.0;
                  soundFX.playCrash(true);
                  if (p.skateGuardWhistleEnabled) {
                    soundFX.playSkateGuardWhistle();
                  }
                } else {
                  soundFX.playCrash(false);
                }
              } else {
                player.vx += nx * 130;
                player.vy += ny * 130;
                if (player.speechTimer <= 0) {
                  player.speechBubble = Math.random() > 0.5 ? 'Ey!' : 'Uff!';
                  player.speechTimer = 1.2;
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

      // ----------------------------------------------------------------------
      // G. HALLEN-SPIELE LOGIC (SINGLE-BALL BALLSPIEL, SLALOM, STUHLSPRUNG)
      // ----------------------------------------------------------------------
      if (p.hallGameMode === 'ballspiel') {
        // Strictly ONE single Ball object on the rink (`state: 'HELD' | 'THROWN' | 'FREE'`)
        if (softballs.length === 0) {
          const g1 = trackNpcs.find((n) => n.id === 'guard-1');
          softballs.push({
            x: g1 ? g1.x : rink.centerX,
            y: g1 ? g1.y : rink.centerY - 190,
            vx: 0,
            vy: 0,
            bouncesLeft: 2,
            color: '#ff2a85',
            fromPlayer: false,
            state: 'HELD',
            holderId: g1 ? g1.id : 'guard-1',
            holdTimer: 1.2,
          });
        } else if (softballs.length > 1) {
          softballs.splice(1);
        }

        const ball = softballs[0];
        if (!ball.state) ball.state = 'FREE';

        if (ball.state === 'HELD') {
          if (ball.holderId === 'player') {
            ball.x = player.x + Math.cos(player.headingRad) * 24;
            ball.y = player.y + Math.sin(player.headingRad) * 24;
            ball.vx = player.vx;
            ball.vy = player.vy;
            ball.color = '#39ff14';
          } else {
            const holderNpc = trackNpcs.find(
              (n) => n.id === ball.holderId && !n.eliminated
            );
            if (!holderNpc) {
              ball.state = 'FREE';
              ball.holderId = undefined;
            } else {
              ball.x = holderNpc.x + Math.cos(holderNpc.headingRad) * 22;
              ball.y = holderNpc.y + Math.sin(holderNpc.headingRad) * 22;
              ball.vx = holderNpc.vx;
              ball.vy = holderNpc.vy;
              ball.color = '#ff2a85';
              ball.holdTimer = (ball.holdTimer ?? 1.1) - dt;
              if ((ball.holdTimer ?? 0) <= 0) {
                // Throw at nearest active target skater!
                const activeTargets = trackNpcs.filter(
                  (n) =>
                    n.role !== 'guard' &&
                    !n.eliminated &&
                    n.id !== holderNpc.id
                );
                if (activeTargets.length > 0) {
                  activeTargets.sort(
                    (a, b) =>
                      Math.hypot(a.x - holderNpc.x, a.y - holderNpc.y) -
                      Math.hypot(b.x - holderNpc.x, b.y - holderNpc.y)
                  );
                  const target = activeTargets[0];
                  const throwAng = Math.atan2(
                    target.y - holderNpc.y,
                    target.x - holderNpc.x
                  );
                  const throwSpd = 610;
                  ball.state = 'THROWN';
                  ball.holderId = undefined;
                  ball.vx = Math.cos(throwAng) * throwSpd;
                  ball.vy = Math.sin(throwAng) * throwSpd;
                  ball.bouncesLeft = 2;
                  ball.fromPlayer = false;
                  soundFX.playBallThrowOrHit(false);
                } else {
                  ball.holdTimer = 1.5;
                }
              }
            }
          }
        } else {
          // Ball is THROWN or FREE -> integrate velocity, drag & hard barrier / U-island reflection!
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          const drag = ball.state === 'FREE' ? 0.965 : 0.992;
          ball.vx *= Math.pow(drag, dt * 60);
          ball.vy *= Math.pow(drag, dt * 60);

          // Bounce off outer rink barriers (never escapes through barriers or Schleusen!)
          const minBx = rink.x + 22;
          const maxBx = rink.x + rink.width - 22;
          const minBy = rink.y + 22;
          const maxBy = rink.y + rink.height - 22;

          if (ball.x < minBx) {
            ball.x = minBx;
            ball.vx = Math.abs(ball.vx) * 0.78;
            if (ball.state === 'THROWN') ball.state = 'FREE';
          } else if (ball.x > maxBx) {
            ball.x = maxBx;
            ball.vx = -Math.abs(ball.vx) * 0.78;
            if (ball.state === 'THROWN') ball.state = 'FREE';
          }
          if (ball.y < minBy) {
            ball.y = minBy;
            ball.vy = Math.abs(ball.vy) * 0.78;
            if (ball.state === 'THROWN') ball.state = 'FREE';
          } else if (ball.y > maxBy) {
            ball.y = maxBy;
            ball.vy = -Math.abs(ball.vy) * 0.78;
            if (ball.state === 'THROWN') ball.state = 'FREE';
          }

          // Also keep inside rounded corners & DJ-Tower curve
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
            if (ball.state === 'THROWN') ball.state = 'FREE';
          }

          const ballSpd = Math.hypot(ball.vx, ball.vy);
          if (ball.state === 'THROWN' && ballSpd < 165) {
            ball.state = 'FREE';
          }

          if (ball.state === 'THROWN') {
            for (const npc of trackNpcs) {
              if (npc.role === 'guard' || npc.eliminated || npc.hitOutTimer > 0)
                continue;
              if (Math.hypot(ball.x - npc.x, ball.y - npc.y) < 34) {
                const elimCountSoFar = trackNpcs.filter(
                  (n) => n.eliminated
                ).length;
                npc.eliminated = true;
                npc.eliminatedOrder = elimCountSoFar;
                npc.sittingBarrierSpot = null;
                npc.speechText = 'Abgeworfen! Ich fahre durch die Schleuse raus!';
                npc.speechTimer = 3.2;
                speakNpcBubble(npc.speechText, npc.name, npc.gender);
                soundFX.playBallThrowOrHit(true);
                if (ball.fromPlayer) {
                  player.ballspielHits += 1;
                  p.onChallengeProgress('ballspiel_5_hits', 1);
                }
                // After hit, ball rebounds and drops FREE onto the parquet!
                ball.state = 'FREE';
                ball.vx = -ball.vx * 0.35;
                ball.vy = -ball.vy * 0.35;
                ball.fromPlayer = false;
                break;
              }
            }
          } else if (ball.state === 'FREE') {
            // Player can pick up the FREE ball by skating over it
            if (
              onRinkFloor &&
              Math.hypot(ball.x - player.x, ball.y - player.y) < 42
            ) {
              ball.state = 'HELD';
              ball.holderId = 'player';
              ball.fromPlayer = true;
              player.speechBubble =
                '🏐 Ball aufgenommen! [E] / [Klick] zum Abwerfen!';
              player.speechTimer = 2.2;
            } else {
              // Nearest guard or active skater picks up the FREE ball
              for (const npc of trackNpcs) {
                if (npc.eliminated || npc.hitOutTimer > 0) continue;
                if (Math.hypot(ball.x - npc.x, ball.y - npc.y) < 38) {
                  ball.state = 'HELD';
                  ball.holderId = npc.id;
                  ball.holdTimer = 0.9 + Math.random() * 0.7;
                  ball.fromPlayer = false;
                  break;
                }
              }
            }
          }
        }
      } else {
        softballs.length = 0;
      }

      if (p.hallGameMode === 'slalom') {
        for (const cone of slalomCones) {
          if (cone.wobbleTimer > 0) {
            cone.wobbleTimer = Math.max(0, cone.wobbleTimer - dt);
          }
          const dist = Math.hypot(player.x - cone.x, player.y - cone.y);
          if (dist < 28 && !player.isJumping) {
            if (cone.wobbleTimer <= 0) {
              cone.wobbleTimer = 1.5;
              player.slalomCombo = 0;
              player.speechBubble = 'Hütchen berührt!';
              player.speechTimer = 1.2;
              soundFX.playCrash(false);
            }
          } else if (dist < 64 && dist >= 28 && !cone.passed) {
            cone.passed = true;
            player.slalomCombo += 1;
            soundFX.playSlalomCombo(player.slalomCombo);
            p.onChallengeProgress('slalom_10_gates', player.slalomCombo, true);
            window.setTimeout(() => {
              cone.passed = false;
            }, 3500);
          }
        }
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
                const clearedCount = jumpChairs.filter(
                  (c) => c.clearedInLap
                ).length;

                if (clearedCount >= jumpChairs.length) {
                  player.speechBubble = `🏆 Komplette Stuhl-Runde (${jumpChairs.length}/${jumpChairs.length}) gemeistert!`;
                  player.speechTimer = 2.6;
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
        jrEasterEggTimer
      );

      // Mirror main canvas onto the Admin Live-Monitor / Rückfahrkamera canvas if open.
      // When the admin clicks a style card in "BAHN-STYLES & EPOCHEN-LOOKS" (`p.monitorPreviewStyle`),
      // render that selected style directly into the Live-Monitor in real time!
      const monitorEl = document.getElementById(
        'admin-live-monitor-canvas'
      ) as HTMLCanvasElement | null;
      if (monitorEl) {
        const mCtx = monitorEl.getContext('2d');
        if (mCtx) {
          mCtx.imageSmoothingEnabled = false;
          const previewStyle = p.monitorPreviewStyle || arenaStyleRef.current;
          if (previewStyle !== arenaStyleRef.current) {
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
              jrEasterEggTimer
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
            Math.hypot(player.x - rentalCenterX, player.y - 895) <= 135,
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
      window.removeEventListener('gamepadconnected', onGamepadConn);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconn);
      canvas.removeEventListener('mousedown', handleCanvasClick);
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
 * Keeps AI track skaters strictly inside the rounded blue rink barrier (including
 * the right side x = 1710 and the bottom-right / bottom-left rounded corners r = 190).
 */
function clampPointInsideRoundedRink(
  entity: { x: number; y: number; vx?: number; vy?: number },
  margin = 24
): void {
  const { rink, djTower } = ARENA_LAYOUT;
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

  // 3d. Bottom Rink Barrier straight segments (open ONLY at Schleusen-Bande 1 [485..655] and Schleusen-Bande 2 [1345..1525])
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

  // Offset parallel Schleusen-Banden (baffle barriers at y = 888 in front of the two bottom openings)
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

  // 4. 90°-Rotated Center U-Islands (`[` on the Left and `]` on the Right) OR Closed Center Stage
  const w = uIslands.width;
  const h = uIslands.height;
  const t = uIslands.wallThickness;
  const topY = uIslands.topY;

  if (stageCloseProgress > 0.4) {
    collideBox(
      uIslands.closedStageX,
      uIslands.closedStageY,
      uIslands.closedStageWidth,
      uIslands.closedStageHeight
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

  // 6. Pushed-Back Bottom-Left Bistro Counter & Marble Tables
  collideBox(
    bistro.counter.x,
    bistro.counter.y,
    bistro.counter.width,
    bistro.counter.height
  );
  for (const mt of bistro.marbleTables) {
    const dx = player.x - mt.x;
    const dy = player.y - mt.y;
    const dist = Math.hypot(dx, dy);
    const minDist = mt.radius + 10 + r;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      player.x = mt.x + nx * minDist;
      player.y = mt.y + ny * minDist;
    }
  }

  // 7. Compact Cashier Booth -> Right-Shifted Pro-Shop -> Rollschuhverleih
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
  collideBox(
    proShopAndRental.rentalBounds.x,
    proShopAndRental.rentalBounds.y,
    proShopAndRental.rentalBounds.width,
    proShopAndRental.rentalBounds.height
  );
}

// ============================================================================
// WIDESCREEN 2D/2.5D RENDERER (ALL ZONES, CURVED DJ-TOWER, KENGOL BREAKDANCERS)
// ============================================================================

let activeArenaStyle: ArenaVisualStyle = 'classic-neon';
let activePixel16BitFigures = false;
let activeCrewNames: CrewNamesConfig = { ...DEFAULT_CREW_NAMES };

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
    characterMode: PlayerCharacterMode;
    cameraMode: CameraViewMode;
    lightingMode: LightingMode;
    centerStageMode: CenterStageMode;
    concertLightingMode: ConcertLightingMode;
    arenaStyle: ArenaVisualStyle;
    fullHallPutzlichtEnabled?: boolean;
    pixel16BitFiguresEnabled?: boolean;
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
    phase: 'idle' | 'running-in' | 'kneeling' | 'walking-out';
    x: number;
    y: number;
    headingRad: number;
    speechText: string | null;
  },
  jrEasterEggTimer = 0
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

  // Draw the TWO parallel offset Schleusen-Banden (Baffle Barriers at y = 888) in the exact same turquoise/cyan barrier style:
  const drawSchleusenBaffle = (
    bxStart: number,
    bxEnd: number,
    by: number,
    openStart: number,
    openEnd: number
  ) => {
    // Subtle entry/exit floor arrows on the gap sides
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(openStart + 10, rink.y + rink.height - 10);
    ctx.lineTo(openStart + 10, by + 10);
    ctx.moveTo(openEnd - 10, rink.y + rink.height - 10);
    ctx.lineTo(openEnd - 10, by + 10);
    ctx.stroke();
    ctx.restore();

    // Main turquoise offset baffle barrier
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

  // 4. SLOPED 2.5D TOP BACK WALL + VERTICAL 90° LEFT MIRROR WALL + KENGOL BREAKDANCERS + PUTZRAUM DOOR
  renderSloped25DBackWallAndVerticalMirror(
    ctx,
    now,
    p.showNames,
    isBlacklight,
    djHandsUpActive
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
    p.showNames,
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
    activeBallspielPlayersCount
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
    p.showNames,
    isBlacklight,
    djSpeechBubble
  );

  // 7. HALL TOUR: RIGHT WALL GLASS FACADE, COMPACT SIDE-WINDOW CASHIER + SECURITY-SAMMY -> PRO-SHOP -> VERLEIH -> BISTRO
  renderHallTourZonesAndStaff(
    ctx,
    now,
    p.showNames,
    isBlacklight,
    p.hasOwnSkates || p.hasRentedSkates,
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
    }

    for (const npc of trackNpcs) {
      const isNpcBackward =
        p.hallGameMode !== 'ballspiel' &&
        (npc.id === 'couple-b-1' ||
          (isSlowSkating &&
            p.hallGameMode === 'free-skate' &&
            (npc.id === 'reg-2' || npc.id === 'speed-2' || npc.id === 'speed-4')));
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
        showName: p.showNames,
        isBlacklight,
        crashTimer: npc.crashTimer,
        speechBubble: npc.speechText,
        isBackwardGliding: isNpcBackward,
        wristbandColor:
          npc.role === 'speed'
            ? 'cyan'
            : npc.role === 'guard'
            ? 'green'
            : undefined,
      });
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
          showName: p.showNames,
          isBlacklight,
          crashTimer: 0,
          speechBubble: null,
        });
      });
    }
  }

  // 9b. RENDER CONNECTED HUMAN MULTIPLAYER SKATERS (WITH SMOOTH INTERPOLATION, TRICK MOVES, NEON WRISTBANDS & GOLDEN/TURQUOISE STAR BADGE!)
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
        showName: p.showNames,
        isBlacklight,
        crashTimer: rp.crashTimer || 0,
        speechBubble: rp.speechBubble || null,
        hasMultiplayerStar: true,
        activeTrickMove: rp.activeTrickMove || null,
        isBackwardGliding: rp.activeTrickMove === 'backward',
        wristbandColor: rp.wristbandColor,
      });
    }
  }

  // 10. RENDER PLAYER CHARACTER (Supports [H] Kengol-Bucket-Hat, 80s Trick Moves [1]-[4], & Neon Wristbands!)
  const displayPlayerName =
    p.isAnonymousGuest || !p.playerName.trim() ? '' : p.playerName.trim();

  const playerHasSkates =
    p.characterMode === 'wheelchair' || p.hasOwnSkates || p.hasRentedSkates;

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
    accentColor: '#39ff14',
    wheelColor: p.kengolHatEnabled
      ? '#ff2a85'
      : p.hasOwnSkates
      ? '#39ff14'
      : '#38bdf8',
    kengolHat: p.kengolHatEnabled,
    kengoShoesWhitePink: p.kengolHatEnabled,
    isStreetShoes: !playerHasSkates,
    isRentalSkates: !p.hasOwnSkates && p.hasRentedSkates && !p.kengolHatEnabled,
    isCustomOwnSkates: p.hasOwnSkates && !p.kengolHatEnabled,
    name: displayPlayerName,
    showName: p.showNames && displayPlayerName.length > 0,
    isBlacklight,
    crashTimer: player.crashTimer,
    speechBubble: player.speechBubble,
    underglowColor:
      p.upgrades.underglowEnabled && playerHasSkates
        ? p.upgrades.underglowColor
        : undefined,
    hasMultiplayerStar: Boolean(p.isMultiplayerActive),
    activeTrickMove: player.activeTrickMove,
    isBackwardGliding: player.activeTrickMove === 'backward',
    wristbandColor: p.upgrades.wristbandsEnabled
      ? p.upgrades.wristbandColor
      : undefined,
  });

  // Render Nurse / Paramedic ("SANI-SANDRA") in White Coat with Red Cross Symbol when active!
  if (saniNurse.active) {
    renderSaniNurseSprite(ctx, now, saniNurse, p.showNames);
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
  for (const item of deferredOverlayQueue) {
    if (item.kind === 'bubble') {
      drawSpeechBubble(ctx, item.worldX, item.worldY, item.text);
    }
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

// ============================================================================
// SUB-RENDERERS: 2.5D BACK WALL, VERTICAL LEFT MIRROR WALL & KENGOL BREAKDANCERS
// ============================================================================

function renderSloped25DBackWallAndVerticalMirror(
  ctx: CanvasRenderingContext2D,
  now: number,
  showNames: boolean,
  isBlacklight: boolean,
  djHandsUpActive: boolean
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

    // 80s geometric zig-zag / triangle ornaments Left & Right of the center neon sign
    [630, 1480].forEach((ox) => {
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
    ctx.restore();
  }

  ctx.restore();

  // 2. ELEGANT 80s CUT-OUT NEON SIGN "PALLADIUM HANAU" + NEON WINGED ROLLER SKATE & PULSATING PA SPEAKER BOXES
  // (All three poster boxes removed from the upper back wall; pure cut-out glowing neon tubes directly on the dark back wall!)
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

  // 4. FLUSH "PUTZRAUM" DOOR ON THE LEFT OUTER WALL (Between Mirror Wall and Bistro)
  ctx.save();
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
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

  // Door handle & keyhole on the right inner edge
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(
    putzraumDoor.x + putzraumDoor.width - 4,
    putzraumDoor.y + putzraumDoor.height / 2,
    2.5,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // Retro door plate "PUTZRAUM"
  ctx.save();
  ctx.translate(
    putzraumDoor.x + putzraumDoor.width / 2,
    putzraumDoor.y + putzraumDoor.height / 2
  );
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.2;
  ctx.fillRect(-34, -7, 68, 14);
  ctx.strokeRect(-34, -7, 68, 14);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
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

  // 1. CUT-OUT NEON WINGED ROLLER SKATE (Pure glowing neon line drawing on the left side of the sign!)
  ctx.save();
  ctx.translate(-172, 2);
  ctx.scale(1.18, 1.18);

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

  // 4 Glowing Neon-Pink Roller Wheels (Rotating neon spokes!)
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

  // 2. CUT-OUT 80s NEON TUBES: "✦✦ PALLADIUM HANAU ✦✦"
  ctx.save();
  ctx.translate(42, 0);

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
 * Oval Emblem: "ROLLER DISCO Palladium – HANAU-Grimm Center"
 * Dark-blue oval sign with gold border, white arched "ROLLER DISCO",
 * sweeping red retro script "Palladium", and "HANAU-Grimm Center" below.
 * Rendered on the Cashier Booth roof and inside the Pro-Shop!
 */
function drawRollerDiscoOvalEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  isBlacklight: boolean
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const scale = rx / 108;
  ctx.scale(scale, scale);
  const baseRx = 108;
  const baseRy = ry / scale;

  if (isBlacklight) {
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 15;
  }

  // Dark-blue oval sign with double gold rim
  ctx.fillStyle = isBlacklight ? '#0c1333' : '#0f172a';
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, baseRx, baseRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(253, 224, 71, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, baseRx - 5, baseRy - 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // White arched top text "ROLLER DISCO"
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ ROLLER DISCO ★', 0, -baseRy * 0.48);

  // Sweeping red retro script "Palladium"
  if (isBlacklight) {
    ctx.shadowColor = '#ff2a85';
    ctx.shadowBlur = 12;
  }
  ctx.font = 'italic 900 20px "Outfit", serif';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2.2;
  ctx.strokeText('Palladium', 0, 2);
  ctx.fillStyle = isBlacklight ? '#ff2a85' : '#ef4444';
  ctx.fillText('Palladium', 0, 2);
  ctx.shadowBlur = 0;

  // Bottom text "HANAU-Grimm Center"
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.fillText('HANAU-Grimm Center', 0, baseRy * 0.56);

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
  ballspielPlayersRemaining = 15
): void {
  const { rink, uIslands } = ARENA_LAYOUT;
  const w = uIslands.width;
  const h = uIslands.height;
  const t = uIslands.wallThickness;
  const topY = uIslands.topY;

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
    const boardX = rink.centerX - boardW / 2;
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
      rink.centerX,
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
            baseX: rink.centerX - 48,
            baseY: rink.centerY - 54,
            col: '#38bdf8',
            legwarmerColor: '#ff2a85',
            bootCol: 'white' as const,
            idx: 0,
          },
          {
            name: 'Spin-Sammy',
            gender: 'male' as const,
            baseX: rink.centerX + 48,
            baseY: rink.centerY - 54,
            col: '#39ff14',
            legwarmerColor: undefined,
            bootCol: 'black' as const,
            idx: 1,
          },
          {
            name: 'Boogie-Bea',
            gender: 'female' as const,
            baseX: rink.centerX - 48,
            baseY: rink.centerY + 58,
            col: '#ff2a85',
            legwarmerColor: '#00f0ff',
            bootCol: 'white' as const,
            idx: 2,
          },
          {
            name: 'Groove-Gino',
            gender: 'male' as const,
            baseX: rink.centerX + 48,
            baseY: rink.centerY + 58,
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
      ctx.fillText(`★ LIVE: ${activeBandName} ★`, rink.centerX, sy + 37);

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
          tx: rink.centerX - 118,
          ty: sy + 162,
          col: '#ef4444', // Red
          rgba: '239, 68, 68',
        },
        {
          sx: trussX + 86,
          tx: rink.centerX - 118,
          ty: sy + 162,
          col: '#f59e0b', // Warm Yellow/Amber
          rgba: '245, 158, 11',
        },
        {
          sx: trussX + 144,
          tx: rink.centerX,
          ty: sy + 92,
          col: '#00f0ff', // Neon Blue
          rgba: '0, 240, 255',
        },
        {
          sx: trussX + 204,
          tx: rink.centerX,
          ty: sy + 242,
          col: '#39ff14', // Emerald Green
          rgba: '57, 255, 20',
        },
        {
          sx: trussX + 262,
          tx: rink.centerX + 118,
          ty: sy + 162,
          col: '#ff2a85', // Magenta
          rgba: '255, 42, 133',
        },
        {
          sx: trussX + 320,
          tx: rink.centerX + 118,
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

      // 1) REAR DRUMMER (at bx = rink.centerX, by = sy + 92)
      {
        const bx = rink.centerX;
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

      // 2) LEFT STANDING GUITARIST (at bx = rink.centerX - 118, by = sy + 162)
      {
        const bx = rink.centerX - 118;
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

      // 3) RIGHT STANDING GUITARIST / KEYTARIST (at bx = rink.centerX + 118, by = sy + 162)
      {
        const bx = rink.centerX + 118;
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

      // 4) FRONTMAN / LEAD SINGER WITH MICROPHONE STAND (at bx = rink.centerX, by = sy + 242)
      {
        const bx = rink.centerX;
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
      const projX = rink.centerX;
      const projY = scr.y + scr.height + 54;

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

      // 1. White Structural Center Pillar ("weiße Mittelsäule") behind top center of screen
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(rink.centerX - 24, scr.y - 26, 48, 30, 6);
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
          rink.centerX,
          scr.y + 32
        );

        // Digital 7-segment display box
        const boxW = scr.width - 56;
        const boxH = 56;
        const boxX = rink.centerX - boxW / 2;
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
        ctx.fillText(clockStr, rink.centerX, boxY + 31);
        ctx.restore();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.fillText(
          'TAGE       STD        MIN        SEK',
          rink.centerX,
          boxY + 48
        );

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillText(
          `AUTO-KINO: ${cinemaWeekdays.join(', ')} • AB ${cinemaStartTime} UHR`,
          rink.centerX,
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
        ctx.fillText('★ PALLADIUM LIVE ★', rink.centerX, scr.y + 42);
        ctx.restore();

        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          '80s ROLLER DISCO TELEVISION • STEREO VISUALIZER',
          rink.centerX,
          scr.y + 64
        );
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillText(
          `SENDETERMINE: ${cinemaWeekdays.join(', ')} AB ${cinemaStartTime} UHR`,
          rink.centerX,
          scr.y + 84
        );
      }
      ctx.restore();

      // 3. Small Wooden Spectator Bench in front of the screen ("kleine Zuschauerbank davor")
      const benchW = 148;
      const benchH = 16;
      const benchX = rink.centerX - benchW / 2;
      const benchY = scr.y + scr.height + 10;
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(benchX, benchY, benchW, benchH, 4);
      ctx.fill();
      ctx.stroke();

      // 4. Flickering Projector Light Cone ("halbtransparenter, leicht flackernder Projektions-Lichtkegel") from Projector to Screen
      const flicker =
        0.15 + Math.sin(now * 0.03) * 0.025 + Math.cos(now * 0.07) * 0.015;
      const coneGrad = ctx.createLinearGradient(
        projX,
        projY,
        rink.centerX,
        scr.y + scr.height
      );
      coneGrad.addColorStop(0, `rgba(224, 242, 254, ${flicker * 1.55})`);
      coneGrad.addColorStop(0.5, `rgba(186, 230, 253, ${flicker})`);
      coneGrad.addColorStop(1, `rgba(56, 189, 248, ${flicker * 0.5})`);
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(projX - 10, projY - 8);
      ctx.lineTo(projX + 10, projY - 8);
      ctx.lineTo(scr.x + scr.width - 8, scr.y + scr.height);
      ctx.lineTo(scr.x + 8, scr.y + scr.height);
      ctx.closePath();
      ctx.fill();

      // 5. Opposite 80s Large-Screen RGB CRT Projector ("gegenüberliegender 80er-Großbildprojektor")
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(projX - 24, projY - 10, 48, 26, 4);
      ctx.fill();
      ctx.stroke();
      ['#ef4444', '#22c55e', '#3b82f6'].forEach((lensCol, lIdx) => {
        ctx.fillStyle = lensCol;
        ctx.beginPath();
        ctx.arc(projX - 11 + lIdx * 11, projY - 9, 3.8, 0, Math.PI * 2);
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
        rink.centerX,
        scr.y - 32
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

  // D. DJ MAGIC FORCE & LIGHT JOCKEY BEHIND THE MIXER (Centered on x = 0!)
  const djBob = Math.sin(now * 0.006) * 4;
  ctx.fillStyle = '#3b0764';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-34 + djBob, -17, 32, 18, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(-18 + djBob, -8, 8, 0, Math.PI * 2);
  ctx.fill();

  // Light Jockey beside the DJ at the lighting desk
  const ljBob = Math.cos(now * 0.0065) * 3.5;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(6 - ljBob, -17, 30, 18, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(21 - ljBob, -8, 7.5, 0, Math.PI * 2);
  ctx.fill();

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
  // B. 1) KASSE & EINGANG PALLADIUM
  // ==========================================================================
  const { cashierBooth, spinWarmupZone } = bottomEntrance;

  ctx.save();
  ctx.translate(cashierBooth.centerX, cashierBooth.centerY);
  ctx.rotate(cashierBooth.angleRad);

  const cw = cashierBooth.width;
  const ch = cashierBooth.height;

  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.fillRect(-cw / 2 + 6, -ch / 2 + 26, 20, ch - 52);
  ctx.strokeRect(-cw / 2 + 6, -ch / 2 + 26, 20, ch - 52);

  drawRollerDiscoOvalEmblem(ctx, 10, 14, 52, 22, isBlacklight);

  ctx.fillStyle = '#39ff14';
  ctx.font = 'bold 10.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1) KASSE & EINGANG', 8, -ch / 2 + 18);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.fillText('PALLADIUM HANAU', 8, ch / 2 - 12);
  ctx.restore();

  // Circular Spin- & Warm-Up-Zone near the bottom-right entrance
  const pulse = 0.5 + Math.sin(now * 0.005) * 0.22;
  ctx.fillStyle = 'rgba(236, 72, 153, 0.14)';
  ctx.strokeStyle = `rgba(0, 240, 255, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    spinWarmupZone.x,
    spinWarmupZone.y,
    spinWarmupZone.radius,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f472b6';
  ctx.font = 'bold 9.5px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SPIN- & WARM-UP', spinWarmupZone.x, spinWarmupZone.y - 5);
  ctx.fillStyle = '#00f0ff';
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillText('[Space]/[Q] Spin', spinWarmupZone.x, spinWarmupZone.y + 10);

  // ==========================================================================
  // C. 2) PRO-SHOP & TUNING [E]
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
  ctx.lineWidth = 3;
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

  const itemColors = ['#ff2a85', '#00f0ff', '#39ff14', '#fde047', '#a855f7'];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = itemColors[i];
    ctx.beginPath();
    ctx.arc(
      proShopCounter.x + 38 + i * 54,
      proShopCounter.y + 21,
      8.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(proShopInteractX, proShopInteractY, 32, 0, Math.PI * 2);
  ctx.stroke();

  drawRollerDiscoOvalEmblem(
    ctx,
    proShopBounds.x + proShopBounds.width - 72,
    proShopBounds.y + proShopBounds.height - 26,
    54,
    20,
    isBlacklight
  );

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 13px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'PRO-SHOP & TUNING [E]',
    proShopBounds.x + proShopBounds.width / 2 - 28,
    proShopBounds.y + proShopBounds.height - 12
  );

  renderCharacterSprite(ctx, now, {
    x: proShopBounds.x + proShopBounds.width / 2 + Math.sin(now * 0.0018) * 18,
    y: proShopBounds.y + 84,
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
  // D. 3) ROLLSCHUHVERLEIH (WITH 2 ANIMATED STAFF MEMBERS!)
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

  for (const shelf of rentalShelves) {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.fillRect(shelf.x, shelf.y, shelf.width, shelf.height);
    ctx.strokeRect(shelf.x, shelf.y, shelf.width, shelf.height);
    for (let sx = shelf.x + 12; sx < shelf.x + shelf.width - 18; sx += 26) {
      ctx.fillStyle = '#d97706';
      ctx.fillRect(sx, shelf.y + 5, 9, 9);
      ctx.fillRect(sx + 11, shelf.y + 5, 9, 9);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(sx, shelf.y + 17, 9, 9);
      ctx.fillRect(sx + 11, shelf.y + 17, 9, 9);
    }
  }

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 13px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'ROLLSCHUHVERLEIH (SCHUHREGALE & AUSGABE)',
    rentalBounds.x + rentalBounds.width / 2,
    rentalBounds.y + 23
  );

  const rentalInteractX = rentalBounds.x + rentalBounds.width / 2;
  const rentalInteractY = 895;
  ctx.save();
  ctx.strokeStyle = !hasSkatesEquipped
    ? `rgba(250, 204, 21, ${0.65 + Math.sin(now * 0.008) * 0.3})`
    : 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = !hasSkatesEquipped ? 3 : 2;
  ctx.beginPath();
  ctx.arc(rentalInteractX, rentalInteractY, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = !hasSkatesEquipped ? '#fde047' : '#7dd3fc';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    !hasSkatesEquipped && drinkChipAvailable
      ? '🛼 LEIH-SKATES HOLEN [E] (CHIP)'
      : 'LEIH-SKATE AUSGABE [E]',
    rentalInteractX,
    rentalCounter.y - 8
  );
  ctx.restore();

  // 2 ANIMATED STAFF MEMBERS IN THE ROLLSCHUHVERLEIH (#16):
  // 1) Verleih-Biggi at the counter handing out skates
  const verleihBiggiX =
    rentalBounds.x + rentalBounds.width * 0.34 + Math.sin(now * 0.0022) * 24;
  renderCharacterSprite(ctx, now, {
    x: verleihBiggiX,
    y: rentalBounds.y + 78,
    headingRad: -Math.PI / 2 + Math.cos(now * 0.0022) * 0.18,
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

  // 2) Verleih-Tommy sorting skates along the shoe shelves
  const verleihTommyX =
    rentalBounds.x + rentalBounds.width * 0.72 + Math.cos(now * 0.0019) * 28;
  const verleihTommyY = rentalBounds.y + 92 + Math.sin(now * 0.0025) * 8;
  renderCharacterSprite(ctx, now, {
    x: verleihTommyX,
    y: verleihTommyY,
    headingRad:
      Math.sin(now * 0.0019) > 0 ? Math.PI / 2 : -Math.PI / 2,
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
  // E. 4) BISTRO & GARNET-LOUNGE IN THE BOTTOM-LEFT CORNER!
  // ==========================================================================
  ctx.save();
  ctx.fillStyle = '#181326';
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(24, 795);
  ctx.lineTo(270, 795);
  ctx.lineTo(415, 912);
  ctx.lineTo(730, 912);
  ctx.lineTo(730, 1064);
  ctx.lineTo(24, 1064);
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
  ctx.fillText('↑ WC / BANDEN-ZUGANG', wc.x + wc.width + 10, wc.y + 18);

  ctx.fillStyle = '#f472b6';
  ctx.font = 'bold 12.5px "Outfit", sans-serif';
  ctx.fillText('BISTRO & GARNET-LOUNGE', 38, 868);

  // 2. Bright 80s Marble Tables & Black 80s Plastic Chairs along the back wall
  for (const mt of bistro.marbleTables) {
    const chairAngles = [
      -Math.PI * 0.75,
      -Math.PI * 0.25,
      Math.PI * 0.25,
      Math.PI * 0.75,
    ];
    for (const ang of chairAngles) {
      const chX = mt.x + Math.cos(ang) * (mt.radius + 9);
      const chY = mt.y + Math.sin(ang) * (mt.radius + 9);
      ctx.save();
      ctx.translate(chX, chY);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-8, -7, 16, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(mt.x, mt.y, mt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mt.x - 14, mt.y - 8);
    ctx.quadraticCurveTo(mt.x - 2, mt.y + 2, mt.x + 15, mt.y - 4);
    ctx.moveTo(mt.x - 10, mt.y + 10);
    ctx.quadraticCurveTo(mt.x + 4, mt.y + 5, mt.x + 12, mt.y + 14);
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(mt.x - 7, mt.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.arc(mt.x + 8, mt.y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 3. Pushed-Back Beverage Counter with Slush-Puppie Machine & "BLOBA COLA" Dispenser
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
  ctx.fillRect(bistro.slushMachine.x, bistro.slushMachine.y, 26, 32);
  ctx.fillStyle = '#ff2a85';
  ctx.fillRect(bistro.slushMachine.x + 30, bistro.slushMachine.y, 26, 32);

  ctx.fillStyle = '#7c2d12';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.fillRect(bistro.blobaColaTap.x, bistro.blobaColaTap.y, 58, 32);
  ctx.strokeRect(bistro.blobaColaTap.x, bistro.blobaColaTap.y, 58, 32);
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 8.5px "Silkscreen", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'BLOBA COLA',
    bistro.blobaColaTap.x + 29,
    bistro.blobaColaTap.y + 20
  );

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bistro.interactX, bistro.interactY, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'SLUSH & BLOBA [E]',
    bistro.counter.x + bistro.counter.width / 2,
    bistro.counter.y - 8
  );
  ctx.restore();

  // 2 ANIMATED STAFF MEMBERS IN THE BISTRO (#16):
  // 1) Bistro-Marco serving at the Bloba-Cola tap
  renderCharacterSprite(ctx, now, {
    x: bistro.counter.x + bistro.counter.width * 0.68 + Math.sin(now * 0.0021) * 16,
    y: bistro.counter.y + 68,
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
    x: bistro.counter.x + bistro.counter.width * 0.28 + Math.cos(now * 0.0024) * 14,
    y: bistro.counter.y + 68,
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

  // 5 ANIMATED AI VISITORS AT THE CORNER MARBLE TABLES & LOUNGE BENCHES IN SINGLEPLAYER MODE (#16):
  if (!isMultiplayerActive) {
    const cornerTableVisitors = [
      // Table 1 (78, 958): 2 chatting 80s visitors sipping Slush & Bloba
      {
        x: 78 + Math.cos(-Math.PI * 0.75) * 33,
        y: 958 + Math.sin(-Math.PI * 0.75) * 33,
        headingRad: Math.PI * 0.25,
        gender: 'female' as const,
        shirtColor: '#ec4899',
        accentColor: '#00f0ff',
        hairColor: '#f59e0b',
        drinkColor: '#00f0ff',
        phase: 0.4,
      },
      {
        x: 78 + Math.cos(Math.PI * 0.25) * 33,
        y: 958 + Math.sin(Math.PI * 0.25) * 33,
        headingRad: -Math.PI * 0.75,
        gender: 'male' as const,
        shirtColor: '#0284c7',
        accentColor: '#fde047',
        hairColor: '#451a03',
        drinkColor: '#ff2a85',
        phase: 1.7,
      },
      // Table 2 (195, 958): 1 visitor relaxing with a Bloba Cola
      {
        x: 195 + Math.cos(-Math.PI * 0.25) * 33,
        y: 958 + Math.sin(-Math.PI * 0.25) * 33,
        headingRad: Math.PI * 0.75,
        gender: 'female' as const,
        shirtColor: '#a855f7',
        accentColor: '#39ff14',
        hairColor: '#1e1b4b',
        drinkColor: '#7c2d12',
        phase: 2.9,
      },
      // Table 3 (312, 958): 1 visitor cheering toward the rink
      {
        x: 312 + Math.cos(Math.PI * 0.75) * 33,
        y: 958 + Math.sin(Math.PI * 0.75) * 33,
        headingRad: -Math.PI * 0.25,
        gender: 'male' as const,
        shirtColor: '#16a34a',
        accentColor: '#ffffff',
        hairColor: '#78350f',
        drinkColor: '#00f0ff',
        phase: 4.1,
      },
      // Right-wall wooden bench 1 (1848, 170): 1 resting skater tying laces / watching the rink
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
  // Rotate 180° when backward-gliding ([Taste 2] or backward couple partner) so skater faces against travel direction!
  ctx.rotate(opts.headingRad + (isBackward ? Math.PI : 0));

  // Shoulder width differentiation: Female narrower (31px), Male broader (37px)
  const shoulderSpan = isFemale ? 31 : 37;
  const torsoOffsetX = opts.isSpeedSkater ? 4 : 0;

  // Rhythmically swinging skate stride & arm swing (zero grey side bars!)
  const stridePhase = now * (opts.isSpeedSkater ? 0.014 : 0.01) + (opts.x + opts.y) * 0.015;
  const legStride = opts.isPalladiumanerStaff ? 0 : Math.sin(stridePhase) * 3.2;

  if (opts.isWheelchair) {
    // Clean sporty wheelchair frame without protruding grey side bars
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = opts.isBlacklight ? '#00f0ff' : opts.wheelColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-16, -23, 24, 6, 3);
    ctx.roundRect(-16, 17, 24, 6, 3);
    ctx.fill();
    ctx.stroke();

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
      `➕ ${activeCrewNames.nurse || 'SANI-SANDRA'}`,
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

  // Ground shadow under skates
  ctx.fillStyle = opts.isGhost
    ? 'rgba(0, 240, 255, 0.25)'
    : 'rgba(0, 0, 0, 0.46)';
  ctx.fillRect(-18, 12, 36, 10);
  ctx.fillRect(-14, 10, 28, 14);

  ctx.translate(0, -pxSnap(opts.jumpZ));

  // Optional Underglow or Ghost Cyan Aura
  if (opts.underglowColor || opts.isGhost) {
    const glowMap: Record<string, string> = {
      pink: '#ff2a85',
      cyan: '#00f0ff',
      green: '#39ff14',
      gold: '#fde047',
    };
    ctx.fillStyle = opts.isGhost
      ? '#00f0ff'
      : glowMap[opts.underglowColor || 'cyan'] || '#00f0ff';
    ctx.globalAlpha = opts.isGhost
      ? 0.22 + Math.sin(now * 0.01) * 0.08
      : 0.3;
    ctx.fillRect(-20, -24, 40, 44);
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.scale(flipX, 1);

  if (opts.isGhost) {
    ctx.globalAlpha = 0.72 + Math.sin(now * 0.012 + absHash) * 0.1;
  }

  // Helper to draw a crisp 2x2 pixel block on the 24x32 full-body grid
  // Grid coordinates: gx in [0..23], gy in [0..31], anchored so feet sit around y = +16
  const P = 1.75; // 24 * 1.75 = 42px wide, 32 * 1.75 = 56px tall
  const ox = -12 * P;
  const oy = -22 * P;
  const rectPx = (gx: number, gy: number, gw: number, gh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(
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
    }
  }

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


