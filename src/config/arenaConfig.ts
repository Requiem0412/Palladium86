/**
 * PALLADIUM ROLLER ARENA HANAU (STAND: Alpha v0.2 • Aktualisiert am 13.11.2026)
 * Zentrale Konfiguration, Konstanten, Upgrades, Challenges & 16:9 Breitbild-Geometrie (1920 x 1080 px)
 */

// ============================================================================
// 1. EDITIERBARE TOP-LEVEL KONSTANTEN (ADMIN-PIN & GEISTER-SKATER)
// ============================================================================

export const APP_VERSION_LABEL = 'Update V0.5 • Aktualisiert am 14.11.2026';

export const ADMIN_PIN = '1986';

// === START LAYOUT-KONFIGURATION ===
export const DEFAULT_LAYOUT = {
  modules: {
    proShop: { x: 1310, y: 978, w: 168, h: 88, rot: 0, label: 'PRO-SHOP' },
    skateRental: { x: 930, y: 978, w: 364, h: 88, rot: 0, label: 'ROLLSCHUHVERLEIH' },
    bistro: { x: 24, y: 795, w: 730, h: 271, rot: 0, label: 'SLUSH & BLOB' },
    cashier: { x: 1808, y: 742, w: 94, h: 132, rot: 0, label: 'KASSE & EINGANG' },
    centerStage: { x: 685, y: 342, w: 630, h: 284, rot: 0, label: 'MITTEL-BÜHNE' },
    djTower: { x: 16, y: 6, w: 426, h: 254, rot: 0, label: 'DISCO-TOWER / BACKSTAGE' },
    baffleLeft: { x: 516, y: 855, w: 48, h: 10, rot: 0, label: 'SCHLEUSEN-BALKEN 1 (LINKS)' },
    baffleRight: { x: 1386, y: 855, w: 48, h: 10, rot: 0, label: 'SCHLEUSEN-BALKEN 2 (RECHTS)' },
    lockers: { x: 1515, y: 982, w: 220, h: 42, rot: 0, label: 'SPINDE' },
    bistroTable1: { x: 85, y: 922, w: 40, h: 40, rot: 0, label: 'BISTRO-TISCH 1' },
    bistroTable2: { x: 215, y: 922, w: 40, h: 40, rot: 0, label: 'BISTRO-TISCH 2' },
    bistroTable3: { x: 335, y: 922, w: 40, h: 40, rot: 0, label: 'BISTRO-TISCH 3' },
    bistroTable4: { x: 150, y: 995, w: 40, h: 40, rot: 0, label: 'BISTRO-TISCH 4' },
  },
  npcAnchors: {
    'speed-1': { name: 'Paceline-Leader Kai', homeX: 1604, homeY: 329, orbitAngle: 0.48, laneRadiusX: 668, laneRadiusY: 336 },
    'speed-2': { name: 'Aero-Anja', homeX: 1641, homeY: 366, orbitAngle: 0.36, laneRadiusX: 668, laneRadiusY: 336 },
    'speed-3': { name: 'Turbo-Marek', homeX: 1666, homeY: 404, orbitAngle: 0.24, laneRadiusX: 668, laneRadiusY: 336 },
    'speed-4': { name: 'Sprint-Sonja', homeX: 1681, homeY: 444, orbitAngle: 0.12, laneRadiusX: 668, laneRadiusY: 336 },
    'speed-5': { name: 'Raketen-Ralf', homeX: 1686, homeY: 484, orbitAngle: 0.0, laneRadiusX: 668, laneRadiusY: 336 },
    'speed-6': { name: 'Blitz-Bianca', homeX: 1681, homeY: 524, orbitAngle: -0.12, laneRadiusX: 668, laneRadiusY: 336 },
    'guard-1': { name: 'SKATE GUARD Manni', homeX: 1198, homeY: 240, orbitAngle: 1.2, laneRadiusX: 542, laneRadiusY: 262 },
    'guard-2': { name: 'SKATE GUARD Biggi', homeX: 803, homeY: 728, orbitAngle: 4.34, laneRadiusX: 542, laneRadiusY: 262 },
    'reg-1': { name: 'Disco-Dieter', homeX: 747, homeY: 273, orbitAngle: 2.1, laneRadiusX: 495, laneRadiusY: 245 },
    'reg-2': { name: 'Neon-Nadine', homeX: 521, homeY: 544, orbitAngle: 3.4, laneRadiusX: 472, laneRadiusY: 234 },
    'reg-3': { name: 'WCMX-Marco', homeX: 1197, homeY: 719, orbitAngle: 5.1, laneRadiusX: 518, laneRadiusY: 254 },
    'reg-4': { name: 'Slalom-Steffi', homeX: 1293, homeY: 305, orbitAngle: 0.9, laneRadiusX: 462, laneRadiusY: 228 },
    'reg-5': { name: 'Boogie-Bernd', homeX: 446, homeY: 376, orbitAngle: 2.75, laneRadiusX: 575, laneRadiusY: 284 },
    'reg-6': { name: 'Glitter-Gabi', homeX: 625, homeY: 719, orbitAngle: 4.05, laneRadiusX: 602, laneRadiusY: 298 },
    'reg-7': { name: 'Synth-Sven', homeX: 1013, homeY: 180, orbitAngle: 1.55, laneRadiusX: 615, laneRadiusY: 304 },
    'reg-8': { name: 'Lady-Lisa', homeX: 1466, homeY: 647, orbitAngle: 5.65, laneRadiusX: 560, laneRadiusY: 276 },
    'reg-9': { name: 'Retro-Rico', homeX: 1492, homeY: 372, orbitAngle: 0.45, laneRadiusX: 525, laneRadiusY: 258 },
    'reg-10': { name: 'Disco-Dora', homeX: 468, homeY: 461, orbitAngle: 3.05, laneRadiusX: 508, laneRadiusY: 250 },
    'reg-11': { name: 'Funky-Frank', homeX: 1022, homeY: 774, orbitAngle: 4.75, laneRadiusX: 588, laneRadiusY: 290 },
    'reg-12': { name: 'Wave-Wendy', homeX: 874, homeY: 271, orbitAngle: 1.85, laneRadiusX: 452, laneRadiusY: 222 },
    'reg-13': { name: 'Kassetten-Karsten', homeX: 452, homeY: 655, orbitAngle: 3.72, laneRadiusX: 632, laneRadiusY: 312 },
    'reg-14': { name: 'Pop-Petra', homeX: 1609, homeY: 585, orbitAngle: 5.95, laneRadiusX: 622, laneRadiusY: 308 },
    'reg-15': { name: 'Break-Boris', homeX: 577, homeY: 306, orbitAngle: 2.42, laneRadiusX: 548, laneRadiusY: 270 },
  },
};
// === ENDE LAYOUT-KONFIGURATION ===

