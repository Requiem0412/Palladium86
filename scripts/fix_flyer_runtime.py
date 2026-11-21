from pathlib import Path

app_path = Path("src/App.tsx")
app = app_path.read_text(encoding="utf-8")

# 1. Imports ergänzen falls fehlend
if "recordVisitorGender" not in app:
    app = app.replace(
        "recordVeteranRinkVote,",
        "recordVeteranRinkVote,\n  recordVisitorGender,\n  recordVisitorBirthYear,\n  recordVisitorReferrer,",
        1,
    )

# 2. States & showEntranceFlyer sauber im App-Funktionskörper anlegen
target_anchor = "  const [flyerVeteranRink, setFlyerVeteranRink] = useState<string>(() => (typeof window !== \"undefined\" ? localStorage.getItem(\"p86_flyer_rink\") || \"\" : \"\"));"
if target_anchor in app and "const [flyerGender, setFlyerGender]" not in app:
    injection = target_anchor + """
  const [flyerGender, setFlyerGender] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("p86_flyer_gender") || "" : ""));
  const [flyerYearDigit1, setFlyerYearDigit1] = useState<string>(() => (typeof window !== "undefined" ? (localStorage.getItem("p86_flyer_year") || "")[0] || "" : ""));
  const [flyerYearDigit2, setFlyerYearDigit2] = useState<string>(() => (typeof window !== "undefined" ? (localStorage.getItem("p86_flyer_year") || "")[1] || "" : ""));
  const [flyerYearSaved, setFlyerYearSaved] = useState<boolean>(() => (typeof window !== "undefined" ? Boolean(localStorage.getItem("p86_flyer_year")) : false));
  const [flyerDismissed, setFlyerDismissed] = useState<boolean>(false);
  const flyerSettings = adminSettings as Record<string, any>;
  const isSingleplayerOpen = flyerSettings.singleplayerEnabled !== false;
  const isMultiplayerOpen = flyerSettings.multiplayerEnabled !== false;
  const showEntranceFlyer = !flyerDismissed && (flyerSettings.entranceFlyerEnabled === true || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("flyer") === "1"));"""
    app = app.replace(target_anchor, injection, 1)

# 3. Property-Zugriffe im Flyer abstrahieren, damit TS & Runtime keinen Undefined-Crash werfen
app = app.replace("adminSettings.entranceFlyerBadge", "flyerSettings.entranceFlyerBadge")
app = app.replace("adminSettings.entranceFlyerTitle", "flyerSettings.entranceFlyerTitle")
app = app.replace("adminSettings.entranceFlyerBody", "flyerSettings.entranceFlyerBody")
app = app.replace("adminSettings.entranceFlyerButtonText", "flyerSettings.entranceFlyerButtonText")
app = app.replace("setAdminSettings((s) => ({ ...s, alphaStartScreenEnabled: true }))", "setAdminSettings((s) => ({ ...(s as any), alphaStartScreenEnabled: true }))")
app = app.replace("else if (!isMultiplayerActive) { setIsMultiplayerActive(true); }", "else if (!isMultiplayerActive) { setFlyerDismissed(true); }")

app_path.write_text(app, encoding="utf-8")
print("FIX_FLYER_RUNTIME_OK")
