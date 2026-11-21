import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://xyocuyyfkqyalnispfne.supabase.co';

const RAW_ANON_KEY =
  ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '').trim();

export const SUPABASE_ANON_KEY =
  RAW_ANON_KEY &&
  !RAW_ANON_KEY.startsWith('[hier') &&
  RAW_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
    ? RAW_ANON_KEY
    : 'sb_publishable_pTLhtbeT8SsMzPb118Jkgg_ZKvk0B03';

export const supabase: SupabaseClient | null = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
  }
);

export function isSupabaseConfigured(): boolean {
  return Boolean(supabase);
}

const SESSION_ID_KEY = 'palladium_supabase_session_id_v1';
const SESSION_STARTED_AT_KEY = 'palladium_supabase_session_started_at_v1';
const SESSION_COUNTRY_KEY = 'palladium_supabase_session_country_v1';
const PLAYER_ID_STORAGE_KEY = 'palladium_cloud_player_id_v1';
const MP_PEAK_STORAGE_KEY = 'palladium_supabase_mp_peak_v1';
const GUESTBOOK_SIGNED_DATE_KEY = 'palladium_guestbook_signed_date_v1';
const SKATED_SECONDS_STORAGE_KEY = 'palladium_skated_seconds_v1';

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getTodayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadSkatedSeconds(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const val = Number(
      window.localStorage.getItem(SKATED_SECONDS_STORAGE_KEY) || '0'
    );
    return Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0;
  } catch {
    return 0;
  }
}

export function saveSkatedSeconds(sec: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SKATED_SECONDS_STORAGE_KEY,
      String(Math.max(0, Math.floor(sec)))
    );
  } catch {
    // ignore
  }
}

export function countryCodeToFlag(countryCode?: string | null): string {
  const code = (countryCode || 'DE').trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return '🇩🇪';
  const offset = 127397;
  return String.fromCodePoint(
    code.charCodeAt(0) + offset,
    code.charCodeAt(1) + offset
  );
}

