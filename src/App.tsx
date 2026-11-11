import React, { useCallback, useEffect, useState } from 'react';
import {
  ARENA_CONFIG,
  DEFAULT_PHYSICS_CONFIG,
  PlayerCharacterMode,
  SkaterPhysicsConfig,
} from './config/arenaConfig';
import { RollerRinkCanvas } from './components/RollerRinkCanvas';
import { CameraMode, SceneTelemetryPayload } from './game/RinkScene';
import {
  RotateCcw,
  Sliders,
  Compass,
  Eye,
  MapPin,
  Zap,
  Ticket,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [showHitboxes, setShowHitboxes] = useState<boolean>(false);
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [characterMode, setCharacterMode] =
    useState<PlayerCharacterMode>('wheelchair');

  const [nameInput, setNameInput] = useState<string>('');
  const [checkedInName, setCheckedInName] = useState<string | null>(null);
  const [checkInTrigger, setCheckInTrigger] = useState<number>(0);
  const [showCashierModal, setShowCashierModal] = useState<boolean>(true);
  const [showZeitsprungBanner, setShowZeitsprungBanner] =
    useState<boolean>(false);

  const [spinTrigger, setSpinTrigger] = useState<number>(0);
  const [physicsConfig, setPhysicsConfig] = useState<SkaterPhysicsConfig>({
    ...DEFAULT_PHYSICS_CONFIG,
  });
  const [respawnCount, setRespawnCount] = useState<number>(0);

  const [telemetry, setTelemetry] = useState<SceneTelemetryPayload>({
    skater: {
      x: ARENA_CONFIG.world.spawnPoint.x,
      y: ARENA_CONFIG.world.spawnPoint.y,
      speed: 0,
      headingDeg: ARENA_CONFIG.world.spawnPoint.angleDeg,
      velocityAngleDeg: ARENA_CONFIG.world.spawnPoint.angleDeg,
      driftAngleDeg: 0,
      isDrifting: false,
      isSpinning360: false,
      isAccelerating: false,
      isBraking: false,
      collisionCount: 0,
      characterMode: 'wheelchair',
      playerName: 'GAST #86',
      isSlushBoostActive: false,
      slushBoostRemainingSec: 0,
      inSlushTriggerZone: false,
      inCashierTriggerZone: true,
    },
    activeZone:
      ARENA_CONFIG.zones.find((z) => z.id === 'cashier-foyer') ?? null,
    cameraMode: 'overview',
    showHitboxes: false,
    lastCollidedLabel: null,
    hasCheckedInAtCashier: false,
    drinkTokens: 0,
    slushCooldownRemainingSec: 0,
    lapsCompletedForSlush: 0,
    totalLapsCompleted: 0,
    statusMessage: null,
  });

  const handleTelemetryUpdate = useCallback((payload: SceneTelemetryPayload) => {
    setTelemetry(payload);
    setCameraMode(payload.cameraMode);
    setShowHitboxes(payload.showHitboxes);
    setCharacterMode(payload.skater.characterMode);

    // Automatically pop up the Cashier Name Input when approaching the Cashier Booth before check-in
    if (payload.skater.inCashierTriggerZone && !payload.hasCheckedInAtCashier) {
      setShowCashierModal(true);
    }
  }, []);

  // Auto-hide the neon "Zeitsprung" banner after 7.5 seconds
  useEffect(() => {
    if (!showZeitsprungBanner) return;
    const timer = window.setTimeout(() => {
      setShowZeitsprungBanner(false);
    }, 7500);
    return () => window.clearTimeout(timer);
  }, [showZeitsprungBanner]);

  const handleCashierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = nameInput.trim() || 'PALLADIUM-86';
    setCheckedInName(finalName);
    setCheckInTrigger((c) => c + 1);
    setShowCashierModal(false);
    setShowZeitsprungBanner(true);
  };

  const handleRespawn = () => {
    setRespawnCount((c) => c + 1);
  };

  const handleResetPhysics = () => {
    setPhysicsConfig({ ...DEFAULT_PHYSICS_CONFIG });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070A12] text-slate-100 overflow-hidden">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 bg-[#0B0F19] border-b border-slate-800/80 shrink-0">
        {/* Zone 1: Brand Title (single text element, one line) */}
        <a
          href="#palladium"
          onClick={(e) => {
            e.preventDefault();
            handleRespawn();
          }}
          className="font-display text-lg font-bold tracking-tight text-[#39FF14] whitespace-nowrap shrink-0"
        >
          Roller Disco Palladium Hanau
        </a>

        {/* Zone 2: 5 concise single-line text navigation/action links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() =>
              setCharacterMode((m) =>
                m === 'wheelchair' ? 'skater' : 'wheelchair'
              )
            }
            className="transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 text-emerald-300 border-emerald-400 hover:text-emerald-200 cursor-pointer"
          >
            Figur: {characterMode === 'wheelchair' ? 'Rollstuhl-Skater' : 'Rollschuh-Skater'}
          </button>
          <button
            type="button"
            onClick={() =>
              setCameraMode((m) => (m === 'overview' ? 'follow' : 'overview'))
            }
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              cameraMode === 'follow'
                ? 'text-cyan-300 border-cyan-400'
                : 'text-slate-400 border-transparent hover:text-slate-100'
            }`}
          >
            {cameraMode === 'overview' ? 'Hallen-Gesamtansicht' : 'Verfolgerkamera'}
          </button>
          <button
            type="button"
            onClick={() => setSpinTrigger((s) => s + 1)}
            className="transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 text-slate-300 border-transparent hover:text-pink-300 cursor-pointer"
          >
            360°-Spin [Q]
          </button>
          <button
            type="button"
            onClick={() => setShowHitboxes((prev) => !prev)}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              showHitboxes
                ? 'text-amber-300 border-amber-400'
                : 'text-slate-400 border-transparent hover:text-slate-100'
            }`}
          >
            Hitbox-Overlay
          </button>
          <button
            type="button"
            onClick={() => setShowInspector((prev) => !prev)}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
              showInspector
                ? 'text-pink-300 border-pink-400'
                : 'text-slate-400 border-transparent hover:text-slate-100'
            }`}
          >
            Physik-Inspektor
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setShowCashierModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-[#39FF14] rounded-lg hover:bg-emerald-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5" />
            {telemetry.hasCheckedInAtCashier
              ? `VIP: ${telemetry.skater.playerName}`
              : 'Kassen-Check-in'}
          </button>
        </div>
      </header>

      {/* Unobtrusive Telemetry, Token & Slush-Puppie Cooldown Sub-Bar (Zero-Pill Unboxed Metadata) */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2 bg-[#090D16] border-b border-slate-800/60 text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-2 font-mono tabular-nums overflow-x-auto whitespace-nowrap">
          <span className="text-[#39FF14] font-semibold">
            {telemetry.skater.playerName}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300 font-semibold">
            Freigetränk-Tokens: {telemetry.drinkTokens}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-200">
            Runden: {telemetry.totalLapsCompleted}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-300">
            Tempo: {telemetry.skater.speed} px/s
          </span>
          <span aria-hidden="true">·</span>
          {telemetry.skater.isSlushBoostActive ? (
            <span className="text-cyan-300 font-semibold inline-flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-cyan-300" />
              SLUSH-ICE-BOOST AKTIV (+25% Speed):{' '}
              {telemetry.skater.slushBoostRemainingSec.toFixed(1)}s
            </span>
          ) : telemetry.slushCooldownRemainingSec > 0 &&
            telemetry.drinkTokens === 0 ? (
            <span className="text-pink-300">
              Maschine friert nach: {telemetry.slushCooldownRemainingSec}s (oder{' '}
              {telemetry.lapsCompletedForSlush}/2 Runden)
            </span>
          ) : telemetry.drinkTokens > 0 ? (
            <span className="text-emerald-300 font-semibold">
              Slush-Puppie bereit an der Theke (Links Oben · [Taste E])
            </span>
          ) : (
            <span className="text-amber-300">
              Unten rechts an der Kasse Namen eintragen für 1 Freigetränk-Token!
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-400 whitespace-nowrap font-mono">
          <span>WASD/Pfeile = Fahren</span>
          <span aria-hidden="true">·</span>
          <span className="text-pink-300">Space/Shift = Drift</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#39FF14]">Q = 360°-Spin</span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-300">E = Slush-Boost</span>
          <span aria-hidden="true">·</span>
          <span>V = Rollstuhl/Skates</span>
        </div>
      </div>

      {/* Main Workspace: 1150x1550 2.5D Phaser Canvas + Cashier Input & Zeitsprung Banner */}
      <main className="relative flex-1 flex overflow-hidden">
        <div className="relative flex-1 h-full p-2 flex items-center justify-center">
          <RollerRinkCanvas
            cameraMode={cameraMode}
            showHitboxes={showHitboxes}
            characterMode={characterMode}
            checkedInName={checkedInName}
            checkInTrigger={checkInTrigger}
            spinTrigger={spinTrigger}
            physicsConfig={physicsConfig}
            respawnTrigger={respawnCount}
            onTelemetryUpdate={handleTelemetryUpdate}
          />

          {/* KASSEN-INTERAKTION ("ZEITSPRUNG") MODAL OVERLAY (Bottom-Right / Bottom-Center) */}
          {showCashierModal && (
            <div className="absolute bottom-6 right-6 z-30 w-full max-w-md bg-[#090D16]/95 border-2 border-[#39FF14] rounded-xl p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-mono text-xs font-semibold text-[#39FF14] tracking-wider">
                  ★ KASSENHÄUSCHEN PALLADIUM HANAU ★
                </span>
                <button
                  type="button"
                  onClick={() => setShowCashierModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Schließen
                </button>
              </div>

              <h2 className="font-display text-lg font-bold text-amber-300 mb-1">
                „Eintritt frei - hier zahlen Sie mit Ihrem Namen!“
              </h2>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Trage deinen Namen für dein Retro-Nametag ein. Die Schranke zur
                Rollschuhbahn öffnet sich und du erhältst{' '}
                <strong className="text-cyan-300">1 Freigetränk-Token</strong>{' '}
                für die Slush-Puppie-Maschine!
              </p>

              <form onSubmit={handleCashierSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Dein Retro-Spitzname (z. B. Speedy 86)..."
                  maxLength={18}
                  autoFocus
                  className="flex-1 px-3.5 py-2 text-sm font-mono bg-slate-950 border border-slate-700 focus:border-[#39FF14] rounded-lg text-slate-100 placeholder:text-slate-500 outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-[#39FF14] hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Ka-Ching! Eintreten
                </button>
              </form>
            </div>
          )}

          {/* ANIMATED NEON-GLITTERING "ZEITSPRUNG" BANNER (Lower Area) */}
          {showZeitsprungBanner && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 px-7 py-4 rounded-xl bg-[#090D16]/95 border-2 border-[#00F0FF] shadow-2xl text-center animate-bounce">
              <div className="flex items-center justify-center gap-2 text-base md:text-lg font-display font-bold text-[#39FF14] tracking-wide whitespace-nowrap">
                <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                <span>
                  ⚡ Zeitsprung aktiviert – Willkommen zurück in deiner Jugend! ⚡
                </span>
                <Sparkles className="w-5 h-5 text-pink-400 shrink-0" />
              </div>
              <p className="text-xs font-mono text-cyan-300 mt-1">
                Ka-Ching! Durchlass geöffnet · +1 Freigetränk-Token für Slush-Puppie
                (Links Oben) erhalten!
              </p>
            </div>
          )}
        </div>

        {/* Collapsible Physics & Arena Architecture Inspector Drawer */}
        {showInspector && (
          <aside className="w-88 h-full bg-[#0B0F19] border-l border-slate-800/90 p-5 overflow-y-auto shrink-0 flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  2.5D Physik & Steuerung
                </h2>
                <button
                  type="button"
                  onClick={handleResetPhysics}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer whitespace-nowrap"
                >
                  Standardwerte
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCharacterMode((m) =>
                      m === 'wheelchair' ? 'skater' : 'wheelchair'
                    )
                  }
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-emerald-500/50 bg-slate-900 hover:bg-slate-800 text-emerald-300 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {characterMode === 'wheelchair' ? 'Rollstuhl' : 'Rollschuhe'}
                </button>
                <button
                  type="button"
                  onClick={handleRespawn}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  Spawn Foyer
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between mb-1 font-mono tabular-nums">
                    <span className="text-slate-300">Basis-Topspeed</span>
                    <span className="text-cyan-300">{physicsConfig.maxSpeed} px/s</span>
                  </div>
                  <input
                    type="range"
                    min={240}
                    max={680}
                    step={10}
                    value={physicsConfig.maxSpeed}
                    onChange={(e) =>
                      setPhysicsConfig((prev) => ({
                        ...prev,
                        maxSpeed: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 font-mono tabular-nums">
                    <span className="text-slate-300">Antritt / Beschleunigung</span>
                    <span className="text-cyan-300">
                      {physicsConfig.acceleration} px/s²
                    </span>
                  </div>
                  <input
                    type="range"
                    min={220}
                    max={800}
                    step={20}
                    value={physicsConfig.acceleration}
                    onChange={(e) =>
                      setPhysicsConfig((prev) => ({
                        ...prev,
                        acceleration: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1 font-mono tabular-nums">
                    <span className="text-slate-300">Kurven-Drift Grip</span>
                    <span className="text-pink-400">
                      {Math.round(physicsConfig.driftLateralGrip * 1000) / 10}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.005}
                    max={0.07}
                    step={0.005}
                    value={physicsConfig.driftLateralGrip}
                    onChange={(e) =>
                      setPhysicsConfig((prev) => ({
                        ...prev,
                        driftLateralGrip: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-800/80" />

            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                Ansicht & Diagnose
              </h3>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setCameraMode((m) => (m === 'overview' ? 'follow' : 'overview'))
                  }
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Kamera: {cameraMode === 'overview' ? 'Gesamt' : 'Follow'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowHitboxes((h) => !h)}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  {showHitboxes ? 'Hitboxen An' : 'Hitboxen Aus'}
                </button>
              </div>
            </div>

            <hr className="border-slate-800/80" />

            <div>
              <h3 className="font-display text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[#39FF14]" />
                Palladium Zonen & Features
              </h3>
              <div className="space-y-2.5 text-xs">
                {ARENA_CONFIG.zones.map((zone) => {
                  const isActive = telemetry.activeZone?.id === zone.id;
                  return (
                    <div
                      key={zone.id}
                      className={`p-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-slate-900/95 border-[#39FF14]/70'
                          : 'bg-slate-900/40 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">
                          {zone.name}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                        {zone.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
