from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

marker = '<div className="flex flex-wrap items-center justify-between gap-1.5"><h3 className="font-mono font-bold text-[11px] uppercase text-emerald-300">🌐 MULTIPLAYER-SPASSRAUM (LIVE-SESSION)</h3>'
wrapper_open = '<div className="p-2 rounded-lg bg-slate-950/95 border border-emerald-400/50 space-y-1.5">'

pos = s.find(marker)
assert pos != -1, "MP inner header nicht gefunden"

# Falls nicht schon direkt davor gewrappt, Wrapper oeffnen
before = s[max(0, pos - 200):pos]
if wrapper_open not in before:
    s = s[:pos] + wrapper_open + s[pos:]
    # Passendes schliessendes </div> nach dem MP-Block einfuegen
    mp_start = s.find(wrapper_open)
    kick_pos = s.find("handleKickGuest(rp.peerId)", mp_start)
    assert kick_pos != -1, "kick_pos nicht gefunden"
    # Nach dem Ende des mpRole === 'host'-Ternary-Blocks (nach '24/7-Raum') das schliessende </div> setzen
    room_txt_pos = s.find("24/7-Raum", kick_pos)
    assert room_txt_pos != -1, "24/7-Raum nicht gefunden"
    after_host_ternary = s.find(")}", room_txt_pos)
    assert after_host_ternary != -1, "Ende des host-Ternary nicht gefunden"
    close_pos = after_host_ternary + len(")}")
    s = s[:close_pos] + "</div>" + s[close_pos:]
    print("WRAPPED_MP_BOX_CLEANLY")
else:
    print("ALREADY_WRAPPED")

p.write_text(s, encoding="utf-8")