export function getOrCreateVisitSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';
  try {
    let sid = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = `sess-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_ID_KEY, sid);
    }
    return sid;
  } catch {
    return `sess-${Date.now().toString(36)}`;
  }
}

export function getOrCreateVisitStartedAt(): string {
  if (typeof window === 'undefined') return new Date().toISOString();
  try {
    let startedAt = window.sessionStorage.getItem(SESSION_STARTED_AT_KEY);
    if (!startedAt) {
      startedAt = new Date().toISOString();
      window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, startedAt);
    }
    return startedAt;
  } catch {
    return new Date().toISOString();
  }
}

export function getOrCreateCloudPlayerId(): string {
  if (typeof window === 'undefined') return 'server-player';
  try {
    let pid = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
    if (!pid) {
      pid = generateUuidV4();
      window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, pid);
    }
    return pid;
  } catch {
    return generateUuidV4();
  }
}

function getFallbackLanguageCountry(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const parts = navigator.language.split(/[-_]/);
    if (parts.length >= 2 && parts[1].length === 2) {
      return parts[1].toUpperCase();
    }
    if (parts[0].length === 2) {
      return parts[0].toUpperCase();
    }
  }
  return 'DE';
}

let cachedCountryPromise: Promise<string> | null = null;

export async function resolveVisitorCountry(): Promise<string> {
  if (typeof window === 'undefined') return 'DE';
  try {
    const cached = window.sessionStorage.getItem(SESSION_COUNTRY_KEY);
    if (cached && cached.length === 2) {
      return cached;
    }
  } catch {
    // ignore
  }

  if (!cachedCountryPromise) {
    cachedCountryPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 2500);
        const res = await fetch('/api/geo', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        window.clearTimeout(timeout);
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = (await res.json()) as { country?: string | null };
            if (
              data &&
              typeof data.country === 'string' &&
              data.country.trim().length === 2
            ) {
              const code = data.country.trim().toUpperCase();
              try {
                window.sessionStorage.setItem(SESSION_COUNTRY_KEY, code);
              } catch {
                // ignore
              }
              return code;
            }
          }
        }
      } catch {
        // Fallback to navigator.language
      }
      const fallback = getFallbackLanguageCountry();
      try {
        window.sessionStorage.setItem(SESSION_COUNTRY_KEY, fallback);
      } catch {
        // ignore
      }
      return fallback;
    })();
  }

  return cachedCountryPromise;
}

// ============================================================================
// 1. HALLEN-STATISTIK & LÄNDER-AUSWERTUNG (public.visits)
// ============================================================================

export interface VisitRow {
  id?: string;
  session_id: string;
  mode: 'solo' | 'multiplayer' | string;
  country?: string | null;
  started_at: string;
  last_seen: string;
}

export interface CloudHallStatsSummary {
  activeOnRinkLive: number;
  soloSessionsStarted: number;
  multiplayerSessionsStarted: number;
  totalMultiplayerVisitors: number;
  peakConcurrentMultiplayer: number;
  visitorsToday: number;
  peakHourText: string;
  countryBreakdown: Array<{ country: string; count: number }>;
  isCloudConnected: boolean;
}

export async function upsertCloudVisit(
  mode: 'solo' | 'multiplayer'
): Promise<void> {
  if (!supabase) return;
  const session_id = getOrCreateVisitSessionId();
  const started_at = getOrCreateVisitStartedAt();
  const last_seen = new Date().toISOString();
  const country = await resolveVisitorCountry();

  try {
    const { error } = await supabase.from('visits').upsert(
      {
        session_id,
        mode,
        country,
        started_at,
        last_seen,
      },
      { onConflict: 'session_id' }
    );
    if (error) {
      await supabase.from('visits').upsert(
        {
          session_id,
          mode,
          started_at,
          last_seen,
        },
        { onConflict: 'session_id' }
      );
    }
  } catch {
    // Ignore transient network errors
  }
}

export async function sendCloudVisitHeartbeat(
  mode?: 'solo' | 'multiplayer'
): Promise<void> {
  if (!supabase) return;
  const session_id = getOrCreateVisitSessionId();
  const last_seen = new Date().toISOString();
  try {
    const updatePayload: Record<string, string> = { last_seen };
    if (mode) updatePayload.mode = mode;

    const { data, error } = await supabase
      .from('visits')
      .update(updatePayload)
      .eq('session_id', session_id)
      .select('session_id');

    if (error || !data || data.length === 0) {
      await upsertCloudVisit(mode || 'solo');
    }
  } catch {
    // Ignore transient network errors
  }
}

function computeMultiplayerConcurrencyPeak(rows: VisitRow[]): number {
  const mpRows = rows.filter((r) => r.mode === 'multiplayer');
  if (mpRows.length === 0) return 0;

  const events: Array<{ time: number; delta: number }> = [];
  for (const r of mpRows) {
    const startMs = Date.parse(r.started_at);
    const endMs = Date.parse(r.last_seen);
    if (Number.isFinite(startMs)) {
      const effectiveEnd =
        Number.isFinite(endMs) && endMs >= startMs
          ? endMs + 2 * 60 * 1000
          : startMs + 2 * 60 * 1000;
      events.push({ time: startMs, delta: 1 });
      events.push({ time: effectiveEnd, delta: -1 });
    }
  }
  events.sort((a, b) => a.time - b.time || b.delta - a.delta);

  let current = 0;
  let peak = 0;
  for (const ev of events) {
    current += ev.delta;
    if (current > peak) peak = current;
  }

  try {
    const storedPeak = Number(
      window.localStorage.getItem(MP_PEAK_STORAGE_KEY) || '0'
    );
    const best = Math.max(peak, storedPeak, mpRows.length > 0 ? 1 : 0);
    window.localStorage.setItem(MP_PEAK_STORAGE_KEY, String(best));
    return best;
  } catch {
    return Math.max(peak, 1);
  }
}

export async function fetchCloudHallStats(): Promise<CloudHallStatsSummary | null> {
  if (!supabase) return null;
  try {
    let rows: VisitRow[] = [];
    const resWithCountry = await supabase
      .from('visits')
      .select('session_id, mode, country, started_at, last_seen');

    if (!resWithCountry.error && Array.isArray(resWithCountry.data)) {
      rows = resWithCountry.data as VisitRow[];
    } else {
      const resBasic = await supabase
        .from('visits')
        .select('session_id, mode, started_at, last_seen');
      if (resBasic.error || !Array.isArray(resBasic.data)) {
        return null;
      }
      rows = resBasic.data as VisitRow[];
    }

    const nowMs = Date.now();
    const twoMinutesAgoMs = nowMs - 2 * 60 * 1000;

    const nowDate = new Date();
    const todayYear = nowDate.getFullYear();
    const todayMonth = nowDate.getMonth();
    const todayDay = nowDate.getDate();

    let activeOnRinkLive = 0;
    let soloSessionsStarted = 0;
    let multiplayerSessionsStarted = 0;
    const todaySessionIds = new Set<string>();
    const hourlyHistogram = Array.from({ length: 24 }, () => 0);
    const countryCounts = new Map<string, number>();

    for (const row of rows) {
      const lastSeenMs = Date.parse(row.last_seen);
      if (Number.isFinite(lastSeenMs) && lastSeenMs >= twoMinutesAgoMs) {
        activeOnRinkLive += 1;
      }

      if (row.mode === 'multiplayer') {
        multiplayerSessionsStarted += 1;
      } else {
        soloSessionsStarted += 1;
      }

      if (row.started_at) {
        const startedDate = new Date(row.started_at);
        if (!Number.isNaN(startedDate.getTime())) {
          if (
            startedDate.getFullYear() === todayYear &&
            startedDate.getMonth() === todayMonth &&
            startedDate.getDate() === todayDay
          ) {
            todaySessionIds.add(row.session_id);
          }
          const hr = startedDate.getHours();
          if (hr >= 0 && hr < 24) {
            hourlyHistogram[hr] += 1;
          }
        }
      }

      const cCode =
        typeof row.country === 'string' && row.country.trim().length > 0
          ? row.country.trim().toUpperCase()
          : 'DE';
      countryCounts.set(cCode, (countryCounts.get(cCode) || 0) + 1);
    }

    let maxHour = -1;
    let maxHourCount = 0;
    for (let h = 0; h < 24; h++) {
      if (hourlyHistogram[h] > maxHourCount) {
        maxHourCount = hourlyHistogram[h];
        maxHour = h;
      }
    }

    const peakHourText =
      maxHour >= 0 && maxHourCount > 0
        ? `${String(maxHour).padStart(2, '0')}:00 - ${String(
            (maxHour + 1) % 24
          ).padStart(2, '0')}:00 Uhr`
        : 'Noch keine Daten';

    const peakConcurrentMultiplayer = computeMultiplayerConcurrencyPeak(rows);
    const countryBreakdown = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return {
      activeOnRinkLive,
      soloSessionsStarted,
      multiplayerSessionsStarted,
      totalMultiplayerVisitors: multiplayerSessionsStarted,
      peakConcurrentMultiplayer,
      visitorsToday: todaySessionIds.size,
      peakHourText,
      countryBreakdown,
      isCloudConnected: true,
    };
  } catch {
    return null;
  }
}

export async function resetCloudHallStats(): Promise<CloudHallStatsSummary> {
  try {
    window.localStorage.removeItem(MP_PEAK_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (supabase) {
    try {
      await supabase.from('visits').delete().neq('session_id', '');
    } catch {
      // ignore
    }
  }
  return {
    activeOnRinkLive: 0,
    soloSessionsStarted: 0,
    multiplayerSessionsStarted: 0,
    totalMultiplayerVisitors: 0,
    peakConcurrentMultiplayer: 0,
    visitorsToday: 0,
    peakHourText: 'Noch keine Daten',
    countryBreakdown: [],
    isCloudConnected: Boolean(supabase),
  };
}

// ============================================================================
// 2. CLOUD-SICHERUNG FÜR SPIELERPROFILE (public.players)
// ============================================================================

export interface CloudPlayerProfilePayload {
  player_id?: string;
  name: string;
  outfit_color: string;
  settings: Record<string, unknown>;
  highscore: number;
}

export async function upsertCloudPlayerProfile(
  payload: CloudPlayerProfilePayload
): Promise<void> {
  if (!supabase) return;
  const player_id = payload.player_id || getOrCreateCloudPlayerId();
  const updated_at = new Date().toISOString();
  try {
    const { error } = await supabase.from('players').upsert(
      {
        player_id,
        name: payload.name,
        outfit_color: payload.outfit_color,
        settings: payload.settings,
        highscore: Math.max(0, Math.round(payload.highscore || 0)),
        updated_at,
      },
      { onConflict: 'player_id' }
    );
    if (error) {
      await supabase.from('players').upsert(
        {
          id: player_id,
          name: payload.name,
          outfit_color: payload.outfit_color,
          settings: payload.settings,
          highscore: Math.max(0, Math.round(payload.highscore || 0)),
          updated_at,
        },
        { onConflict: 'id' }
      );
    }
  } catch {
    // Ignore transient network errors
  }
}

export async function fetchCloudPlayerProfile(): Promise<{
  name?: string;
  outfit_color?: string;
  settings?: Record<string, unknown>;
  highscore?: number;
} | null> {
  if (!supabase) return null;
  const player_id = getOrCreateCloudPlayerId();
  try {
    const { data, error } = await supabase
      .from('players')
      .select('name, outfit_color, settings, highscore')
      .eq('player_id', player_id)
      .maybeSingle();

    if (!error && data) {
      return data as {
        name?: string;
        outfit_color?: string;
        settings?: Record<string, unknown>;
        highscore?: number;
      };
    }
  } catch {
    // ignore
  }
  return null;
}

// ============================================================================
// 3. LIVE-REGIE-SYNCHRONISATION (public.hall_settings, ID = 1)
// ============================================================================

export interface CloudHallSettingsRow<TControls = Record<string, unknown>> {
  id: number;
  controls: TControls;
  announcement?: string | null;
  updated_at?: string;
}

export async function upsertCloudHallSettings<TControls>(
  controls: TControls,
  announcement?: string | null
): Promise<void> {
  if (!supabase) return;
  try {
    const row: Record<string, unknown> = {
      id: 1,
      controls,
      updated_at: new Date().toISOString(),
    };
    if (announcement !== undefined) {
      row.announcement = announcement;
    }
    await supabase.from('hall_settings').upsert(row, { onConflict: 'id' });
  } catch {
    // Ignore transient network errors
  }
}

export async function fetchInitialCloudHallSettings<
  TControls = Record<string, unknown>
>(): Promise<CloudHallSettingsRow<TControls> | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('hall_settings')
      .select('id, controls, announcement, updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) {
      return data as CloudHallSettingsRow<TControls>;
    }
  } catch {
    // ignore
  }
  return null;
}

export function subscribeToCloudHallSettings<TControls = Record<string, unknown>>(
  onUpdate: (row: CloudHallSettingsRow<TControls>) => void
): () => void {
  if (!supabase) return () => {};
  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase
      .channel('palladium-hall-settings-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hall_settings',
          filter: 'id=eq.1',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            onUpdate(payload.new as CloudHallSettingsRow<TControls>);
          }
        }
      )
      .subscribe();
  } catch {
    // ignore
  }
  return () => {
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}

export function subscribeToCloudVisits(onChange: () => void): () => void {
  if (!supabase) return () => {};
  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase
      .channel('palladium-visits-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
        },
        () => {
          onChange();
        }
      )
      .subscribe();
  } catch {
    // ignore
  }
  return () => {
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}

// ============================================================================
// 4. TROLL-GÄSTEBUCH (public.guestbook) – OHNE FREITEXT, HONEYPOT, 60s / 500 Pkt
// ============================================================================

export interface GuestbookEntryRow {
  id: string;
  player_id?: string | null;
  name: string;
  country?: string | null;
  skated_seconds?: number | null;
  entry_date?: string | null;
  created_at: string;
}

export function hasSignedGuestbookToday(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(GUESTBOOK_SIGNED_DATE_KEY) ===
      getTodayIsoDate()
    );
  } catch {
    return false;
  }
}

export function markGuestbookSignedToday(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUESTBOOK_SIGNED_DATE_KEY, getTodayIsoDate());
  } catch {
    // ignore
  }
}

export async function fetchCloudGuestbook(): Promise<GuestbookEntryRow[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('guestbook')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(80);
    if (!error && Array.isArray(data)) {
      return data.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? `${row.name}-${row.created_at}`),
        player_id: typeof row.player_id === 'string' ? row.player_id : null,
        name: String(row.name || row.player_name || 'Palladium-Skater'),
        country:
          typeof row.country === 'string' && row.country.trim().length > 0
            ? row.country.trim().toUpperCase()
            : 'DE',
        skated_seconds:
          typeof row.skated_seconds === 'number' ? row.skated_seconds : 60,
        entry_date:
          typeof row.entry_date === 'string' ? row.entry_date : undefined,
        created_at:
          typeof row.created_at === 'string'
            ? row.created_at
            : new Date().toISOString(),
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

export async function upsertCloudGuestbookEntry(params: {
  player_id: string;
  name: string;
  country: string;
  skated_seconds: number;
  points: number;
  honeypot?: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Honeypot check: reject automated bots silently
  if (params.honeypot && params.honeypot.trim().length > 0) {
    return { ok: false, error: 'Bot-Schutz ausgelöst.' };
  }
  if (params.skated_seconds < 60 && params.points < 500) {
    const remaining = Math.max(1, 60 - Math.floor(params.skated_seconds));
    return {
      ok: false,
      error: `Noch ${remaining}s auf der Bahn rollen (oder 500 Punkte erreichen).`,
    };
  }
  if (hasSignedGuestbookToday()) {
    return {
      ok: false,
      error: 'Maximal 1 Gästebuch-Eintrag pro Tag erlaubt.',
    };
  }
  if (!supabase) {
    return { ok: false, error: 'Keine Cloud-Verbindung.' };
  }

  const cleanName = (params.name || 'Palladium-Skater').trim().slice(0, 24);
  const country = (params.country || 'DE').trim().toUpperCase().slice(0, 2);
  const todayIso = getTodayIsoDate();
  const nowIso = new Date().toISOString();

  try {
    // Check if this player already signed today in DB
    const existing = await fetchCloudGuestbook();
    const alreadyToday = existing.some((row) => {
      const rowDate = (row.entry_date || row.created_at || '').slice(0, 10);
      if (rowDate !== todayIso) return false;
      if (row.player_id && row.player_id === params.player_id) return true;
      return row.name.trim().toLowerCase() === cleanName.toLowerCase();
    });
    if (alreadyToday) {
      markGuestbookSignedToday();
      return {
        ok: false,
        error: 'Du stehst heute bereits im Gästebuch!',
      };
    }

    // Attempt full upsert/insert first, fallback to minimal schema (name, country, created_at)
    const fullRow = {
      player_id: params.player_id,
      name: cleanName,
      country,
      skated_seconds: Math.floor(params.skated_seconds),
      entry_date: todayIso,
      created_at: nowIso,
    };

    const resFull = await supabase.from('guestbook').upsert(fullRow);
    if (resFull.error) {
      const resMinimal = await supabase.from('guestbook').insert({
        name: cleanName,
        country,
        created_at: nowIso,
      });
      if (resMinimal.error) {
        await supabase.from('guestbook').insert({
          name: cleanName,
        });
      }
    }

    markGuestbookSignedToday();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Speichern fehlgeschlagen.' };
  }
}

export async function deleteCloudGuestbookEntry(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('guestbook').delete().eq('id', id);
  } catch {
    // ignore
  }
}

export async function clearCloudGuestbook(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('guestbook').delete().neq('name', '');
  } catch {
    // ignore
  }
}

export function subscribeToCloudGuestbook(onChange: () => void): () => void {
  if (!supabase) return () => {};
  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase
      .channel('palladium-guestbook-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guestbook',
        },
        () => {
          onChange();
        }
      )
      .subscribe();
  } catch {
    // ignore
  }
  return () => {
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}

// ============================================================================
// 5. VIP-GÄSTELISTE (public.guest_list) – OFFEN VS. NUR VIP
// ============================================================================

export interface VipGuestListEntry {
  id: string;
  name: string;
  created_at?: string;
}

export async function fetchCloudGuestList(): Promise<VipGuestListEntry[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('guest_list')
      .select('*')
      .order('name', { ascending: true });
    if (!error && Array.isArray(data)) {
      return data
        .map((row: Record<string, unknown>) => ({
          id: String(row.id ?? row.name ?? Math.random()),
          name: String(row.name || row.guest_name || '').trim(),
          created_at:
            typeof row.created_at === 'string' ? row.created_at : undefined,
        }))
        .filter((r) => r.name.length > 0);
    }
  } catch {
    // ignore
  }
  return [];
}

export async function addCloudGuestListName(name: string): Promise<boolean> {
  if (!supabase) return false;
  const clean = name.trim();
  if (!clean) return false;
  try {
    const existing = await fetchCloudGuestList();
    if (
      existing.some((g) => g.name.trim().toLowerCase() === clean.toLowerCase())
    ) {
      return true;
    }
    const { error } = await supabase.from('guest_list').insert({ name: clean });
    if (error) {
      await supabase
        .from('guest_list')
        .upsert({ name: clean }, { onConflict: 'name' });
    }
    return true;
  } catch {
    return false;
  }
}

export async function removeCloudGuestListEntry(
  entry: VipGuestListEntry
): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('guest_list')
      .delete()
      .eq('id', entry.id);
    if (error) {
      await supabase.from('guest_list').delete().eq('name', entry.name);
    }
  } catch {
    // ignore
  }
}

export async function isNameOnCloudGuestList(name: string): Promise<boolean> {
  const clean = name.trim().toLowerCase();
  if (!clean) return false;
  const list = await fetchCloudGuestList();
  return list.some((entry) => entry.name.trim().toLowerCase() === clean);
}

export function subscribeToCloudGuestList(onChange: () => void): () => void {
  if (!supabase) return () => {};
  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase
      .channel('palladium-guestlist-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guest_list',
        },
        () => {
          onChange();
        }
      )
      .subscribe();
  } catch {
    // ignore
  }
  return () => {
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}

// ============================================================================
// 10. ECHTE DJ-AUDIO-SAMPLES (Supabase Storage Bucket `dj-samples` + Fallback)
// ============================================================================

export async function uploadDjSampleToCloud(
  file: File,
  slotId: string
): Promise<{ url: string | null; source: 'supabase-storage' | 'data-url' }> {
  const safeExt =
    (file.name.split('.').pop() || 'mp3')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'mp3';
  const storagePath = `samples/${slotId}_${Date.now()}.${safeExt}`;

  if (supabase) {
    try {
      const { error: uploadErr } = await supabase.storage
        .from('dj-samples')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'audio/mpeg',
        });

      if (!uploadErr) {
        const { data } = supabase.storage
          .from('dj-samples')
          .getPublicUrl(storagePath);
        if (data?.publicUrl) {
          return { url: data.publicUrl, source: 'supabase-storage' };
        }
      }
    } catch {
      // Fallback to DataURL if bucket RLS / network blocks upload
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve({ url: reader.result, source: 'data-url' });
      } else {
        resolve({ url: null, source: 'data-url' });
      }
    };
    reader.onerror = () => resolve({ url: null, source: 'data-url' });
    reader.readAsDataURL(file);
  });
}

export function setCloudPlayerId(playerId: string): void {
  if (typeof window === 'undefined' || !playerId.trim()) return;
  try {
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId.trim());
  } catch {
    // ignore
  }
}

export async function loginOrSyncCloudAccountByName(skaterName: string): Promise<{
  player_id: string;
  name: string;
  outfit_color?: string;
  settings?: Record<string, unknown>;
  highscore?: number;
  isExistingCloudAccount: boolean;
} | null> {
  if (!supabase) return null;
  const cleanName = skaterName.trim();
  if (!cleanName) return null;

  try {
    const { data, error } = await supabase
      .from('players')
      .select('player_id, id, name, outfit_color, settings, highscore')
      .ilike('name', cleanName)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      const resolvedId = String(
        row.player_id || row.id || getOrCreateCloudPlayerId()
      );
      setCloudPlayerId(resolvedId);
      return {
        player_id: resolvedId,
        name: String(row.name || cleanName),
        outfit_color:
          typeof row.outfit_color === 'string' ? row.outfit_color : undefined,
        settings:
          row.settings && typeof row.settings === 'object'
            ? (row.settings as Record<string, unknown>)
            : undefined,
        highscore:
          typeof row.highscore === 'number' ? row.highscore : undefined,
        isExistingCloudAccount: true,
      };
    }

    const newPlayerId = getOrCreateCloudPlayerId();
    return {
      player_id: newPlayerId,
      name: cleanName,
      isExistingCloudAccount: false,
    };
  } catch {
    return null;
  }
}

export function subscribeToCloudPlayerProfile(
  playerId: string,
  onUpdate: (profile: {
    name?: string;
    outfit_color?: string;
    settings?: Record<string, unknown>;
    highscore?: number;
  }) => void
): () => void {
  if (!supabase || !playerId) return () => {};
  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase
      .channel(`palladium-player-sync-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            onUpdate(
              payload.new as {
                name?: string;
                outfit_color?: string;
                settings?: Record<string, unknown>;
                highscore?: number;
              }
            );
          }
        }
      )
      .subscribe();
  } catch {
    // ignore
  }
  return () => {
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}