/**
 * Spezial-Skater im Retro-Geisterschema (Selektives No-Clip auf der Bahn).
 * Halbtransparent (65% Deckkraft) mit kühlem Cyan-/Weiß-Hologramm-Schimmer
 * und dezenten Doppel-Rollenspuren statt geradem Stab-Schweif.
 */
export const DEFAULT_SPECIAL_SKATERS: string[] = [];

export const LEGACY_DEFAULT_GHOSTS: string[] = [
  'Holger 86',
  'JR (Jürgen Becker)',
  'Palladium-Legende',
  'Nachtläufer Hanau',
];

export interface CrewNamesConfig {
  dj: string;
  lightJockey: string;
  skateGuard: string;
  rollerTeacher: string;
  nurse: string;
  security?: string;
}

export const DEFAULT_CREW_NAMES: CrewNamesConfig = {
  dj: 'DJ Magic Force',
  lightJockey: 'LJ Laser-Lutz',
  skateGuard: 'SKATE-ORDNER MANNI',
  rollerTeacher: 'TRAINERIN CONNY',
  nurse: 'Schwester Gudrun',
  security: 'Security-Sammy',
};

export interface DjJingleSlot {
  id: 'intro' | 'last-round' | 'jam-battle' | 'slow-skating';
  label: string;
  bubbleText: string;
  audioUrl: string;
  fileName?: string;
}

export const DEFAULT_DJ_JINGLE_SLOTS: DjJingleSlot[] = [
  {
    id: 'intro',
    label: '🎙️ Ladies & Gentlemen Intro',
    bubbleText: '🎙️ LADIES & GENTLEMEN — WILLKOMMEN IM PALLADIUM HANAU!',
    audioUrl: '',
  },
  {
    id: 'last-round',
    label: '🚨 Letzte Runde',
    bubbleText: '🚨 ACHTUNG SKATER: LETZTE RUNDE FÜR HEUTE ABEND!',
    audioUrl: '',
  },
  {
    id: 'jam-battle',
    label: '🕺 Jam-Battle',
    bubbleText: '🕺 ALLE ZUR SPIEGELWAND — DAS JAM-BATTLE STARTET JETZT!',
    audioUrl: '',
  },
  {
    id: 'slow-skating',
    label: '🪩 Slow-Skating',
    bubbleText: '🪩 LICHT AUS, SPOT AN — ZEIT FÜR DIE KUSCHELRUNDE!',
    audioUrl: '',
  },
];

export const DEFAULT_TWITCH_CHANNEL = 'Dj_Magic_Force';
export const DEFAULT_DJ_NAME = 'DJ Magic Force';

export const DEFAULT_DJ_TICKER =
  '+++ ON AIR: DJ MAGIC FORCE +++ KLECKNIX TWIN-DECKS +++ OLDSCHOOL • NEWSCHOOL • R&B • HIP HOP • MIAMI BASS • FREESTYLE +++';

export interface GuestDjPreset {
  id: string;
  name: string;
  twitchChannel: string;
  tickerText: string;
  isResident?: boolean;
}

export interface RadioTrackItem {
  id: string;
  title: string;
  subtitle: string;
  streamUrl?: string;
  synthStyle: 'electro-boogie' | 'italo-disco' | 'miami-bass' | 'funk-jam';
  bpm: number;
  isCustom?: boolean;
}

export const DEFAULT_80S_RADIO_PLAYLIST: RadioTrackItem[] = [
  {
    id: 'mix_klecknix_electro_86',
    title: 'Klecknix Twin-Decks — Electro-Boogie 1986',
    subtitle: 'Palladium Resident Mix • 118 BPM (Synth + Webradio)',
    streamUrl: 'https://ice2.somafm.com/u80s-128-mp3',
    synthStyle: 'electro-boogie',
    bpm: 118,
  },
  {
    id: 'mix_hanau_miami_bass',
    title: 'Hanau Jam-Floor — 808 Miami Bass & Freestyle',
    subtitle: 'DJ Magic Force Special • 124 BPM',
    streamUrl: 'https://stream.nightride.fm/nightride.m4a',
    synthStyle: 'miami-bass',
    bpm: 124,
  },
  {
    id: 'mix_italo_roller_night',
    title: 'Rollerland & Palladium — Italo-Disco Night 1985',
    subtitle: 'High-Energy Synthesizer • 120 BPM',
    streamUrl: 'https://ice4.somafm.com/u80s-128-mp3',
    synthStyle: 'italo-disco',
    bpm: 120,
  },
  {
    id: 'mix_boogie_funk_express',
    title: 'Main-Kinzig Funk & Boogie Roller-Jam',
    subtitle: 'Oldschool Funk & Slap-Bass • 114 BPM',
    synthStyle: 'funk-jam',
    bpm: 114,
  },
];

export const PARODY_BANDS = [
  'LAMIO',
  'THE NOTSIGNAL BAND',
  'KOOL & THE SKATES',
  'WINDS OF FREEDOM',
] as const;

// ============================================================================
// 2. TYPEN FÜR GAMEPLAY, LICHT, BÜHNE, SPIELE & UPGRADES
// ============================================================================

export type LightingMode =
  | 'disco'
  | 'blacklight'
  | 'putzlicht'
  | 'slow-skating';
export type CenterStageMode = 'islands' | 'band' | 'cinema';
export type ConcertLightingMode = 'auto' | 'on' | 'off';
export type ArenaVisualStyle = 'classic-neon' | 'palladium-1989' | 'pixel-16bit';
export type BandSkinToneMode = 'black' | 'white' | 'mixed';
export type BandGenderMode = 'male' | 'female' | 'mixed';
export type HallGameMode =
  | 'free-skate'
  | 'ballspiel'
  | 'slalom'
  | 'stuhlsprung'
  | 'springerstaffel';
export type NameDisplayMode = 'focus' | 'all' | 'off';
export type CameraViewMode = 'top-down' | 'chase' | 'ego';
export type PlayerCharacterMode = 'skater' | 'wheelchair';
export type NeonUnderglowColor = 'pink' | 'cyan' | 'green' | 'gold';
export type NeonWristbandColor = 'pink' | 'cyan' | 'green' | 'gold';
export type TrickMoveId = 'spin360' | 'backward' | 'flamingo' | 'starjump';
export type SkateCharmId = 'bell' | 'teddy' | 'pompons' | 'dice';
export type DjSoundboardEffectId =
  | 'airhorn'
  | 'scratch'
  | 'laser'
  | 'fog-hiss'
  | 'applause';

