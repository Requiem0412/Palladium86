/**
 * PALLADIUM ROLLER ARENA HANAU (STAND: ALPHA 0.1)
 * Zentrale Konfiguration, Konstanten, Upgrades, Challenges & 16:9 Breitbild-Geometrie (1920 x 1080 px)
 */

// ============================================================================
// 1. EDITIERBARE TOP-LEVEL KONSTANTEN (ADMIN-PIN & GEISTER-SKATER)
// ============================================================================

export const ADMIN_PIN = '1986';

/**
 * Spezial-Skater im Retro-Geisterschema (Selektives No-Clip auf der Bahn).
 * Halbtransparent (65% Deckkraft) mit kühlem Cyan-/Weiß-Hologramm-Schimmer
 * und dezenten Doppel-Rollenspuren statt geradem Stab-Schweif.
 */
export const DEFAULT_SPECIAL_SKATERS: string[] = [
  'Holger 86',
  'JR (Jürgen Becker)',
  'Palladium-Legende',
  'Nachtläufer Hanau',
];

export const DEFAULT_TWITCH_CHANNEL = 'Dj_Magic_Force';

export const DEFAULT_DJ_TICKER =
  '+++ ON AIR: DJ MAGIC FORCE +++ KLECKNIX TWIN-DECKS +++ OLDSCHOOL • NEWSCHOOL • R&B • HIP HOP • MIAMI BASS • FREESTYLE +++';

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
export type CenterStageMode = 'islands' | 'live-band' | 'cinema';
export type HallGameMode = 'free-skate' | 'ballspiel' | 'slalom' | 'stuhlsprung';
export type CameraViewMode = 'top-down' | 'chase' | 'ego';
export type PlayerCharacterMode = 'skater' | 'wheelchair';
export type NeonUnderglowColor = 'pink' | 'cyan' | 'green' | 'gold';

export interface ProShopUpgradesState {
  bearingsAbec9: boolean;
  highGripWheels: boolean;
  aluPlatesHighTop: boolean;
  underglowEnabled: boolean;
  underglowColor: NeonUnderglowColor;
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

  // Exakt ZWEI breite, hindernisfreie braune Banden-Zugänge mit grüner Schwelle:
  // Zugang 1: Unten rechts an der Bahn-Rundung bei der schrägen Kasse & Pro-Shop
  // Zugang 2: Unten links direkt an der oberen Kante des nach unten gerückten Bistros (Bistro-/WC-Bandenzugang)
  gates: {
    // Zugang 1 (Unten rechts an der unteren Bande)
    bottomRightEntrance: {
      xStart: 1355,
      xEnd: 1535,
      y: 860,
      width: 180,
    },
    // Zugang 2 (Links unten an der Bande / Kurvenansatz direkt an der oberen Kante des Bistros unten links)
    topLeftBistro: {
      x: 290,
      yStart: 615,
      yEnd: 745,
      height: 130,
    },
  },

  // 1) Leicht gebogener (viertelkreisförmig geschwungener) Eck-DJ-Tower tief hinten in der oberen linken Hallenecke:
  // Schmiegt sich direkt ohne Leerraum an die obere (y = 6) und linke (x = 16) Hallen-Außenwand an!
  // Seine vordere, sanft gebogene Kanzel-Kante verbindet (290, 260) und (442, 108) als harmonischer Viertelbogen.
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
    // Kontrollpunkt für den nach hinten in die Ecke gewölbten Viertelkreis-Bogen der Kanzel-Front
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

