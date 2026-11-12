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
  HallGameMode,
  LightingMode,
  PlayerCharacterMode,
  ProShopUpgradesState,
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
  slalomCombo: number;
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
  x: number;
  y: number;
  vx: number;
  vy: number;
  headingRad: number;
  baseSpeed: number;
  shirtColor: string;
  accentColor: string;
  wheelColor: string;
  legwarmerColor?: string;
  spinTimer: number;
  speechText: string | null;
  speechTimer: number;
  crashTimer: number;
  hitOutTimer: number;
  sittingBarrierSpot?: { x: number; y: number; normalRad: number } | null;
}

interface NeonSoftball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncesLeft: number;
  color: string;
  fromPlayer: boolean;
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
 * Computes starting position based on Singleplayer Experience Level (`beginner` | `intermediate` | `pro`)
 * and whether the player enters directly on skates or on street shoes needing the Rollschuh-Verleih first.
 */
function getPlayerStartCoords(
  diff: SingleplayerDifficulty,
  hasSkatesEquipped: boolean
): { x: number; y: number; headingRad: number } {
  if (!hasSkatesEquipped) {
    // Player entered without own skates -> start on outer carpet near Kasse/Rollschuh-Verleih!
    return { x: 1580, y: 925, headingRad: Math.PI };
  }
  if (diff === 'beginner') {
    // 🟢 Anfänger: Safe start on the inner lane near the center stage
    return { x: 1185, y: 660, headingRad: -Math.PI / 2 };
  }
  if (diff === 'pro') {
    // 🔴 Profi: Challenging start further out on the fast outer lane
    return { x: 1465, y: 785, headingRad: -Math.PI / 2 };
  }
  // 🟡 Fortgeschrittener: Balanced start on the middle lane
  return { x: 1320, y: 725, headingRad: -Math.PI / 2 };
}

