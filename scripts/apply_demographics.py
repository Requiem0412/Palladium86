from pathlib import Path

# 1. supabaseCloud.ts erweitern
sc_path = Path("src/lib/supabaseCloud.ts")
sc = sc_path.read_text(encoding="utf-8")
if "fetchFlyerDemographics" not in sc:
    addition = """
export type VisitorGenderKey = "male" | "female" | "diverse";
export type VisitorGenderCounts = { male: number; female: number; diverse: number };
export type FlyerDemographicsSummary = {
  genders: VisitorGenderCounts;
  birthYears: Record<string, number>;
};

export async function fetchFlyerDemographics(): Promise<FlyerDemographicsSummary> {
  const fallback: FlyerDemographicsSummary = {
    genders: { male: 0, female: 0, diverse: 0 },
    birthYears: {},
  };
  if (!supabase) return fallback;
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const controls = data?.controls as Record<string, any> | undefined;
    const g = controls?.visitorGenders;
    const by = controls?.visitorBirthYears;
    return {
      genders: {
        male: Number(g?.male) || 0,
        female: Number(g?.female) || 0,
        diverse: Number(g?.diverse) || 0,
      },
      birthYears: by && typeof by === "object" ? by : {},
    };
  } catch {}
  return fallback;
}

export async function recordVisitorGender(choice: VisitorGenderKey): Promise<VisitorGenderCounts> {
  const current = await fetchFlyerDemographics();
  const next: VisitorGenderCounts = {
    ...current.genders,
    [choice]: (current.genders[choice] || 0) + 1,
  };
  if (!supabase) return next;
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const prevControls = data?.controls && typeof data?.controls === "object" ? data.controls : {};
    await supabase.from("hall_settings").upsert(
      { id: 1, controls: { ...prevControls, visitorGenders: next }, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  } catch {}
  return next;
}

export async function recordVisitorBirthYear(twoDigitYear: string): Promise<Record<string, number>> {
  const clean = twoDigitYear.replace(/[^0-9]/g, "").slice(0, 2);
  const current = await fetchFlyerDemographics();
  if (clean.length !== 2) return current.birthYears;
  const next: Record<string, number> = {
    ...current.birthYears,
    [clean]: (Number(current.birthYears[clean]) || 0) + 1,
  };
  if (!supabase) return next;
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const prevControls = data?.controls && typeof data?.controls === "object" ? data.controls : {};
    await supabase.from("hall_settings").upsert(
      { id: 1, controls: { ...prevControls, visitorBirthYears: next }, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  } catch {}
  return next;
}
"""
    sc_path.write_text(sc + addition, encoding="utf-8")

# 2. App.tsx aktualisieren
app_path = Path("src/App.tsx")
app = app_path.read_text(encoding="utf-8")

assert "recordVeteranRinkVote," in app, "Import nicht gefunden"
app = app.replace(
    "recordVeteranRinkVote,",
    "recordVeteranRinkVote,\n  recordVisitorGender,\n  recordVisitorBirthYear,",
    1,
)

state_anchor = '  const [flyerVeteranRink, setFlyerVeteranRink] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("p86_flyer_rink") || "" : ""));'
assert state_anchor in app, "State-Anchor nicht gefunden"
new_states = state_anchor + """
  const [flyerGender, setFlyerGender] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("p86_flyer_gender") || "" : ""));
  const [flyerYearDigit1, setFlyerYearDigit1] = useState<string>(() => (typeof window !== "undefined" ? (localStorage.getItem("p86_flyer_year") || "")[0] || "" : ""));
  const [flyerYearDigit2, setFlyerYearDigit2] = useState<string>(() => (typeof window !== "undefined" ? (localStorage.getItem("p86_flyer_year") || "")[1] || "" : ""));
  const [flyerYearSaved, setFlyerYearSaved] = useState<boolean>(() => (typeof window !== "undefined" ? Boolean(localStorage.getItem("p86_flyer_year")) : false));"""
app = app.replace(state_anchor, new_states, 1)