export interface ProShopUpgradesState {
  bearingsAbec9: boolean;
  highGripWheels: boolean;
  aluPlatesHighTop: boolean;
  underglowEnabled: boolean;
  underglowColor: NeonUnderglowColor;
  wristbandsEnabled: boolean;
  wristbandColor: NeonWristbandColor;
  unlockedMoves: {
    spin360: boolean;
    backward: boolean;
    flamingo: boolean;
    starjump: boolean;
  };
  unlockedCharms?: {
    bell: boolean;
    teddy: boolean;
    pompons: boolean;
    dice: boolean;
  };
  activeCharm?: SkateCharmId | null;
  spentPoints?: number;
  bonusPoints?: number;
}

export type ChallengeId =
  | 'warmup_spins'
  | 'endurance_20_laps'
  | 'bistro_drink'
  | 'slipstream_10s'
  | 'mirror_spin'
  | 'vip_ego_view'
  | 'ballspiel_5_hits'
  | 'slalom_10_gates'
  | 'chair_jump_3';

export interface ChallengeDefinition {
  id: ChallengeId;
  title: string;
  description: string;
  target: number;
  unit: string;
  rewardLabel: string;
  unlockKey: string;
}

export const PALLADIUM_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'warmup_spins',
    title: '1. Warm-Up-Kreisel',
    description:
      'Mache 3 saubere 360°-Pirouetten ([Space]/[Q]/Pad-B) in der Spin-Zone am Eingang.',
    target: 3,
    unit: 'Spins',
    rewardLabel: 'Neon-Rollenbeleuchtung (Pink & Cyan)',
    unlockKey: 'underglow_pink_cyan',
  },
  {
    id: 'endurance_20_laps',
    title: '2. Dauerläufer',
    description:
      'Fahre 20 Runden gegen den Uhrzeigersinn ohne Skate-Guard-Pfiff.',
    target: 20,
    unit: 'Runden',
    rewardLabel: 'ABEC-9 Gold-Kugellager (+Topspeed)',
    unlockKey: 'bearings_abec9',
  },
  {
    id: 'bistro_drink',
    title: '3. Slush- & Bloba-Pause',
    description:
      'Hole dir am Bistro unten links einen Slush-Puppie oder eine Bloba Cola.',
    target: 1,
    unit: 'Drink',
    rewardLabel: 'High-Grip Urethan-Rollen (Bohnerwachs-Stabilität)',
    unlockKey: 'wheels_high_grip',
  },
  {
    id: 'slipstream_10s',
    title: '4. Windschatten-Surfer',
    description:
      'Halte dich 10 Sekunden im sichtbaren Windschatten der Speed-Skater.',
    target: 10,
    unit: 'Sek.',
    rewardLabel: 'Leichte Alu-Platten (+Antritt)',
    unlockKey: 'plates_alu',
  },
  {
    id: 'mirror_spin',
    title: '5. Spiegel-Tänzer',
    description:
      'Drehe vor der hochkanten Spiegelwand links eine Pirouette im Takt mit den Breakdancern.',
    target: 1,
    unit: 'Spin',
    rewardLabel: 'Neon-Rollenbeleuchtung (Neongrün & Gold)',
    unlockKey: 'underglow_green_gold',
  },
  {
    id: 'vip_ego_view',
    title: '6. VIP-Blick',
    description:
      'Schalte vor dem gebogenen Eck-DJ-Tower mit [C] oder Pad-Y in die Ego-Perspektive.',
    target: 1,
    unit: 'Blick',
    rewardLabel: 'VIP-Backstage-Pass Status',
    unlockKey: 'vip_badge',
  },
  {
    id: 'ballspiel_5_hits',
    title: '7. Ballspiel-Ass',
    description:
      'Triff im Hallen-Spiel „Ballspiel“ mindestens 5 Skater mit dem Neon-Softball.',
    target: 5,
    unit: 'Treffer',
    rewardLabel: 'Ehren-Trillerpfeife der Skate Guards',
    unlockKey: 'guard_whistle',
  },
  {
    id: 'slalom_10_gates',
    title: '8. Slalom-Künstler',
    description:
      'Durchfahre im Hallen-Spiel „Slalom“ 10 Tore am Stück fehlerfrei.',
    target: 10,
    unit: 'Tore',
    rewardLabel: 'Slalom-Profi-Stopper',
    unlockKey: 'slalom_stopper',
  },
  {
    id: 'chair_jump_3',
    title: '9. Stuhl-Springer',
    description:
      'Überspringe beim „Stuhl- & Hindernissprung“ eine 3er-Stuhlreihe mit [Space]/[J]/[Shift]/Pad-A.',
    target: 1,
    unit: 'Sprung',
    rewardLabel: 'Pro-High-Top-Skates (+Sprunghöhe)',
    unlockKey: 'skates_hightop',
  },
];

// ============================================================================
// 3. 16:9 WIDESCREEN ARENA GEOMETRIE (1920 x 1080 px)
// ============================================================================

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1080;