  // 2) SPIEGELWAND - JAM-DANCE: Um 90° gedreht (senkrecht/hochkant) direkt bündig an der linken Hallen-Außenwand
  // unterhalb des geschwungenen DJ-Towers (Spiegelfläche zeigt nach rechts zur Halle!)
  mirrorWall: {
    x: 16,
    y: 274,
    width: 28, // Hochkant an der linken Wand!
    height: 365, // Von y = 274 bis y = 639
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

  // Rechte Hallenwand: Vier braune Holzlatten-Sitzbänke ganz nach hinten an die rechte Außenwand gerückt,
  // mit Lücke in der Mitte (y = 385..555) für die breite Metall-Doppeltür ("TECHNIK & EQUIPMENT" + "NOTAUSGANG")!
  rightWallBenches: [
    { id: 'right-bench-1', x: 1848, y: 132, width: 48, height: 112 },
    { id: 'right-bench-2', x: 1848, y: 262, width: 48, height: 112 },
    { id: 'right-bench-3', x: 1848, y: 566, width: 48, height: 112 },
    { id: 'right-bench-4', x: 1848, y: 696, width: 48, height: 112 },
  ],

  rightWallTechDoor: {
    x: 1860,
    y: 405,
    width: 44,
    height: 132,
  },

  // 3) Untere & rechte Hallenachse:
  // A) 1) KASSE & EINGANG PALLADIUM: Gespiegelt & schräg angewinkelt in der unteren rechten Hallenecke
  // an der rechten Außenwand mit Blickrichtung schräg nach links oben zur Hallenmitte!
  bottomEntrance: {
    cashierBooth: {
      x: 1675,
      y: 895,
      width: 236,
      height: 144,
      centerX: 1812,
      centerY: 968,
      angleRad: 0.58, // Schräg angewinkelt mit Blickrichtung schräg nach links oben zur Hallenmitte!
    },
    spinWarmupZone: { x: 1565, y: 842, radius: 52 },
    woodenSlatBenches: [] as {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  },

  // B) PRO-SHOP & ROLLSCHUHVERLEIH: Deutlich weiter nach rechts gerückt, direkt bündig links neben die schräge Kasse!
  proShopAndRental: {
    // 2) Pro-Shop & Tuning [E] (unten rechts direkt links neben der schrägen Kasse)
    proShopBounds: { x: 1300, y: 928, width: 335, height: 136 },
    proShopCounter: { x: 1320, y: 936, width: 295, height: 42 },
    proShopInteractX: 1468,
    proShopInteractY: 902,
    proShopInteractRadius: 100,

    // Trennwand zwischen Pro-Shop (rechts) und Rollschuhverleih (links)
    dividerWall: { x: 1280, y: 928, width: 20, height: 136 },

    // 3) Rollschuhverleih (direkt links neben dem Pro-Shop auf derselben Grundlinie y = 928 .. 1064)
    rentalBounds: { x: 750, y: 928, width: 530, height: 136 },
    rentalCounter: { x: 772, y: 936, width: 486, height: 40 },
    rentalShelves: [
      { x: 772, y: 1020, width: 232, height: 32 },
      { x: 1026, y: 1020, width: 232, height: 32 },
    ],

    oppositeBenches: [] as {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  },

  // C) 4) BISTRO & GARNET-LOUNGE: In der unteren linken Ecke:
  // - Die SLUSH & BLOBA [E]-Theke samt THEKEN-CREW ist weiter nach hinten Richtung untere Außenwand gerückt,
  //   sodass vorne zur blauen Bahn-Bande hin ein breiter, barrierefreier Durchgang (auch für den Rollstuhl) frei bleibt!
  // - Hinten an der Wand stehen helle 80er-Marmortische mit schwarzen Plastikstühlen (statt der langen roten Sitzbank).
  // - Hinten in der unteren linken Ecke leuchtet ein kompaktes 80er-WC-Schild.
  bistro: {
    bounds: { x: 24, y: 785, width: 706, height: 279 },
    wcSign: { x: 38, y: 796, width: 88, height: 32 },
    // Weiter nach hinten Richtung untere Außenwand verschobene Theke -> breiter barrierefreier Durchgang vorne!
    counter: { x: 375, y: 956, width: 335, height: 42 },
    slushMachine: { x: 396, y: 960, width: 56, height: 34 },
    blobaColaTap: { x: 474, y: 960, width: 58, height: 34 },
    interactX: 542,
    interactY: 922,
    interactRadius: 95,
    // Helle 80er-Marmortische mit schwarzen Plastikstühlen ganz hinten an der Wand
    marbleTables: [
      { id: 'marble-table-1', x: 96, y: 906, radius: 26 },
      { id: 'marble-table-2', x: 96, y: 1008, radius: 26 },
      { id: 'marble-table-3', x: 242, y: 1008, radius: 26 },
    ],
    wallBenches: [] as {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[],
  },
};