/**
 * Builds the AI NPC roster dynamically scaled for Singleplayer Experience Level:
 * - `beginner` (🟢 Anfänger): ~9 AI skaters, calmer speed (0.76x), only 1 speed skater
 * - `intermediate` (🟡 Fortgeschrittener): 14 AI skaters, normal disco speed (1.0x), 4 speed skaters
 * - `pro` (🔴 Profi): 23 AI skaters ("Samstagabend Volles Haus"), faster speed (1.18x), 6 speed skaters in outer paceline
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

  if (diff === 'beginner') {
    // 🟢 Anfänger: 9 skaters total (1 speed skater, 2 guards, 6 regulars)
    return [
      ...allSpeedSkaters.slice(0, 1),
      ...guards,
      ...allRegularSkaters.slice(0, 6),
    ];
  }
  if (diff === 'pro') {
    // 🔴 Profi: 23 skaters total ("Samstagabend Volles Haus": 6 speed skaters, 2 guards, 15 regulars)
    return [...allSpeedSkaters, ...guards, ...allRegularSkaters];
  }
  // 🟡 Fortgeschrittener: 14 skaters total (4 speed skaters, 2 guards, 8 regulars)
  return [
    ...allSpeedSkaters.slice(0, 4),
    ...guards,
    ...allRegularSkaters.slice(0, 8),
  ];
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
  const fogBurstTimerRef = useRef<number>(0);

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
    };

    // Web Speech API (`window.speechSynthesis`, `de-DE`) with 5s cooldown & character-specific pitch/rate
    let lastNpcSpeechTime = 0;

    const speakNpcBubble = (
      rawText: string,
      speakerName: string,
      gender: 'female' | 'male'
    ) => {
      const p = propsRef.current;
      if (!p.npcVoicesEnabled || p.isMuted || !p.isCurtainOpen) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      if (window.speechSynthesis.speaking) return;
      const nowMs = performance.now();
      if (nowMs - lastNpcSpeechTime < 5000) return;

      // Strip leading emojis and quotation marks for natural German speech synthesis
      const cleanText = rawText
        .replace(
          /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
          ''
        )
        .replace(/["„“«»]/g, '')
        .trim();
      if (!cleanText) return;

      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'de-DE';
        const upperName = speakerName.toUpperCase();

        if (gender === 'female') {
          if (upperName.includes('SANDRA')) {
            utterance.pitch = 1.36;
            utterance.rate = 1.1;
          } else if (upperName.includes('STEFFI')) {
            utterance.pitch = 1.32;
            utterance.rate = 1.08;
          } else if (upperName.includes('BIGGI')) {
            utterance.pitch = 1.18;
            utterance.rate = 1.04;
          } else {
            utterance.pitch = 1.28;
            utterance.rate = 1.06;
          }
        } else {
          if (upperName.includes('DIETER')) {
            utterance.pitch = 0.82;
            utterance.rate = 0.95;
          } else if (upperName.includes('MANNI')) {
            utterance.pitch = 0.78;
            utterance.rate = 0.98;
          } else if (upperName.includes('DJ')) {
            utterance.pitch = 0.86;
            utterance.rate = 1.04;
          } else {
            utterance.pitch = 0.88;
            utterance.rate = 0.98;
          }
        }
        utterance.volume = 0.85;
        lastNpcSpeechTime = nowMs;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore browser speechSynthesis errors
      }
    };

    // DJ Magic Force Neon Speech Bubble & "Put your hands up!" Crowd Cheer State
    let djSpeechBubble: string | null =
      '🎤 "Willkommen im Palladium Hanau! Let\'s roll!"';
    let djSpeechTimer = 6.5;
    let djNextAutoSpeechTimer = 22.0;
    let djHandsUpCheerTimer = 0;
    let ambientChatterTimer = 7.5;
    let prevLightingMode: LightingMode = propsRef.current.lightingMode;
    let prevHallGameMode: HallGameMode = propsRef.current.hallGameMode;
    let prevDifficulty: SingleplayerDifficulty = propsRef.current.difficulty;
    let prevHasOwnSkates: boolean = propsRef.current.hasOwnSkates;
    let prevIsCurtainOpen: boolean = propsRef.current.isCurtainOpen;

    // 80s Stage Fog Machine & Manual Burst Timer State
    let lastFogBurstCount = propsRef.current.fogBurstCount;
    let fogBurstTimer = 0;

    // Nurse / Paramedic ("SANI-SANDRA") Rescue Sequence State
    // Runs in from rink edge (~3.0s) -> kneels for care (~3.5s) -> walks calmly back off field (~3.2s)
    const saniNurse = {
      active: false,
      phase: 'idle' as 'idle' | 'running-in' | 'kneeling' | 'walking-out',
      x: 1732,
      y: 520,
      startX: 1732,
      startY: 520,
      targetX: 1400,
      targetY: 700,
      headingRad: Math.PI,
      phaseTimer: 0,
      phaseDuration: 3.0,
      speechText: null as string | null,
    };

    const triggerSaniNurseDispatch = (crashX: number, crashY: number) => {
      if (saniNurse.active) return;
      // Pick nearest rink edge gate/border so Sani-Sandra visibly runs across the parquet
      let spawnX = 1732;
      let spawnY = Math.max(220, Math.min(760, crashY));
      if (crashX < 620) {
        spawnX = 288;
        spawnY = Math.max(300, Math.min(740, crashY));
      } else if (crashY > 720) {
        spawnX = 1410;
        spawnY = 875;
      }
      saniNurse.active = true;
      saniNurse.phase = 'running-in';
      saniNurse.startX = spawnX;
      saniNurse.startY = spawnY;
      saniNurse.x = spawnX;
      saniNurse.y = spawnY;
      saniNurse.targetX = crashX + 26;
      saniNurse.targetY = crashY + 10;
      saniNurse.phaseTimer = 0;
      saniNurse.phaseDuration = 3.0; // ~3.0s clearly trackable run-in across the rink
      saniNurse.headingRad = Math.atan2(
        saniNurse.targetY - spawnY,
        saniNurse.targetX - spawnX
      );
      saniNurse.speechText = '🚑 Sani-Sandra eilt herbei!';
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

      // Check if in bottom-right Spin- & Warm-Up-Zone by Cashier & Entrance
      const { spinWarmupZone } = ARENA_LAYOUT.bottomEntrance;
      const distWarmup = Math.hypot(
        player.x - spinWarmupZone.x,
        player.y - spinWarmupZone.y
      );
      if (distWarmup <= spinWarmupZone.radius + 45) {
        player.warmupSpinsCount += 1;
        propsRef.current.onChallengeProgress('warmup_spins', 1);
        for (let i = 0; i < 24; i++) {
          const ang = (Math.PI * 2 * i) / 24;
          sparks.push({
            x: player.x,
            y: player.y,
            vx: Math.cos(ang) * (90 + Math.random() * 110),
            vy: Math.sin(ang) * (90 + Math.random() * 110),
            color: ['#00f0ff', '#ff2a85', '#39ff14', '#fde047'][i % 4],
            alpha: 1,
            size: 4 + Math.random() * 3,
          });
        }
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

      // 3. In "Ballspiel" mode: Throw glowing Neon-Softball!
      if (p.hallGameMode === 'ballspiel') {
        const speed = 690;
        softballs.push({
          x: player.x + Math.cos(player.headingRad) * 28,
          y: player.y + Math.sin(player.headingRad) * 28,
          vx: Math.cos(player.headingRad) * speed,
          vy: Math.sin(player.headingRad) * speed,
          bouncesLeft: 1,
          color: '#39ff14',
          fromPlayer: true,
        });
        soundFX.playBallThrowOrHit(false);
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

      if (e.code === 'Space') {
        if (!propsRef.current.isCurtainOpen) {
          propsRef.current.onEnterHallFromGamepad();
        } else if (propsRef.current.hallGameMode === 'stuhlsprung') {
          triggerPlayerJump();
        } else {
          const { spinWarmupZone } = ARENA_LAYOUT.bottomEntrance;
          const { mirrorWall } = ARENA_LAYOUT;
          const inSpinZone =
            Math.hypot(
              player.x - spinWarmupZone.x,
              player.y - spinWarmupZone.y
            ) <=
              spinWarmupZone.radius + 45 ||
            (player.x >= mirrorWall.x &&
              player.x <= mirrorWall.danceFloorX + 145 &&
              player.y >= mirrorWall.y - 25 &&
              player.y <= mirrorWall.y + mirrorWall.height + 25);
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
      } else if (
        k === '1' &&
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
      } else if (
        k === '2' &&
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
    let aiGuardBallThrowTimer = 0;
    const remotePlayersMap = new Map<string, InterpolatedRemotePlayer>();

    const stepFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

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

      // Welcome Gift / Skate Rental Notification on Hall Entry
      if (p.isCurtainOpen && !player.hasShownWelcomeGift) {
        player.hasShownWelcomeGift = true;
        if (p.hasOwnSkates || p.characterMode === 'wheelchair') {
          player.freeSlushCount = p.drinkChipAvailable ? 1 : 0;
          player.freeBlobaCount = p.drinkChipAvailable ? 1 : 0;
          player.speechBubble =
            '🛼 Eigene Rollschuhe aktiv! 🎁 1x Freigetränk-Chip fürs Bistro im Inventar!';
          player.speechTimer = 4.8;
        } else if (!p.hasRentedSkates) {
          player.speechBubble =
            '👟 Straßenschuhe an: Tausche deinen Freigetränk-Chip am Rollschuh-Verleih [E] gegen Leih-Skates!';
          player.speechTimer = 5.5;
        }
      }

      // DJ Magic Force Neon Speech Bubbles (Mode Changes & Every 20–30 Seconds)
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
          djSpeechBubble =
            '🎤 "Jägerball / Ballspiel startet! Achtung vor den Neon-Softbällen!"';
          djSpeechTimer = 5.5;
          speakNpcBubble(djSpeechBubble, p.activeDjName || 'DJ MAGIC FORCE', 'male');
        } else if (p.hallGameMode === 'stuhlsprung') {
          djSpeechBubble =
            '🎤 "Rundum-Stuhlsprung frei! Alle Zuschauer an die Bande!"';
          djSpeechTimer = 5.5;
          speakNpcBubble(djSpeechBubble, p.activeDjName || 'DJ MAGIC FORCE', 'male');
        } else if (p.hallGameMode === 'slalom') {
          djSpeechBubble =
            '🎤 "Slalom-Parcours eröffnet! Zeigt eure saubersten Kurven!"';
          djSpeechTimer = 5.5;
          speakNpcBubble(djSpeechBubble, p.activeDjName || 'DJ MAGIC FORCE', 'male');
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

      // Update Nurse / Paramedic ("SANI-SANDRA") Rescue Sequence
      if (saniNurse.active) {
        saniNurse.phaseTimer += dt;
        if (saniNurse.phase === 'running-in') {
          // Track player's fallen spot while running in over ~3.0 seconds
          saniNurse.targetX = player.x + 28;
          saniNurse.targetY = player.y + 10;
          const progress = Math.min(
            1,
            saniNurse.phaseTimer / saniNurse.phaseDuration
          );
          saniNurse.x =
            saniNurse.startX +
            (saniNurse.targetX - saniNurse.startX) * progress;
          saniNurse.y =
            saniNurse.startY +
            (saniNurse.targetY - saniNurse.startY) * progress;
          saniNurse.headingRad = Math.atan2(
            saniNurse.targetY - saniNurse.startY,
            saniNurse.targetX - saniNurse.startX
          );
          // Keep fallen skater waiting on the parquet until Sani-Sandra arrives
          if (player.crashTimer > 0 && player.crashTimer < 0.4) {
            player.crashTimer = 0.4;
          }
          if (progress >= 1) {
            saniNurse.phase = 'kneeling';
            saniNurse.phaseTimer = 0;
            saniNurse.phaseDuration = 3.5; // Kneels for ~3.5 seconds to treat the skater
            saniNurse.speechText =
              '🩹 Erste Hilfe: Eisspray & Pflaster drauf!';
            speakNpcBubble(saniNurse.speechText, 'SANI-SANDRA', 'female');
            player.crashTimer = Math.max(player.crashTimer, 3.2);
            player.speechBubble = '🩹 Danke, Sani-Sandra!';
            player.speechTimer = 3.2;
          }
        } else if (saniNurse.phase === 'kneeling') {
          saniNurse.x = player.x + 28;
          saniNurse.y = player.y + 10;
          saniNurse.headingRad = Math.atan2(
            player.y - saniNurse.y,
            player.x - saniNurse.x
          );
          if (saniNurse.phaseTimer >= saniNurse.phaseDuration) {
            saniNurse.phase = 'walking-out';
            saniNurse.phaseTimer = 0;
            saniNurse.phaseDuration = 3.2; // Walks calmly back off the rink
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
          saniNurse.x =
            saniNurse.targetX +
            (saniNurse.startX - saniNurse.targetX) * progress;
          saniNurse.y =
            saniNurse.targetY +
            (saniNurse.startY - saniNurse.targetY) * progress;
          saniNurse.headingRad = Math.atan2(
            saniNurse.startY - saniNurse.targetY,
            saniNurse.startX - saniNurse.targetX
          );
          if (progress >= 1) {
            saniNurse.active = false;
            saniNurse.phase = 'idle';
            saniNurse.speechText = null;
          }
        }
      }

      // Smoothly animate collapsible Center Stage (`[` & `]` sliding together horizontally)
      const targetStage = p.centerStageMode === 'islands' ? 0 : 1;
      stageCloseProgress +=
        (targetStage - stageCloseProgress) * Math.min(1, dt * 3.5);

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

      // Record Neon Underglow or Slush / Bloba Wheel Trails on the Parquet
      if (
        hasSkatesEquipped &&
        speed > 35 &&
        player.jumpZ <= 2 &&
        (p.upgrades.underglowEnabled ||
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
        const trailCol =
          player.slushRemainingSec > 0
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
            alpha: 0.55,
            width: 4,
          });
          trails.push({
            x1: prevRightWheel.x,
            y1: prevRightWheel.y,
            x2: rx,
            y2: ry,
            color: trailCol,
            alpha: 0.55,
            width: 4,
          });
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

      // Pre-enforce minimum longitudinal spacing between solo AI skaters on the oval so they never bunch up or overlap badges
      const soloNpcs = trackNpcs.filter(
        (n) =>
          !n.sittingBarrierSpot &&
          n.hitOutTimer <= 0 &&
          !(isSlowSkating && slowSkateCouples[n.id]?.isBackwardsPartner)
      );
      for (let i = 0; i < soloNpcs.length; i++) {
        for (let j = i + 1; j < soloNpcs.length; j++) {
          const a = soloNpcs[i];
          const b = soloNpcs[j];
          // Only space skaters that share similar lane radii (or when in Slow-Skating)
          if (Math.abs(a.laneRadiusX - b.laneRadiusX) < 65 || isSlowSkating) {
            const angDiff = normalizeAngle(a.orbitAngle - b.orbitAngle);
            const minAngGap = a.role === 'speed' && !isSlowSkating ? 0.16 : 0.28;
            if (Math.abs(angDiff) < minAngGap) {
              const push = (minAngGap - Math.abs(angDiff)) * 0.5 * dt;
              if (angDiff >= 0) {
                a.orbitAngle = normalizeAngle(a.orbitAngle + push);
                b.orbitAngle = normalizeAngle(b.orbitAngle - push);
              } else {
                a.orbitAngle = normalizeAngle(a.orbitAngle - push);
                b.orbitAngle = normalizeAngle(b.orbitAngle + push);
              }
            }
          }
        }
      }

      trackNpcs.forEach((npc, npcIdx) => {
        if (npc.speechTimer > 0) {
          npc.speechTimer = Math.max(0, npc.speechTimer - dt);
          if (npc.speechTimer === 0) npc.speechText = null;
        }
        if (npc.crashTimer > 0) {
          npc.crashTimer = Math.max(0, npc.crashTimer - dt);
          return;
        }

        // 1. In "Stuhlsprung" mode: all AI NPCs clear the rink, line up along the outer barrier as spectators, and look at the player!
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

        // 2. Hit out during Ballspiel
        if (npc.hitOutTimer > 0) {
          npc.hitOutTimer = Math.max(0, npc.hitOutTimer - dt);
          npc.x += (1745 - npc.x) * dt * 2.2;
          npc.y += (485 - npc.y) * dt * 2.2;
          return;
        }

        // 3. NPC currently sitting on the blue outer barrier (waiting until Skate Guard whistles!)
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

        // 4. Skate Guard intercepting an NPC sitting on the blue outer barrier!
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
            // Skate Guard arrived at the barrier-sitting skater -> Blow Whistle & Order off the barrier!
            if (p.skateGuardWhistleEnabled) {
              soundFX.playSkateGuardWhistle();
            }
            npc.speechText = '📣 TRILLER! Nicht auf der Bande sitzen!';
            npc.speechTimer = 3.4;
            speakNpcBubble(npc.speechText, npc.name, npc.gender);
            activeSitterNpc.sittingBarrierSpot = null;
            activeSitterNpc.speechText = 'Ups, schon wieder unten!';
            activeSitterNpc.speechTimer = 2.4;
            // Push skater back onto the parquet
            activeSitterNpc.x += Math.cos(spot.normalRad) * 44;
            activeSitterNpc.y += Math.sin(spot.normalRad) * 44;
            activeBarrierSitterId = null;
            barrierSitTimer = 15 + Math.random() * 6;
          }
          return;
        }

        // 5. Slow-Skating Mode: 3 Romantic Couples skating synchronously (one partner skating backwards facing the other at a clean 36px distance!)
        const coupleCfg =
          isSlowSkating && p.hallGameMode === 'free-skate'
            ? slowSkateCouples[npc.id]
            : undefined;

        if (coupleCfg) {
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

          // Offset the two partners cleanly along the track tangent (+18px ahead for backwards partner, -18px behind for forward partner -> 36px clean face-to-face distance!)
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

          // Backwards partner faces directly toward the forward partner!
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

          const trackPt = computeTrackOvalPoint(
            rink.centerX,
            rink.centerY,
            npc.laneRadiusX,
            npc.laneRadiusY,
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

          // Skate Guard #1 handles 15s AFK escort if player stands still on the rink
          if (npc.id === 'guard-1' && player.afkSecondsOnTrack >= 15) {
            targetX = player.x - 24;
            targetY = player.y - 24;
            const distToAfk = Math.hypot(player.x - npc.x, player.y - npc.y);
            if (distToAfk < 65) {
              if (!player.guardEscortActive) {
                player.guardEscortActive = true;
                npc.speechText = 'Trrriiiiieeeet! Nicht auf der Bahn stehen!';
                npc.speechTimer = 3.5;
                if (p.skateGuardWhistleEnabled) {
                  soundFX.playSkateGuardWhistle();
                }
                speakNpcBubble(npc.speechText, npc.name, npc.gender);
              }
              player.vx = (1745 - player.x) * 1.4;
              player.vy = (550 - player.y) * 1.4;
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

          // Check if player is drafting in the visible Slipstream behind the Speed-Skater paceline
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

            const relSpeed = Math.hypot(player.vx - npc.vx, player.vy - npc.vy);
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

              // Dispatch Sani-Sandra nurse to run across the rink to the fallen player!
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

      // Pairwise minimum-distance separation between non-coupled NPCs so figures and name badges never overlap!
      for (let i = 0; i < trackNpcs.length; i++) {
        for (let j = i + 1; j < trackNpcs.length; j++) {
          const a = trackNpcs[i];
          const b = trackNpcs[j];
          if (a.sittingBarrierSpot || b.sittingBarrierSpot) continue;
          const isCouple =
            isSlowSkating &&
            p.hallGameMode === 'free-skate' &&
            slowSkateCouples[a.id] &&
            slowSkateCouples[b.id] &&
            slowSkateCouples[a.id].leaderId === slowSkateCouples[b.id].leaderId;
          if (isCouple) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minSep = 76;
          if (dist < minSep && dist > 0.1) {
            const push = (minSep - dist) * 0.5;
            const nx = dx / dist;
            const ny = dy / dist;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
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
      // G. HALLEN-SPIELE LOGIC (BALLSPIEL, SLALOM, STUHLSPRUNG)
      // ----------------------------------------------------------------------
      if (p.hallGameMode === 'ballspiel') {
        aiGuardBallThrowTimer += dt;
        if (aiGuardBallThrowTimer > 2.8) {
          aiGuardBallThrowTimer = 0;
          const guard1 = trackNpcs.find((n) => n.id === 'guard-1');
          const targetSkater = trackNpcs.find(
            (n) => n.role === 'regular' && n.hitOutTimer <= 0
          );
          if (guard1 && targetSkater) {
            const ang = Math.atan2(
              targetSkater.y - guard1.y,
              targetSkater.x - guard1.x
            );
            softballs.push({
              x: guard1.x,
              y: guard1.y,
              vx: Math.cos(ang) * 580,
              vy: Math.sin(ang) * 580,
              bouncesLeft: 1,
              color: '#ff2a85',
              fromPlayer: false,
            });
          }
        }

        for (let i = softballs.length - 1; i >= 0; i--) {
          const b = softballs[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          if (b.x < rink.x + 20 || b.x > rink.x + rink.width - 20) {
            if (b.bouncesLeft > 0) {
              b.vx = -b.vx;
              b.bouncesLeft -= 1;
            } else {
              softballs.splice(i, 1);
              continue;
            }
          }
          if (b.y < rink.y + 20 || b.y > rink.y + rink.height - 20) {
            if (b.bouncesLeft > 0) {
              b.vy = -b.vy;
              b.bouncesLeft -= 1;
            } else {
              softballs.splice(i, 1);
              continue;
            }
          }

          let hitSomeone = false;
          for (const npc of trackNpcs) {
            if (npc.role === 'guard' || npc.hitOutTimer > 0) continue;
            if (Math.hypot(b.x - npc.x, b.y - npc.y) < 34) {
              npc.hitOutTimer = 5.5;
              npc.speechText = 'Getroffen!';
              npc.speechTimer = 2.4;
              speakNpcBubble(npc.speechText, npc.name, npc.gender);
              soundFX.playBallThrowOrHit(true);
              if (b.fromPlayer) {
                player.ballspielHits += 1;
                p.onChallengeProgress('ballspiel_5_hits', 1);
              }
              hitSomeone = true;
              break;
            }
          }
          if (hitSomeone) {
            softballs.splice(i, 1);
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
        saniNurse
      );

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
          slalomCombo: player.slalomCombo,
        });
      }

      animFrameId = requestAnimationFrame(stepFrame);
    };

    animFrameId = requestAnimationFrame(stepFrame);

    return () => {
      cancelAnimationFrame(animFrameId);
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
      className="w-full h-full block select-none"
    />
  );
};

// ============================================================================
// COLLISION SOLVER (CURVED DJ-TOWER, VERTICAL MIRROR WALL, ANGLED CASHIER, ETC.)
// ============================================================================

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

  // 3. Rink Barriers with EXACTLY TWO WIDE OBSTACLE-FREE GATES:
  // Right Rink Barrier (x = rink.x + rink.width)
  collideBox(rink.x + rink.width - 8, rink.y, 16, rink.height - 65);

  // Bottom Rink Barrier (split cleanly around Gate 1)
  collideBox(
    rink.x + 25,
    rink.y + rink.height - 8,
    gates.bottomRightEntrance.xStart - (rink.x + 25),
    16
  );
  collideBox(
    gates.bottomRightEntrance.xEnd,
    rink.y + rink.height - 8,
    rink.x + rink.width - gates.bottomRightEntrance.xEnd - 25,
    16
  );

  // Left Rink Barrier (starts at bottom-left of curved DJ-Tower y = 260, split around Gate 2 at y = 615..745)
  collideBox(
    rink.x - 8,
    djTower.bevelLeftY,
    16,
    gates.topLeftBistro.yStart - djTower.bevelLeftY
  );
  collideBox(
    rink.x - 8,
    gates.topLeftBistro.yEnd,
    16,
    rink.y + rink.height - gates.topLeftBistro.yEnd - 25
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

  // 7. Bottom-Right Angled Cashier Booth -> Right-Shifted Pro-Shop -> Rollschuhverleih
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
  }
): void {
  const isPutzlicht = p.lightingMode === 'putzlicht';
  const isBlacklight = p.lightingMode === 'blacklight';
  const isSlowSkating = p.lightingMode === 'slow-skating';
  activeArenaStyle = p.arenaStyle || 'classic-neon';

  // Defer all skater/NPC name badges & speech bubbles so they are drawn ABOVE the fog and floor spots!
  deferredOverlayQueue.length = 0;
  isDeferringOverlays = true;

  ctx.save();
  ctx.imageSmoothingEnabled = activeArenaStyle !== 'pixel-16bit';

  ctx.fillStyle = isPutzlicht
    ? '#475569'
    : isBlacklight
    ? '#110726'
    : isSlowSkating
    ? '#1a0f1e'
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
        ? '#1e1224'
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
    woodGrad.addColorStop(0, '#381b18');
    woodGrad.addColorStop(1, '#220e10');
  } else if (activeArenaStyle === 'palladium-1989') {
    // Darker 1989 hardwood parquet so golden disco-ball light dots pop vividly!
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

  // Subtle Center-Court Inlaid Retro Logo
  ctx.save();
  ctx.translate(rink.centerX, rink.centerY);
  ctx.fillStyle = isBlacklight
    ? 'rgba(0, 240, 255, 0.22)'
    : 'rgba(245, 158, 11, 0.15)';
  ctx.font = 'bold 26px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROLLER DISCO PALLADIUM HANAU', 0, 8);
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

  // 3. RINK BARRIER: CURVED QUARTER-CIRCLE TOP-LEFT DJ-TOWER -> STRAIGHT LEFT BARRIER -> BOTTOM -> RIGHT
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#38bdf8';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
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
  ctx.lineTo(rink.x + rink.width - r, rink.y + rink.height);
  ctx.arcTo(
    rink.x + rink.width,
    rink.y + rink.height,
    rink.x + rink.width,
    rink.y + rink.height - r,
    r
  );
  ctx.lineTo(rink.x + rink.width, rink.y);
  ctx.stroke();

  // Carve out & render EXACTLY TWO WIDE BROWN BANDEN-ZUGÄNGE WITH GREEN THRESHOLD:
  // Gate 1: Bottom-Right by Kasse & Pro-Shop
  const g1 = gates.bottomRightEntrance;
  ctx.fillStyle = woodGrad;
  ctx.fillRect(g1.xStart, g1.y - 12, g1.width, 26);
  ctx.fillStyle = '#39ff14';
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 10;
  ctx.fillRect(g1.xStart + 10, g1.y - 3, g1.width - 20, 6);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#5c3418';
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 2;
  ctx.fillRect(g1.xStart - 12, g1.y - 12, 16, 24);
  ctx.strokeRect(g1.xStart - 12, g1.y - 12, 16, 24);
  ctx.fillRect(g1.xEnd - 4, g1.y - 12, 16, 24);
  ctx.strokeRect(g1.xEnd - 4, g1.y - 12, 16, 24);

  // Gate 2: Bottom-Left directly at the upper edge of the moved-down Bistro & Garnet-Lounge
  const g2 = gates.topLeftBistro;
  ctx.fillStyle = woodGrad;
  ctx.fillRect(g2.x - 12, g2.yStart, 26, g2.height);
  ctx.fillStyle = '#39ff14';
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 10;
  ctx.fillRect(g2.x - 3, g2.yStart + 10, 6, g2.height - 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#5c3418';
  ctx.strokeStyle = '#a16207';
  ctx.lineWidth = 2;
  ctx.fillRect(g2.x - 12, g2.yStart - 12, 24, 16);
  ctx.strokeRect(g2.x - 12, g2.yStart - 12, 24, 16);
  ctx.fillRect(g2.x - 12, g2.yEnd - 4, 24, 16);
  ctx.strokeRect(g2.x - 12, g2.yEnd - 4, 24, 16);

  // 4. SLOPED 2.5D TOP BACK WALL + VERTICAL 90° LEFT MIRROR WALL + KENGOL BREAKDANCERS + PUTZRAUM DOOR
  renderSloped25DBackWallAndVerticalMirror(
    ctx,
    now,
    p.showNames,
    isBlacklight,
    djHandsUpActive
  );

  // 5. 90°-ROTATED CENTER U-ISLANDS (`[` LEFT & `]` RIGHT), JAM-SKATERS IN BETWEEN, OR COLLAPSIBLE EVENT STAGE (WITH TRUSS, PAR SPOTS, LIGHT ORGANS & FOG)
  const fogIntensity =
    fogBurstTimer > 0 ? 1.35 : p.fogMachineEnabled ? 0.85 : 0;
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
    Boolean(p.isMultiplayerActive)
  );

  // 6. CURVED QUARTER-CIRCLE TOP-LEFT CORNER DJ-TOWER ("KLECKNIX" TURNTABLES + VINYL CABINET + DJ SPEECH BUBBLE)
  renderCurvedDjTowerCorner(
    ctx,
    now,
    p.djTickerText,
    p.activeDjName || 'DJ Magic Force',
    p.showNames,
    isBlacklight,
    djSpeechBubble
  );

  // 7. HALL TOUR: RIGHT WALL BENCHES, ANGLED CASHIER -> PRO-SHOP -> VERLEIH -> COMPACT BOTTOM-LEFT BISTRO
  renderHallTourZonesAndStaff(
    ctx,
    now,
    p.showNames,
    isBlacklight,
    p.hasOwnSkates || p.hasRentedSkates,
    p.drinkChipAvailable
  );

  // 8. HALLEN-SPIELE PROPS (SLALOM CONES, FOLDING CHAIRS, NEON SOFTBALLS)
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
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 9. RENDER TRACK NPCS (ONLY IN SOLO MODE — IN MULTIPLAYER, THE RINK BELONGS EXCLUSIVELY TO REAL CONNECTED PLAYERS!)
  if (!p.isMultiplayerActive) {
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

          // Visible two-arm hand-holding connection ("Händchenhalten-Verbindung") between both partners
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

          // Clasped hands in the middle (left & right hand holding)
          ctx.fillStyle = '#fde68a';
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(midX + perpX * 0.8, midY + perpY * 0.8, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Second hand-holding link on the other side
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

          // Small pink/red pixel hearts ("♥") gently floating upward ONLY above these 3 couples!
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
      renderCharacterSprite(ctx, now, {
        x: npc.x,
        y: npc.y,
        headingRad: npc.headingRad,
        jumpZ: 0,
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
        name: npc.name,
        showName: p.showNames,
        isBlacklight,
        crashTimer: npc.crashTimer,
        speechBubble: npc.speechText,
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

  // 9b. RENDER CONNECTED HUMAN MULTIPLAYER SKATERS (WITH SMOOTH INTERPOLATION & GOLDEN/TURQUOISE STAR BADGE!)
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
      });
    }
  }

  // 10. RENDER PLAYER CHARACTER (Supports [H] Kengol-Bucket-Hat & White-Pink Kengo Skates!)
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

  // 11. LIGHTING LAYER: WANDERING COLOR SPOTS, SLOW-SKATING DIMMED GLOW, ROTATING CENTRAL MIRROR BALL
  if (!isPutzlicht) {
    renderMirrorBallAndDiscoLighting(ctx, now, isBlacklight, isSlowSkating);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 245, 0.22)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  // 11b. CONCERT LIGHTING LAYER (Automatik / Immer An / Aus):
  // Dims the rest of the hall with a dark veil while keeping the Live-Band-Bühne cut out and lit by 80s spotlights (Warm White, Magenta, Cyan)
  const isBandPlayingShowCycle = (now * 0.001) % 48 < 41;
  const isConcertLightingActive =
    !isPutzlicht &&
    (p.concertLightingMode === 'on' ||
      (p.concertLightingMode === 'auto' &&
        p.centerStageMode === 'live-band' &&
        isBandPlayingShowCycle));
  if (isConcertLightingActive) {
    renderConcertStageSpotlightOverlay(ctx, now, stageCloseProgress);
  }

  // 11c. VISIBLE 80s HALL FOG CLOUDS (OVER floor & floor spots, UNDER all Name Badges & HUD Overlays!):
  // Triggered when Fog Machine is ON (fogMachineEnabled), or automatically when Live-Band is active, or during a Fog Burst!
  const shouldRenderHallFog =
    p.fogMachineEnabled ||
    p.centerStageMode === 'live-band' ||
    fogBurstTimer > 0;
  if (shouldRenderHallFog) {
    const burstBoost =
      fogBurstTimer > 0 ? Math.min(1.0, fogBurstTimer / 5.0) : 0;
    render80sDancefloorFogBanks(
      ctx,
      now,
      p.fogMachineEnabled || p.centerStageMode === 'live-band',
      burstBoost,
      isBlacklight,
      isSlowSkating,
      isConcertLightingActive
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

  // Large Black 80s PA Speaker Boxes (Two round woofers + top horn tweeter, membranes pulsing to the current beat!)
  draw80sPASpeakerBox(ctx, 525, wallCenterY, 44, 82, 0.08, now, isBlacklight);
  draw80sPASpeakerBox(ctx, 735, wallCenterY, 44, 82, 0, now, isBlacklight);
  draw80sPASpeakerBox(ctx, 1345, wallCenterY, 44, 82, 0, now, isBlacklight);
  draw80sPASpeakerBox(ctx, 1615, wallCenterY, 44, 82, -0.08, now, isBlacklight);

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
  const beatWave = Math.sin(now * 0.013);
  const beatPulse = Math.pow(Math.max(0, beatWave), 3); // sharp rhythmic bass thump (0..1)

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
  isMultiplayerActive = false
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
    ctx.strokeRect(aisleLeft, topY + 8, aisleWidth, h - 16);
    ctx.restore();
  }

  // 1. Draw Left U-Island (`[` shape)
  ctx.fillStyle = '#1e1b2e';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#ec4899';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(leftX, topY, w, h, [42, 8, 8, 42]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2d1b36';
  ctx.fillRect(leftX + t, topY + t, w - t, h - t * 2);

  // 2. Draw Right U-Island (`]` shape)
  ctx.fillStyle = '#1e1b2e';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#ec4899';
  ctx.beginPath();
  ctx.roundRect(rightX, topY, w, h, [8, 42, 42, 8]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#2d1b36';
  ctx.fillRect(rightX, topY + t, w - t, h - t * 2);

  // Subtle 80s Ground-Fog wisps around the center U-islands when Fog Machine is active in 'islands' mode
  if (fogIntensity > 0 && centerStageMode === 'islands') {
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

  // 3. When the two U-Islands are open (in Solo mode), 2 Jam-Roller-Skaters dance in the wide open center aisle between them!
  if (
    !isMultiplayerActive &&
    stageCloseProgress < 0.3 &&
    centerStageMode === 'islands'
  ) {
    const centerJamSkaters = [
      {
        name: 'Electric-Mia',
        gender: 'female' as const,
        baseX: rink.centerX - 32,
        baseY: rink.centerY - 48,
        col: '#38bdf8',
        legwarmerColor: '#ff2a85',
        phase: 0.8,
      },
      {
        name: 'Spin-Sammy',
        gender: 'male' as const,
        baseX: rink.centerX + 32,
        baseY: rink.centerY + 48,
        col: '#39ff14',
        legwarmerColor: undefined,
        phase: 3.6,
      },
    ];

    for (const js of centerJamSkaters) {
      const jt = now * 0.0035 + js.phase;
      const jx = js.baseX + Math.cos(jt) * 28;
      const jy = js.baseY + Math.sin(jt * 2) * 14;
      const heading = (now * 0.005 + js.phase) % (Math.PI * 2);

      renderCharacterSprite(ctx, now, {
        x: jx,
        y: jy,
        headingRad: heading,
        jumpZ:
          djHandsUpActive ? Math.abs(Math.sin(now * 0.01 + js.phase)) * 6 : 0,
        gender: js.gender,
        isWheelchair: false,
        isSkateGuard: false,
        isSpeedSkater: false,
        isGhost: false,
        isPalladiumanerStaff: false,
        shirtColor: js.col,
        accentColor: '#ffffff',
        wheelColor: '#fde047',
        legwarmerColor: js.legwarmerColor,
        name: js.name,
        showName: showNames,
        isBlacklight,
        crashTimer: 0,
        speechBubble:
          djHandsUpActive && js.gender === 'female' ? '🙌 HANDS UP!' : null,
      });
    }
  }

  // 4. If Event Stage is active (Live-Band or Cinema), render closed stage on top
  if (stageCloseProgress > 0.7 && centerStageMode !== 'islands') {
    const sx = uIslands.closedStageX;
    const sy = uIslands.closedStageY;
    const sw = uIslands.closedStageWidth;
    const sh = uIslands.closedStageHeight;

    ctx.fillStyle = '#13111c';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(sx + 12, sy + 12, sw - 24, sh - 24, 16);
    ctx.fill();
    ctx.stroke();

    if (centerStageMode === 'live-band') {
      const beatWave = Math.sin(now * 0.013);
      const beatPulse = Math.pow(Math.max(0, beatWave), 2);

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

      // Draw soft, semi-transparent PAR spotlight cones sweeping forward over the stage (shimmering more strongly when fog is active!)
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
        const baseAlpha =
          (0.18 + ((idx % 2 === 0 ? beatPulse : 1 - beatPulse) * 0.1)) *
          coneAlphaBoost;
        coneGrad.addColorStop(0, `rgba(${sp.rgba}, ${Math.min(0.42, baseAlpha)})`);
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
      const activeChamber = Math.floor(now * 0.008) % 4;
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
            (beatPulse > 0.45 && (c + activeChamber) % 2 === 0);
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
      // Live-adapted to bandSkinTone ('black' | 'white' | 'mixed') & bandGender ('male' | 'female' | 'mixed')!
      // (Rear drummer at sy + 92 and front singer at sy + 242 so the center under the mirror ball at rink.centerY = 484 remains 100% unobstructed!)
      const darkTones = ['#6b3e26', '#5c3317', '#784421', '#4e2a14'] as const;
      const lightTones = ['#fde68a', '#fed7aa', '#fcd34d', '#fde68a'] as const;
      const getMusicianSkin = (idx: 0 | 1 | 2 | 3) => {
        const isDark =
          bandSkinTone === 'black'
            ? true
            : bandSkinTone === 'white'
            ? false
            : idx % 2 === 0; // 'mixed': Drummer & Keytarist dark, Guitarist & Singer light
        return {
          isDark,
          skinColor: isDark ? darkTones[idx] : lightTones[idx],
        };
      };
      const getMusicianIsFemale = (idx: 0 | 1 | 2 | 3) => {
        if (bandGender === 'female') return true;
        if (bandGender === 'male') return false;
        return idx === 1 || idx === 3; // 'mixed': Guitarist & Lead Singer female, Drummer & Keytarist male
      };

      const drawMusicianHeadAndHair = (
        bx: number,
        headY: number,
        isFemale: boolean,
        isDark: boolean,
        skinColor: string,
        roleIdx: 0 | 1 | 2 | 3
      ) => {
        // Base head circle
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(bx, headY, 8.6, 0, Math.PI * 2);
        ctx.fill();

        if (isFemale) {
          // Female 80s Hairstyles: Voluminous 80s curls, twin braids/ponytails, or long mane with neon headband
          const hairCol = isDark
            ? '#170d08'
            : roleIdx === 2
            ? '#f59e0b'
            : roleIdx === 1
            ? '#9333ea'
            : '#b45309';
          ctx.fillStyle = hairCol;
          // Voluminous side curls / long flowing locks
          ctx.beginPath();
          ctx.arc(bx - 7.5, headY + 1, 5.2, 0, Math.PI * 2);
          ctx.arc(bx + 7.5, headY + 1, 5.2, 0, Math.PI * 2);
          ctx.arc(bx, headY - 3.5, 8.8, Math.PI * 0.95, Math.PI * 0.05);
          ctx.fill();

          if (isDark) {
            // Extra 80s Afro-puff / braided volume crown
            ctx.beginPath();
            ctx.arc(bx - 5, headY - 6.5, 4.8, 0, Math.PI * 2);
            ctx.arc(bx + 5, headY - 6.5, 4.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // High 80s side ponytail / ribbon
            ctx.beginPath();
            ctx.ellipse(bx + 9.5, headY - 4, 4.5, 2.8, -0.4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Neon 80s hairband + hoop earrings
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
          // Male 80s Hairstyles: Afro/curls for dark skin, Vokuhila (mullet) / rocker mane + headband for light skin
          const hairCol = isDark
            ? '#140c08'
            : roleIdx === 2
            ? '#f59e0b'
            : roleIdx === 0
            ? '#451a03'
            : '#1e1b4b';
          ctx.fillStyle = hairCol;
          if (isDark) {
            // Classic 80s Funk/Soul Afro / Curly High-Top
            ctx.beginPath();
            ctx.arc(bx, headY - 2.5, 10.2, Math.PI * 0.85, Math.PI * 0.15);
            ctx.arc(bx - 6.5, headY - 4, 4.6, 0, Math.PI * 2);
            ctx.arc(bx + 6.5, headY - 4, 4.6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // 80s Vokuhila (Mullet) with neck fringe & spiked top
            ctx.beginPath();
            ctx.arc(bx, headY - 2, 8.6, Math.PI * 0.88, Math.PI * 0.12);
            ctx.fill();
            ctx.fillRect(bx - 7.5, headY - 2, 3, 6);
            ctx.fillRect(bx + 4.5, headY - 2, 3, 6);
          }

          if (roleIdx === 0 || roleIdx === 3) {
            // 80s Stage Sweatband / Stirnband
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
        // Offset floor shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.ellipse(bx + 4, by + 12, 30, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Drummer shoulders & 80s stage top/jacket (behind drum kit)
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

        // Drummer arms + drumsticks hitting drums to the beat
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 12, by - 4 + bounce);
        ctx.lineTo(bx - 9, by + 8 + stickSwing * 0.4);
        ctx.moveTo(bx + 12, by - 4 + bounce);
        ctx.lineTo(bx + 9, by + 8 - stickSwing * 0.4);
        ctx.stroke();

        // Drumsticks
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx - 9, by + 8 + stickSwing * 0.4);
        ctx.lineTo(bx - 5, by + 15 + stickSwing * 0.6);
        ctx.moveTo(bx + 9, by + 8 - stickSwing * 0.4);
        ctx.lineTo(bx + 5, by + 15 - stickSwing * 0.6);
        ctx.stroke();

        // Drum kit: Central Bass Drum + 2 Rack Toms + 2 Golden Cymbals
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx - 14, by + 8, 28, 12, 4);
        ctx.fill();
        ctx.stroke();

        // Left & Right Snare/Tom drums
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(bx - 13, by + 10, 6.5, 0, Math.PI * 2);
        ctx.arc(bx + 13, by + 10, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Golden Crash & Ride Cymbals left & right
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(bx - 24, by + 6, 8, 4.5, -0.2, 0, Math.PI * 2);
        ctx.ellipse(bx + 24, by + 6, 8, 4.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Drummer Head & 80s Hair/Headband
        drawMusicianHeadAndHair(bx, by - 7 + bounce, isFemale, isDark, skinColor, 0);
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
        // Distinct offset floor shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + 14, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Standing boots/legs (+ 80s neon legwarmers for female outfit)
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

        // Upright Shoulders & 80s Stage Top / Jacket
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

        // Guitar Strap across shoulder
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by - 10 + bounce);
        ctx.lineTo(bx + 8, by + 5 + bounce);
        ctx.stroke();

        // 80s Electric Guitar Body (Neon Pink V/Strat) + Guitar Neck & Headstock
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

        // Left & Right Arms (fretting hand on neck, strumming hand on body)
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 12, by - 2 + bounce);
        ctx.lineTo(bx - 3, by + 3 + bounce + strum);
        ctx.moveTo(bx + 12, by - 2 + bounce);
        ctx.lineTo(bx + 16, by - 4 + bounce + strum * 0.25);
        ctx.stroke();

        // Head & 80s Hair
        drawMusicianHeadAndHair(bx, by - 6 + bounce, isFemale, isDark, skinColor, 1);
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
        // Distinct offset floor shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + 14, 22, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Standing boots/legs (+ 80s legwarmers for female outfit)
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

        // Upright Shoulders & Torso
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

        // Guitar Strap
        ctx.strokeStyle = '#ff2a85';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(bx + 10, by - 10 + bounce);
        ctx.lineTo(bx - 8, by + 5 + bounce);
        ctx.stroke();

        // 80s Electric Guitar / Keytar (Gold/Yellow) + Neck pointing left-up
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

        // Playing Arms
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx + 12, by - 2 + bounce);
        ctx.lineTo(bx + 4, by + 3 + bounce + strum);
        ctx.moveTo(bx - 12, by - 2 + bounce);
        ctx.lineTo(bx - 16, by - 4 + bounce + strum * 0.25);
        ctx.stroke();

        // Head & 80s Hair
        drawMusicianHeadAndHair(bx, by - 6 + bounce, isFemale, isDark, skinColor, 2);
        ctx.restore();
      }

      // 4) FRONTMAN / LEAD SINGER WITH MICROPHONE STAND (at bx = rink.centerX, by = sy + 242 — near front edge, leaving mirror ball at y=484 completely free!)
      {
        const bx = rink.centerX;
        const by = sy + 242;
        const bounce = Math.sin(now * 0.012 + 0.5) * 3.2;
        const armGesture = Math.sin(now * 0.016) * 5;
        const { isDark, skinColor } = getMusicianSkin(3);
        const isFemale = getMusicianIsFemale(3);
        const torsoW = isFemale ? 27 : 32;

        ctx.save();
        // Distinct offset floor shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(bx + 5, by + 14, 23, 11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Standing boots
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 10, by + 5, 8, 9);
        ctx.fillRect(bx + 2, by + 5, 8, 9);
        if (isFemale) {
          ctx.fillStyle = '#fde047';
          ctx.fillRect(bx - 10, by + 5, 8, 4.5);
          ctx.fillRect(bx + 2, by + 5, 8, 4.5);
        }

        // Front Singer Shoulders & 80s Glitter Top / Stage Jacket
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

        // Sequin / Glitter detail on lead singer's 80s outfit
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(bx - 6, by - 2 + bounce, 1.6, 0, Math.PI * 2);
        ctx.arc(bx + 6, by - 2 + bounce, 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Left arm holding microphone stand, Right arm gesturing to the crowd
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - 12, by - 1 + bounce);
        ctx.lineTo(bx - 2, by + 11 + bounce * 0.5);
        ctx.moveTo(bx + 13, by - 1 + bounce);
        ctx.lineTo(bx + 21, by + 7 + armGesture);
        ctx.stroke();

        // Front Singer Head & 80s Hairstyle
        drawMusicianHeadAndHair(bx, by - 5 + bounce, isFemale, isDark, skinColor, 3);

        // Chrome Microphone Stand ("Mikrofonständer") directly in front of the singer
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

        // Silver Dynamic Microphone Head
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(micX, micY - 10 + bounce * 0.4, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (centerStageMode === 'cinema') {
      const scr = uIslands.cinemaScreenRect;

      if (activeArenaStyle === 'palladium-1989') {
        // PALLADIUM 1989 KINO-LEINWAND:
        // Large white screen mounted directly on a white center pillar, small spectator bench in front,
        // and an opposite 80s large-screen projector with a flickering light cone in the fog!
        const projX = rink.centerX;
        const projY = scr.y + scr.height + 54;

        // 1. White Structural Center Pillar ("weiße Mittelsäule") behind top center of screen
        ctx.save();
        ctx.fillStyle = '#f1f5f9';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rink.centerX - 24, scr.y - 26, 48, 30, 6);
        ctx.fill();
        ctx.stroke();

        // 2. White 1989 Projection Screen Frame on the Center Pillar
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.fillRect(scr.x, scr.y, scr.width, scr.height);
        ctx.strokeRect(scr.x, scr.y, scr.width, scr.height);

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

        // 4. Flickering Projector Light Cone ("sichtbarer, leicht flackernder Lichtkegel im Nebel") from Projector to Screen
        const flicker =
          0.16 +
          Math.sin(now * 0.035) * 0.03 +
          Math.cos(now * 0.08) * 0.02;
        const coneGrad = ctx.createLinearGradient(
          projX,
          projY,
          rink.centerX,
          scr.y + scr.height
        );
        coneGrad.addColorStop(0, `rgba(224, 242, 254, ${flicker * 1.6})`);
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

        // 5. Opposite 80s Large-Screen CRT/Three-Lens Projector ("gegenüberliegender 80er-Großbildprojektor")
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(projX - 24, projY - 10, 48, 26, 4);
        ctx.fill();
        ctx.stroke();
        // Iconic 80s Red-Green-Blue CRT Projector Lenses
        ['#ef4444', '#22c55e', '#3b82f6'].forEach((lensCol, lIdx) => {
          ctx.fillStyle = lensCol;
          ctx.beginPath();
          ctx.arc(projX - 11 + lIdx * 11, projY - 9, 3.8, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          '📼 PALLADIUM 1989 GROSSPROJEKTOR & MITTELSÄULEN-LEINWAND',
          rink.centerX,
          scr.y - 32
        );
        ctx.restore();
      } else {
        ctx.fillStyle = '#020617';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.fillRect(scr.x, scr.y, scr.width, scr.height);
        ctx.strokeRect(scr.x, scr.y, scr.width, scr.height);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px "Silkscreen", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          '🎬 PALLADIUM KINO-LEINWAND (LIVE-STREAM)',
          rink.centerX,
          scr.y - 8
        );
      }
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

  // D. DJ MAGIC FORCE BODY BEHIND THE MIXER (Centered on x = 0!)
  const djBob = Math.sin(now * 0.006) * 4;
  ctx.fillStyle = '#3b0764';
  ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(-17 + djBob, -17, 34, 18, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(djBob, -8, 8.5, 0, Math.PI * 2);
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

  // F. SYMMETRICALLY CENTERED "DJ MAGIC FORCE • ► PULT [KLICK]" FRONT PULPIT BADGE (x = 0!)
  const badgeW = 192;
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-badgeW / 2, deskY + deskH + 3, badgeW, 20, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const cleanDjLabel = (activeDjName || 'DJ MAGIC FORCE').toUpperCase();
  ctx.fillText(
    showNames
      ? `🎧 ${cleanDjLabel} • ► PULT`
      : '► DJ-PULT [KLICK] ◄',
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
  drinkChipAvailable = true
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
  // 1. Diamond-plate threshold ("Riffelblech-Schwelle") in front of the double door
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

  // 2. Heavy Metal Double Door Frame & Two Door Leaves (split at center Y)
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

  // Crash bars / double handles on both door leaves
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(rightWallTechDoor.x + 5, doorMidY - 18, 5, 14);
  ctx.fillRect(rightWallTechDoor.x + 5, doorMidY + 4, 5, 14);

  // Vertical label "TECHNIK & EQUIPMENT" on the metal double door
  ctx.save();
  ctx.translate(rightWallTechDoor.x + 26, doorMidY);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TECHNIK & EQUIPMENT', 0, 0);
  ctx.restore();

  // 3. Glowing Green 80s "NOTAUSGANG" Illuminated Sign with Running-Man Escape Pictogram mounted above/beside the door
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
  // B. 1) KASSE & EINGANG PALLADIUM (FLUSH & STRAIGHT ON THE RIGHT WALL WHERE THE 4TH BENCH USED TO BE!)
  // ==========================================================================
  const { cashierBooth, spinWarmupZone } = bottomEntrance;

  ctx.save();
  ctx.translate(cashierBooth.centerX, cashierBooth.centerY);
  ctx.rotate(cashierBooth.angleRad);

  const cw = cashierBooth.width;
  const ch = cashierBooth.height;

  // Straight booth body flush with the right hall wall (x = 1768..1904, y = 692..880)
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 10);
  ctx.fill();
  ctx.stroke();

  // Ticket counter window ("KASSEN-SCHALTER") on the left edge facing into the hall toward Gate 1
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.fillRect(-cw / 2 + 6, -ch / 2 + 26, 20, ch - 52);
  ctx.strokeRect(-cw / 2 + 6, -ch / 2 + 26, 20, ch - 52);

  // Historic Oval Emblem "ROLLER DISCO Palladium – HANAU-Grimm Center" mounted on the Cashier roof!
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
  // C. 2) PRO-SHOP & TUNING [E] (SHIFTED RIGHT DIRECTLY NEXT TO ANGLED KASSE)
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

  // Historic Oval Emblem inside the Pro-Shop back wall
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
    x: proShopBounds.x + proShopBounds.width / 2,
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
  // D. 3) ROLLSCHUHVERLEIH (SHIFTED RIGHT NEXT TO PRO-SHOP)
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

  // Interactive prompt circle in front of Rollschuhverleih counter (especially highlighted when player is on street shoes!)
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

  renderCharacterSprite(ctx, now, {
    x: rentalBounds.x + rentalBounds.width / 2,
    y: rentalBounds.y + 84,
    headingRad: -Math.PI / 2,
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
    name: 'Verleih (PALLADIUMANER)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });

  // ==========================================================================
  // E. 4) BISTRO & GARNET-LOUNGE IN THE BOTTOM-LEFT CORNER!
  //    - Glowing 80s "WC" Neon Sign (with Ladies/Gents pictogram) at WC / BANDEN-ZUGANG
  //    - Pushed-back "SLUSH & BLOBA [E]" Counter & "THEKEN-CREW" against the lower wall
  //    - Bright Marble Tables ("helle Marmortische") & Black 80s Plastic Chairs ("schwarze 80er-Plastikstühle")
  //      leaving a wide, barrier-free passage in front toward the blue rink barrier!
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

  // 1. Compact Glowing 80s "WC" Illuminated Sign (with Ladies/Gents pictogram) at the back wall in the bottom-left corner
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

  // 2. Bright 80s Marble Tables ("helle Marmortische") & Black 80s Plastic Chairs ("schwarze 80er-Plastikstühle") along the back wall
  for (const mt of bistro.marbleTables) {
    // 4 Black 80s Plastic Chairs around each marble table
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
      // Black molded 80s plastic shell chair
      ctx.fillStyle = '#090d16';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-8, -7, 16, 14, 4);
      ctx.fill();
      ctx.stroke();
      // Curved black plastic backrest
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Bright White/Carrara Marble Table Top with subtle grey marble veins
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = isBlacklight ? '#00f0ff' : '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(mt.x, mt.y, mt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Subtle Carrara marble veins
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mt.x - 14, mt.y - 8);
    ctx.quadraticCurveTo(mt.x - 2, mt.y + 2, mt.x + 15, mt.y - 4);
    ctx.moveTo(mt.x - 10, mt.y + 10);
    ctx.quadraticCurveTo(mt.x + 4, mt.y + 5, mt.x + 12, mt.y + 14);
    ctx.stroke();

    // Slush & Bloba cups on the marble table
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

  // 3. Pushed-Back Beverage Counter with Slush-Puppie Machine & "BLOBA COLA" Dispenser (leaving wide wheelchair-accessible passage in front!)
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

  // Slush-Puppie Machine (Twin Chambers Blue & Pink)
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(bistro.slushMachine.x, bistro.slushMachine.y, 26, 32);
  ctx.fillStyle = '#ff2a85';
  ctx.fillRect(bistro.slushMachine.x + 30, bistro.slushMachine.y, 26, 32);

  // "BLOBA COLA" Retro Dispenser
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

  // Bistro Interaction Zone Prompt ("SLUSH & BLOBA [E]")
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

  // Pushed-back Theken-Crew behind the counter near the lower outer wall
  renderCharacterSprite(ctx, now, {
    x: bistro.counter.x + bistro.counter.width / 2,
    y: bistro.counter.y + 68,
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
    name: 'Theken-Crew (PALLADIUMANER)',
    showName: showNames,
    isBlacklight,
    crashTimer: 0,
    speechBubble: null,
  });
}

function drawSeatedGuest(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shirtColor: string
): void {
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
  ctx.fill();
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
// SCALED 2.5D CHARACTER SPRITE RENDERER (FEMALE/MALE, KENGOL HAT, CREW SHIRTS)
// ============================================================================

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
  }
): void {
  if (activeArenaStyle === 'pixel-16bit') {
    render16BitPixelCharacterSprite(ctx, now, opts);
    return;
  }

  const isFemale = opts.gender === 'female';

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

  if (opts.underglowColor) {
    const glowMap: Record<string, string> = {
      pink: '#ff2a85',
      cyan: '#00f0ff',
      green: '#39ff14',
      gold: '#fde047',
    };
    const gCol = glowMap[opts.underglowColor] || '#00f0ff';
    ctx.fillStyle = gCol;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = opts.isGhost ? 0.65 : 1;
  }

  ctx.save();
  ctx.rotate(opts.headingRad);

  if (opts.isWheelchair) {
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(10, -12, 12, 24, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = opts.isBlacklight ? '#00f0ff' : opts.wheelColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-18, -24, 26, 7, 3);
    ctx.roundRect(-18, 17, 26, 7, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-14, -15, 22, 30);
    ctx.fillStyle = opts.accentColor;
    ctx.fillRect(-17, -14, 5, 28);
  } else if (opts.isStreetShoes) {
    // Normal 80s Street Sneakers (No roller wheels — player must rent skates at Rollschuh-Verleih first!)
    ctx.fillStyle = '#334155';
    ctx.fillRect(-9, -18, 18, 7);
    ctx.fillRect(-9, 11, 18, 7);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-7, -16, 13, 2.5);
    ctx.fillRect(-7, 13, 13, 2.5);
  } else {
    // Roller Skates: Custom Own Skates (dual-tone neon green/pink), 80s Brown/Blue Rental Skates, or Kengo Skates
    const wheelCol = opts.kengoShoesWhitePink
      ? '#ff2a85'
      : opts.isRentalSkates
      ? '#38bdf8'
      : opts.isBlacklight
      ? '#00f0ff'
      : opts.wheelColor;
    ctx.fillStyle = wheelCol;
    if ((opts.kengoShoesWhitePink || opts.isCustomOwnSkates) && opts.isBlacklight) {
      ctx.shadowColor = wheelCol;
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(-10, -21, 18, 5);
    ctx.fillRect(-10, 16, 18, 5);

    if (opts.isCustomOwnSkates) {
      // Sporty dual-color custom racing wheel accent on own skates!
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(-1, -21, 9, 5);
      ctx.fillRect(-1, 16, 9, 5);
    }

    // Boot (Amber-brown leather for classic 80s rental skates, crisp white with racing stripes for own/Kengo skates!)
    ctx.fillStyle = opts.isRentalSkates ? '#b45309' : '#ffffff';
    ctx.fillRect(-11, -18, 20, 7);
    ctx.fillRect(-11, 11, 20, 7);
    if (opts.kengoShoesWhitePink) {
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(-9, -16, 16, 3);
      ctx.fillRect(-9, 13, 16, 3);
    } else if (opts.isCustomOwnSkates) {
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(-9, -16, 16, 2.5);
      ctx.fillRect(-9, 13, 16, 2.5);
    } else if (opts.isRentalSkates) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-8, -16, 14, 2);
      ctx.fillRect(-8, 13, 14, 2);
    }
    ctx.shadowBlur = 0;

    // Female 80s Legwarmers (Stulpen) over the skates!
    if (isFemale && opts.legwarmerColor) {
      ctx.fillStyle = opts.legwarmerColor;
      ctx.fillRect(-8, -17, 11, 6);
      ctx.fillRect(-8, 11, 11, 6);
    }
  }

  // Shoulder width differentiation: Female narrower (31px), Male broader (37px)
  const shoulderSpan = isFemale ? 31 : 37;
  const torsoOffsetX = opts.isSpeedSkater ? 4 : 0;

  // Skate Guards & Hall Staff always wear a pitch-black shirt with glowing neon-green lettering!
  const isCrewOrGuard = opts.isSkateGuard || opts.isPalladiumanerStaff;
  ctx.fillStyle = isCrewOrGuard ? '#070a10' : opts.shirtColor;
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
    // Red lanyard + silver pea whistle
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
    // Iconic Kengol-Bucket-Hat with neon-pink band & golden kangaroo logo!
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
    // Female 80s High Ponytail with Neon Scrunchie + Curls
    const hairCol = '#f59e0b';
    ctx.fillStyle = hairCol;
    ctx.beginPath();
    ctx.arc(1 + torsoOffsetX, 0, 9.5, 0.7, -0.7);
    ctx.fill();
    // Ponytail flowing behind (-X)
    const tailWag = Math.sin(now * 0.01 + opts.x) * 2.5;
    ctx.fillStyle = hairCol;
    ctx.beginPath();
    ctx.ellipse(-13 + torsoOffsetX, tailWag, 8.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Neon Scrunchie at ponytail base
    ctx.fillStyle = opts.legwarmerColor || '#ff2a85';
    ctx.beginPath();
    ctx.arc(-6 + torsoOffsetX, tailWag * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Male Short 80s Haircut / Headband
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

  if (opts.crashTimer > 0) {
    for (let s = 0; s < 3; s++) {
      const ang = now * 0.008 + (s * Math.PI * 2) / 3;
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('★', Math.cos(ang) * 22 - 6, -28 + Math.sin(ang) * 8);
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

  // Always render speech bubbles cleanly ABOVE the name badge so they never overlap!
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
    // Subtle golden/turquoise star badge next to connected human skater's name!
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

/**
 * Renders Nurse / Paramedic ("SANI-SANDRA") in a white coat with red cross emblem
 * and first-aid bag, running across the rink, kneeling beside the fallen skater,
 * and walking calmly back off the field.
 */
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

  // Floor shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
  ctx.beginPath();
  ctx.ellipse(0, 8, isKneeling ? 22 : 24, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(saniNurse.headingRad);

  if (!isKneeling) {
    // Running / Walking feet in white medical sneakers
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-8 + stride, -15, 14, 6, 3);
    ctx.roundRect(-8 - stride, 9, 14, 6, 3);
    ctx.fill();
    ctx.stroke();
  }

  // White Nurse / Paramedic Coat ("weißer Kittel")
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(-13, -16, 24, 32, 10);
  ctx.fill();
  ctx.stroke();

  // Prominent Red Cross Symbol ("rotes Kreuz-Symbol") on the back/shoulders of the white coat
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-7, -2.2, 12, 4.4);
  ctx.fillRect(-3.2, -6, 4.4, 12);

  // First-Aid Medkit Case ("Erste-Hilfe-Koffer") carried at her side / placed beside the skater when kneeling
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

  // Kneeling care arms reaching out toward the injured skater
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

  // Head + Nurse Cap with Red Cross
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(3, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // Blonde hair ponytail
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.ellipse(-11, 0, 6.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Classic White Nurse Cap with Red Cross on top
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

  ctx.restore(); // End rotation
  ctx.restore(); // End translation

  if (showNames) {
    drawRetroNameBadge(
      ctx,
      saniNurse.x,
      saniNurse.y - 36,
      '➕ SANI-SANDRA',
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
// CENTRAL ROTATING 80s MIRROR BALL, DISCO SPOTS & SLOW-SKATING ROMANTIC GLOW
// ============================================================================

function renderMirrorBallAndDiscoLighting(
  ctx: CanvasRenderingContext2D,
  now: number,
  isBlacklight: boolean,
  isSlowSkating: boolean
): void {
  const { rink } = ARENA_LAYOUT;
  const cx = rink.centerX;
  const cy = rink.centerY;

  if (isSlowSkating) {
    // 1. SLOW-SKATING MODE:
    // Spots & strobe pause completely; warm dimmed ambiance + illuminated rotating Mirror Ball!
    ctx.fillStyle = 'rgba(24, 6, 20, 0.34)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Rotating Mirror Ball reflections across the rink
    const rot = now * 0.00022;
    const numDots = 78;
    for (let i = 0; i < numDots; i++) {
      const ring = (i % 6) + 1;
      const angle = rot * (ring % 2 === 0 ? 1 : -1.2) + (i * Math.PI * 2) / 13;
      const distX = ring * 115 + Math.sin(now * 0.001 + i) * 24;
      const distY = ring * 68 + Math.cos(now * 0.001 + i) * 18;
      const rx = cx + Math.cos(angle) * distX;
      const ry = cy + Math.sin(angle) * distY;

      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(253, 224, 71, 0.44)'
          : i % 3 === 1
          ? 'rgba(255, 255, 255, 0.38)'
          : 'rgba(244, 114, 182, 0.36)';
      ctx.beginPath();
      ctx.ellipse(rx, ry, 5.5, 3.8, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Two ceiling pin-spot beams shining directly onto the Mirror Ball
    ctx.save();
    ctx.globalAlpha = 0.28;
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

    // Illuminated, sparkling rotating Mirror Ball at (cx, cy)
    ctx.save();
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
    ctx.restore();
    return;
  }

  if (isBlacklight) {
    // 2. BLACKLIGHT UV MODE: Deep UV spots
    const uvSpots = [
      {
        x: cx + Math.cos(now * 0.0008) * 420,
        y: cy + Math.sin(now * 0.0011) * 230,
        col: 'rgba(139, 92, 246, 0.16)',
      },
      {
        x: cx + Math.cos(now * 0.0009 + 2) * 440,
        y: cy + Math.sin(now * 0.0007 + 1) * 240,
        col: 'rgba(0, 240, 255, 0.14)',
      },
      {
        x: cx + Math.cos(now * 0.0007 + 4) * 390,
        y: cy + Math.sin(now * 0.001 + 3) * 220,
        col: 'rgba(217, 70, 239, 0.15)',
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
    // 3. DISCO-SPOTS MODE:
    // Mirror ball stays OFF! Instead: subtle, cool white spotlight cones + short, rhythmic strobe impulses!
    const coolWhiteSpots = [
      {
        sx: cx - 420,
        sy: 110,
        tx: cx + Math.cos(now * 0.0009) * 410,
        ty: cy + Math.sin(now * 0.0011) * 225,
      },
      {
        sx: cx + 420,
        sy: 110,
        tx: cx + Math.cos(now * 0.0008 + 2.2) * 420,
        ty: cy + Math.sin(now * 0.0009 + 1.4) * 230,
      },
      {
        sx: cx - 220,
        sy: 110,
        tx: cx + Math.cos(now * 0.0007 + 4.1) * 370,
        ty: cy + Math.sin(now * 0.001 + 3.2) * 210,
      },
      {
        sx: cx + 220,
        sy: 110,
        tx: cx + Math.cos(now * 0.001 + 5.2) * 350,
        ty: cy + Math.sin(now * 0.0008 + 4.5) * 205,
      },
    ];

    ctx.save();
    for (const sp of coolWhiteSpots) {
      // Subtle cool-white beam cone
      const beamGrad = ctx.createLinearGradient(sp.sx, sp.sy, sp.tx, sp.ty);
      beamGrad.addColorStop(0, 'rgba(224, 242, 254, 0.09)');
      beamGrad.addColorStop(1, 'rgba(186, 230, 253, 0.01)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(sp.sx - 8, sp.sy);
      ctx.lineTo(sp.sx + 8, sp.sy);
      ctx.lineTo(sp.tx + 95, sp.ty);
      ctx.lineTo(sp.tx - 95, sp.ty);
      ctx.closePath();
      ctx.fill();

      // Cool-white floor pool
      const poolGrad = ctx.createRadialGradient(
        sp.tx,
        sp.ty,
        12,
        sp.tx,
        sp.ty,
        195
      );
      poolGrad.addColorStop(0, 'rgba(240, 249, 255, 0.13)');
      poolGrad.addColorStop(0.55, 'rgba(186, 230, 253, 0.06)');
      poolGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = poolGrad;
      ctx.beginPath();
      ctx.arc(sp.tx, sp.ty, 195, 0, Math.PI * 2);
      ctx.fill();
    }

    // Short, rhythmic cool-white Strobe impulses synced to the beat (subtle & comfortable on the eyes)
    const strobeCycle = (now % 1850) / 1850;
    const isStrobeFlash =
      (strobeCycle > 0.0 && strobeCycle < 0.028) ||
      (strobeCycle > 0.065 && strobeCycle < 0.088);
    if (isStrobeFlash) {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.085)';
      ctx.fillRect(rink.x, rink.y, rink.width, rink.height);
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

  // Mirror Ball at ceiling: Golden & illuminated in 'palladium-1989' mode; resting in other non-slow-skating modes!
  ctx.save();
  if (activeArenaStyle === 'palladium-1989') {
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
 * VISIBLE 80s HALL & DANCEFLOOR FOG CLOUDS (Rendered OVER floor & floor spots, UNDER Name Badges & HUD Overlays):
 * Soft radial gradient banks in `rgba(215, 230, 255, 0.25)` to `0.40` drifting across the parquet and stage,
 * softly tinted by the Disco-Spots / Stage Spotlights!
 */
function render80sDancefloorFogBanks(
  ctx: CanvasRenderingContext2D,
  now: number,
  baseActive: boolean,
  burstBoost: number,
  isBlacklight: boolean,
  isSlowSkating: boolean,
  isConcertLightingActive: boolean
): void {
  const { rink } = ARENA_LAYOUT;
  const cx = rink.centerX;
  const cy = rink.centerY;

  // Base alpha between 0.25 and 0.40 as requested!
  const baseAlpha = baseActive ? 0.27 : 0.0;
  const peakAlpha = Math.min(0.42, baseAlpha + burstBoost * 0.15);
  if (peakAlpha <= 0.01) return;

  const fogClouds = [
    { ox: -310, oy: -120, rx: 310, ry: 155, spd: 0.00045, ph: 0.2, tint: 'cool' },
    { ox: 0, oy: -35, rx: 370, ry: 180, spd: -0.00038, ph: 1.4, tint: 'magenta' },
    { ox: 320, oy: -110, rx: 300, ry: 150, spd: 0.00042, ph: 2.7, tint: 'cyan' },
    { ox: -260, oy: 135, rx: 320, ry: 160, spd: -0.00048, ph: 3.9, tint: 'cyan' },
    { ox: 40, oy: 115, rx: 380, ry: 175, spd: 0.00036, ph: 5.1, tint: 'warm' },
    { ox: 310, oy: 130, rx: 310, ry: 155, spd: -0.00044, ph: 6.0, tint: 'magenta' },
    { ox: -490, oy: 10, rx: 250, ry: 135, spd: 0.0005, ph: 2.1, tint: 'cool' },
    { ox: 480, oy: 15, rx: 250, ry: 135, spd: -0.0005, ph: 4.4, tint: 'cool' },
  ];

  ctx.save();
  for (const fc of fogClouds) {
    const driftX = Math.sin(now * fc.spd + fc.ph) * 75;
    const driftY = Math.cos(now * fc.spd * 1.15 + fc.ph) * 32;
    const fx = cx + fc.ox + driftX;
    const fy = cy + fc.oy + driftY;
    const pulseR = fc.rx * (0.94 + Math.sin(now * 0.0014 + fc.ph) * 0.1 + burstBoost * 0.18);
    const pulseRy = fc.ry * (0.94 + Math.cos(now * 0.0012 + fc.ph) * 0.1 + burstBoost * 0.18);

    const g = ctx.createRadialGradient(fx, fy, 18, fx, fy, pulseR);
    // Core fog in rgba(215, 230, 255, 0.25..0.40) + subtle spotlight color tint in mid-ring
    g.addColorStop(0, `rgba(215, 230, 255, ${peakAlpha.toFixed(3)})`);
    if (isBlacklight) {
      g.addColorStop(
        0.52,
        fc.tint === 'cyan'
          ? `rgba(125, 211, 252, ${(peakAlpha * 0.68).toFixed(3)})`
          : `rgba(216, 180, 254, ${(peakAlpha * 0.68).toFixed(3)})`
      );
    } else if (isConcertLightingActive || isSlowSkating) {
      g.addColorStop(
        0.52,
        fc.tint === 'magenta'
          ? `rgba(244, 114, 182, ${(peakAlpha * 0.65).toFixed(3)})`
          : fc.tint === 'cyan'
          ? `rgba(103, 232, 249, ${(peakAlpha * 0.65).toFixed(3)})`
          : `rgba(254, 240, 138, ${(peakAlpha * 0.65).toFixed(3)})`
      );
    } else {
      g.addColorStop(0.55, `rgba(215, 230, 255, ${(peakAlpha * 0.58).toFixed(3)})`);
    }
    g.addColorStop(1, 'rgba(215, 230, 255, 0)');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(fx, fy, pulseR, pulseRy, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 16-BIT ARCADE PIXEL-ART SPRITE RENDERER ('pixel-16bit')
 * Draws all skaters and NPCs on a crisp 2px pixel grid with 1px dark outlines,
 * 80s neon outfits, and animated roller skates!
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
  }
): void {
  const isFemale = opts.gender === 'female';
  const isCrewOrGuard = opts.isSkateGuard || opts.isPalladiumanerStaff;
  const pxSnap = (v: number) => Math.round(v / 2) * 2;
  const x = pxSnap(opts.x);
  const y = pxSnap(opts.y);
  const strideFrame = Math.floor(now * 0.012 + (opts.x + opts.y) * 0.02) % 2 === 0 ? -3 : 3;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);

  if (opts.isGhost) {
    ctx.globalAlpha = 0.68;
  }

  // Pixelated drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  ctx.fillRect(-18, 6, 36, 12);
  ctx.fillRect(-14, 4, 28, 16);

  ctx.translate(0, -pxSnap(opts.jumpZ));

  if (opts.underglowColor) {
    const glowMap: Record<string, string> = {
      pink: '#ff2a85',
      cyan: '#00f0ff',
      green: '#39ff14',
      gold: '#fde047',
    };
    ctx.fillStyle = glowMap[opts.underglowColor] || '#00f0ff';
    ctx.globalAlpha = 0.34;
    ctx.fillRect(-24, -20, 48, 40);
    ctx.globalAlpha = opts.isGhost ? 0.68 : 1;
  }

  ctx.save();
  // Quantize rotation to 16 arcade directions for authentic 16-bit arcade feel!
  const quantHeading =
    Math.round(opts.headingRad / (Math.PI / 8)) * (Math.PI / 8);
  ctx.rotate(quantHeading);

  const outlineCol = '#050811';
  const wheelCol = opts.kengoShoesWhitePink
    ? '#ff2a85'
    : opts.isRentalSkates
    ? '#38bdf8'
    : opts.isBlacklight
    ? '#00f0ff'
    : opts.wheelColor;

  if (opts.isWheelchair) {
    // 16-bit pixel wheelchair + neon rim wheels
    ctx.fillStyle = outlineCol;
    ctx.fillRect(-18, -24, 28, 48);
    ctx.fillStyle = wheelCol;
    ctx.fillRect(-16, -22, 24, 6);
    ctx.fillRect(-16, 16, 24, 6);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-12, -14, 20, 28);
  } else {
    // Animated 16-bit Pixel Roller Skates (Left & Right boot + 4 pixel wheels)
    [-19, 13].forEach((sideY, idx) => {
      const legShift = idx === 0 ? strideFrame : -strideFrame;
      // 1px dark pixel outline around skate
      ctx.fillStyle = outlineCol;
      ctx.fillRect(-12 + legShift, sideY - 2, 22, 10);
      // Pixel wheels
      if (!opts.isStreetShoes) {
        ctx.fillStyle = wheelCol;
        ctx.fillRect(-10 + legShift, sideY < 0 ? sideY - 3 : sideY + 6, 6, 3);
        ctx.fillRect(0 + legShift, sideY < 0 ? sideY - 3 : sideY + 6, 6, 3);
      }
      // Boot block
      ctx.fillStyle = opts.isStreetShoes
        ? '#334155'
        : opts.isRentalSkates
        ? '#b45309'
        : '#ffffff';
      ctx.fillRect(-10 + legShift, sideY, 18, 6);
      // 80s neon stripe on boot
      ctx.fillStyle = opts.kengoShoesWhitePink
        ? '#ff2a85'
        : opts.isCustomOwnSkates
        ? '#39ff14'
        : opts.accentColor;
      ctx.fillRect(-8 + legShift, sideY + 2, 12, 2);
    });
  }

  // Torso / 80s Shoulder-Pad Jacket with 1px dark outline
  const shW = isFemale ? 30 : 36;
  ctx.fillStyle = outlineCol;
  ctx.fillRect(-14, -shW / 2 - 2, 26, shW + 4);

  ctx.fillStyle = isCrewOrGuard ? '#070a10' : opts.shirtColor;
  ctx.fillRect(-12, -shW / 2, 22, shW);

  // 80s Neon V-Chevron / Stripe on shoulders
  ctx.fillStyle = isCrewOrGuard
    ? '#39ff14'
    : opts.isBlacklight
    ? '#00f0ff'
    : opts.accentColor;
  ctx.fillRect(-10, -shW / 2 + 2, 4, shW - 4);
  ctx.fillRect(4, -shW / 2 + 2, 4, shW - 4);

  // Pixel Head with 1px dark outline
  ctx.fillStyle = outlineCol;
  ctx.fillRect(-6, -10, 20, 20);
  ctx.fillStyle = opts.isGhost ? '#cffafe' : '#fde68a';
  ctx.fillRect(-4, -8, 16, 16);

  if (opts.kengolHat) {
    // 16-bit Pixel Kengol Bucket Hat
    ctx.fillStyle = '#111827';
    ctx.fillRect(-6, -10, 18, 20);
    ctx.fillStyle = '#ff2a85';
    ctx.fillRect(-2, -8, 4, 16);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(4, -2, 4, 4);
  } else if (isFemale) {
    // 16-bit Pixel High Ponytail + Scrunchie
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-6, -8, 10, 16);
    ctx.fillRect(-16, -4, 8, 8);
    ctx.fillStyle = opts.legwarmerColor || '#ff2a85';
    ctx.fillRect(-8, -3, 4, 6);
  } else {
    // 16-bit Pixel 80s Hair + Neon Headband
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-6, -8, 10, 16);
    ctx.fillStyle = opts.accentColor;
    ctx.fillRect(4, -8, 4, 16);
  }

  ctx.restore();
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
        ? opts.y - opts.jumpZ - 62
        : opts.y - opts.jumpZ - 46;
    drawSpeechBubble(ctx, opts.x, bubbleY, opts.speechBubble);
  }
}

/**
 * CONCERT LIGHTING OVERLAY ("🔦 KONZERTBELEUCHTUNG"):
 * Dims the surrounding hall with a dark veil (`rgba(5, 6, 18, 0.68)`) while keeping
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
  // 1. Dark Hall Light Veil with even-odd Stage Cut-Out
  ctx.fillStyle = `rgba(5, 6, 18, ${0.52 + 0.16 * stageCloseProgress})`;
  ctx.beginPath();
  ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  // Cut out rounded stage spotlight zone in the middle
  ctx.roundRect(sx, sy, sw, sh, 44);
  ctx.fill('evenodd');

  // Soft glowing feather rim around the illuminated stage cut-out
  ctx.strokeStyle = 'rgba(255, 42, 133, 0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(sx, sy, sw, sh, 44);
  ctx.stroke();

  // 2. Sweeping 80s Stage Spotlight Cones in Warm White, Magenta, and Cyan
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

