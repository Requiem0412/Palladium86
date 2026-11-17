import React from 'react';
import {
  computeHallRankInfo,
  LicensePaperTheme,
  LicenseStampsState,
} from '../utils/storageAndStats';

interface PaperDriverLicenseModalProps {
  playerName: string;
  playerShirtColor: string;
  characterMode: 'skater' | 'wheelchair';
  kengolHatEnabled: boolean;
  vipDiscoSkatesEquipped: boolean;
  hallPointsXp: number;
  collectedPixels: number;
  createdAtText: string;
  licenseNumber: string;
  stamps: LicenseStampsState;
  customThresholds?: number[];
  isConstantReaderUnlocked: boolean;
  onClose: () => void;
}

export const PaperDriverLicenseModal: React.FC<
  PaperDriverLicenseModalProps
> = ({
  playerName,
  playerShirtColor,
  characterMode,
  kengolHatEnabled,
  vipDiscoSkatesEquipped,
  hallPointsXp,
  collectedPixels,
  createdAtText,
  licenseNumber,
  stamps,
  customThresholds,
  isConstantReaderUnlocked,
  onClose,
}) => {
  const rankInfo = computeHallRankInfo(hallPointsXp, customThresholds);

  const themeStyles: Record<
    LicensePaperTheme,
    {
      outerBg: string;
      border: string;
      innerCardBg: string;
      headerText: string;
      subText: string;
      accentBadge: string;
      stampBoxBg: string;
      themeName: string;
    }
  > = {
    gray: {
      outerBg:
        'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 48%, #cbd5e1 100%)',
      border: 'border-slate-600',
      innerCardBg: 'bg-slate-200/90 text-slate-900 border-slate-500',
      headerText: 'text-slate-900',
      subText: 'text-slate-700',
      accentBadge: 'bg-slate-800 text-amber-300 border-slate-600',
      stampBoxBg: 'bg-slate-100/90 border-slate-500 text-slate-800',
      themeName: 'KLASSISCHES 80ER-BEHÖRDEN-GRAU (EINSTEIGER)',
    },
    rose: {
      outerBg:
        'linear-gradient(135deg, #fecdd3 0%, #fda4af 48%, #ffe4e6 100%)',
      border: 'border-rose-500',
      innerCardBg: 'bg-rose-100/90 text-rose-950 border-rose-400',
      headerText: 'text-rose-950',
      subText: 'text-rose-800',
      accentBadge: 'bg-rose-900 text-pink-200 border-rose-500',
      stampBoxBg: 'bg-rose-50/90 border-rose-400 text-rose-900',
      themeName: '80ER-ALTROSA / EURO-ROSA (FORTGESCHRITTENE)',
    },
    'gold-parchment': {
      outerBg:
        'linear-gradient(135deg, #fef08a 0%, #facc15 48%, #fef9c3 100%)',
      border: 'border-amber-600',
      innerCardBg: 'bg-amber-50/95 text-amber-950 border-amber-500',
      headerText: 'text-amber-950',
      subText: 'text-amber-800',
      accentBadge: 'bg-amber-900 text-yellow-200 border-amber-500',
      stampBoxBg: 'bg-yellow-50/95 border-amber-500 text-amber-950',
      themeName: 'GOLDGELB-PERGAMENT (HALLEN-LEGENDE)',
    },
    'royal-black-gold': {
      outerBg:
        'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #090d16 100%)',
      border: 'border-yellow-400',
      innerCardBg: 'bg-slate-900/95 text-amber-100 border-yellow-500/80',
      headerText: 'text-yellow-300',
      subText: 'text-amber-200/90',
      accentBadge:
        'bg-gradient-to-r from-amber-500 to-yellow-300 text-slate-950 border-yellow-200',
      stampBoxBg: 'bg-slate-950/90 border-yellow-500/70 text-amber-100',
      themeName: 'EDLES GOLD-SCHWARZ (👑 KÖNIG DER HALLE)',
    },
  };

  const t = themeStyles[rankInfo.paperTheme];
  const isRoyal = rankInfo.paperTheme === 'royal-black-gold';

  const stationsCount = (stamps.visitedStations || []).length;
  const all5StationsVisited =
    stamps.fiveStationsVisited || stationsCount >= 5;
  const kurierReaderDone =
    stamps.kurierReader || isConstantReaderUnlocked;

  const stampItems = [
    {
      id: 'slalom',
      title: '1. SLALOM-PRÜFUNG',
      subtitle: '10 Slalom-Tore / 1 Runde fehlerfrei',
      unlocked: stamps.slalomExam,
      stampText: 'GEPRÜFT • SLALOM ’86',
      stampColor: isRoyal ? 'text-emerald-300 border-emerald-400' : 'text-emerald-700 border-emerald-600',
    },
    {
      id: 'ballspiel',
      title: '2. BALLSPIEL-CHAMPION',
      subtitle: 'Alle Skater im Ballspiel abgeworfen',
      unlocked: stamps.ballspielChamp,
      stampText: 'CHAMPION • LAST SKATER',
      stampColor: isRoyal ? 'text-cyan-300 border-cyan-400' : 'text-blue-800 border-blue-700',
    },
    {
      id: 'kurier',
      title: '3. KURIER-VIELLESER',
      subtitle: '3 Ausgaben „Palladium-Kurier“ gelesen',
      unlocked: kurierReaderDone,
      stampText: 'PRESSE-STEMPEL ’86',
      stampColor: isRoyal ? 'text-pink-300 border-pink-400' : 'text-rose-800 border-rose-700',
    },
    {
      id: 'stations',
      title: '4. 5 PIXEL-STATIONEN',
      subtitle: `Stationen besucht: ${Math.min(5, stationsCount)} / 5`,
      unlocked: all5StationsVisited,
      stampText: 'ALLE 5 STATIONEN ★',
      stampColor: isRoyal ? 'text-yellow-300 border-yellow-400' : 'text-purple-900 border-purple-700',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl rounded-2xl border-4 ${t.border} p-4 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)] transition-all`}
        style={{ background: t.outerBg }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/90 border border-slate-400 text-white font-bold text-sm flex items-center justify-center hover:bg-rose-600 cursor-pointer z-10"
          title="Führerschein schließen"
        >
          ✕
        </button>

        {/* Paper Texture Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-current/30 pb-2.5">
          <div>
            <div
              className={`text-[10px] font-mono uppercase tracking-widest font-bold ${t.subText}`}
            >
              📄 AMTLICHES ROLLSCHUH-DOKUMENT • PAPIEROPTIK: {t.themeName}
            </div>
            <h2
              className={`text-lg sm:text-2xl font-extrabold tracking-tight ${t.headerText}`}
            >
              🪪 ROLLSCHUH-FÜHRERSCHEIN – PALLADIUM HANAU ’86
            </h2>
          </div>
          <div
            className={`rounded-lg border px-3 py-1 text-xs font-extrabold font-mono shadow-sm ${t.accentBadge}`}
          >
            {rankInfo.icon} RANG {rankInfo.level}/6: {rankInfo.title.toUpperCase()}
          </div>
        </div>

        {/* Foldable Two-Page 80s Driver's License Layout (Left Fold + Center Crease + Right Fold) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
          {/* LEFT PAGE: PASSFOTO, PERSONAL DATA & XP RANK PROGRESS */}
          <div
            className={`rounded-xl border-2 p-3.5 shadow-inner ${t.innerCardBg}`}
          >
            <div className="flex items-start gap-3.5">
              {/* 80s Passfoto Frame with Rivets & Official Corner Stamp */}
              <div className="relative shrink-0 w-24 h-28 rounded-lg border-2 border-slate-700 bg-slate-900 overflow-hidden flex flex-col items-center justify-center shadow-md">
                <div
                  className="w-12 h-12 rounded-full border-2 border-yellow-300 flex items-center justify-center text-2xl shadow"
                  style={{ backgroundColor: playerShirtColor || '#1e1b4b' }}
                >
                  {rankInfo.level === 6
                    ? '👑'
                    : characterMode === 'wheelchair'
                    ? '♿'
                    : kengolHatEnabled
                    ? '🦘'
                    : vipDiscoSkatesEquipped
                    ? '🪩'
                    : '🛼'}
                </div>
                <div className="mt-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-cyan-300 font-bold uppercase truncate max-w-[86px]">
                  {playerName}
                </div>
                {/* Official Passfoto Corner Seal */}
                <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full border-2 border-rose-500/80 bg-rose-950/80 flex items-center justify-center text-[8px] font-mono font-bold text-rose-200 rotate-[-15deg]">
                  86-OK
                </div>
              </div>

              {/* Personal License Details */}
              <div className="flex-1 min-w-0 font-mono text-xs space-y-1">
                <div className="text-[10px] opacity-75 uppercase">
                  Inhaber / Rufname:
                </div>
                <div className="text-sm font-extrabold truncate">
                  {playerName}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div>
                    <div className="text-[9px] opacity-75 uppercase">
                      Ausgestellt am:
                    </div>
                    <div className="text-[11px] font-bold">{createdAtText}</div>
                  </div>
                  <div>
                    <div className="text-[9px] opacity-75 uppercase">
                      Listen-Nr.:
                    </div>
                    <div className="text-[11px] font-bold">{licenseNumber}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="rounded border border-current/25 px-2 py-1 bg-black/5">
                    <div className="text-[9px] opacity-75 uppercase">
                      Hallen-Punkte (XP)
                    </div>
                    <div className="text-sm font-extrabold">
                      {hallPointsXp} XP
                    </div>
                  </div>
                  <div className="rounded border border-current/25 px-2 py-1 bg-black/5">
                    <div className="text-[9px] opacity-75 uppercase">
                      Gesammelte Pixel
                    </div>
                    <div className="text-sm font-extrabold">
                      🪙 {collectedPixels}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* XP & Rank Progression Bar up to "König der Halle" */}
            <div className="mt-3 pt-2.5 border-t border-current/20">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                <span>
                  {rankInfo.icon} {rankInfo.title}
                </span>
                <span>
                  {rankInfo.nextXp !== null
                    ? `Nächster Rang ab ${rankInfo.nextXp} XP (${hallPointsXp} / ${rankInfo.nextXp} XP)`
                    : '👑 HÖCHSTRANG ERREICHT!'}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-950/30 overflow-hidden border border-current/30 p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${rankInfo.progressPercent}%`,
                    background:
                      rankInfo.level === 6
                        ? 'linear-gradient(90deg, #facc15, #f59e0b, #fef08a)'
                        : 'linear-gradient(90deg, #00f0ff, #39ff14)',
                  }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] opacity-85">
                <span>
                  Papierfarbe wechselt automatisch mit deinem Hallen-Rang!
                </span>
                {rankInfo.level === 6 && (
                  <span className="font-bold text-yellow-400">
                    🏆 Ehren-Krone &amp; Gold-Schwarz-Ausweis aktiv!
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PAGE: OFFICIAL STAMP FIELDS (STEMPEL-FELDER) */}
          <div
            className={`rounded-xl border-2 p-3.5 shadow-inner flex flex-col justify-between ${t.innerCardBg}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold font-mono uppercase tracking-wider">
                  💮 AMTLICHE PRÜFUNGS- &amp; EHREN-STEMPEL
                </span>
                <span className="text-[10px] font-mono font-bold opacity-80">
                  {stampItems.filter((s) => s.unlocked).length} / 4 FREIGESCHALTET
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stampItems.map((st) => (
                  <div
                    key={st.id}
                    className={`relative rounded-lg border-2 p-2.5 min-h-[78px] flex flex-col justify-between ${t.stampBoxBg}`}
                  >
                    <div>
                      <div className="text-[10px] font-extrabold font-mono">
                        {st.title}
                      </div>
                      <div className="text-[9px] opacity-75 leading-tight mt-0.5">
                        {st.subtitle}
                      </div>
                    </div>

                    {st.unlocked ? (
                      <div
                        className={`mt-1.5 inline-block self-start rounded border-2 px-2 py-0.5 text-[9.5px] font-mono font-extrabold uppercase tracking-wider rotate-[-4deg] shadow-sm ${st.stampColor}`}
                      >
                        ✓ {st.stampText}
                      </div>
                    ) : (
                      <div className="mt-1.5 text-[9.5px] font-mono italic opacity-55">
                        [ Stempel-Feld noch frei ]
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Official Signature & Footer */}
            <div className="mt-3 pt-2 border-t border-dashed border-current/30 flex items-center justify-between text-[10px] font-mono">
              <div>
                Gez. <span className="font-bold italic">Hallenleitung Palladium ’86</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 text-amber-300 border border-amber-400/60 px-3 py-1 font-bold hover:bg-slate-800 cursor-pointer"
              >
                Führerschein zuklappen
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
