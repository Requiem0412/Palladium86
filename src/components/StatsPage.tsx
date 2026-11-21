import React, { useCallback, useEffect, useState } from "react";
import {
  CloudHallStatsSummary,
  fetchCloudGuestbook,
  fetchCloudGuestList,
  fetchCloudHallStats,
  fetchVeteranRinkVotes,
  fetchVisitorReferrers,
  GuestbookEntryRow,
  VeteranRinkCounts,
} from "../lib/supabaseCloud";

export default function StatsPage() {
  const [stats, setStats] = useState<CloudHallStatsSummary | null>(null);
  const [votes, setVotes] = useState<VeteranRinkCounts>({ palladium: 0, rollerland: 0, other: 0 });
  const [guestbook, setGuestbook] = useState<GuestbookEntryRow[]>([]);
  const [vipCount, setVipCount] = useState<number>(0);
  const [referrers, setReferrers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [s, v, gb, vip] = await Promise.all([
      fetchCloudHallStats(),
      fetchVeteranRinkVotes(),
      fetchCloudGuestbook(),
      fetchCloudGuestList(),
      fetchVisitorReferrers(),
    ]);
    setStats(s);
    setVotes(v);
    setGuestbook(gb || []);
    setVipCount(Array.isArray(vip) ? vip.length : 0);
    setReferrers(refs || {});
    setLastUpdated(new Date().toLocaleTimeString("de-DE"));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const timer = window.setInterval(loadAll, 15000);
    return () => window.clearInterval(timer);
  }, [loadAll]);

  const totalVotes = votes.palladium + votes.rollerland + votes.other;
  const pct = (n: number) => (totalVotes > 0 ? Math.round((n / totalVotes) * 100) : 0);

  const referrerEntries = Object.entries(referrers)
    .map(([source, count]) => ({ source, count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const totalReferrers = referrerEntries.reduce((acc, cur) => acc + cur.count, 0);

  const copyUrl = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans">
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
                    {votes[row.key]} ({pct(votes[row.key])}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${row.color} transition-all`} style={{ width: `${pct(votes[row.key])}%` }} />
                </div>
              </div>
            ))}
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
                  <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-400/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300">
              Besucher-Herkunft (Referrer / Links)
            </h2>
            <span className="text-xs font-mono text-slate-400">{totalReferrers} Aufrufe erfasst</span>
          </div>
          {referrerEntries.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {referrerEntries.map((item) => (
                <div key={item.source} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="truncate pr-2">{item.source}</span>
                    <span className="font-mono text-slate-300 shrink-0">
                      {item.count} ({pct(item.count, totalReferrers)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{ width: `${pct(item.count, totalReferrers)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Noch keine Herkunftsdaten vorhanden (werden ab sofort automatisch beim Seitenaufruf gezählt).
            </p>
          )}
        </div>

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
                    <span className="text-xs text-slate-300 ml-2">{entry.message}</span>
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