export const ARENA_LAYOUT = {
  // Obere nach hinten geneigte 2.5D-Rückwand (schließt links bei x = 442, y = 108 bündig an den gebogenen Eck-DJ-Tower an!)
  slopedBackWall: {
    topY: 6,
    bottomY: 108,
    topLeftX: 356,
    topRightX: 1665,
    bottomLeftX: 442,
    bottomRightX: 1710,
    // Großes neongrünes Leuchtschild "✦✦ PALLADIUM HANAU ✦✦" mittig auf der 2.5D-Rückwand
    neonSignCenterX: 1075,
    neonSignCenterY: 56,
    neonSignWidth: 580,
    neonSignHeight: 50,
  },

  // Hauptbahn: Oben links mit sanft geschwungenem Viertelbogen am tief in die Ecke gesetzten DJ-Tower
  // von (290, 260) nach (442, 108) -> deutlich mehr Platz vorne auf der Bahn!
  rink: {
    x: 290,
    y: 108,
    width: 1420,
    height: 752,
    cornerRadius: 190,
    topLeftBevel: 152, // Viertelbogen-Übergang: (290, 260) -> (442, 108)
    centerX: 1000,
    centerY: 484,
  },

  // Um 90° gedrehte pinke U-Inseln in der Bahnmitte (Zentrum x = 1000):
  // Weiter auseinandergerückt für einen deutlich breiteren, großzügigen Jam- & Freestyle-Mittelgang!
  uIslands: {
    width: 175,
    height: 284,
    wallThickness: 30,
    centerY: 484,
    topY: 342, // 484 - 284/2
    leftDefaultX: 685, // `[` Insel links (685 .. 860)
    rightDefaultX: 1140, // `]` Insel rechts (1140 .. 1315) -> 280px breiter Mittelgang!
    closedStageX: 805, // Zusammengeschoben in der Mitte: 805 .. 1195
    closedStageY: 336,
    closedStageWidth: 390,
    closedStageHeight: 296,
    // Großer Kino-Leinwand-Rahmen in der Arena-Mitte (für eingebetteten Live-Twitch-Player)
    cinemaScreenRect: {
      x: 825,
      y: 356,
      width: 350,
      height: 256,
    },
  },

  // Exakt ZWEI Schleusen-Banden (unten links & unten rechts):
  // - 120 px breite Öffnung in der Hauptbande (y = 860)
  // - Leuchtend cyane Schleusen-Balken direkt auf Höhe der unteren Außenbande (baffleY = 860),
  //   sodass die untere Gerade der Bahn komplett frei befahrbar ist!
  gates: {
    // Schleusen-Bande 2 (Unten rechts über „PRO-SHOP“)
    bottomRightEntrance: {
      xStart: 1344,
      xEnd: 1476,
      y: 860,
      width: 132,
      baffleXStart: 1386,
      baffleXEnd: 1434,
      baffleY: 860,
    },
    // (Vertikale linke Außenbande x = 290 ist komplett durchgängig geschlossen!)
    topLeftBistro: {
      x: 290,
      yStart: 615,
      yEnd: 615,
      height: 0,
    },
    // Schleusen-Bande 1 (Unten links über „SLUSH & BLOB“)
    bottomLeftSchwingtuer: {
      xStart: 474,
      xEnd: 606,
      y: 860,
      width: 132,
      baffleXStart: 516,
      baffleXEnd: 564,
      baffleY: 860,
    },
    // Dynamische Schleusen-Wegpunkte direkt im freien Durchgang
    gateLeft: { x: 494, y: 860 },
    gateRight: { x: 1456, y: 860 },
  },

  // 1) Leicht gebogener (viertelkreisförmig geschwungener) Eck-DJ-Tower tief hinten in der oberen linken Hallenecke:
  djTower: {
    cornerX: 16,
    cornerY: 6,
    centerX: 205,
    centerY: 118,
    angleRad: -Math.PI / 4,
    width: 248,
    height: 142,
    bevelLeftX: 290,
    bevelLeftY: 260,
    bevelTopX: 442,
    bevelTopY: 108,
    curveCtrlX: 308,
    curveCtrlY: 126,
    x: 16,
    y: 6,
    deskX: 145,
    deskY: 105,
    deskW: 215,
    deskH: 42,
    clickRadius: 175,
    egoTriggerX: 385,
    egoTriggerY: 220,
    egoTriggerRadius: 210,
  },

  // 2) SPIEGELWAND - JAM-DANCE
  mirrorWall: {
    x: 16,
    y: 274,
    width: 28,
    height: 365,
    danceFloorX: 128,
    danceFloorY: 455,
  },

  // Schmale, bündige Tür an der linken Außenwand zwischen Spiegelwand und Bistro ("PUTZRAUM")
  putzraumDoor: {
    x: 16,
    y: 662,
    width: 22,
    height: 98,
  },

  // Rechte Hallenwand: Drei braune Holzlatten-Sitzbänke ganz nach hinten an die rechte Außenwand gerückt
  rightWallBenches: [
    { id: 'right-bench-1', x: 1848, y: 132, width: 48, height: 112 },
    { id: 'right-bench-2', x: 1848, y: 262, width: 48, height: 112 },
    { id: 'right-bench-3', x: 1848, y: 558, width: 48, height: 112 },
  ],

  rightWallTechDoor: {
    x: 1860,
    y: 405,
    width: 44,
    height: 132,
  },

  // 3) Untere & rechte Hallenachse:
  // A) 1) KASSE & EINGANG GANZ AN DER RECHTEN AUSSENWAND (x = 1808..1902), Kassenfenster links nach innen zum breiten Durchgang!
  bottomEntrance: {
    cashierBooth: {
      x: 1808,
      y: 742,
      width: 94,
      height: 132,
      centerX: 1855,
      centerY: 808,
      angleRad: 0,
    },
    entranceSpawn: {
      x: 1762,
      y: 808,
      securityX: 1718,
      securityY: 808,
    },
    spinWarmupZone: { x: -999, y: -999, radius: 0 },
    woodenSlatBenches: [] as {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  },

  // B) KOMPAKTER MINI-PRO-SHOP (~48% Breite) & UM ~32% VERKLEINERTER ROLLSCHUHVERLEIH (118 px breiter unterer Gang y = 860..978!)
  proShopAndRental: {
    // 2) Kompakter Mini-Stand Pro-Shop & Tuning [E] (ohne großes ovales Emblem)
    proShopBounds: { x: 1310, y: 978, width: 168, height: 88 },
    proShopCounter: { x: 1322, y: 984, width: 144, height: 32 },
    proShopInteractX: 1394,
    proShopInteractY: 948,
    proShopInteractRadius: 82,

    // Schmale Trennwand zwischen Pro-Shop (rechts) und Rollschuhverleih (links)
    dividerWall: { x: 1294, y: 978, width: 16, height: 88 },

    // 3) Um ~32% verkleinerter Rollschuhverleih mit Schuhregalen ganz an der Rückwand (mit Kollisionsschutz) & Personal im Gang davor
    rentalBounds: { x: 930, y: 978, width: 364, height: 88 },
    rentalCounter: { x: 946, y: 982, width: 332, height: 28 },
    rentalInteractX: 1112,
    rentalInteractY: 948,
    rentalInteractRadius: 125,
    rentalShelves: [
      { x: 946, y: 1038, width: 158, height: 24 },
      { x: 1120, y: 1038, width: 158, height: 24 },
    ],

    oppositeBenches: [] as {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  },

  // C) 4) 80ER-BISTRO & GARNET-LOUNGE (124 px breiter Hauptgang y = 860..984 + 80er-Sitzgruppe mit mind. 75 px freien Wegen!)
  bistro: {
    bounds: { x: 24, y: 795, width: 730, height: 271 },
    wcSign: { x: 38, y: 802, width: 88, height: 30 },
    counter: { x: 430, y: 984, width: 310, height: 38 },
    slushMachine: { x: 448, y: 986, width: 52, height: 30 },
    blobaColaTap: { x: 520, y: 986, width: 56, height: 30 },
    interactX: 585,
    interactY: 948,
    interactRadius: 85,
    // 80er-Sitzgruppe im Vorbereich (runde Bistro-Tische frei verschiebbar, pinke Polsterbänke entfernt)
    marbleTables: [
      { id: 'marble-table-1', x: 105, y: 942, radius: 20 },
      { id: 'marble-table-2', x: 235, y: 942, radius: 20 },
      { id: 'marble-table-3', x: 355, y: 942, radius: 20 },
      { id: 'marble-table-4', x: 170, y: 1015, radius: 20 },
    ],
    wallBenches: [] as {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  },

  // D) 5) 80ER-SPINDREIHE („SPINDE“ — grau-blaue Metall-Schließfächer mit Lüftungsschlitzen & Nummern)
  lockers: {
    x: 1515,
    y: 982,
    width: 220,
    height: 42,
    rot: 0,
  },
};

export type EditableModuleId =
  | 'proShop'
  | 'skateRental'
  | 'bistro'
  | 'cashier'
  | 'centerStage'
  | 'djTower'
  | 'baffleLeft'
  | 'baffleRight'
  | 'lockers'
  | 'bistroTable1'
  | 'bistroTable2'
  | 'bistroTable3'
  | 'bistroTable4';

export interface EditableModuleRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rot?: number;
  label: string;
}

export interface CustomNpcAnchor {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  homeX: number;
  homeY: number;
  orbitAngle?: number;
  laneRadiusX?: number;
  laneRadiusY?: number;
  isStationary?: boolean;
}

export interface CustomArenaLayoutState {
  modules: Record<EditableModuleId, EditableModuleRect>;
  npcAnchors: Record<string, CustomNpcAnchor>;
}

export const DEFAULT_CUSTOM_ARENA_LAYOUT: CustomArenaLayoutState = {
  modules: {
    proShop: {
      x: DEFAULT_LAYOUT.modules.proShop.x,
      y: DEFAULT_LAYOUT.modules.proShop.y,
      width: DEFAULT_LAYOUT.modules.proShop.w,
      height: DEFAULT_LAYOUT.modules.proShop.h,
      rot: DEFAULT_LAYOUT.modules.proShop.rot,
      label: DEFAULT_LAYOUT.modules.proShop.label,
    },
    skateRental: {
      x: DEFAULT_LAYOUT.modules.skateRental.x,
      y: DEFAULT_LAYOUT.modules.skateRental.y,
      width: DEFAULT_LAYOUT.modules.skateRental.w,
      height: DEFAULT_LAYOUT.modules.skateRental.h,
      rot: DEFAULT_LAYOUT.modules.skateRental.rot,
      label: DEFAULT_LAYOUT.modules.skateRental.label,
    },
    bistro: {
      x: DEFAULT_LAYOUT.modules.bistro.x,
      y: DEFAULT_LAYOUT.modules.bistro.y,
      width: DEFAULT_LAYOUT.modules.bistro.w,
      height: DEFAULT_LAYOUT.modules.bistro.h,
      rot: DEFAULT_LAYOUT.modules.bistro.rot,
      label: DEFAULT_LAYOUT.modules.bistro.label,
    },
    cashier: {
      x: DEFAULT_LAYOUT.modules.cashier.x,
      y: DEFAULT_LAYOUT.modules.cashier.y,
      width: DEFAULT_LAYOUT.modules.cashier.w,
      height: DEFAULT_LAYOUT.modules.cashier.h,
      rot: DEFAULT_LAYOUT.modules.cashier.rot,
      label: DEFAULT_LAYOUT.modules.cashier.label,
    },
    centerStage: {
      x: DEFAULT_LAYOUT.modules.centerStage.x,
      y: DEFAULT_LAYOUT.modules.centerStage.y,
      width: DEFAULT_LAYOUT.modules.centerStage.w,
      height: DEFAULT_LAYOUT.modules.centerStage.h,
      rot: DEFAULT_LAYOUT.modules.centerStage.rot,
      label: DEFAULT_LAYOUT.modules.centerStage.label,
    },
    djTower: {
      x: DEFAULT_LAYOUT.modules.djTower.x,
      y: DEFAULT_LAYOUT.modules.djTower.y,
      width: DEFAULT_LAYOUT.modules.djTower.w,
      height: DEFAULT_LAYOUT.modules.djTower.h,
      rot: DEFAULT_LAYOUT.modules.djTower.rot,
      label: DEFAULT_LAYOUT.modules.djTower.label,
    },
    baffleLeft: {
      x: DEFAULT_LAYOUT.modules.baffleLeft.x,
      y: DEFAULT_LAYOUT.modules.baffleLeft.y,
      width: DEFAULT_LAYOUT.modules.baffleLeft.w,
      height: DEFAULT_LAYOUT.modules.baffleLeft.h,
      rot: DEFAULT_LAYOUT.modules.baffleLeft.rot,
      label: DEFAULT_LAYOUT.modules.baffleLeft.label,
    },
    baffleRight: {
      x: DEFAULT_LAYOUT.modules.baffleRight.x,
      y: DEFAULT_LAYOUT.modules.baffleRight.y,
      width: DEFAULT_LAYOUT.modules.baffleRight.w,
      height: DEFAULT_LAYOUT.modules.baffleRight.h,
      rot: DEFAULT_LAYOUT.modules.baffleRight.rot,
      label: DEFAULT_LAYOUT.modules.baffleRight.label,
    },
    lockers: {
      x: DEFAULT_LAYOUT.modules.lockers.x,
      y: DEFAULT_LAYOUT.modules.lockers.y,
      width: DEFAULT_LAYOUT.modules.lockers.w,
      height: DEFAULT_LAYOUT.modules.lockers.h,
      rot: DEFAULT_LAYOUT.modules.lockers.rot,
      label: DEFAULT_LAYOUT.modules.lockers.label,
    },
    bistroTable1: {
      x: DEFAULT_LAYOUT.modules.bistroTable1.x,
      y: DEFAULT_LAYOUT.modules.bistroTable1.y,
      width: DEFAULT_LAYOUT.modules.bistroTable1.w,
      height: DEFAULT_LAYOUT.modules.bistroTable1.h,
      rot: DEFAULT_LAYOUT.modules.bistroTable1.rot,
      label: DEFAULT_LAYOUT.modules.bistroTable1.label,
    },
    bistroTable2: {
      x: DEFAULT_LAYOUT.modules.bistroTable2.x,
      y: DEFAULT_LAYOUT.modules.bistroTable2.y,
      width: DEFAULT_LAYOUT.modules.bistroTable2.w,
      height: DEFAULT_LAYOUT.modules.bistroTable2.h,
      rot: DEFAULT_LAYOUT.modules.bistroTable2.rot,
      label: DEFAULT_LAYOUT.modules.bistroTable2.label,
    },
    bistroTable3: {
      x: DEFAULT_LAYOUT.modules.bistroTable3.x,
      y: DEFAULT_LAYOUT.modules.bistroTable3.y,
      width: DEFAULT_LAYOUT.modules.bistroTable3.w,
      height: DEFAULT_LAYOUT.modules.bistroTable3.h,
      rot: DEFAULT_LAYOUT.modules.bistroTable3.rot,
      label: DEFAULT_LAYOUT.modules.bistroTable3.label,
    },
    bistroTable4: {
      x: DEFAULT_LAYOUT.modules.bistroTable4.x,
      y: DEFAULT_LAYOUT.modules.bistroTable4.y,
      width: DEFAULT_LAYOUT.modules.bistroTable4.w,
      height: DEFAULT_LAYOUT.modules.bistroTable4.h,
      rot: DEFAULT_LAYOUT.modules.bistroTable4.rot,
      label: DEFAULT_LAYOUT.modules.bistroTable4.label,
    },
  },
  npcAnchors: { ...DEFAULT_LAYOUT.npcAnchors },
};

/**
 * Computes the effective axis-aligned bounding box of a module accounting for its
 * current width (`w`), height (`h`), and rotation (`rot` in degrees around its center).
 */
export function getModuleCollisionRect(
  mod: Pick<EditableModuleRect, 'x' | 'y' | 'width' | 'height' | 'rot'>
): {
  x: number;
  y: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  rot: number;
} {
  const rot = ((mod.rot || 0) % 360 + 360) % 360;
  const cx = mod.x + mod.width / 2;
  const cy = mod.y + mod.height / 2;
  if (rot === 0 || rot === 180) {
    return {
      x: Math.round(mod.x),
      y: Math.round(mod.y),
      width: Math.round(mod.width),
      height: Math.round(mod.height),
      cx,
      cy,
      rot,
    };
  }
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const effW = Math.max(10, Math.round(mod.width * cos + mod.height * sin));
  const effH = Math.max(10, Math.round(mod.width * sin + mod.height * cos));
  return {
    x: Math.round(cx - effW / 2),
    y: Math.round(cy - effH / 2),
    width: effW,
    height: effH,
    cx,
    cy,
    rot,
  };
}

/**
 * Generates the complete JS block between `// === START LAYOUT-KONFIGURATION ===`
 * and `// === ENDE LAYOUT-KONFIGURATION ===` for 1-click Copy & Paste into the HTML/TS editor.
 */
export function formatLayoutConfigCodeBlock(
  custom?: CustomArenaLayoutState | null
): string {
  const mods = custom?.modules || DEFAULT_CUSTOM_ARENA_LAYOUT.modules;
  const anchors = custom?.npcAnchors || DEFAULT_CUSTOM_ARENA_LAYOUT.npcAnchors;
  const modOrder: EditableModuleId[] = [
    'proShop',
    'skateRental',
    'bistro',
    'cashier',
    'centerStage',
    'djTower',
    'baffleLeft',
    'baffleRight',
    'lockers',
    'bistroTable1',
    'bistroTable2',
    'bistroTable3',
    'bistroTable4',
  ];

  const modLines = modOrder.map((id) => {
    const m = mods[id] || DEFAULT_CUSTOM_ARENA_LAYOUT.modules[id];
    const x = Math.round(m.x);
    const y = Math.round(m.y);
    const w = Math.round(m.width);
    const h = Math.round(m.height);
    const rot = Math.round(m.rot || 0);
    return `    ${id}: { x: ${x}, y: ${y}, w: ${w}, h: ${h}, rot: ${rot}, label: '${m.label}' },`;
  });

  const mergedNpcKeys = Array.from(
    new Set([
      ...Object.keys(DEFAULT_LAYOUT.npcAnchors),
      ...Object.keys(anchors),
    ])
  );
  const npcLines = mergedNpcKeys.map((id) => {
    const def = (DEFAULT_LAYOUT.npcAnchors as Record<string, CustomNpcAnchor>)[id];
    const cur = anchors[id] || def;
    const name = cur?.name || def?.name || id;
    const hx = Math.round(cur?.homeX ?? def?.homeX ?? 1000);
    const hy = Math.round(cur?.homeY ?? def?.homeY ?? 484);
    const oa = Number((cur?.orbitAngle ?? def?.orbitAngle ?? 0).toFixed(2));
    const rx = Math.round(cur?.laneRadiusX ?? def?.laneRadiusX ?? 548);
    const ry = Math.round(cur?.laneRadiusY ?? def?.laneRadiusY ?? 270);
    return `    '${id}': { name: '${name}', homeX: ${hx}, homeY: ${hy}, orbitAngle: ${oa}, laneRadiusX: ${rx}, laneRadiusY: ${ry} },`;
  });

  return [
    '// === START LAYOUT-KONFIGURATION ===',
    'export const DEFAULT_LAYOUT = {',
    '  modules: {',
    ...modLines,
    '  },',
    '  npcAnchors: {',
    ...npcLines,
    '  },',
    '};',
    '// === ENDE LAYOUT-KONFIGURATION ===',
  ].join('\n');
}

/**
 * Single Source of Truth updater: dynamically recalculates all module bounds,
 * collision boxes, sub-elements, and [E] interaction zones directly from the
 * active CustomArenaLayoutState so zero static "ghost walls" ever remain!
 */
export function applyCustomArenaLayout(
  custom?: CustomArenaLayoutState | null
): void {
  const mods = custom?.modules || DEFAULT_CUSTOM_ARENA_LAYOUT.modules;

  // 1. PRO-SHOP
  const psRaw = mods.proShop || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.proShop;
  const ps = getModuleCollisionRect(psRaw);
  ARENA_LAYOUT.proShopAndRental.proShopBounds = {
    x: ps.x,
    y: ps.y,
    width: ps.width,
    height: ps.height,
  };
  ARENA_LAYOUT.proShopAndRental.proShopCounter = {
    x: ps.x + Math.round(ps.width * 0.07),
    y: ps.y + Math.round(ps.height * 0.07),
    width: Math.max(36, Math.round(ps.width * 0.86)),
    height: Math.max(20, Math.round(ps.height * 0.36)),
  };
  ARENA_LAYOUT.proShopAndRental.proShopInteractX =
    ps.x + Math.round(ps.width / 2);
  ARENA_LAYOUT.proShopAndRental.proShopInteractY = ps.y - 30;
  ARENA_LAYOUT.proShopAndRental.proShopInteractRadius = Math.max(
    72,
    Math.round(Math.max(ps.width, ps.height) * 0.5)
  );

  // 2. ROLLSCHUHVERLEIH
  const srRaw =
    mods.skateRental || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.skateRental;
  const sr = getModuleCollisionRect(srRaw);
  ARENA_LAYOUT.proShopAndRental.rentalBounds = {
    x: sr.x,
    y: sr.y,
    width: sr.width,
    height: sr.height,
  };
  ARENA_LAYOUT.proShopAndRental.rentalCounter = {
    x: sr.x + Math.round(sr.width * 0.045),
    y: sr.y + Math.round(sr.height * 0.05),
    width: Math.max(50, Math.round(sr.width * 0.91)),
    height: Math.max(20, Math.round(sr.height * 0.32)),
  };
  ARENA_LAYOUT.proShopAndRental.rentalInteractX =
    sr.x + Math.round(sr.width / 2);
  ARENA_LAYOUT.proShopAndRental.rentalInteractY = sr.y - 30;
  ARENA_LAYOUT.proShopAndRental.rentalInteractRadius = Math.max(
    95,
    Math.round(Math.max(sr.width, sr.height) * 0.36)
  );
  const shelfW = Math.max(40, Math.round(sr.width * 0.43));
  const shelfH = Math.max(16, Math.round(sr.height * 0.27));
  const shelfY = sr.y + Math.max(24, sr.height - shelfH - 4);
  ARENA_LAYOUT.proShopAndRental.rentalShelves = [
    { x: sr.x + Math.round(sr.width * 0.045), y: shelfY, width: shelfW, height: shelfH },
    { x: sr.x + Math.round(sr.width * 0.52), y: shelfY, width: shelfW, height: shelfH },
  ];
  ARENA_LAYOUT.proShopAndRental.dividerWall = {
    x: sr.x + sr.width,
    y: sr.y,
    width: 16,
    height: sr.height,
  };

  // 3. SLUSH & BLOB (inkl. Bistro-Sitzgruppe proportional zu w/h)
  const biRaw = mods.bistro || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.bistro;
  const bi = getModuleCollisionRect(biRaw);
  const biScaleX = bi.width / 730;
  const biScaleY = bi.height / 271;
  ARENA_LAYOUT.bistro.bounds = {
    x: bi.x,
    y: bi.y,
    width: bi.width,
    height: bi.height,
  };
  // WC-Schild fest an der äußeren Hallen-/Rückwand verankert (unabhängig vom Bistro-Modul)
  ARENA_LAYOUT.bistro.wcSign = {
    x: 38,
    y: 802,
    width: 88,
    height: 30,
  };
  ARENA_LAYOUT.bistro.counter = {
    x: Math.round(bi.x + 406 * biScaleX),
    y: Math.round(bi.y + 189 * biScaleY),
    width: Math.max(90, Math.round(310 * biScaleX)),
    height: Math.max(24, Math.round(38 * biScaleY)),
  };
  ARENA_LAYOUT.bistro.slushMachine = {
    x: Math.round(bi.x + 424 * biScaleX),
    y: Math.round(bi.y + 191 * biScaleY),
    width: Math.max(28, Math.round(52 * biScaleX)),
    height: Math.max(18, Math.round(30 * biScaleY)),
  };
  ARENA_LAYOUT.bistro.blobaColaTap = {
    x: Math.round(bi.x + 496 * biScaleX),
    y: Math.round(bi.y + 191 * biScaleY),
    width: Math.max(28, Math.round(56 * biScaleX)),
    height: Math.max(18, Math.round(30 * biScaleY)),
  };
  ARENA_LAYOUT.bistro.interactX = Math.round(bi.x + 561 * biScaleX);
  ARENA_LAYOUT.bistro.interactY = Math.round(bi.y + 153 * biScaleY);
  ARENA_LAYOUT.bistro.interactRadius = 85;
  const bt1 = getModuleCollisionRect(
    mods.bistroTable1 || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.bistroTable1
  );
  const bt2 = getModuleCollisionRect(
    mods.bistroTable2 || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.bistroTable2
  );
  const bt3 = getModuleCollisionRect(
    mods.bistroTable3 || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.bistroTable3
  );
  const bt4 = getModuleCollisionRect(
    mods.bistroTable4 || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.bistroTable4
  );
  ARENA_LAYOUT.bistro.marbleTables = [
    {
      id: 'marble-table-1',
      x: Math.round(bt1.cx),
      y: Math.round(bt1.cy),
      radius: Math.max(12, Math.round(Math.min(bt1.width, bt1.height) / 2)),
    },
    {
      id: 'marble-table-2',
      x: Math.round(bt2.cx),
      y: Math.round(bt2.cy),
      radius: Math.max(12, Math.round(Math.min(bt2.width, bt2.height) / 2)),
    },
    {
      id: 'marble-table-3',
      x: Math.round(bt3.cx),
      y: Math.round(bt3.cy),
      radius: Math.max(12, Math.round(Math.min(bt3.width, bt3.height) / 2)),
    },
    {
      id: 'marble-table-4',
      x: Math.round(bt4.cx),
      y: Math.round(bt4.cy),
      radius: Math.max(12, Math.round(Math.min(bt4.width, bt4.height) / 2)),
    },
  ];
  ARENA_LAYOUT.bistro.wallBenches = [];

  // 4. KASSE & EINGANG
  const caRaw = mods.cashier || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.cashier;
  const ca = getModuleCollisionRect(caRaw);
  ARENA_LAYOUT.bottomEntrance.cashierBooth = {
    x: ca.x,
    y: ca.y,
    width: ca.width,
    height: ca.height,
    centerX: ca.x + Math.round(ca.width / 2),
    centerY: ca.y + Math.round(ca.height / 2),
    angleRad: ((caRaw.rot || 0) * Math.PI) / 180,
  };
  ARENA_LAYOUT.bottomEntrance.entranceSpawn = {
    x: ca.x - 46,
    y: ca.y + Math.round(ca.height / 2),
    securityX: ca.x - 90,
    securityY: ca.y + Math.round(ca.height / 2),
  };

  // 5. MITTEL-BÜHNE (U-Islands & Stage / Cinema proportional zu w/h/rot)
  const csRaw =
    mods.centerStage || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.centerStage;
  const cs = getModuleCollisionRect(csRaw);
  const csScaleX = cs.width / 630;
  const csScaleY = cs.height / 284;
  ARENA_LAYOUT.uIslands.width = Math.max(80, Math.round(175 * csScaleX));
  ARENA_LAYOUT.uIslands.height = Math.max(120, Math.round(284 * csScaleY));
  ARENA_LAYOUT.uIslands.leftDefaultX = cs.x;
  ARENA_LAYOUT.uIslands.rightDefaultX = Math.round(
    cs.x + cs.width - ARENA_LAYOUT.uIslands.width
  );
  ARENA_LAYOUT.uIslands.topY = cs.y;
  ARENA_LAYOUT.uIslands.centerY = cs.y + Math.round(cs.height / 2);
  ARENA_LAYOUT.uIslands.closedStageWidth = Math.max(
    160,
    Math.round(390 * csScaleX)
  );
  ARENA_LAYOUT.uIslands.closedStageHeight = Math.max(
    120,
    Math.round(296 * csScaleY)
  );
  ARENA_LAYOUT.uIslands.closedStageX = Math.round(
    cs.x + (cs.width - ARENA_LAYOUT.uIslands.closedStageWidth) / 2
  );
  ARENA_LAYOUT.uIslands.closedStageY = Math.round(cs.y - 6 * csScaleY);
  ARENA_LAYOUT.uIslands.cinemaScreenRect = {
    x: Math.round(ARENA_LAYOUT.uIslands.closedStageX + 20 * csScaleX),
    y: Math.round(ARENA_LAYOUT.uIslands.closedStageY + 20 * csScaleY),
    width: Math.max(120, Math.round(350 * csScaleX)),
    height: Math.max(90, Math.round(256 * csScaleY)),
  };

  // 6. DISCO-TOWER / BACKSTAGE
  const djRaw = mods.djTower || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.djTower;
  const dj = getModuleCollisionRect(djRaw);
  const djScaleX = dj.width / 426;
  const djScaleY = dj.height / 254;
  ARENA_LAYOUT.djTower.x = dj.x;
  ARENA_LAYOUT.djTower.y = dj.y;
  ARENA_LAYOUT.djTower.cornerX = dj.x;
  ARENA_LAYOUT.djTower.cornerY = dj.y;
  ARENA_LAYOUT.djTower.centerX = Math.round(dj.x + 189 * djScaleX);
  ARENA_LAYOUT.djTower.centerY = Math.round(dj.y + 112 * djScaleY);
  ARENA_LAYOUT.djTower.bevelLeftX = Math.round(dj.x + 274 * djScaleX);
  ARENA_LAYOUT.djTower.bevelLeftY = Math.round(dj.y + 254 * djScaleY);
  ARENA_LAYOUT.djTower.bevelTopX = Math.round(dj.x + 426 * djScaleX);
  ARENA_LAYOUT.djTower.bevelTopY = Math.round(dj.y + 102 * djScaleY);
  ARENA_LAYOUT.djTower.curveCtrlX = Math.round(dj.x + 292 * djScaleX);
  ARENA_LAYOUT.djTower.curveCtrlY = Math.round(dj.y + 120 * djScaleY);
  ARENA_LAYOUT.djTower.deskX = Math.round(dj.x + 129 * djScaleX);
  ARENA_LAYOUT.djTower.deskY = Math.round(dj.y + 99 * djScaleY);
  ARENA_LAYOUT.djTower.deskW = Math.max(80, Math.round(215 * djScaleX));
  ARENA_LAYOUT.djTower.deskH = Math.max(24, Math.round(42 * djScaleY));
  ARENA_LAYOUT.djTower.egoTriggerX = Math.round(dj.x + 369 * djScaleX);
  ARENA_LAYOUT.djTower.egoTriggerY = Math.round(dj.y + 214 * djScaleY);

  // 7. SCHLEUSEN-BALKEN 1 (LINKS) & dynamischer Wegpunkt gateLeft
  const blRaw =
    mods.baffleLeft || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.baffleLeft;
  const bl = getModuleCollisionRect(blRaw);
  ARENA_LAYOUT.gates.bottomLeftSchwingtuer.baffleXStart = bl.x;
  ARENA_LAYOUT.gates.bottomLeftSchwingtuer.baffleXEnd = bl.x + bl.width;
  ARENA_LAYOUT.gates.bottomLeftSchwingtuer.baffleY =
    bl.y + Math.round(bl.height / 2);
  ARENA_LAYOUT.gates.bottomLeftSchwingtuer.xStart = bl.x - 42;
  ARENA_LAYOUT.gates.bottomLeftSchwingtuer.xEnd = bl.x + bl.width + 42;
  ARENA_LAYOUT.gates.bottomLeftSchwingtuer.width = bl.width + 84;
  ARENA_LAYOUT.gates.gateLeft = {
    x: Math.round(bl.x - 22),
    y: Math.round(bl.y + bl.height / 2),
  };

  // 8. SCHLEUSEN-BALKEN 2 (RECHTS) & dynamischer Wegpunkt gateRight
  const brRaw =
    mods.baffleRight || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.baffleRight;
  const br = getModuleCollisionRect(brRaw);
  ARENA_LAYOUT.gates.bottomRightEntrance.baffleXStart = br.x;
  ARENA_LAYOUT.gates.bottomRightEntrance.baffleXEnd = br.x + br.width;
  ARENA_LAYOUT.gates.bottomRightEntrance.baffleY =
    br.y + Math.round(br.height / 2);
  ARENA_LAYOUT.gates.bottomRightEntrance.xStart = br.x - 42;
  ARENA_LAYOUT.gates.bottomRightEntrance.xEnd = br.x + br.width + 42;
  ARENA_LAYOUT.gates.bottomRightEntrance.width = br.width + 84;
  ARENA_LAYOUT.gates.gateRight = {
    x: Math.round(br.x + br.width + 22),
    y: Math.round(br.y + br.height / 2),
  };

  // 9. 80ER-SPINDREIHE (SPINDE)
  const lkRaw = mods.lockers || DEFAULT_CUSTOM_ARENA_LAYOUT.modules.lockers;
  const lk = getModuleCollisionRect(lkRaw);
  ARENA_LAYOUT.lockers = {
    x: lk.x,
    y: lk.y,
    width: lk.width,
    height: lk.height,
    rot: lk.rot,
  };
}

