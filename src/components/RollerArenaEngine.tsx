import React, { useEffect, useRef } from 'react';
import {
  ARENA_LAYOUT,
  CameraViewMode,
  CenterStageMode,
  ChallengeId,
  HallGameMode,
  LightingMode,
  PlayerCharacterMode,
  ProShopUpgradesState,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/arenaConfig';
import { soundFX } from '../utils/soundEffects';

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
  nearBistroCounter: boolean;
  nearDjTower: boolean;
  djAudioProximity: number; // 0.15 .. 1.0
  gamepadConnected: boolean;
  gamepadName: string;
  activeSpeech: string | null;
  ballspielScore: number;
  slalomCombo: number;
}

interface RollerArenaEngineProps {
  playerName: string;
  isAnonymousGuest: boolean;
  showNames: boolean;
  characterMode: PlayerCharacterMode;
  cameraMode: CameraViewMode;
  lightingMode: LightingMode;
  centerStageMode: CenterStageMode;
  activeBandName: string;
  hallGameMode: HallGameMode;
  djTickerText: string;
  specialSkaters: string[];
  ghostSkatersEnabled: boolean;
  kengolHatEnabled: boolean;
  upgrades: ProShopUpgradesState;
  isCurtainOpen: boolean;
  onToggleCamera: () => void;
  onToggleCharacterMode: () => void;
  onToggleShowNames: () => void;
  onToggleUnderglow: () => void;
  onToggleKengolHat: () => void;
  onOpenProShopModal: () => void;
  onOpenChronicleModal: () => void;
  onEnterHallFromGamepad: () => void;
  onToggleTwitchStream?: () => void;
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

export const RollerArenaEngine: React.FC<RollerArenaEngineProps> = ({
  playerName,
  isAnonymousGuest,
  showNames,
  characterMode,
  cameraMode,
  lightingMode,
  centerStageMode,
  activeBandName,
  hallGameMode,
  djTickerText,
  specialSkaters,
  ghostSkatersEnabled,
  kengolHatEnabled,
  upgrades,
  isCurtainOpen,
  onToggleCamera,
  onToggleCharacterMode,
  onToggleShowNames,
  onToggleUnderglow,
  onToggleKengolHat,
  onOpenProShopModal,
  onOpenChronicleModal,
  onEnterHallFromGamepad,
  onToggleTwitchStream,
  onChallengeProgress,
  onTelemetry,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const propsRef = useRef({
    playerName,
    isAnonymousGuest,
    showNames,
    characterMode,
    cameraMode,
    lightingMode,
    centerStageMode,
    activeBandName,
    hallGameMode,
    djTickerText,
    specialSkaters,
    ghostSkatersEnabled,
    kengolHatEnabled,
    upgrades,
    isCurtainOpen,
    onToggleCamera,
    onToggleCharacterMode,
    onToggleShowNames,
    onToggleUnderglow,
    onToggleKengolHat,
    onOpenProShopModal,
    onOpenChronicleModal,
    onEnterHallFromGamepad,
    onToggleTwitchStream,
    onChallengeProgress,
    onTelemetry,
  });

  useEffect(() => {
    propsRef.current = {
      playerName,
      isAnonymousGuest,
      showNames,
      characterMode,
      cameraMode,
      lightingMode,
      centerStageMode,
      activeBandName,
      hallGameMode,
      djTickerText,
      specialSkaters,
      ghostSkatersEnabled,
      kengolHatEnabled,
      upgrades,
      isCurtainOpen,
      onToggleCamera,
      onToggleCharacterMode,
      onToggleShowNames,
      onToggleUnderglow,
      onToggleKengolHat,
      onOpenProShopModal,
      onOpenChronicleModal,
      onEnterHallFromGamepad,
      onToggleTwitchStream,
      onChallengeProgress,
      onTelemetry,
    };
  }, [
    playerName,
    isAnonymousGuest,
    showNames,
    characterMode,
    cameraMode,
    lightingMode,
    centerStageMode,
    activeBandName,
    hallGameMode,
    djTickerText,
    specialSkaters,
    ghostSkatersEnabled,
    kengolHatEnabled,
    upgrades,
    isCurtainOpen,
    onToggleCamera,
    onToggleCharacterMode,
    onToggleShowNames,
    onToggleUnderglow,
    onToggleKengolHat,
    onOpenProShopModal,
    onOpenChronicleModal,
    onEnterHallFromGamepad,
    onToggleTwitchStream,
    onChallengeProgress,
    onTelemetry,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ========================================================================
    // 1. PLAYER & WORLD RUNTIME STATE (STARTS NEAR BOTTOM-RIGHT ENTRANCE GATE 1)
    // ========================================================================
    const player = {
      x: 1445,
      y: 785,
      vx: 0,
      vy: 0,
      headingRad: -Math.PI / 2,
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
      freeSlushCount: 1,
      freeBlobaCount: 1,
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

    // DJ Magic Force Neon Speech Bubble & "Put your hands up!" Crowd Cheer State
    let djSpeechBubble: string | null =
      '🎤 "Willkommen im Palladium Hanau! Let\'s roll!"';
    let djSpeechTimer = 6.5;
    let djNextAutoSpeechTimer = 22.0;
    let djHandsUpCheerTimer = 0;
    let prevLightingMode: LightingMode = propsRef.current.lightingMode;
    let prevHallGameMode: HallGameMode = propsRef.current.hallGameMode;

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
    // 2. INITIALIZE TRACK NPCS (MALE & FEMALE DISTINCT + SKATE GUARDS IN BLACK/GREEN)
    // ========================================================================
    const trackNpcs: TrackNpc[] = [
      // 4 Speed-Skaters in a tight Paceline right along the outer barrier/wall
      {
        id: 'speed-1',
        name: 'Paceline-Leader Kai',
        gender: 'male',
        role: 'speed',
        orbitAngle: 0.4,
        laneRadiusX: 668,
        laneRadiusY: 336,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        headingRad: 0,
        baseSpeed: 0.92,
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
        orbitAngle: 0.3,
        laneRadiusX: 668,
        laneRadiusY: 336,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        headingRad: 0,
        baseSpeed: 0.92,
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
        orbitAngle: 0.2,
        laneRadiusX: 668,
        laneRadiusY: 336,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        headingRad: 0,
        baseSpeed: 0.92,
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
        orbitAngle: 0.1,
        laneRadiusX: 668,
        laneRadiusY: 336,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        headingRad: 0,
        baseSpeed: 0.92,
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

      // 2 Active Skate Guards (Black shirt with glowing neon-green "GUARD" / "CREW" lettering + whistle)
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
        baseSpeed: 0.68,
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
        baseSpeed: 0.68,
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

      // Regular Counter-Clockwise Skaters & 1 Wheelchair NPC (adjusted around the wider center U-islands!)
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
        baseSpeed: 0.56,
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
        baseSpeed: 0.61,
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
        baseSpeed: 0.63,
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
        baseSpeed: 0.58,
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
    ];

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

      // 1. Check Bistro Counter proximity (Slush-Puppie & Bloba Cola at bottom-left Bistro)
      const distBistro = Math.hypot(
        player.x - ARENA_LAYOUT.bistro.interactX,
        player.y - ARENA_LAYOUT.bistro.interactY
      );
      if (distBistro <= ARENA_LAYOUT.bistro.interactRadius) {
        player.slushRemainingSec = 75;
        player.blobaColaRemainingSec = 45;
        if (player.freeSlushCount > 0 || player.freeBlobaCount > 0) {
          player.freeSlushCount = Math.max(0, player.freeSlushCount - 1);
          player.freeBlobaCount = Math.max(0, player.freeBlobaCount - 1);
          player.speechBubble =
            '🎁 Willkommens-Gutschein eingelöst: Slush Puppy & Bloba Cola gratis!';
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
      } else if (k === '1' && player.freeSlushCount > 0) {
        player.freeSlushCount -= 1;
        player.slushRemainingSec = 75;
        player.speechBubble = '🍧 Gratis Slush Puppy eingelöst! Mega Cool-Kick!';
        player.speechTimer = 2.8;
        soundFX.playDrinkRefresh();
        propsRef.current.onChallengeProgress('bistro_drink', 1);
      } else if (k === '2' && player.freeBlobaCount > 0) {
        player.freeBlobaCount -= 1;
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
    let aiGuardBallThrowTimer = 0;

    const stepFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const p = propsRef.current;

      // Welcome Gift Notification on First Hall Entry (1x Slush Puppy & 1x Bloba Cola credited automatically!)
      if (p.isCurtainOpen && !player.hasShownWelcomeGift) {
        player.hasShownWelcomeGift = true;
        player.freeSlushCount = Math.max(1, player.freeSlushCount);
        player.freeBlobaCount = Math.max(1, player.freeBlobaCount);
        player.speechBubble =
          '🎁 Willkommensgeschenk: 1x Slush Puppy & 1x Bloba Cola gratis im Inventar!';
        player.speechTimer = 4.5;
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
            '🎤 "Slow Skating Kuschelrunde – schnappt euch euren Partner!"';
        } else if (p.lightingMode === 'putzlicht') {
          djSpeechBubble =
            '🎤 "Volles Putzlicht an – freie Sicht auf dem Parkett!"';
        } else {
          djSpeechBubble =
            '🎤 "Disco-Spots an! Let\'s roll, Palladium Hanau!"';
        }
        djSpeechTimer = 5.5;
        djNextAutoSpeechTimer = 22.0;
      }

      if (p.hallGameMode !== prevHallGameMode) {
        prevHallGameMode = p.hallGameMode;
        if (p.hallGameMode === 'ballspiel') {
          djSpeechBubble =
            '🎤 "Jägerball / Ballspiel startet! Achtung vor den Neon-Softbällen!"';
          djSpeechTimer = 5.5;
        } else if (p.hallGameMode === 'stuhlsprung') {
          djSpeechBubble =
            '🎤 "Rundum-Stuhlsprung frei! Alle Zuschauer an die Bande!"';
          djSpeechTimer = 5.5;
        } else if (p.hallGameMode === 'slalom') {
          djSpeechBubble =
            '🎤 "Slalom-Parcours eröffnet! Zeigt eure saubersten Kurven!"';
          djSpeechTimer = 5.5;
        }
        djNextAutoSpeechTimer = 22.0;
      }

      djNextAutoSpeechTimer -= dt;
      if (djNextAutoSpeechTimer <= 0 && p.isCurtainOpen) {
        djNextAutoSpeechTimer = 21 + Math.random() * 7;
        const djPhrases = [
          '🎤 "Put your hands up in the air!"',
          '🎤 "Palladium Hanau – seid ihr gut drauf?!"',
          '🎤 "Let\'s roll! Danger Rytm Crew in the mix!"',
          '🎤 "Put your hands up in the air!"',
          '🎤 "Klecknix Twin-Decks live aus der Eck-Kanzel!"',
        ];
        const chosen =
          djPhrases[Math.floor(Math.random() * djPhrases.length)];
        djSpeechBubble = chosen;
        djSpeechTimer = 5.5;
        if (chosen.includes('Put your hands up')) {
          triggerHandsUpCrowdCheer();
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
        player.x += (1745 - player.x) * dt * 2.5;
        player.y += (520 - player.y) * dt * 2.5;
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
      // C. PLAYER MOVEMENT, UPGRADES, WAX SLIP & WHEELCHAIR FORWARD FIX
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
      player.isOnWaxPatch = waxDx * waxDx + waxDy * waxDy <= 1.0;

      const bearingsMult = p.upgrades.bearingsAbec9 ? 1.18 : 1.0;
      const platesMult = p.upgrades.aluPlatesHighTop ? 1.16 : 1.0;
      const slushMult = player.slushRemainingSec > 0 ? 1.14 : 1.0;
      const blobaMult = player.blobaColaRemainingSec > 0 ? 1.15 : 1.0;
      const slipstreamMult = player.isSlipstreamActive ? 1.22 : 1.0;

      const maxSpeed = 355 * bearingsMult * slushMult * slipstreamMult;
      const airControlMult = player.isJumping ? 0.65 : 1.0;
      const accel = 540 * platesMult * blobaMult * airControlMult;

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
              player.crashTimer = 1.6;
              player.speechBubble = 'Huch, frisch gebohnert!';
              player.speechTimer = 2.4;
              player.totalCrashes += 1;
              player.consecutiveCrashes += 1;
              soundFX.playCrash(false);
            }
          }
        } else if (padThrottle > 0.1) {
          player.vx += Math.cos(player.headingRad) * accel * padThrottle * dt;
          player.vy += Math.sin(player.headingRad) * accel * padThrottle * dt;
        }
      }

      const baseFriction = player.isOnWaxPatch
        ? p.upgrades.highGripWheels
          ? 0.991
          : 0.9965
        : p.upgrades.bearingsAbec9
        ? 0.9915
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
        player.headingRad = rotateShortest(
          player.headingRad,
          targetHeading,
          dt * 11.5
        );
        player.stridePhase += speed * dt * 0.032;
      }

      // Record Neon Underglow or Slush / Bloba Wheel Trails on the Parquet
      if (
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
      const { rink, djTower } = ARENA_LAYOUT;
      const onRinkFloor =
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
      // F. UPDATE TRACK NPCS, SLOW-SKATING COUPLES & BARRIER-SITTING GUARD WHISTLE
      // ----------------------------------------------------------------------
      player.isSlipstreamActive = false;

      if (
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

      // Random Barrier-Sitting Event: Every ~13–18s in free-skate, a regular NPC sits on the blue outer barrier
      if (p.hallGameMode === 'free-skate') {
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

      const isSlowSkating = p.lightingMode === 'slow-skating';
      const activeSitterNpc = activeBarrierSitterId
        ? trackNpcs.find((n) => n.id === activeBarrierSitterId)
        : null;

      // Find nearest Skate Guard to intercept any NPC sitting on the blue barrier
      let assignedBarrierGuardId: string | null = null;
      if (activeSitterNpc && activeSitterNpc.sittingBarrierSpot) {
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
        if (npc.sittingBarrierSpot) {
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
            soundFX.playSkateGuardWhistle();
            npc.speechText = '📣 TRILLER! Nicht auf der Bande sitzen!';
            npc.speechTimer = 3.4;
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

        // 5. Slow-Skating Mode: Romantic couples skating side-by-side + skilled backward skaters!
        const speedMult = isSlowSkating
          ? npc.role === 'speed'
            ? 0.55
            : 0.68
          : 1.0;

        // Pair up 'reg-2' (Neon-Nadine, female) right next to 'reg-1' (Disco-Dieter, male) & 'speed-2' (Aero-Anja) next to 'speed-3' (Turbo-Marek)
        if (isSlowSkating && npc.id === 'reg-2') {
          const partner = trackNpcs.find((n) => n.id === 'reg-1');
          if (partner) {
            npc.orbitAngle = partner.orbitAngle;
          }
        } else if (isSlowSkating && npc.id === 'speed-2') {
          const partner = trackNpcs.find((n) => n.id === 'speed-3');
          if (partner) {
            npc.orbitAngle = partner.orbitAngle;
          }
        } else {
          npc.orbitAngle = normalizeAngle(
            npc.orbitAngle - npc.baseSpeed * speedMult * dt
          );
        }

        const effectiveRadiusX =
          isSlowSkating && npc.id === 'reg-2'
            ? 466
            : isSlowSkating && npc.id === 'speed-2'
            ? 630
            : npc.laneRadiusX;
        const effectiveRadiusY =
          isSlowSkating && npc.id === 'reg-2'
            ? 232
            : isSlowSkating && npc.id === 'speed-2'
            ? 315
            : npc.laneRadiusY;

        const trackPt = computeTrackOvalPoint(
          rink.centerX,
          rink.centerY,
          effectiveRadiusX,
          effectiveRadiusY,
          npc.orbitAngle,
          npc.role === 'speed'
        );

        let targetX = trackPt.x;
        let targetY = trackPt.y;

        if (npc.role === 'regular' && !isSlowSkating) {
          const sway = Math.sin(now * 0.004 + npc.laneRadiusX) * 12;
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
              soundFX.playSkateGuardWhistle();
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

        // In Slow-Skating mode, Slalom-Steffi ('reg-4') and Paceline-Leader Kai ('speed-1') skate backwards!
        const skatesBackwards =
          isSlowSkating && (npc.id === 'reg-4' || npc.id === 'speed-1');
        const desiredHeading = skatesBackwards
          ? normalizeAngle(trackPt.tangentRad + Math.PI)
          : trackPt.tangentRad;

        npc.headingRad = rotateShortest(
          npc.headingRad === 0 ? desiredHeading : npc.headingRad,
          desiredHeading,
          dt * 14
        );

        // Check if player is drafting in the visible Slipstream behind the Speed-Skater paceline
        if (npc.role === 'speed') {
          const behindX = npc.x - Math.cos(trackPt.tangentRad) * 65;
          const behindY = npc.y - Math.sin(trackPt.tangentRad) * 65;
          if (
            Math.hypot(player.x - behindX, player.y - behindY) < 82 &&
            speed > 110
          ) {
            player.isSlipstreamActive = true;
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
            soundFX.playSkateGuardWhistle();
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
              player.crashTimer = 2.0;
              player.totalCrashes += 1;
              player.consecutiveCrashes += 1;
              player.vx = nx * 140;
              player.vy = ny * 140;
              player.speechBubble = 'Hoppla!';
              player.speechTimer = 2.0;
              npc.speechText = 'Uff! Aufpassen!';
              npc.speechTimer = 2.0;

              if (player.consecutiveCrashes >= 3) {
                player.consecutiveCrashes = 0;
                player.medicRescueTimer = 3.6;
                player.speechBubble = '🚑 Sanitäter-Einsatz! Ab an die Bande!';
                player.speechTimer = 3.6;
                soundFX.playCrash(true);
                soundFX.playSkateGuardWhistle();
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

      if (player.isSlipstreamActive) {
        player.slipstreamAccumSec += dt;
        p.onChallengeProgress(
          'slipstream_10s',
          Math.floor(player.slipstreamAccumSec),
          true
        );
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
              player.crashTimer = 1.6;
              player.totalCrashes += 1;
              player.vx *= -0.35;
              player.vy *= -0.35;
              player.speechBubble = 'Schepper! Zu spät abgesprungen!';
              player.speechTimer = 2.2;
              soundFX.playCrash(false);
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
      renderCompleteScene(
        ctx,
        now,
        p,
        player,
        trackNpcs,
        waxPatch,
        stageCloseProgress,
        slalomCones,
        jumpChairs,
        softballs,
        trails,
        sparks,
        djSpeechBubble,
        djHandsUpCheerTimer > 0
      );

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

function renderCompleteScene(
  ctx: CanvasRenderingContext2D,
  now: number,
  p: {
    playerName: string;
    isAnonymousGuest: boolean;
    showNames: boolean;
    characterMode: PlayerCharacterMode;
    cameraMode: CameraViewMode;
    lightingMode: LightingMode;
    centerStageMode: CenterStageMode;
    activeBandName: string;
    hallGameMode: HallGameMode;
    djTickerText: string;
    specialSkaters: string[];
    ghostSkatersEnabled: boolean;
    kengolHatEnabled: boolean;
    upgrades: ProShopUpgradesState;
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
  waxPatch: { x: number; y: number; radiusX: number; radiusY: number },
  stageCloseProgress: number,
  slalomCones: SlalomCone[],
  jumpChairs: JumpObstacleChair[],
  softballs: NeonSoftball[],
  trails: WheelTrailPoint[],
  sparks: SparkParticle[],
  djSpeechBubble: string | null,
  djHandsUpActive: boolean
): void {
  const isPutzlicht = p.lightingMode === 'putzlicht';
  const isBlacklight = p.lightingMode === 'blacklight';
  const isSlowSkating = p.lightingMode === 'slow-skating';

  ctx.save();

  ctx.fillStyle = isPutzlicht
    ? '#475569'
    : isBlacklight
    ? '#110726'
    : isSlowSkating
    ? '#1a0f1e'
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

  // 1. OUTER HALL FLOOR
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
  } else {
    woodGrad.addColorStop(0, '#3f2213');
    woodGrad.addColorStop(1, '#2b160c');
  }
  ctx.fillStyle = woodGrad;
  ctx.fillRect(rink.x, rink.y, rink.width, rink.height);

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

  // Render Visible Slipstream (Windschatten) behind the outer Speed-Skater Paceline
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

  // 5. 90°-ROTATED CENTER U-ISLANDS (`[` LEFT & `]` RIGHT), JAM-SKATERS IN BETWEEN, OR COLLAPSIBLE EVENT STAGE
  renderCenterIslandsOrStage(
    ctx,
    now,
    stageCloseProgress,
    p.centerStageMode,
    p.activeBandName,
    p.showNames,
    isBlacklight,
    djHandsUpActive
  );

  // 6. CURVED QUARTER-CIRCLE TOP-LEFT CORNER DJ-TOWER ("KLECKNIX" TURNTABLES + VINYL CABINET + DJ SPEECH BUBBLE)
  renderCurvedDjTowerCorner(
    ctx,
    now,
    p.djTickerText,
    p.showNames,
    isBlacklight,
    djSpeechBubble
  );

  // 7. HALL TOUR: RIGHT WALL BENCHES, ANGLED CASHIER -> PRO-SHOP -> VERLEIH -> COMPACT BOTTOM-LEFT BISTRO
  renderHallTourZonesAndStaff(ctx, now, p.showNames, isBlacklight);

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

  // 9. RENDER TRACK NPCS (WITH FEMALE PONYTAILS/LEGWARMERS, MALE HAIRCUTS, AND SLOW-SKATE HEARTS)
  if (isSlowSkating && p.hallGameMode === 'free-skate') {
    const pairIds = [
      ['reg-1', 'reg-2'],
      ['speed-3', 'speed-2'],
    ];
    for (const [idA, idB] of pairIds) {
      const a = trackNpcs.find((n) => n.id === idA);
      const b = trackNpcs.find((n) => n.id === idB);
      if (a && b) {
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💕', (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
      }
    }
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

  // Render Special Ghost Skaters (When enabled in Admin Terminal — with subtle dual roller-wheel tracks instead of stick-tail!)
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

        // Subtle dual roller-wheel tracks ("dezente Rollen-Spuren" instead of a single stick tail!)
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
          ctx.moveTo(sx - Math.cos(gHeading) * 10, sy - Math.sin(gHeading) * 10);
          ctx.lineTo(sx - Math.cos(gHeading) * 46, sy - Math.sin(gHeading) * 46);
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

  // 10. RENDER PLAYER CHARACTER (Supports [H] Kengol-Bucket-Hat & White-Pink Kengo Skates!)
  const displayPlayerName =
    p.isAnonymousGuest || !p.playerName.trim() ? '' : p.playerName.trim();

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
    shirtColor: p.hallGameMode === 'ballspiel' ? '#070a10' : '#1e1b4b',
    accentColor: '#39ff14',
    wheelColor: p.kengolHatEnabled ? '#ff2a85' : '#00f0ff',
    kengolHat: p.kengolHatEnabled,
    kengoShoesWhitePink: p.kengolHatEnabled,
    name: displayPlayerName,
    showName: p.showNames && displayPlayerName.length > 0,
    isBlacklight,
    crashTimer: player.crashTimer,
    speechBubble: player.speechBubble,
    underglowColor: p.upgrades.underglowEnabled
      ? p.upgrades.underglowColor
      : undefined,
  });

  if (player.medicRescueTimer > 0) {
    renderParamedicsStretcher(ctx, player.x, player.y);
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

  ctx.restore(); // End world camera transform

  // 12. FULLSCREEN CAMERA FIX: RENDER CRISP RADAR-MINIMAP TOP-RIGHT WHEN IN CHASE OR EGO VIEW
  if (p.cameraMode === 'chase' || p.cameraMode === 'ego') {
    renderRadarMinimap(ctx, player, trackNpcs, p.cameraMode);
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
    const moveLabel =
      moveIndex <= 1 ? 'Sync-Mirror-Groove' : moveIndex === 2 ? 'Windmill-Spin' : 'Handstand-Freeze';
    drawRetroNameBadge(
      ctx,
      bd.x + 6,
      bd.y - 44,
      `${bd.name} (${moveLabel})`,
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
  showNames: boolean,
  isBlacklight: boolean,
  djHandsUpActive: boolean
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

  // 3. When the two U-Islands are open, 2 Jam-Roller-Skaters (WITH roller skates!) dance in the wide open center aisle between them!
  if (stageCloseProgress < 0.3 && centerStageMode === 'islands') {
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
        jumpZ: djHandsUpActive ? Math.abs(Math.sin(now * 0.01 + js.phase)) * 6 : 0,
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
      ctx.fillStyle = '#090d16';
      ctx.fillRect(sx + 32, sy + 24, sw - 64, 34);
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 16px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`★ LIVE: ${activeBandName} ★`, rink.centerX, sy + 46);

      const bandPositions = [
        { bx: rink.centerX, by: sy + 108, col: '#f59e0b' },
        { bx: rink.centerX, by: sy + 185, col: '#ec4899' },
        { bx: rink.centerX - 105, by: sy + 155, col: '#00f0ff' },
        { bx: rink.centerX + 105, by: sy + 155, col: '#39ff14' },
      ];
      for (const m of bandPositions) {
        const bounce = Math.sin(now * 0.01 + m.bx) * 4;
        ctx.fillStyle = m.col;
        ctx.beginPath();
        ctx.arc(m.bx, m.by + bounce, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(m.bx, m.by - 4 + bounce, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (centerStageMode === 'cinema') {
      const scr = uIslands.cinemaScreenRect;
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

// ============================================================================
// CURVED QUARTER-CIRCLE TOP-LEFT CORNER DJ-TOWER (SYMMETRICAL AXIS & DJ SPEECH BUBBLES)
// ============================================================================

function renderCurvedDjTowerCorner(
  ctx: CanvasRenderingContext2D,
  now: number,
  djTickerText: string,
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
  ctx.fillText(
    showNames
      ? '🎧 DJ MAGIC FORCE • ► PULT [KLICK]'
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
  isBlacklight: boolean
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
  // B. 1) KASSE & EINGANG PALLADIUM (MIRRORED IN BOTTOM-RIGHT CORNER, ANGLED TOWARD HALL CENTER!)
  // ==========================================================================
  const { cashierBooth, spinWarmupZone } = bottomEntrance;

  ctx.save();
  ctx.translate(cashierBooth.centerX, cashierBooth.centerY);
  ctx.rotate(cashierBooth.angleRad);

  const cw = cashierBooth.width;
  const ch = cashierBooth.height;

  // Mirrored angled booth body at the bottom-right outer wall facing diagonally up-left into the hall
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 10);
  ctx.fill();
  ctx.stroke();

  // Ticket counter window at the front (facing up-left toward the hall interior)
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 2;
  ctx.fillRect(-cw / 2 + 22, -ch / 2 + 8, cw - 44, 22);
  ctx.strokeRect(-cw / 2 + 22, -ch / 2 + 8, cw - 44, 22);

  // Historic Oval Emblem "ROLLER DISCO Palladium – HANAU-Grimm Center" mounted on the Cashier roof!
  drawRollerDiscoOvalEmblem(ctx, 0, 14, 72, 24, isBlacklight);

  ctx.fillStyle = '#39ff14';
  ctx.font = 'bold 11.5px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('1) KASSE & EINGANG PALLADIUM', 0, -17);
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
    name: string;
    showName: boolean;
    isBlacklight: boolean;
    crashTimer: number;
    speechBubble: string | null;
    underglowColor?: string;
  }
): void {
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
  } else {
    // Roller Skates OR White-Pink Kengo Skates ([H] mode)
    const wheelCol = opts.kengoShoesWhitePink
      ? '#ff2a85'
      : opts.isBlacklight
      ? '#00f0ff'
      : opts.wheelColor;
    ctx.fillStyle = wheelCol;
    if (opts.kengoShoesWhitePink && opts.isBlacklight) {
      ctx.shadowColor = '#ff2a85';
      ctx.shadowBlur = 10;
    }
    ctx.fillRect(-10, -21, 18, 5);
    ctx.fillRect(-10, 16, 18, 5);

    // Boot (Crisp white with neon-pink Kengo stripes when kengoShoesWhitePink is active!)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-11, -18, 20, 7);
    ctx.fillRect(-11, 11, 20, 7);
    if (opts.kengoShoesWhitePink) {
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(-9, -16, 16, 3);
      ctx.fillRect(-9, 13, 16, 3);
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

  if (opts.speechBubble) {
    drawSpeechBubble(ctx, opts.x, opts.y - opts.jumpZ - 56, opts.speechBubble);
  }

  if (opts.showName && opts.name) {
    drawRetroNameBadge(
      ctx,
      opts.x,
      opts.y - opts.jumpZ - 34,
      opts.name,
      isCrewOrGuard ? '#39ff14' : opts.accentColor
    );
  }
}

/** Clamps all name badges inside the canvas edges so nothing is ever cut off! */
function drawRetroNameBadge(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  text: string,
  borderColor: string
): void {
  ctx.save();
  ctx.font = 'bold 11.5px "Silkscreen", "JetBrains Mono", monospace';
  const metrics = ctx.measureText(text);
  const padX = 9;
  const w = metrics.width + padX * 2;
  const h = 21;

  const cx = Math.max(w / 2 + 8, Math.min(WORLD_WIDTH - w / 2 - 8, worldX));
  const cy = Math.max(h / 2 + 8, Math.min(WORLD_HEIGHT - h / 2 - 36, worldY));

  ctx.fillStyle = 'rgba(5, 8, 17, 0.92)';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
  ctx.restore();
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  text: string
): void {
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

function renderParamedicsStretcher(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number
): void {
  ctx.save();
  ctx.translate(px, py + 32);
  ctx.fillStyle = '#f97316';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.fillRect(-36, -10, 72, 20);
  ctx.strokeRect(-36, -10, 72, 20);
  [-46, 46].forEach((mx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(mx - 6, -2, 12, 4);
    ctx.fillRect(mx - 2, -6, 4, 12);
  });
  ctx.restore();
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
    // Warm dimmed romantic amber/rose Slow-Skating ambiance
    ctx.fillStyle = 'rgba(24, 6, 20, 0.34)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  const spots = [
    {
      x: cx + Math.cos(now * 0.0008) * 420,
      y: cy + Math.sin(now * 0.0011) * 230,
      col: isBlacklight
        ? 'rgba(139, 92, 246, 0.16)'
        : isSlowSkating
        ? 'rgba(245, 158, 11, 0.16)'
        : 'rgba(236, 72, 153, 0.11)',
    },
    {
      x: cx + Math.cos(now * 0.0009 + 2) * 440,
      y: cy + Math.sin(now * 0.0007 + 1) * 240,
      col: isBlacklight
        ? 'rgba(0, 240, 255, 0.14)'
        : isSlowSkating
        ? 'rgba(244, 63, 94, 0.15)'
        : 'rgba(6, 182, 212, 0.11)',
    },
    {
      x: cx + Math.cos(now * 0.0007 + 4) * 390,
      y: cy + Math.sin(now * 0.001 + 3) * 220,
      col: isBlacklight
        ? 'rgba(217, 70, 239, 0.15)'
        : isSlowSkating
        ? 'rgba(217, 119, 6, 0.14)'
        : 'rgba(57, 255, 20, 0.09)',
    },
    {
      x: cx + Math.cos(now * 0.001 + 5) * 360,
      y: cy + Math.sin(now * 0.0008 + 4) * 210,
      col: isBlacklight
        ? 'rgba(99, 102, 241, 0.15)'
        : isSlowSkating
        ? 'rgba(192, 132, 252, 0.13)'
        : 'rgba(250, 204, 21, 0.09)',
    },
  ];

  for (const s of spots) {
    const grad = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, 260);
    grad.addColorStop(0, s.col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 260, 0, Math.PI * 2);
    ctx.fill();
  }

  const rot = now * (isSlowSkating ? 0.00018 : 0.00035);
  const numDots = 72;
  for (let i = 0; i < numDots; i++) {
    const ring = (i % 6) + 1;
    const angle = rot * (ring % 2 === 0 ? 1 : -1.2) + (i * Math.PI * 2) / 12;
    const distX = ring * 115 + Math.sin(now * 0.001 + i) * 25;
    const distY = ring * 68 + Math.cos(now * 0.001 + i) * 18;
    const rx = cx + Math.cos(angle) * distX;
    const ry = cy + Math.sin(angle) * distY;

    ctx.fillStyle = isBlacklight
      ? i % 2 === 0
        ? 'rgba(0, 240, 255, 0.42)'
        : 'rgba(232, 121, 249, 0.42)'
      : isSlowSkating
      ? 'rgba(253, 224, 71, 0.36)'
      : 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.ellipse(rx, ry, 5, 3.5, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = isBlacklight
    ? '#c084fc'
    : isSlowSkating
    ? '#fbbf24'
    : '#bae6fd';
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

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const facetShift = (now * 0.015) % 10;
  for (let fy = -24; fy <= 24; fy += 10) {
    const rowWidth = Math.sqrt(Math.max(0, 32 * 32 - fy * fy));
    for (let fx = -rowWidth + facetShift; fx < rowWidth - 4; fx += 10) {
      ctx.fillStyle = Math.floor(fx + fy) % 2 === 0 ? '#f8fafc' : '#38bdf8';
      ctx.fillRect(cx + fx - 3, cy + fy - 3, 6, 6);
    }
  }
  ctx.restore();
}
