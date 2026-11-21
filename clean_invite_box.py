from pathlib import Path

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

# 1. Die ueberfluessige EINLADUNGS-LINK-Box direkt vor MULTIPLAYER-SPASSRAUM entfernen
marker = "🔗 EINLADUNGS-LINK"
pos = s.find(marker)
assert pos != -1, "EINLADUNGS-LINK nicht gefunden"

box_start = s.rfind("<div ", 0, pos)
assert box_start != -1, "Start-Div von EINLADUNGS-LINK nicht gefunden"

# Das schliessende </div> dieser Box liegt direkt vor dem Start-Div von MULTIPLAYER-SPASSRAUM
mp_pos = s.find("MULTIPLAYER-SPASSRAUM (LIVE-SESSION)", pos)
assert mp_pos != -1, "MULTIPLAYER-SPASSRAUM nicht danach gefunden"

mp_div_start = s.rfind("<div ", pos, mp_pos)
assert mp_div_start != -1, "Start-Div von MULTIPLAYER-SPASSRAUM nicht gefunden"

# Alles von box_start bis mp_div_start entfernen und saubere Einrueckung setzen
s = s[:box_start] + "                " + s[mp_div_start:]

p.write_text(s, encoding="utf-8")
print("REMOVED_DUPLICATE_INVITE_BOX_AND_MOVED_MP_UP")
