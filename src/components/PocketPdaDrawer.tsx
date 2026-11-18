import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CertificateId,
  DEFAULT_NEWSPAPER_TIPS,
  PALLADIUM_CERTIFICATES,
  PalladiumCertificatesState,
} from '../utils/storageAndStats';
import { soundFX } from '../utils/soundEffects';

export type PocketPdaTabId = 'stats' | 'minigames' | 'kurier';

export interface PocketPdaDrawerProps {
  hasPocketPda: boolean;
  playerName: string;
  playerPixels: number;
  totalEarnedPoints: number;
  hallRankTitle: string;
  hallRankIcon: string;
  skatedLaps: number;
  bestLapSec: number;
  slalomRecord: number;
  ballspielBestTimeSec: number | null;
  certificatesState: PalladiumCertificatesState;
  newspaperIssueId: number;
  newspaperUpdatedAt: string;
  newspaperHeadline: string;
  newspaperBody: string;
  newspaperTips: string;
  hasUnreadNewspaperIssue: boolean;
  pdaMinigameHighscore: number;
  onUpdateMinigameHighscore: (nextBest: number) => void;
  onAwardBonusPixels: (pixels: number) => void;
  onOpenNewspaperModal: () => void;
  onOpenDriverLicense: () => void;
  onSelectCertificate?: (certId: CertificateId) => void;
}

const GRID_COLS = 18;
const GRID_ROWS = 12;

interface Point {
  x: number;
  y: number;
}