old_flyer_box = '<p className="text-[11px] text-slate-400 leading-snug">\\U0001f6fc Bei uns rollst du ohne Tracker und Cookies! Diese Angabe ist komplett freiwillig – du kannst natürlich auch ohne Auswahl direkt in die Halle. Deine Stimme wird rein anonym (ohne Name oder IP) in unserer Datenbank gezählt; ein lokaler Browser-Vermerk verhindert lediglich Doppelabstimmungen.</p></div>'
assert old_flyer_box in app, "Flyer-Box-Anchor nicht gefunden"

new_flyer_box = """<div className="pt-2 border-t border-slate-800 space-y-2.5">
<div className="text-xs font-bold text-cyan-300">Bevor es losgeht – beantworte uns noch kurz (freiwillig):</div>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
<div>
<div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Geschlecht</div>
<div className="grid grid-cols-3 gap-1.5">
{([{ id: "male", label: "Männlich" }, { id: "female", label: "Weiblich" }, { id: "diverse", label: "Divers" }] as const).map((g) => (
<button key={g.id} type="button" onClick={async () => { if (flyerGender) return; setFlyerGender(g.id); localStorage.setItem("p86_flyer_gender", g.id); await recordVisitorGender(g.id); }} className={`py-2 px-2 rounded-xl border text-xs font-bold cursor-pointer transition ${flyerGender === g.id ? "bg-cyan-400 border-white text-slate-950" : "bg-slate-950/80 border-slate-700 text-slate-200 hover:border-cyan-400/60"}`}>{flyerGender === g.id ? "✓ " : ""}{g.label}</button>
))}
</div>
</div>
<div>
<div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Jahrgang (z. B. 78 oder 65)</div>
<div className="flex items-center gap-2">
<input
  id="p86-year-d1"
  type="text"
  inputMode="numeric"
  maxLength={1}
  placeholder="7"
  value={flyerYearDigit1}
  disabled={flyerYearSaved}
  onChange={(e) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(-1);
    setFlyerYearDigit1(val);
    if (val) {
      document.getElementById("p86-year-d2")?.focus();
    }
  }}
  className="w-12 h-11 text-center text-xl font-black font-mono rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-amber-400 text-amber-300 outline-none disabled:opacity-70"
/>
<input
  id="p86-year-d2"
  type="text"
  inputMode="numeric"
  maxLength={1}
  placeholder="8"
  value={flyerYearDigit2}
  disabled={flyerYearSaved}
  onKeyDown={(e) => {
    if (e.key === "Backspace" && !flyerYearDigit2) {
      document.getElementById("p86-year-d1")?.focus();
    }
  }}
  onChange={async (e) => {
    const val = e.target.value.replace(/[^0-9]/g, "").slice(-1);
    setFlyerYearDigit2(val);
    const full = `${flyerYearDigit1}${val}`;
    if (full.length === 2 && !flyerYearSaved) {
      setFlyerYearSaved(true);
      localStorage.setItem("p86_flyer_year", full);
      await recordVisitorBirthYear(full);
    }
  }}
  className="w-12 h-11 text-center text-xl font-black font-mono rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-amber-400 text-amber-300 outline-none disabled:opacity-70"
/>
{flyerYearSaved && <span className="text-xs font-bold text-emerald-400">✓ &apos;{flyerYearDigit1}{flyerYearDigit2} gezählt</span>}
</div>
</div>
</div>
</div>
<p className="text-[11px] text-slate-400 leading-snug">\\U0001f6fc Bei uns rollst du ohne Tracker und Cookies! Alle Angaben sind komplett freiwillig – du kannst natürlich auch ohne Auswahl direkt in die Halle. Deine Antworten werden rein anonym (ohne Name oder IP) in unserer Datenbank gezählt; ein lokaler Browser-Vermerk verhindert lediglich Doppelabstimmungen.</p></div>"""

app = app.replace(old_flyer_box, new_flyer_box, 1)
app = app.replace("fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4", "fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 overflow-y-auto", 1)
app_path.write_text(app, encoding="utf-8")