export function roomCodeToSettingsRowId(roomCode?: string | null): number {
  const clean = (roomCode || '').trim().toUpperCase();
  if (!clean || clean === 'PALLADIUM-86-ONLINE' || clean === 'PUBLIC') {
    return 1;
  }
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 1000 + (Math.abs(hash) % 899999);
}

export async function upsertCloudRoomSettings<TControls>(
  roomCode: string | null | undefined,
  controls: TControls,
  announcement?: string | null
): Promise<void> {
  if (!supabase) return;
  const rowId = roomCodeToSettingsRowId(roomCode);
  try {
    const row: Record<string, unknown> = {
      id: rowId,
      controls,
      updated_at: new Date().toISOString(),
    };
    if (announcement !== undefined) {
      row.announcement = announcement;
    }
    await supabase.from('hall_settings').upsert(row, { onConflict: 'id' });
  } catch {
    // ignore
  }
}

export async function fetchCloudRoomSettings<
  TControls = Record<string, unknown>
>(roomCode?: string | null): Promise<CloudHallSettingsRow<TControls> | null> {
  if (!supabase) return null;
  const rowId = roomCodeToSettingsRowId(roomCode);
  try {
    const { data, error } = await supabase
      .from('hall_settings')
      .select('id, controls, announcement, updated_at')
      .eq('id', rowId)
      .maybeSingle();
    if (!error && data) {
      return data as CloudHallSettingsRow<TControls>;
    }
  } catch {
    // ignore
  }
  return null;
}

