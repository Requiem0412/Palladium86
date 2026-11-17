import React, { useEffect, useRef, useState } from 'react';
import { soundFX } from '../utils/soundEffects';

export type ArcadeMachineId = 'monkey-stomp' | 'disco-invaders' | 'pac-roller';

interface RetroArcadeCabinetsModalProps {
  activeGameId: ArcadeMachineId;
  onSelectGame: (gameId: ArcadeMachineId) => void;
  onClose: () => void;
  onAwardArcadeReward: (
    bonusXp: number,
    bonusPixels: number,
    gameTitle: string,
    score: number
  ) => void;
}

export const RetroArcadeCabinetsModal: React.FC<
  RetroArcadeCabinetsModalProps
> = ({ activeGameId, onSelectGame, onClose, onAwardArcadeReward }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<Record<ArcadeMachineId, number>>({
    'monkey-stomp': 240,
    'disco-invaders': 320,
    'pac-roller': 280,
  });
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [rewardBanner, setRewardBanner] = useState<string | null>(null);
  const [restartSeq, setRestartSeq] = useState(0);

  const controlsRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
  });

  const awardSessionIfEligible = (finalScore: number, gameId: ArcadeMachineId) => {
    if (finalScore <= 0) return;
    const bonusPixels = Math.max(1, Math.min(25, Math.floor(finalScore / 40)));
    const bonusXp = Math.max(10, Math.min(180, Math.floor(finalScore / 2)));
    const titleMap: Record<ArcadeMachineId, string> = {
      'monkey-stomp': 'Monkey Stomp ’86',
      'disco-invaders': 'Disco Invaders ’86',
      'pac-roller': 'Pac-Roller ’86',
    };
    onAwardArcadeReward(bonusXp, bonusPixels, titleMap[gameId], finalScore);
    setRewardBanner(
      `🎉 +${bonusXp} Hallen-Punkte (XP) & +${bonusPixels} Pixel gutgeschrieben!`
    );
  };

  useEffect(() => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setRewardBanner(null);
  }, [activeGameId, restartSeq]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        controlsRef.current.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        controlsRef.current.right = true;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        controlsRef.current.up = true;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        controlsRef.current.down = true;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        controlsRef.current.action = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        controlsRef.current.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        controlsRef.current.right = false;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        controlsRef.current.up = false;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        controlsRef.current.down = false;
      }
      if (e.key === ' ' || e.code === 'Space') {
        controlsRef.current.action = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 420;
    const H = 280;
    let animId = 0;
    let lastTime = performance.now();
    let localScore = 0;
    let localLives = 3;
    let isEnded = false;

    // --- STATE FOR GAME 1: MONKEY STOMP ---
    const msPlayer = {
      x: 70,
      y: 236,
      vx: 0,
      vy: 0,
      tier: 0, // 0=bottom(236), 1=mid(166), 2=top(96)
      jumpZ: 0,
      jumpVz: 0,
      invuln: 0,
    };
    const msTiersY = [236, 166, 96];
    const msBarrels: { x: number; tier: number; vx: number; jumped?: boolean }[] = [];
    let msBarrelTimer = 0.8;
    let msBanana = { x: 330, tier: 1 };

    // --- STATE FOR GAME 2: DISCO INVADERS ---
    const diPlayer = { x: 210, cooldown: 0, invuln: 0 };
    const diBullets: { x: number; y: number; fromEnemy?: boolean }[] = [];
    const diEnemies: { x: number; y: number; alive: boolean; row: number }[] = [];
    const spawnInvaderWave = () => {
      diEnemies.length = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 7; c++) {
          diEnemies.push({
            x: 64 + c * 46,
            y: 44 + r * 30,
            alive: true,
            row: r,
          });
        }
      }
    };
    spawnInvaderWave();
    let diDir = 1;
    let diEnemyShotTimer = 1.4;

    // --- STATE FOR GAME 3: PAC-ROLLER ---
    const prPlayer = { x: 210, y: 210, dirX: 1, dirY: 0, invuln: 0 };
    const prDots: { x: number; y: number; collected: boolean; cherry?: boolean }[] = [];
    const spawnPacDots = () => {
      prDots.length = 0;
      for (let gx = 42; gx <= 378; gx += 42) {
        for (let gy = 46; gy <= 246; gy += 40) {
          if (Math.abs(gx - 210) < 28 && Math.abs(gy - 146) < 28) continue;
          prDots.push({
            x: gx,
            y: gy,
            collected: false,
            cherry: (gx === 42 || gx === 378) && (gy === 46 || gy === 246),
          });
        }
      }
    };
    spawnPacDots();
    const prGhosts = [
      { x: 110, y: 86, vx: 78, vy: 62, color: '#ff2a85' },
      { x: 310, y: 86, vx: -74, vy: 68, color: '#00f0ff' },
    ];

    const addPoints = (pts: number) => {
      localScore += pts;
      setScore(localScore);
      setHighScore((prev) => ({
        ...prev,
        [activeGameId]: Math.max(prev[activeGameId] || 0, localScore),
      }));
    };

    const loseLife = () => {
      localLives -= 1;
      setLives(localLives);
      soundFX.playCrash(false);
      if (localLives <= 0 && !isEnded) {
        isEnded = true;
        setGameOver(true);
        awardSessionIfEligible(localScore, activeGameId);
      }
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, W, H);

      // Subtle CRT grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      if (!isEnded) {
        const ctrl = controlsRef.current;

        if (activeGameId === 'monkey-stomp') {
          // Draw 3 Neon Girders & Ladders
          msTiersY.forEach((gy, tIdx) => {
            ctx.fillStyle = '#be185d';
            ctx.fillRect(24, gy + 12, W - 48, 8);
            ctx.strokeStyle = '#ff2a85';
            ctx.strokeRect(24, gy + 12, W - 48, 8);
            if (tIdx < 2) {
              const ladderX = tIdx === 0 ? 350 : 70;
              ctx.strokeStyle = '#00f0ff';
              ctx.lineWidth = 2;
              for (let ly = msTiersY[tIdx + 1] + 20; ly < gy + 12; ly += 8) {
                ctx.beginPath();
                ctx.moveTo(ladderX - 8, ly);
                ctx.lineTo(ladderX + 8, ly);
                ctx.stroke();
              }
            }
          });

          // Draw 80s Gorilla at top-left
          const kongBounce = Math.sin(now * 0.008) * 3;
          ctx.font = '24px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('🦍', 58, 82 + kongBounce);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.fillText('DISCO-KONG', 58, 54);

          // Player movement
          if (msPlayer.invuln > 0) msPlayer.invuln = Math.max(0, msPlayer.invuln - dt);
          const moveSpd = 155;
          if (ctrl.left) msPlayer.x = Math.max(34, msPlayer.x - moveSpd * dt);
          if (ctrl.right) msPlayer.x = Math.min(W - 34, msPlayer.x + moveSpd * dt);

          // Ladder climb or jump
          if ((ctrl.up || ctrl.action) && msPlayer.jumpZ === 0) {
            const ladderX = msPlayer.tier === 0 ? 350 : msPlayer.tier === 1 ? 70 : -999;
            if (ctrl.up && Math.abs(msPlayer.x - ladderX) < 22 && msPlayer.tier < 2) {
              msPlayer.tier += 1;
              msPlayer.y = msTiersY[msPlayer.tier];
              ctrl.up = false;
              soundFX.playJump();
            } else {
              msPlayer.jumpVz = 195;
              msPlayer.jumpZ = 1;
              ctrl.action = false;
              soundFX.playJump();
            }
          }
          if (ctrl.down && msPlayer.jumpZ === 0 && msPlayer.tier > 0) {
            msPlayer.tier -= 1;
            msPlayer.y = msTiersY[msPlayer.tier];
            ctrl.down = false;
          }

          if (msPlayer.jumpZ > 0 || msPlayer.jumpVz !== 0) {
            msPlayer.jumpZ += msPlayer.jumpVz * dt;
            msPlayer.jumpVz -= 560 * dt;
            if (msPlayer.jumpZ <= 0) {
              msPlayer.jumpZ = 0;
              msPlayer.jumpVz = 0;
            }
          }
          msPlayer.y = msTiersY[msPlayer.tier] - msPlayer.jumpZ;

          // Collect Golden Vinyl / Banana
          const bY = msTiersY[msBanana.tier] - 6;
          ctx.font = '16px monospace';
          ctx.fillText('🍌', msBanana.x, bY + 6);
          if (
            msPlayer.tier === msBanana.tier &&
            Math.abs(msPlayer.x - msBanana.x) < 22
          ) {
            addPoints(40);
            soundFX.playSlalomCombo(2);
            msBanana = {
              x: 80 + Math.floor(Math.random() * 260),
              tier: (msBanana.tier + 1) % 3,
            };
          }

          // Spawn & update rolling neon barrels
          msBarrelTimer -= dt;
          if (msBarrelTimer <= 0) {
            msBarrelTimer = Math.max(0.9, 1.8 - localScore * 0.001);
            msBarrels.push({
              x: 85,
              tier: 2,
              vx: 130 + Math.min(70, localScore * 0.15),
            });
          }

          for (let i = msBarrels.length - 1; i >= 0; i--) {
            const b = msBarrels[i];
            b.x += b.vx * dt;
            if (b.tier === 2 && b.x > W - 42) {
              b.tier = 1;
              b.vx = -Math.abs(b.vx);
            } else if (b.tier === 1 && b.x < 42) {
              b.tier = 0;
              b.vx = Math.abs(b.vx);
            } else if (b.tier === 0 && b.x > W - 28) {
              msBarrels.splice(i, 1);
              continue;
            }

            const barrelY = msTiersY[b.tier] + 2;
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, barrelY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (b.tier === msPlayer.tier && Math.abs(b.x - msPlayer.x) < 16) {
              if (msPlayer.jumpZ > 12) {
                if (!b.jumped) {
                  b.jumped = true;
                  addPoints(20);
                  soundFX.playSlalomCombo(1);
                }
              } else if (msPlayer.invuln <= 0) {
                msPlayer.invuln = 1.4;
                loseLife();
              }
            }
          }

          // Draw Skater Hero
          ctx.save();
          ctx.globalAlpha = msPlayer.invuln > 0 ? 0.5 : 1;
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(msPlayer.x, msPlayer.y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = '14px monospace';
          ctx.fillText('🛼', msPlayer.x, msPlayer.y + 5);
          ctx.restore();
        } else if (activeGameId === 'disco-invaders') {
          if (diPlayer.invuln > 0) diPlayer.invuln = Math.max(0, diPlayer.invuln - dt);
          if (diPlayer.cooldown > 0) diPlayer.cooldown = Math.max(0, diPlayer.cooldown - dt);

          if (ctrl.left) diPlayer.x = Math.max(32, diPlayer.x - 190 * dt);
          if (ctrl.right) diPlayer.x = Math.min(W - 32, diPlayer.x + 190 * dt);
          if ((ctrl.action || ctrl.up) && diPlayer.cooldown <= 0) {
            diPlayer.cooldown = 0.28;
            diBullets.push({ x: diPlayer.x, y: H - 36 });
            ctrl.action = false;
            soundFX.playBallThrowOrHit(false);
          }

          // Move enemies
          let hitEdge = false;
          const aliveEnemies = diEnemies.filter((e) => e.alive);
          if (aliveEnemies.length === 0) {
            addPoints(100);
            soundFX.playChallengeUnlocked();
            spawnInvaderWave();
          }
          for (const e of aliveEnemies) {
            e.x += diDir * (44 + Math.min(50, localScore * 0.08)) * dt;
            if (e.x > W - 28 || e.x < 28) hitEdge = true;
          }
          if (hitEdge) {
            diDir *= -1;
            for (const e of aliveEnemies) {
              e.y += 10;
              if (e.y > H - 48 && diPlayer.invuln <= 0) {
                diPlayer.invuln = 1.5;
                loseLife();
                spawnInvaderWave();
                break;
              }
            }
          }

          diEnemyShotTimer -= dt;
          if (diEnemyShotTimer <= 0 && aliveEnemies.length > 0) {
            diEnemyShotTimer = 1.25;
            const shooter =
              aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            diBullets.push({ x: shooter.x, y: shooter.y + 10, fromEnemy: true });
          }

          // Render Enemies
          for (const e of aliveEnemies) {
            ctx.fillStyle =
              e.row === 0 ? '#ff2a85' : e.row === 1 ? '#00f0ff' : '#39ff14';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(e.row === 0 ? '🛸' : '👾', e.x, e.y + 6);
          }

          // Update & render bullets
          for (let i = diBullets.length - 1; i >= 0; i--) {
            const b = diBullets[i];
            b.y += (b.fromEnemy ? 165 : -260) * dt;
            if (b.y < 10 || b.y > H - 10) {
              diBullets.splice(i, 1);
              continue;
            }
            ctx.fillStyle = b.fromEnemy ? '#fde047' : '#39ff14';
            ctx.fillRect(b.x - 2, b.y - 6, 4, 10);

            if (!b.fromEnemy) {
              for (const e of aliveEnemies) {
                if (Math.hypot(b.x - e.x, b.y - e.y) < 16) {
                  e.alive = false;
                  diBullets.splice(i, 1);
                  addPoints(20);
                  soundFX.playSlalomCombo(1);
                  break;
                }
              }
            } else if (
              Math.hypot(b.x - diPlayer.x, b.y - (H - 26)) < 16 &&
              diPlayer.invuln <= 0
            ) {
              diBullets.splice(i, 1);
              diPlayer.invuln = 1.4;
              loseLife();
            }
          }

          // Draw Player Turret
          ctx.save();
          ctx.globalAlpha = diPlayer.invuln > 0 ? 0.5 : 1;
          ctx.fillStyle = '#00f0ff';
          ctx.fillRect(diPlayer.x - 16, H - 24, 32, 10);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(diPlayer.x - 4, H - 32, 8, 8);
          ctx.restore();
        } else if (activeGameId === 'pac-roller') {
          if (prPlayer.invuln > 0) prPlayer.invuln = Math.max(0, prPlayer.invuln - dt);
          if (ctrl.left) {
            prPlayer.dirX = -1;
            prPlayer.dirY = 0;
          } else if (ctrl.right) {
            prPlayer.dirX = 1;
            prPlayer.dirY = 0;
          } else if (ctrl.up) {
            prPlayer.dirX = 0;
            prPlayer.dirY = -1;
          } else if (ctrl.down) {
            prPlayer.dirX = 0;
            prPlayer.dirY = 1;
          }

          const spd = 135;
          prPlayer.x = Math.max(
            26,
            Math.min(W - 26, prPlayer.x + prPlayer.dirX * spd * dt)
          );
          prPlayer.y = Math.max(
            32,
            Math.min(H - 26, prPlayer.y + prPlayer.dirY * spd * dt)
          );

          // Center Disco Block Obstacle
          ctx.fillStyle = '#1e1b4b';
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          ctx.strokeRect(166, 114, 88, 56);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('🪩 DISCO-BOX', 210, 146);

          // Dots
          let remaining = 0;
          for (const d of prDots) {
            if (d.collected) continue;
            remaining++;
            if (d.cherry) {
              ctx.font = '13px monospace';
              ctx.fillText('🍒', d.x, d.y + 4);
            } else {
              ctx.fillStyle = '#fde047';
              ctx.beginPath();
              ctx.arc(d.x, d.y, 3.2, 0, Math.PI * 2);
              ctx.fill();
            }
            if (Math.hypot(prPlayer.x - d.x, prPlayer.y - d.y) < 15) {
              d.collected = true;
              addPoints(d.cherry ? 35 : 10);
              soundFX.playSlalomCombo(d.cherry ? 3 : 1);
            }
          }
          if (remaining === 0) {
            addPoints(80);
            soundFX.playChallengeUnlocked();
            spawnPacDots();
          }

          // Ghosts
          for (const g of prGhosts) {
            g.x += g.vx * dt;
            g.y += g.vy * dt;
            if (g.x < 28 || g.x > W - 28) g.vx *= -1;
            if (g.y < 34 || g.y > H - 28) g.vy *= -1;
            ctx.font = '16px monospace';
            ctx.fillText('👻', g.x, g.y + 5);
            if (
              Math.hypot(g.x - prPlayer.x, g.y - prPlayer.y) < 16 &&
              prPlayer.invuln <= 0
            ) {
              prPlayer.invuln = 1.5;
              loseLife();
            }
          }

          // Pac-Roller Player
          ctx.save();
          ctx.globalAlpha = prPlayer.invuln > 0 ? 0.5 : 1;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(prPlayer.x, prPlayer.y, 11, 0.2 * Math.PI, 1.8 * Math.PI);
          ctx.lineTo(prPlayer.x, prPlayer.y);
          ctx.fill();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [activeGameId, restartSeq]);

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border-2 border-cyan-400 bg-slate-950/95 p-4 shadow-[0_0_40px_rgba(0,240,255,0.35)] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Protection Banner */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-400/60 bg-emerald-950/50 px-3 py-1.5 text-[11px]">
          <span className="font-bold text-emerald-300">
            🛡️ PARK- &amp; SCHUTZ-MODUS AKTIV: Dein Skater steht geschützt in der Arcade-Ecke!
          </span>
          <button
            type="button"
            onClick={() => {
              if (!gameOver && score > 0) {
                awardSessionIfEligible(score, activeGameId);
              }
              onClose();
            }}
            className="rounded border border-rose-400/70 bg-rose-950/70 px-2 py-0.5 text-[10px] font-bold text-rose-200 hover:bg-rose-900 cursor-pointer"
          >
            ✕ Beenden &amp; Weiterrollen
          </button>
        </div>

        {/* 3 Arcade Cabinet Switcher Tabs */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {[
            { id: 'monkey-stomp' as const, label: '🦍 Monkey Stomp', col: 'amber' },
            { id: 'disco-invaders' as const, label: '👾 Disco Invaders', col: 'cyan' },
            { id: 'pac-roller' as const, label: '🍒 Pac-Roller', col: 'yellow' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectGame(tab.id)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                activeGameId === tab.id
                  ? 'border-yellow-300 bg-fuchsia-900/70 text-yellow-200 shadow-[0_0_12px_rgba(253,224,71,0.35)]'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Score & Lives Marquee */}
        <div className="mb-2 flex items-center justify-between rounded-lg border border-fuchsia-500/50 bg-slate-900/90 px-3 py-1.5 font-mono text-xs">
          <div>
            SCORE:{' '}
            <span className="font-bold text-emerald-400">{score}</span>
          </div>
          <div>
            HIGHSCORE:{' '}
            <span className="font-bold text-yellow-300">
              {highScore[activeGameId]}
            </span>
          </div>
          <div>
            LEBEN:{' '}
            <span className="text-rose-400">
              {'❤️'.repeat(Math.max(0, lives))}
            </span>
          </div>
        </div>

        {/* CRT Arcade Screen */}
        <div className="relative mx-auto overflow-hidden rounded-xl border-4 border-slate-700 bg-black shadow-inner">
          <canvas
            ref={canvasRef}
            width={420}
            height={280}
            className="block w-full h-auto"
          />

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
              <div className="text-lg font-extrabold tracking-wider text-yellow-300">
                🕹️ GAME OVER – {score} PUNKTE!
              </div>
              {rewardBanner && (
                <div className="mt-1.5 rounded-lg border border-emerald-400/60 bg-emerald-950/70 px-3 py-1 text-xs font-bold text-emerald-300">
                  {rewardBanner}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRestartSeq((s) => s + 1)}
                  className="rounded-lg border border-emerald-400 bg-emerald-600/80 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                >
                  🔄 Nochmal spielen
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-cyan-400 bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-cyan-200 hover:bg-slate-700 cursor-pointer"
                >
                  ✅ Zurück in die Halle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Touch & Mouse Arcade Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onMouseDown={() => (controlsRef.current.left = true)}
              onMouseUp={() => (controlsRef.current.left = false)}
              onTouchStart={() => (controlsRef.current.left = true)}
              onTouchEnd={() => (controlsRef.current.left = false)}
              className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-2 text-xs font-bold text-cyan-200 active:bg-cyan-700 cursor-pointer"
            >
              ◀ LINKS
            </button>
            <button
              type="button"
              onMouseDown={() => (controlsRef.current.up = true)}
              onMouseUp={() => (controlsRef.current.up = false)}
              onTouchStart={() => (controlsRef.current.up = true)}
              onTouchEnd={() => (controlsRef.current.up = false)}
              className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-2 text-xs font-bold text-cyan-200 active:bg-cyan-700 cursor-pointer"
            >
              ▲ HOCH
            </button>
            <button
              type="button"
              onMouseDown={() => (controlsRef.current.down = true)}
              onMouseUp={() => (controlsRef.current.down = false)}
              onTouchStart={() => (controlsRef.current.down = true)}
              onTouchEnd={() => (controlsRef.current.down = false)}
              className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-2 text-xs font-bold text-cyan-200 active:bg-cyan-700 cursor-pointer"
            >
              ▼ RUNTER
            </button>
            <button
              type="button"
              onMouseDown={() => (controlsRef.current.right = true)}
              onMouseUp={() => (controlsRef.current.right = false)}
              onTouchStart={() => (controlsRef.current.right = true)}
              onTouchEnd={() => (controlsRef.current.right = false)}
              className="rounded-lg border border-cyan-400/60 bg-slate-800 px-3 py-2 text-xs font-bold text-cyan-200 active:bg-cyan-700 cursor-pointer"
            >
              RECHTS ▶
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              controlsRef.current.action = true;
              window.setTimeout(() => {
                controlsRef.current.action = false;
              }, 120);
            }}
            className="rounded-lg border-2 border-yellow-300 bg-fuchsia-700 px-4 py-2 text-xs font-extrabold text-yellow-200 shadow-[0_0_12px_rgba(253,224,71,0.4)] active:scale-95 cursor-pointer"
          >
            ⚡ AKTION / SPRUNG [SPACE]
          </button>
        </div>

        <div className="mt-2 text-center text-[10px] text-slate-400">
          Steuerung per Pfeiltasten / WASD + Leertaste oder Touch-Buttons • Punkte bringen automatisch Hallen-XP &amp; Pixel!
        </div>
      </div>
    </div>
  );
};