# 3. StatsPage.tsx erweitern
stats_tsx = """import React, { useCallback, useEffect, useState } from "react";
import {
  CloudHallStatsSummary,
  fetchCloudGuestbook,
  fetchCloudGuestList,
  fetchCloudHallStats,
  fetchFlyerDemographics,
  fetchVeteranRinkVotes,
  FlyerDemographicsSummary,
  GuestbookEntryRow,
  VeteranRinkCounts,
} from "../lib/supabaseCloud";

export default function StatsPage() {
  const [stats, setStats] = useState<CloudHallStatsSummary | null>(null);
  const [votes, setVotes] = useState<VeteranRinkCounts>({ palladium: 0, rollerland: 0, other: 0 });
  const [demo, setDemo] = useState<FlyerDemographicsSummary>({
    genders: { male: 0, female: 0, diverse: 0 },
    birthYears: {},
  });
  const [guestbook, setGuestbook] = useState<GuestbookEntryRow[]>([]);
  const [vipCount, setVipCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, v, d, gb, vip] = await Promise.all([
      fetchCloudHallStats(),
      fetchVeteranRinkVotes(),
      fetchFlyerDemographics(),
      fetchCloudGuestbook(),
      fetchCloudGuestList(),
    ]);
    setStats(s);
    setVotes(v);
    setDemo(d);
    setGuestbook(gb || []);
    setVipCount(Array.isArray(vip) ? vip.length : 0);
    setLastUpdated(new Date().toLocaleTimeString("de-DE"));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const timer = window.setInterval(loadAll, 15000);
    return () => window.clearInterval(timer);
  }, [loadAll]);

  const totalVotes = votes.palladium + votes.rollerland + votes.other;
  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const totalGenders = demo.genders.male + demo.genders.female + demo.genders.diverse;

  const yearEntries = Object.entries(demo.birthYears)
    .map(([yr, count]) => ({ yr, count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.yr.localeCompare(b.yr));

  const totalYears = yearEntries.reduce((acc, cur) => acc + cur.count, 0);

  const decadeBuckets = [
    { label: "50er / 60er", count: 0 },
    { label: "70er", count: 0 },
    { label: "80er", count: 0 },
    { label: "90er", count: 0 },
    { label: "2000+", count: 0 },
  ];
  for (const { yr, count } of yearEntries) {
    const n = parseInt(yr, 10);
    if (Number.isNaN(n)) continue;
    if (n >= 50 && n <= 69) decadeBuckets[0].count += count;
    else if (n >= 70 && n <= 79) decadeBuckets[1].count += count;
    else if (n >= 80 && n <= 89) decadeBuckets[2].count += count;
    else if (n >= 90 && n <= 99) decadeBuckets[3].count += count;
    else decadeBuckets[4].count += count;
  }

  const copyUrl = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/30 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              Palladium 86 • Live-Telemetrie
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Hallen-Statistik & Besucherzahlen
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Auto-Refresh alle 15s • Stand: {lastUpdated || "lädt..."} •{" "}
              <span className={stats?.isCloudConnected ? "text-emerald-400" : "text-amber-400"}>
                {stats?.isCloudConnected ? "Supabase verbunden" : "Offline / Fallback"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyUrl}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-xs font-bold text-slate-200 cursor-pointer"
            >
              {copied ? "URL kopiert" : "Dashboard-Link kopieren"}
            </button>
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/50 hover:bg-cyan-500/30 text-xs font-bold text-cyan-200 cursor-pointer"
            >
              {loading ? "Lädt..." : "Aktualisieren"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Live auf Bahn", value: stats?.activeOnRinkLive ?? 0, accent: "text-emerald-400" },
            { label: "Besucher heute", value: stats?.visitorsToday ?? 0, accent: "text-cyan-300" },
            { label: "Solo-Sessions", value: stats?.soloSessionsStarted ?? 0, accent: "text-white" },
            { label: "MP-Sessions", value: stats?.multiplayerSessionsStarted ?? 0, accent: "text-fuchsia-300" },
            { label: "MP-Besucher ges.", value: stats?.totalMultiplayerVisitors ?? 0, accent: "text-amber-300" },
            { label: "MP-Peak zeitgl.", value: stats?.peakConcurrentMultiplayer ?? 0, accent: "text-rose-300" },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">{card.label}</div>
              <div className={`text-2xl font-black mt-1 ${card.accent}`}>{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-400/30 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                Veteranen-Umfrage (Startflyer)
              </h2>
              <span className="text-xs font-mono text-slate-400">{totalVotes} Stimmen gesamt</span>
            </div>
            {[
              { key: "palladium" as const, label: "Ich war im Palladium", color: "bg-amber-400" },
              { key: "rollerland" as const, label: "Ich war im Rollerland", color: "bg-cyan-400" },
              { key: "other" as const, label: "Andere / Keine Ahnung", color: "bg-fuchsia-400" },
            ].map((row) => (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>{row.label}</span>
                  <span className="font-mono text-slate-300">
                    {votes[row.key]} ({pct(votes[row.key], totalVotes)}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${row.color} transition-all`} style={{ width: `${pct(votes[row.key], totalVotes)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-400/30 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-cyan-300">
                Geschlecht (Freiwillig)
              </h2>
              <span className="text-xs font-mono text-slate-400">{totalGenders} Angaben</span>
            </div>
            {[
              { key: "male" as const, label: "Männlich", color: "bg-cyan-400" },
              { key: "female" as const, label: "Weiblich", color: "bg-fuchsia-400" },
              { key: "diverse" as const, label: "Divers", color: "bg-amber-400" },
            ].map((row) => (
              <div key={row.key} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span>{row.label}</span>
                  <span className="font-mono text-slate-300">
                    {demo.genders[row.key]} ({pct(demo.genders[row.key], totalGenders)}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${row.color} transition-all`} style={{ width: `${pct(demo.genders[row.key], totalGenders)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-fuchsia-400/30 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-fuchsia-300">
                Jahrgänge & Dekaden
              </h2>
              <span className="text-xs font-mono text-slate-400">{totalYears} Jahrgänge</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {decadeBuckets.map((b) => (
                <div key={b.label} className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-center">
                  <div className="text-[11px] text-slate-400">{b.label}</div>
                  <div className="text-lg font-black text-amber-300 mt-0.5">{b.count}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {yearEntries.length > 0 ? (
                yearEntries.map((item) => (
                  <span
                    key={item.yr}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-amber-200"
                  >
                    &apos;{item.yr}: <strong>{item.count}</strong>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">Noch keine Jahrgänge eingetragen.</span>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-cyan-300">
              Länder & Stoßzeit
            </h2>
            <div className="text-xs text-slate-300">
              Stärkste Tageszeit: <strong className="text-white">{stats?.peakHourText || "-"}</strong> • VIP-Liste:{" "}
              <strong className="text-amber-300">{vipCount} Einträge</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              {(stats?.countryBreakdown || []).length > 0 ? (
                stats!.countryBreakdown.map((c) => (
                  <span
                    key={c.country}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono"
                  >
                    {c.country}: <strong>{c.count}</strong>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">Noch keine Länderdaten vorhanden.</span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-fuchsia-300">
              Gästebuch ({guestbook.length} Einträge)
            </h2>
          </div>
          {guestbook.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {guestbook.slice(0, 6).map((entry) => (
                <div key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <span className="text-xs font-bold text-cyan-300">{entry.name || "Anonym"}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {entry.country ? `[${entry.country}] ` : ""}
                      {entry.skated_seconds ? `${Math.round(entry.skated_seconds / 60)} Min. auf der Bahn` : "Eintrag im Gästebuch"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {entry.created_at ? new Date(entry.created_at).toLocaleDateString("de-DE") : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Noch keine Gästebuch-Einträge vorhanden.</p>
          )}
        </div>
      </div>
    </div>
  );
}
"""
Path("src/components/StatsPage.tsx").write_text(stats_tsx, encoding="utf-8")
print("ALL_DEMOGRAPHICS_OK")