export function subscribeToCloudRoomSettings<
  TControls = Record<string, unknown>
>(
  roomCode: string | null | undefined,
  onUpdate: (row: CloudHallSettingsRow<TControls>) => void
): () => void {
  if (!supabase) return () => {};
  const rowId = roomCodeToSettingsRowId(roomCode);
  let channel: RealtimeChannel | null = null;
  try {
    channel = supabase
      .channel(`palladium-room-settings-${rowId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hall_settings',
          filter: `id=eq.${rowId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            onUpdate(payload.new as CloudHallSettingsRow<TControls>);
          }
        }
      )
      .subscribe();
  } catch {
    // ignore
  }
  return () => {
    if (channel && supabase) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  };
}

export type VeteranRinkCounts = { palladium: number; rollerland: number; other: number };
export async function fetchVeteranRinkVotes(): Promise<VeteranRinkCounts> {
  const fallback: VeteranRinkCounts = { palladium: 0, rollerland: 0, other: 0 };
  if (!supabase) return fallback;
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const v = (data?.controls as Record<string, any> | undefined)?.veteranRinkVotes;
    if (v && typeof v === "object") {
      return { palladium: Number(v.palladium) || 0, rollerland: Number(v.rollerland) || 0, other: Number(v.other) || 0 };
    }
  } catch {}
  return fallback;
}
export async function recordVeteranRinkVote(choice: "palladium" | "rollerland" | "other"): Promise<VeteranRinkCounts> {
  const current = await fetchVeteranRinkVotes();
  const next: VeteranRinkCounts = { ...current, [choice]: (current[choice] || 0) + 1 };
  if (!supabase) return next;
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const prevControls = (data?.controls && typeof data.controls === "object") ? data.controls : {};
    await supabase.from("hall_settings").upsert({ id: 1, controls: { ...prevControls, veteranRinkVotes: next }, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch {}
  return next;
}

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

export async function fetchVisitorReferrers(): Promise<Record<string, number>> {
  if (!supabase) return {};
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const refs = (data?.controls as Record<string, any> | undefined)?.visitorReferrers;
    return refs && typeof refs === "object" ? refs : {};
  } catch {}
  return {};
}

export async function recordVisitorReferrer(sourceLabel: string): Promise<Record<string, number>> {
  const clean = (sourceLabel || "Direkt / Messenger").trim().slice(0, 64) || "Direkt / Messenger";
  const current = await fetchVisitorReferrers();
  const next: Record<string, number> = {
    ...current,
    [clean]: (Number(current[clean]) || 0) + 1,
  };
  if (!supabase) return next;
  try {
    const { data } = await supabase.from("hall_settings").select("controls").eq("id", 1).maybeSingle();
    const prevControls = data?.controls && typeof data.controls === "object" ? data.controls : {};
    await supabase.from("hall_settings").upsert(
      { id: 1, controls: { ...prevControls, visitorReferrers: next }, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  } catch {}
  return next;
}