export const PocketPdaDrawer: React.FC<PocketPdaDrawerProps> = ({
  hasPocketPda,
  playerName,
  playerPixels,
  totalEarnedPoints,
  hallRankTitle,
  hallRankIcon,
  skatedLaps,
  bestLapSec,
  slalomRecord,
  ballspielBestTimeSec,
  certificatesState,
  newspaperIssueId,
  newspaperUpdatedAt,
  newspaperHeadline,
  newspaperBody,
  newspaperTips,
  hasUnreadNewspaperIssue,
  pdaMinigameHighscore,
  onUpdateMinigameHighscore,
  onAwardBonusPixels,
  onOpenNewspaperModal,
  onOpenDriverLicense,
  onSelectCertificate,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<PocketPdaTabId>('stats');

  // Mini-Game ("ROLLER-SNAKE ’86" on LCD screen) state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameRunning, setGameRunning] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [rewardToast, setRewardToast] = useState<string | null>(null);

  const snakeRef = useRef<Point[]>([
    { x: 6, y: 6 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
  ]);
  const dirRef = useRef<Point>({ x: 1, y: 0 });
  const nextDirRef = useRef<Point>({ x: 1, y: 0 });
  const foodRef = useRef<Point>({ x: 12, y: 6 });
  const bonusTypeRef = useRef<'pixel' | 'slush'>('pixel');
  const scoreRef = useRef<number>(0);

  const spawnFood = useCallback((currentSnake: Point[]) => {
    const occupied = new Set(currentSnake.map((p) => `${p.x},${p.y}`));
    const free: Point[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        if (!occupied.has(`${x},${y}`)) {
          free.push({ x, y });
        }
      }
    }
    if (free.length > 0) {
      const pick = free[Math.floor(Math.random() * free.length)];
      foodRef.current = pick;
      bonusTypeRef.current = Math.random() < 0.25 ? 'slush' : 'pixel';
    }
  }, []);

  const drawLcdSnakeScreen = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const W = cvs.width;
    const H = cvs.height;
    const cellW = W / GRID_COLS;
    const cellH = H / GRID_ROWS;

    // 80s Dark Neon LCD Matrix Background
    ctx.fillStyle = '#071418';
    ctx.fillRect(0, 0, W, H);

    // Subtle LCD pixel grid lines
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
    ctx.lineWidth = 1;
    for (let c = 1; c < GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, H);
      ctx.stroke();
    }
    for (let r = 1; r < GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(W, r * cellH);
      ctx.stroke();
    }

    // Rink center oval watermark inside LCD
    ctx.strokeStyle = 'rgba(232, 121, 249, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cellW * 2, cellH * 2, W - cellW * 4, H - cellH * 4);

    // Draw Food (Neon Pixel or Slush Cup)
    const fx = foodRef.current.x * cellW;
    const fy = foodRef.current.y * cellH;
    if (bonusTypeRef.current === 'slush') {
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(fx + 2, fy + 3, cellW - 4, cellH - 4);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(fx + 4, fy + 1, cellW - 8, 3);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(fx + 2, fy + 2, cellW - 4, cellH - 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx + 3, fy + 3, cellW - 6, cellH - 6);
    }

    // Draw Roller-Snake segments
    snakeRef.current.forEach((seg, idx) => {
      const sx = seg.x * cellW;
      const sy = seg.y * cellH;
      if (idx === 0) {
        // Lead Roller Skater Head
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(sx + 1, sy + 1, cellW - 2, cellH - 2);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(sx + 4, sy + 4, 3, 3);
        ctx.fillRect(sx + cellW - 7, sy + 4, 3, 3);
      } else {
        ctx.fillStyle = idx % 2 === 0 ? '#39ff14' : '#22d3ee';
        ctx.fillRect(sx + 2, sy + 2, cellW - 4, cellH - 4);
      }
    });
  }, []);

  const startNewMinigame = useCallback(() => {
    soundFX.unlockAudioContext();
    snakeRef.current = [
      { x: 6, y: 6 },
      { x: 5, y: 6 },
      { x: 4, y: 6 },
    ];
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    setRewardToast(null);
    spawnFood(snakeRef.current);
    setGameRunning(true);
    drawLcdSnakeScreen();
  }, [drawLcdSnakeScreen, spawnFood]);

  const steerSnake = useCallback((dx: number, dy: number) => {
    const cur = dirRef.current;
    // Prevent 180-degree self-reversal
    if (cur.x + dx === 0 && cur.y + dy === 0) return;
    nextDirRef.current = { x: dx, y: dy };
  }, []);

  // Game Loop when Mini-Games tab is active and running
  useEffect(() => {
    if (!isOpen || activeTab !== 'minigames' || !gameRunning || gameOver) {
      drawLcdSnakeScreen();
      return;
    }

    const interval = window.setInterval(() => {
      const currentSnake = snakeRef.current;
      const d = nextDirRef.current;
      dirRef.current = d;

      const head = currentSnake[0];
      const nextHead: Point = {
        x: (head.x + d.x + GRID_COLS) % GRID_COLS,
        y: (head.y + d.y + GRID_ROWS) % GRID_ROWS,
      };

      // Check collision with tail
      const hitSelf = currentSnake.some(
        (seg, i) =>
          i < currentSnake.length - 1 &&
          seg.x === nextHead.x &&
          seg.y === nextHead.y
      );

      if (hitSelf) {
        setGameRunning(false);
        setGameOver(true);
        if (scoreRef.current > pdaMinigameHighscore) {
          onUpdateMinigameHighscore(scoreRef.current);
        }
        drawLcdSnakeScreen();
        return;
      }

      const ateFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;

      const nextSnake = [nextHead, ...currentSnake];
      if (!ateFood) {
        nextSnake.pop();
      } else {
        const addPts = bonusTypeRef.current === 'slush' ? 25 : 10;
        const nextScore = scoreRef.current + addPts;
        scoreRef.current = nextScore;
        setScore(nextScore);
        soundFX.playSlalomCombo(1);

        if (nextScore > pdaMinigameHighscore) {
          onUpdateMinigameHighscore(nextScore);
        }
        // Every 50 points in PDA Snake grants +2 real Hallen-Pixel!
        if (Math.floor(nextScore / 50) > Math.floor((nextScore - addPts) / 50)) {
          onAwardBonusPixels(2);
          setRewardToast('👾 +2 Spiel-Pixel Bonus aufs Konto!');
          window.setTimeout(() => setRewardToast(null), 2200);
        }
        spawnFood(nextSnake);
      }

      snakeRef.current = nextSnake;
      drawLcdSnakeScreen();
    }, 145);

    return () => window.clearInterval(interval);
  }, [
    activeTab,
    drawLcdSnakeScreen,
    gameOver,
    gameRunning,
    isOpen,
    onAwardBonusPixels,
    onUpdateMinigameHighscore,
    pdaMinigameHighscore,
    spawnFood,
  ]);

  // Keyboard support for PDA Minigame when open & on minigames tab
  useEffect(() => {
    if (!isOpen || activeTab !== 'minigames' || !gameRunning) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        e.stopPropagation();
        steerSnake(0, -1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        steerSnake(0, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        e.stopPropagation();
        steerSnake(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        e.stopPropagation();
        steerSnake(1, 0);
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () =>
      window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [activeTab, gameRunning, isOpen, steerSnake]);

  useEffect(() => {
    if (isOpen && activeTab === 'minigames') {
      drawLcdSnakeScreen();
    }
  }, [activeTab, drawLcdSnakeScreen, isOpen]);

  // Do not render the PDA in HUD until the player has picked it up at their locker (Spind)
  if (!hasPocketPda) {
    return null;
  }

  const unlockedCertificatesCount = PALLADIUM_CERTIFICATES.filter(
    (c) => certificatesState.unlocked[c.id]?.unlocked
  ).length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none flex flex-col items-center">
      {/* Compact Pull-Up Tab when closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            soundFX.unlockAudioContext();
            setIsOpen(true);
          }}
          title="Persönlichen Palladium Pocket-PDA ’86 ausfahren"
          className="pointer-events-auto mb-0 px-4 py-1.5 rounded-t-xl bg-[#0B0E17]/95 hover:bg-slate-900 border-t-2 border-x-2 border-cyan-400 shadow-[0_-4px_20px_rgba(34,211,238,0.45)] font-mono text-xs font-black text-cyan-200 flex items-center gap-2 cursor-pointer transition-all hover:py-2"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span>📟 PDA</span>
          <span className="hidden sm:inline text-[10px] text-amber-300 font-bold">
            • POCKET ’86
          </span>
          {hasUnreadNewspaperIssue && (
            <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-black">
              NEU
            </span>
          )}
          <span className="text-cyan-400 text-[10px]">▲</span>
        </button>
      )}

      {/* Slide-Up 80s Retro Pocket-PDA Drawer */}
      <div
        className={`pointer-events-auto w-[96%] max-w-xl rounded-t-2xl bg-[#090D16]/98 border-t-4 border-x-4 border-cyan-400 shadow-[0_-12px_50px_rgba(0,240,255,0.45)] font-mono text-white transition-transform duration-300 ease-out ${
          isOpen
            ? 'translate-y-0'
            : 'translate-y-full h-0 overflow-hidden border-0'
        }`}
      >
        {/* Top Casing Bar (Click to slide back down) */}
        <div
          onClick={() => setIsOpen(false)}
          title="Klicken zum Einfahren des PDAs"
          className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-slate-950 via-[#131B2E] to-slate-950 border-b-2 border-cyan-500/50 rounded-t-xl cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="font-display font-black text-xs sm:text-sm tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-amber-200 to-fuchsia-300">
              📟 PALLADIUM POCKET-PDA ’86
            </span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-400/40 text-[9px] text-cyan-300 font-bold">
              SPIND-EDITION
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Einfahren ▼
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              title="PDA nach unten einfahren"
              className="w-6 h-6 rounded bg-slate-800 hover:bg-rose-700 border border-slate-600 text-slate-200 text-xs font-black flex items-center justify-center cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>

        {/* 3 Main Tabs in the PDA Display */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#060911] border-b border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`py-1.5 px-2 rounded-lg border text-[10px] sm:text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'stats'
                ? 'bg-cyan-400 text-slate-950 border-white shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-cyan-200'
            }`}
          >
            <span>📊</span>
            <span className="truncate">DATEN &amp; REKORDE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('minigames')}
            className={`py-1.5 px-2 rounded-lg border text-[10px] sm:text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'minigames'
                ? 'bg-fuchsia-400 text-slate-950 border-white shadow-[0_0_12px_rgba(232,121,249,0.6)]'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-fuchsia-200'
            }`}
          >
            <span>🕹️</span>
            <span className="truncate">MINI-SPIELE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kurier')}
            className={`relative py-1.5 px-2 rounded-lg border text-[10px] sm:text-[11px] font-black transition cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'kurier'
                ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-amber-200'
            }`}
          >
            <span>📰</span>
            <span className="truncate">HALLEN-KURIER</span>
            {hasUnreadNewspaperIssue && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Inner Retro LC-Display Screen */}
        <div className="p-3 bg-[#071117] max-h-[62dvh] overflow-y-auto space-y-2.5">
          {/* =============================================================== */}
          {/* TAB 1: 📊 DATEN & REKORDE                                       */}
          {/* =============================================================== */}
          {activeTab === 'stats' && (
            <div className="space-y-2.5">
              {/* Top Player Status Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0B1B24] border border-cyan-500/40">
                <div>
                  <div className="text-[9.5px] text-cyan-400 uppercase font-bold">
                    SKATER-AUSWEIS • PALLADIUM ’86
                  </div>
                  <div className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>{(playerName || 'Gast-Skater').trim()}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/60 text-amber-200 text-[10px]">
                      {hallRankIcon} {hallRankTitle}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenDriverLicense}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10.5px] font-black border border-white cursor-pointer shadow"
                >
                  🪪 Grauer Führerschein
                </button>
              </div>

              {/* 4 Key Telemetry & Record Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-950/90 border border-fuchsia-400/50">
                  <div className="text-[9px] text-fuchsia-300 uppercase font-bold">
                    👾 Spiel-Pixel
                  </div>
                  <div className="text-base font-black text-white mt-0.5">
                    {playerPixels}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    XP: {totalEarnedPoints}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/90 border border-cyan-400/50">
                  <div className="text-[9px] text-cyan-300 uppercase font-bold">
                    🛼 Bahn-Runden
                  </div>
                  <div className="text-base font-black text-white mt-0.5">
                    {skatedLaps}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Slalom-Rekord: {slalomRecord}
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/90 border border-emerald-400/50">
                  <div className="text-[9px] text-emerald-300 uppercase font-bold">
                    ⏱️ Runden-Bestzeit
                  </div>
                  <div className="text-base font-black text-emerald-200 mt-0.5">
                    {bestLapSec > 0 ? `${bestLapSec.toFixed(1)} s` : '—'}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Oval-Vollrunde
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/90 border border-amber-400/50">
                  <div className="text-[9px] text-amber-300 uppercase font-bold">
                    🏐 Ballspiel-Bestzeit
                  </div>
                  <div className="text-base font-black text-amber-200 mt-0.5">
                    {ballspielBestTimeSec && ballspielBestTimeSec > 0
                      ? `${ballspielBestTimeSec.toFixed(1)} s`
                      : '—'}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Last Skater Standing
                  </div>
                </div>
              </div>

              {/* Unlocked Certificates & Badges List */}
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-black text-amber-300 uppercase">
                    🏆 Freigeschaltete Urkunden &amp; Abzeichen (
                    {unlockedCertificatesCount}/{PALLADIUM_CERTIFICATES.length})
                  </span>
                  <span className="text-[9.5px] text-slate-400">
                    Antippen zum Öffnen
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {PALLADIUM_CERTIFICATES.map((cert) => {
                    const isUnlocked = Boolean(
                      certificatesState.unlocked[cert.id]?.unlocked
                    );
                    return (
                      <button
                        key={cert.id}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => {
                          if (isUnlocked && onSelectCertificate) {
                            onSelectCertificate(cert.id);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-2 text-[10px] transition ${
                          isUnlocked
                            ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-400/70 text-emerald-100 cursor-pointer'
                            : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <span className="truncate font-bold">
                          {cert.icon} {cert.title}
                        </span>
                        <span className="shrink-0 font-black text-[9px]">
                          {isUnlocked ? '✅ AKTIV' : '🔒'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: 🕹️ MINI-SPIELE ("ROLLER-SNAKE ’86" ON PDA SCREEN)        */}
          {/* =============================================================== */}
          {activeTab === 'minigames' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#0B1B24] border border-fuchsia-400/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black text-fuchsia-300">
                    🐍 ROLLER-SNAKE ’86
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-400/50 text-cyan-200 font-bold text-[10.5px]">
                    PUNKTE: {score}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-300/60 text-amber-300 font-black text-[10.5px]">
                    🏆 HIGHSCORE: {Math.max(score, pdaMinigameHighscore)}
                  </span>
                  <button
                    type="button"
                    onClick={startNewMinigame}
                    className="px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-[10.5px] cursor-pointer shadow"
                  >
                    {gameRunning ? '🔄 Neustart' : '▶️ Starten'}
                  </button>
                </div>
              </div>

              {rewardToast && (
                <div className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-400 text-emerald-200 text-[10.5px] font-bold text-center">
                  {rewardToast}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-xl bg-slate-950 border-2 border-cyan-500/40">
                {/* Retro LCD Matrix Canvas */}
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={288}
                    height={192}
                    className="rounded-lg border-2 border-emerald-400/70 bg-[#071418] shadow-[0_0_20px_rgba(16,185,129,0.25)] block"
                  />
                  {(!gameRunning || gameOver) && (
                    <div className="absolute inset-0 rounded-lg bg-slate-950/82 flex flex-col items-center justify-center p-3 text-center space-y-1.5">
                      <div className="font-display font-black text-sm text-cyan-300">
                        {gameOver
                          ? `💥 CRASH! SCORE: ${score}`
                          : '🛼 ROLLER-SNAKE ’86'}
                      </div>
                      <p className="text-[10px] text-slate-300 max-w-[220px]">
                        Sammle gelbe Pixel (+10) &amp; Slush-Becher (+25). Alle
                        50 Punkte gibt es +2 echte Spiel-Pixel!
                      </p>
                      <button
                        type="button"
                        onClick={startNewMinigame}
                        className="px-3.5 py-1.5 rounded-xl bg-fuchsia-400 hover:bg-fuchsia-300 text-slate-950 font-black text-xs border border-white cursor-pointer shadow"
                      >
                        {gameOver ? '🔄 Nochmal spielen' : '🕹️ Jetzt spielen'}
                      </button>
                    </div>
                  )}
                </div>

                {/* On-Screen D-Pad for Touch & Mouse */}
                <div className="flex flex-col items-center gap-1 select-none">
                  <span className="text-[9.5px] text-slate-400 mb-0.5">
                    WASD / Pfeile oder Steuerkreuz:
                  </span>
                  <button
                    type="button"
                    onClick={() => steerSnake(0, -1)}
                    className="w-11 h-9 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 active:scale-95 border border-cyan-400/60 text-cyan-200 font-black text-sm cursor-pointer"
                  >
                    ▲
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => steerSnake(-1, 0)}
                      className="w-11 h-9 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 active:scale-95 border border-cyan-400/60 text-cyan-200 font-black text-sm cursor-pointer"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => steerSnake(0, 1)}
                      className="w-11 h-9 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 active:scale-95 border border-cyan-400/60 text-cyan-200 font-black text-sm cursor-pointer"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => steerSnake(1, 0)}
                      className="w-11 h-9 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 active:scale-95 border border-cyan-400/60 text-cyan-200 font-black text-sm cursor-pointer"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: 📰 HALLEN-KURIER (DIREKT AUS DEM PDA LESEN & ÖFFNEN)      */}
          {/* =============================================================== */}
          {activeTab === 'kurier' && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-[#f5ecd7] text-[#1c1610] border-2 border-[#3a2817] font-serif space-y-2 shadow-inner">
                <div className="flex flex-wrap items-center justify-between text-[9.5px] font-mono uppercase tracking-wider text-[#4a3520] border-b border-[#8a6d4b] pb-1">
                  <span>PALLADIUM ONLINE • AUSGABE #{newspaperIssueId}</span>
                  <span className="font-bold text-rose-800">
                    ★ PDA-MOBILAUSGABE ★
                  </span>
                  <span>STAND: {newspaperUpdatedAt || '15.11.2026'}</span>
                </div>

                <h4 className="font-display font-black text-sm sm:text-base uppercase text-[#140d06] leading-snug">
                  {newspaperHeadline ||
                    'SONDERAUSGABE: NEON-LIGHTSHOW, 5 PIXEL-STATIONEN & SONNTAGS-CLIQUE LIVE!'}
                </h4>

                <p className="text-xs text-[#241a10] leading-relaxed line-clamp-3 whitespace-pre-line">
                  {newspaperBody ||
                    'Willkommen im Palladium Hanau ’86! Ab sofort erwarten euch unsere 5 interaktiven 16-Bit-Stationen, das echte 3x3-Sampler-Launchpad für DJ Magic Force sowie der neue Sonntags-Clique-Modus.'}
                </p>

                <div className="text-[10.5px] font-mono text-[#2c2013] bg-[#e8dcc2] p-2 rounded border border-[#8a6d4b]">
                  <div className="font-black text-rose-900 uppercase mb-0.5">
                    🛼 Aktuelle Hallen-Tipps:
                  </div>
                  <div className="line-clamp-2 whitespace-pre-line">
                    {newspaperTips || DEFAULT_NEWSPAPER_TIPS}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-amber-200">
                  Komplette 80er-Printausgabe inkl. QR-Code &amp; PNG-Export:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewspaperModal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-black border border-white cursor-pointer shadow-[0_0_16px_rgba(251,191,36,0.5)] transition"
                >
                  📰 Palladium-Kurier komplett aufklappen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
