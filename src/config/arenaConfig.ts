/**
 * Declarative Arena Blueprint & Living World Configuration
 * ROLLER DISCO PALLADIUM HANAU — Animated 2.5D Retro Edition (1150 x 1550 px)
 */

export type ZoneId =
  | 'main-rink'
  | 'wc-area'
  | 'mirror-dance'
  | 'dj-booth'
  | 'bistro-slush-counter'
  | 'bistro-seating'
  | 'bench-shop-corridor'
  | 'cashier-foyer';

export type ColliderCategory =
  | 'outer-wall'
  | 'rink-barrier'
  | 'sluice-pillar'
  | 'u-island'
  | 'counter'
  | 'bench'
  | 'furniture'
  | 'dj-stage'
  | 'partition'
  | 'cashier-gate';

export type PlayerCharacterMode = 'wheelchair' | 'skater';

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArenaZone {
  id: ZoneId;
  name: string;
  subtitle: string;
  bounds: RectBounds;
  floorColor: number;
  accentColor: number;
  accentHex: string;
  description: string;
}

export interface StaticColliderSpec {
  id: string;
  label: string;
  category: ColliderCategory;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor: number;
  strokeColor: number;
  bounceMultiplier?: number;
  /** If true, this collider unlocks/opens when the player checks in at the Cashier Booth */
  unlocksOnCheckIn?: boolean;
}

/**
 * Straight Sluice (Entrance) in the Left Rink Barrier with a central divider pillar
 * that skaters can pass on the left (north) or right (south).
 */
export interface StraightSluiceSpec {
  id: string;
  label: string;
  subtitle: string;
  barrierX: number;
  openingYStart: number;
  openingYEnd: number;
  centralPillar: RectBounds;
}

/**
 * Slim, hollow railing horseshoe arch (∩) in the center of the rink.
 * Interior has the exact same continuous dark brown hardwood parquet.
 */
export interface HollowHorseshoeRailingSpec {
  id: string;
  label: string;
  centerX: number;
  topY: number;
  bottomY: number;
  outerWidth: number;
  railingThickness: number;
}

export interface SlushStationSpec {
  machineBounds: RectBounds;
  triggerX: number;
  triggerY: number;
  triggerRadius: number;
  boostDurationMs: number;
  cooldownSec: number;
  lapsToRecharge: number;
  speedMultiplier: number;
  driftAgilityMultiplier: number;
}

export interface CashierCheckInSpec {
  boothBounds: RectBounds;
  signText: string;
  triggerX: number;
  triggerY: number;
  triggerRadius: number;
  gateBounds: RectBounds;
  bannerText: string;
}

export interface AnimatedNpcSpec {
  id: string;
  nameTag: string;
  nameTagColor: string;
  role:
    | 'mirror-street-dancer'
    | 'mirror-jam-skater'
    | 'oval-lap-skater'
    | 'island-trick-skater'
    | 'bistro-guest'
    | 'dj-master';
  x: number;
  y: number;
  outfitColor: number;
  trimColor: number;
  hairOrCapColor: number;
  shoeOrWheelColor: number;
  phaseOffset: number;
  /** For oval lap skaters: orbit speed and lane offset */
  orbitSpeed?: number;
  laneRadiusOffset?: number;
  /** For trick skaters inside the hollow U-arches */
  islandId?: 'horseshoe-north' | 'horseshoe-south';
  /** Optional chat bubble / status icon for bistro guests */
  chatSymbol?: string;
}

export interface SkaterPhysicsConfig {
  acceleration: number;
  reverseAcceleration: number;
  maxSpeed: number;
  turnSpeed: number;
  driftTurnMultiplier: number;
  forwardDrag: number;
  normalLateralGrip: number;
  driftLateralGrip: number;
  wallBounce: number;
}

export const DEFAULT_PHYSICS_CONFIG: SkaterPhysicsConfig = {
  acceleration: 465,
  reverseAcceleration: 315,
  maxSpeed: 445,
  turnSpeed: 190,
  driftTurnMultiplier: 1.42,
  forwardDrag: 0.0042,
  normalLateralGrip: 0.13,
  driftLateralGrip: 0.022,
  wallBounce: 0.55,
};

export interface ArenaBlueprint {
  world: {
    width: number;
    height: number;
    wallThickness: number;
    spawnPoint: {
      x: number;
      y: number;
      angleDeg: number;
    };
    ceilingEasterEgg: {
      text: string;
      x: number;
      y: number;
    };
  };
  rinkGeometry: {
    bounds: RectBounds;
    cornerRadius: number;
    barrierThickness: number;
    plankSpacingY: number;
    centerLogo: {
      title: string;
      subtitle: string;
      city: string;
      centerX: number;
      centerY: number;
    };
    straightSluices: StraightSluiceSpec[];
    hollowHorseshoes: HollowHorseshoeRailingSpec[];
  };
  wallOfMemories: {
    wallBounds: RectBounds;
    logoTitle: string;
    logoSubtitle: string;
    neonGreenHex: string;
    neonGreenInt: number;
    memoryFrames: { id: string; y: number; height: number; tint: number }[];
  };
  slushStation: SlushStationSpec;
  cashierStation: CashierCheckInSpec;
  npcs: AnimatedNpcSpec[];
  benches: { id: string; label: string; bounds: RectBounds }[];
  bistroTables: { id: string; x: number; y: number; radius: number }[];
  zones: ArenaZone[];
  colliders: StaticColliderSpec[];
}

export const ARENA_CONFIG: ArenaBlueprint = {
  world: {
    width: 1150,
    height: 1550,
    wallThickness: 20,
    // Spawn in the bottom-right / bottom-center Entrance & Cashier Foyer
    // right in front of the glowing Cashier Booth ("Eintritt frei - hier zahlen Sie mit Ihrem Namen!")
    spawnPoint: {
      x: 730,
      y: 1455,
      angleDeg: 0, // Facing East toward the Cashier Booth window
    },
    ceilingEasterEgg: {
      text: '/papi',
      x: 758,
      y: 268,
    },
  },

  rinkGeometry: {
    // Vertical Oval / Rounded Rectangle (X: 390 .. 1118, Y: 225 .. 1365)
    // Leaves bottom foyer (Y: 1370 .. 1530) for the Cashier Booth (bottom-right) & Turnstile Gate
    bounds: {
      x: 390,
      y: 225,
      width: 728,
      height: 1140,
    },
    cornerRadius: 115,
    barrierThickness: 16,
    plankSpacingY: 24,
    centerLogo: {
      title: 'ROLLER DISCO',
      subtitle: 'PALLADIUM',
      city: 'HANAU',
      centerX: 754,
      centerY: 795,
    },

    // Gerade Schleusen (Eingänge) links mit festem längeren Mittel-Trennpfeiler
    straightSluices: [
      {
        id: 'sluice-north-west',
        label: 'Gerade Schleuse 1 (Oben links)',
        subtitle: 'Mit Mittelpfeiler · Vorbeifahrt links oder rechts',
        barrierX: 390,
        openingYStart: 360,
        openingYEnd: 510,
        centralPillar: {
          x: 368,
          y: 423,
          width: 62,
          height: 24,
        },
      },
      {
        id: 'sluice-south-west',
        label: 'Gerade Schleuse 2 (Unten links)',
        subtitle: 'Mit Mittelpfeiler · Vorbeifahrt links oder rechts',
        barrierX: 390,
        openingYStart: 1105,
        openingYEnd: 1255,
        centralPillar: {
          x: 368,
          y: 1168,
          width: 62,
          height: 24,
        },
      },
    ],

    // Zwei schlanke, hohle Geländer-Bögen (∩) im Zentrum (Innen dasselbe Parkett!)
    hollowHorseshoes: [
      {
        id: 'horseshoe-north',
        label: 'Oberer ∩-Geländer-Bogen',
        centerX: 754,
        topY: 410,
        bottomY: 640,
        outerWidth: 216,
        railingThickness: 16,
      },
      {
        id: 'horseshoe-south',
        label: 'Unterer ∩-Geländer-Bogen',
        centerX: 754,
        topY: 950,
        bottomY: 1180,
        outerWidth: 216,
        railingThickness: 16,
      },
    ],
  },

  // Rechte Wand: Massive, plastische 2.5D-Wandfläche ("Wall of Memories")
  // mit intensiv neongrün leuchtendem "PALLADIUM HANAU"-Logo + geflügeltem Rollschuh + Bilderrahmen
  wallOfMemories: {
    wallBounds: { x: 1114, y: 225, width: 36, height: 1140 },
    logoTitle: 'PALLADIUM HANAU',
    logoSubtitle: 'WALL OF MEMORIES',
    neonGreenHex: '#39FF14',
    neonGreenInt: 0x39ff14,
    memoryFrames: [
      { id: 'frame-1', y: 310, height: 46, tint: 0xfef08a },
      { id: 'frame-2', y: 375, height: 42, tint: 0x38bdf8 },
      { id: 'frame-3', y: 435, height: 48, tint: 0xf472b6 },
      { id: 'frame-4', y: 1030, height: 46, tint: 0xa7f3d0 },
      { id: 'frame-5', y: 1095, height: 44, tint: 0xfde047 },
      { id: 'frame-6', y: 1155, height: 48, tint: 0xc084fc },
      { id: 'frame-7', y: 1220, height: 42, tint: 0x67e8f9 },
    ],
  },

  // Bunte Slush-Puppie-Theke links oben (unterhalb WC)
  slushStation: {
    machineBounds: { x: 96, y: 385, width: 48, height: 74 },
    triggerX: 196,
    triggerY: 422,
    triggerRadius: 78,
    boostDurationMs: 8000,
    cooldownSec: 60,
    lapsToRecharge: 2,
    speedMultiplier: 1.25,
    driftAgilityMultiplier: 1.32,
  },

  // Unten rechts: Kassenhäuschen ("ZEITSPRUNG") + Absperrung (Durchlass)
  cashierStation: {
    boothBounds: { x: 855, y: 1405, width: 255, height: 115 },
    signText: 'Eintritt frei - hier zahlen Sie mit Ihrem Namen!',
    triggerX: 785,
    triggerY: 1455,
    triggerRadius: 115,
    // Absperrung (Durchlass) vom Kassen-Foyer in den linken Umgang / zu den Schleusen
    gateBounds: { x: 390, y: 1368, width: 24, height: 162 },
    bannerText: '⚡ Zeitsprung aktiviert – Willkommen zurück in deiner Jugend! ⚡',
  },

  // 19 Lebendige, voll animierte NPCs mit farbigen Retro-Nametags
  npcs: [
    // 1. Oben an der Spiegelwand: 2 Tänzer in Sneakern + 2 Skater auf Rollschuhen
    {
      id: 'npc-mirror-1',
      nameTag: 'B-Boy Tobi',
      nameTagColor: '#FDE047',
      role: 'mirror-street-dancer',
      x: 430,
      y: 115,
      outfitColor: 0x1e293b,
      trimColor: 0xf59e0b,
      hairOrCapColor: 0xef4444,
      shoeOrWheelColor: 0xfacc15,
      phaseOffset: 0,
    },
    {
      id: 'npc-mirror-2',
      nameTag: 'Sneaker-Mia',
      nameTagColor: '#38BDF8',
      role: 'mirror-street-dancer',
      x: 500,
      y: 115,
      outfitColor: 0x0f172a,
      trimColor: 0x38bdf8,
      hairOrCapColor: 0xf472b6,
      shoeOrWheelColor: 0x22d3ee,
      phaseOffset: 0,
    },
    {
      id: 'npc-mirror-3',
      nameTag: 'Jam-Queen Nelly',
      nameTagColor: '#F472B6',
      role: 'mirror-jam-skater',
      x: 580,
      y: 115,
      outfitColor: 0x3b0764,
      trimColor: 0xec4899,
      hairOrCapColor: 0xfde047,
      shoeOrWheelColor: 0x00f0ff,
      phaseOffset: 0,
    },
    {
      id: 'npc-mirror-4',
      nameTag: 'Funky Jamal',
      nameTagColor: '#4ADE80',
      role: 'mirror-jam-skater',
      x: 650,
      y: 115,
      outfitColor: 0x064e3b,
      trimColor: 0x39ff14,
      hairOrCapColor: 0x1e293b,
      shoeOrWheelColor: 0xf472b6,
      phaseOffset: 0,
    },

    // 2. Oben rechts: Animierter DJ am Pult
    {
      id: 'npc-dj-1',
      nameTag: 'DJ Looping Lou',
      nameTagColor: '#FF2A85',
      role: 'dj-master',
      x: 940,
      y: 138,
      outfitColor: 0x3b0764,
      trimColor: 0x39ff14,
      hairOrCapColor: 0x00f0ff,
      shoeOrWheelColor: 0xfacc15,
      phaseOffset: 0.4,
    },

    // 3. Im Zentrum (um die U-Inseln): 5 Runden-Skater + 2 Trick-Skater IN den U-Bögen
    {
      id: 'npc-oval-1',
      nameTag: 'Turbo-Tanja',
      nameTagColor: '#00F0FF',
      role: 'oval-lap-skater',
      x: 550,
      y: 500,
      outfitColor: 0x0e7490,
      trimColor: 0x00f0ff,
      hairOrCapColor: 0xfde047,
      shoeOrWheelColor: 0xf472b6,
      phaseOffset: 0.0,
      orbitSpeed: 0.62,
      laneRadiusOffset: 0,
    },
    {
      id: 'npc-oval-2',
      nameTag: 'Disco-Dieter',
      nameTagColor: '#39FF14',
      role: 'oval-lap-skater',
      x: 950,
      y: 700,
      outfitColor: 0x14532d,
      trimColor: 0x39ff14,
      hairOrCapColor: 0xd97706,
      shoeOrWheelColor: 0x39ff14,
      phaseOffset: 1.6,
      orbitSpeed: 0.54,
      laneRadiusOffset: 38,
    },
    {
      id: 'npc-oval-3',
      nameTag: 'Neon-Nina',
      nameTagColor: '#F472B6',
      role: 'oval-lap-skater',
      x: 750,
      y: 1290,
      outfitColor: 0x701a75,
      trimColor: 0xf472b6,
      hairOrCapColor: 0x38bdf8,
      shoeOrWheelColor: 0xfde047,
      phaseOffset: 3.1,
      orbitSpeed: 0.68,
      laneRadiusOffset: -24,
    },
    {
      id: 'npc-oval-4',
      nameTag: 'Rink-Robby',
      nameTagColor: '#FACC15',
      role: 'oval-lap-skater',
      x: 540,
      y: 1050,
      outfitColor: 0x7c2d12,
      trimColor: 0xfacc15,
      hairOrCapColor: 0xf8fafc,
      shoeOrWheelColor: 0x00f0ff,
      phaseOffset: 4.5,
      orbitSpeed: 0.58,
      laneRadiusOffset: 22,
    },
    {
      id: 'npc-oval-5',
      nameTag: 'Speedy-Sam',
      nameTagColor: '#A855F7',
      role: 'oval-lap-skater',
      x: 960,
      y: 420,
      outfitColor: 0x312e81,
      trimColor: 0xc084fc,
      hairOrCapColor: 0xef4444,
      shoeOrWheelColor: 0x39ff14,
      phaseOffset: 2.35,
      orbitSpeed: 0.64,
      laneRadiusOffset: -12,
    },

    // Trick-Skater im Innenbereich der beiden hohlen U-Geländer-Bögen
    {
      id: 'npc-trick-north',
      nameTag: 'Spin-Sunny',
      nameTagColor: '#FF2A85',
      role: 'island-trick-skater',
      x: 754,
      y: 545,
      outfitColor: 0x4c1d95,
      trimColor: 0xf472b6,
      hairOrCapColor: 0xfde047,
      shoeOrWheelColor: 0x00f0ff,
      phaseOffset: 0.5,
      islandId: 'horseshoe-north',
    },
    {
      id: 'npc-trick-south',
      nameTag: 'Pirouette-Paco',
      nameTagColor: '#00F0FF',
      role: 'island-trick-skater',
      x: 754,
      y: 1085,
      outfitColor: 0x064e3b,
      trimColor: 0x00f0ff,
      hairOrCapColor: 0xf97316,
      shoeOrWheelColor: 0x39ff14,
      phaseOffset: 2.1,
      islandId: 'horseshoe-south',
    },

    // 4. Hinter der Bande / an der bunten Theke / im Bistro / auf den Bänken (7 Gäste)
    {
      id: 'npc-bistro-1',
      nameTag: 'Slush-Sven',
      nameTagColor: '#00F0FF',
      role: 'bistro-guest',
      x: 168,
      y: 355,
      outfitColor: 0x1e3a8a,
      trimColor: 0x38bdf8,
      hairOrCapColor: 0xfde047,
      shoeOrWheelColor: 0xf8fafc,
      phaseOffset: 0.2,
      chatSymbol: '🥤',
    },
    {
      id: 'npc-bistro-2',
      nameTag: 'Bar-Jenny',
      nameTagColor: '#F472B6',
      role: 'bistro-guest',
      x: 168,
      y: 485,
      outfitColor: 0x831843,
      trimColor: 0xf472b6,
      hairOrCapColor: 0xfde047,
      shoeOrWheelColor: 0x22d3ee,
      phaseOffset: 1.4,
      chatSymbol: '♪',
    },
    {
      id: 'npc-bistro-3',
      nameTag: 'Matze 86',
      nameTagColor: '#FDE047',
      role: 'bistro-guest',
      x: 95,
      y: 625,
      outfitColor: 0x3f6212,
      trimColor: 0xa3e635,
      hairOrCapColor: 0x78350f,
      shoeOrWheelColor: 0xf8fafc,
      phaseOffset: 2.2,
      chatSymbol: '💬',
    },
    {
      id: 'npc-bistro-4',
      nameTag: 'Kerstin',
      nameTagColor: '#C084FC',
      role: 'bistro-guest',
      x: 225,
      y: 625,
      outfitColor: 0x581c87,
      trimColor: 0xd8b4fe,
      hairOrCapColor: 0xf43f5e,
      shoeOrWheelColor: 0xfacc15,
      phaseOffset: 0.9,
      chatSymbol: '★',
    },
    {
      id: 'npc-bistro-5',
      nameTag: 'Cola-Chris',
      nameTagColor: '#FB923C',
      role: 'bistro-guest',
      x: 95,
      y: 745,
      outfitColor: 0x7c2d12,
      trimColor: 0xfb923c,
      hairOrCapColor: 0x1e293b,
      shoeOrWheelColor: 0x38bdf8,
      phaseOffset: 3.1,
      chatSymbol: '🥤',
    },
    {
      id: 'npc-bench-1',
      nameTag: 'Pause-Paul',
      nameTagColor: '#38BDF8',
      role: 'bistro-guest',
      x: 332,
      y: 905,
      outfitColor: 0x0f172a,
      trimColor: 0x38bdf8,
      hairOrCapColor: 0xfacc15,
      shoeOrWheelColor: 0xef4444,
      phaseOffset: 1.8,
      chatSymbol: '🛼',
    },
    {
      id: 'npc-bench-2',
      nameTag: 'Retro-Rita',
      nameTagColor: '#4ADE80',
      role: 'bistro-guest',
      x: 332,
      y: 1010,
      outfitColor: 0x064e3b,
      trimColor: 0x4ade80,
      hairOrCapColor: 0xf472b6,
      shoeOrWheelColor: 0xfde047,
      phaseOffset: 2.7,
      chatSymbol: '♥',
    },
  ],

  benches: [
    {
      id: 'bench-1',
      label: 'Sitzbank 1 (an der Bande)',
      bounds: { x: 348, y: 865, width: 26, height: 78 },
    },
    {
      id: 'bench-2',
      label: 'Sitzbank 2 (an der Bande)',
      bounds: { x: 348, y: 965, width: 26, height: 78 },
    },
    {
      id: 'bench-3',
      label: 'Sitzbank 3 (an der Bande)',
      bounds: { x: 348, y: 1065, width: 26, height: 28 },
    },
  ],

  bistroTables: [
    { id: 'bistro-table-1', x: 95, y: 660, radius: 28 },
    { id: 'bistro-table-2', x: 225, y: 660, radius: 28 },
    { id: 'bistro-table-3', x: 95, y: 780, radius: 28 },
    { id: 'bistro-table-4', x: 225, y: 780, radius: 28 },
  ],

  zones: [
    {
      id: 'main-rink',
      name: 'Hauptbahn · Palladium Parkett',
      subtitle: 'Durchgehendes Dunkelbraun-Parkett · 2 Hohle ∩-Geländer',
      bounds: { x: 406, y: 241, width: 708, height: 1108 },
      floorColor: 0x2b160d,
      accentColor: 0x39ff14,
      accentHex: '#39FF14',
      description:
        'Durchgehend warmer, dunkelbrauner Holzboden mit zwei schlanken hohlen Geländer-Bögen (∩) und neongrüner Wall of Memories rechts.',
    },
    {
      id: 'wc-area',
      name: 'WC-Bereich',
      subtitle: 'Oben Links · Sanitär & Spiegel',
      bounds: { x: 20, y: 20, width: 295, height: 190 },
      floorColor: 0x0f172a,
      accentColor: 0x38bdf8,
      accentHex: '#38BDF8',
      description: 'WC-Bereich oben links direkt über der bunten Slush-Puppie-Theke.',
    },
    {
      id: 'mirror-dance',
      name: 'Spiegelwand & Jam-Crew',
      subtitle: 'Oben Mitte · 2 Sneaker-Dancer + 2 Jam-Skater mit Spiegelreflexion',
      bounds: { x: 325, y: 20, width: 415, height: 190 },
      floorColor: 0x151e32,
      accentColor: 0x22d3ee,
      accentHex: '#22D3EE',
      description:
        'Spiegelwand mit mitschwingender Reflexion im Glas und 4 synchron tanzenden NPCs davor.',
    },
    {
      id: 'dj-booth',
      name: 'DJ-Pult & Stage',
      subtitle: 'Oben Rechts · Animierter DJ Looping Lou',
      bounds: { x: 750, y: 20, width: 376, height: 190 },
      floorColor: 0x16112b,
      accentColor: 0xec4899,
      accentHex: '#EC4899',
      description:
        'DJ-Pult mit animiertem DJ, der die Platten bewegt und im Takt mitwippt, plus Twitch- & Ticker-Flächen.',
    },
    {
      id: 'bistro-slush-counter',
      name: 'Bunte Theke & Slush-Puppie-Maschine',
      subtitle: 'Links Oben · [Taste E] Token einlösen für 8s Ice-Boost',
      bounds: { x: 20, y: 225, width: 350, height: 345 },
      floorColor: 0x1c152e,
      accentColor: 0x00f0ff,
      accentHex: '#00F0FF',
      description:
        'Bunte Bistro- & Verleih-Theke links oben mit Slush-Puppie-Maschine (Token-Boost & 60s/2-Runden-Nachfrier-Timer).',
    },
    {
      id: 'bistro-seating',
      name: 'Bistro-Tische & Plauder-Lounge',
      subtitle: 'Links Mitte · Animierte Gäste & Sitzgruppen',
      bounds: { x: 20, y: 580, width: 350, height: 270 },
      floorColor: 0x16192b,
      accentColor: 0xf59e0b,
      accentHex: '#F59E0B',
      description: 'Bestuhlter Bistro-Bereich mit plaudernden und wippenden Retro-Gästen.',
    },
    {
      id: 'bench-shop-corridor',
      name: 'Pro-Shop & 3 Sitzbänke an der Bande',
      subtitle: 'Links Unten · Vor Gerade Schleuse 2',
      bounds: { x: 20, y: 860, width: 355, height: 500 },
      floorColor: 0x101c2e,
      accentColor: 0x10b981,
      accentHex: '#10B981',
      description:
        'Rollschuh-Pro-Shop links und 3 längliche Sitzbänke entlang der Bande vor der unteren geraden Schleuse.',
    },
    {
      id: 'cashier-foyer',
      name: 'Kassenhäuschen & Zeitsprung-Eingang',
      subtitle: 'Unten Rechts · „Eintritt frei - hier zahlen Sie mit Ihrem Namen!“',
      bounds: { x: 390, y: 1370, width: 730, height: 160 },
      floorColor: 0x141b2d,
      accentColor: 0x39ff14,
      accentHex: '#39FF14',
      description:
        'Kassenhäuschen unten rechts mit Namens-Check-in, Zeitsprung-Banner, Freigetränk-Token und Schranken-Durchlass.',
    },
  ],

  colliders: [
    // =========================================================================
    // 1. AUSSENWÄNDE DER HALLE (1150 x 1550 px)
    // =========================================================================
    {
      id: 'wall-north',
      label: 'Hallenwand Nord (Spiegelwand & DJ)',
      category: 'outer-wall',
      x: 0,
      y: 0,
      width: 1150,
      height: 20,
      fillColor: 0x0f172a,
      strokeColor: 0x334155,
    },
    {
      id: 'wall-south',
      label: 'Hallenwand Süd (Foyer & Kasse)',
      category: 'outer-wall',
      x: 0,
      y: 1530,
      width: 1150,
      height: 20,
      fillColor: 0x0f172a,
      strokeColor: 0x334155,
    },
    {
      id: 'wall-west',
      label: 'Hallenwand West (WC, Bunte Theke, Bistro, Shop)',
      category: 'outer-wall',
      x: 0,
      y: 20,
      width: 20,
      height: 1510,
      fillColor: 0x0f172a,
      strokeColor: 0x334155,
    },
    // RECHTE WAND: Massive, plastische 2.5D-Wandfläche ("Wall of Memories") direkt an der Fahrbahn
    {
      id: 'wall-east-palladium',
      label: 'Massive Rechte Wand · Wall of Memories (Palladium Neon-Grün)',
      category: 'outer-wall',
      x: 1114,
      y: 20,
      width: 36,
      height: 1510,
      fillColor: 0x0c1f14,
      strokeColor: 0x39ff14,
      bounceMultiplier: 1.15,
    },

    // =========================================================================
    // 2. HAUPTBAHN BANDE & GERADE SCHLEUSEN LINKS MIT FESTEM MITTELPFEILER
    // =========================================================================
    // Obere Bahn-Bande (Nord)
    {
      id: 'rink-barrier-north',
      label: 'Obere Bahn-Bande (Nord)',
      category: 'rink-barrier',
      x: 390,
      y: 225,
      width: 724,
      height: 16,
      fillColor: 0x1e293b,
      strokeColor: 0x06b6d4,
      bounceMultiplier: 1.15,
    },
    // Untere Bahn-Bande (Süd - trennt Hauptbahn vom Kassen-Foyer unten rechts)
    {
      id: 'rink-barrier-south',
      label: 'Untere Bahn-Bande (Süd)',
      category: 'rink-barrier',
      x: 390,
      y: 1350,
      width: 724,
      height: 16,
      fillColor: 0x1e293b,
      strokeColor: 0x06b6d4,
      bounceMultiplier: 1.15,
    },

    // Linke Bande Segment 1 (Oberhalb Gerade Schleuse 1: Y 225 .. 360)
    {
      id: 'rink-barrier-west-top',
      label: 'Linke Bande (Oberhalb Schleuse 1)',
      category: 'rink-barrier',
      x: 390,
      y: 225,
      width: 18,
      height: 135,
      fillColor: 0x1e293b,
      strokeColor: 0x06b6d4,
      bounceMultiplier: 1.15,
    },
    // GERADE SCHLEUSE 1 (Oben links: Y 360 .. 510): Fester längerer Mittelpfeiler (Pfosten)
    {
      id: 'sluice-1-central-pillar',
      label: 'Trenn-Pfeiler Schleuse 1 (Links/Rechts umfahrbar)',
      category: 'sluice-pillar',
      x: 368,
      y: 423,
      width: 62,
      height: 24,
      fillColor: 0x0f172a,
      strokeColor: 0x39ff14,
      bounceMultiplier: 1.1,
    },

    // Linke Bande Segment 2 (Durchgehend zwischen Schleuse 1 und Schleuse 2: Y 510 .. 1105)
    {
      id: 'rink-barrier-west-middle',
      label: 'Durchgehende Mittelbande West',
      category: 'rink-barrier',
      x: 390,
      y: 510,
      width: 18,
      height: 595,
      fillColor: 0x1e293b,
      strokeColor: 0x06b6d4,
      bounceMultiplier: 1.15,
    },

    // GERADE SCHLEUSE 2 (Unten links: Y 1105 .. 1255): Fester längerer Mittelpfeiler (Pfosten)
    {
      id: 'sluice-2-central-pillar',
      label: 'Trenn-Pfeiler Schleuse 2 (Links/Rechts umfahrbar)',
      category: 'sluice-pillar',
      x: 368,
      y: 1168,
      width: 62,
      height: 24,
      fillColor: 0x0f172a,
      strokeColor: 0x39ff14,
      bounceMultiplier: 1.1,
    },

    // Linke Bande Segment 3 (Unterhalb Schleuse 2: Y 1255 .. 1366)
    {
      id: 'rink-barrier-west-bottom',
      label: 'Linke Bande (Unterhalb Schleuse 2)',
      category: 'rink-barrier',
      x: 390,
      y: 1255,
      width: 18,
      height: 111,
      fillColor: 0x1e293b,
      strokeColor: 0x06b6d4,
      bounceMultiplier: 1.15,
    },

    // =========================================================================
    // 3. ZWEI SCHLANKE, HOHLE GELÄNDER-BÖGEN (∩) IM ZENTRUM
    // =========================================================================
    // Oberer hohler ∩-Geländer-Bogen (Nord: X 646..862, Y 410..640)
    {
      id: 'u-north-rail-top',
      label: 'Oberes ∩-Geländer (Bogen-Scheitel)',
      category: 'u-island',
      x: 662,
      y: 410,
      width: 184,
      height: 16,
      fillColor: 0x334155,
      strokeColor: 0x00f0ff,
      bounceMultiplier: 1.15,
    },
    {
      id: 'u-north-rail-left',
      label: 'Oberes ∩-Geländer (Linker Geländer-Schenkel)',
      category: 'u-island',
      x: 646,
      y: 422,
      width: 16,
      height: 218,
      fillColor: 0x334155,
      strokeColor: 0x00f0ff,
      bounceMultiplier: 1.15,
    },
    {
      id: 'u-north-rail-right',
      label: 'Oberes ∩-Geländer (Rechter Geländer-Schenkel)',
      category: 'u-island',
      x: 846,
      y: 422,
      width: 16,
      height: 218,
      fillColor: 0x334155,
      strokeColor: 0x00f0ff,
      bounceMultiplier: 1.15,
    },

    // Unterer hohler ∩-Geländer-Bogen (Süd: X 646..862, Y 950..1180)
    {
      id: 'u-south-rail-top',
      label: 'Unteres ∩-Geländer (Bogen-Scheitel)',
      category: 'u-island',
      x: 662,
      y: 950,
      width: 184,
      height: 16,
      fillColor: 0x334155,
      strokeColor: 0x00f0ff,
      bounceMultiplier: 1.15,
    },
    {
      id: 'u-south-rail-left',
      label: 'Unteres ∩-Geländer (Linker Geländer-Schenkel)',
      category: 'u-island',
      x: 646,
      y: 962,
      width: 16,
      height: 218,
      fillColor: 0x334155,
      strokeColor: 0x00f0ff,
      bounceMultiplier: 1.15,
    },
    {
      id: 'u-south-rail-right',
      label: 'Unteres ∩-Geländer (Rechter Geländer-Schenkel)',
      category: 'u-island',
      x: 846,
      y: 962,
      width: 16,
      height: 218,
      fillColor: 0x334155,
      strokeColor: 0x00f0ff,
      bounceMultiplier: 1.15,
    },

    // =========================================================================
    // 4. KASSENHÄUSCHEN UNTEN RECHTS & ÖFFNENDE ABSPERRUNG (DURCHLASS)
    // =========================================================================
    {
      id: 'cashier-booth-bottom-right',
      label: 'Kassenhäuschen („Eintritt frei - hier zahlen Sie mit Ihrem Namen!“)',
      category: 'counter',
      x: 855,
      y: 1405,
      width: 255,
      height: 115,
      fillColor: 0x1e1b4b,
      strokeColor: 0x39ff14,
    },
    {
      id: 'cashier-turnstile-gate',
      label: 'Eingangs-Absperrung (Öffnet nach Kassen-Check-in)',
      category: 'cashier-gate',
      x: 390,
      y: 1368,
      width: 24,
      height: 162,
      fillColor: 0x991b1b,
      strokeColor: 0xf43f5e,
      unlocksOnCheckIn: true,
    },

    // =========================================================================
    // 5. LINKS OBEN: BUNTE THEKE MIT SLUSH-PUPPIE-MASCHINE & BISTRO
    // =========================================================================
    {
      id: 'wc-partition-south',
      label: 'WC-Abtrennung Süd',
      category: 'partition',
      x: 20,
      y: 202,
      width: 195,
      height: 16,
      fillColor: 0x1e293b,
      strokeColor: 0x38bdf8,
    },
    {
      id: 'colorful-slush-counter',
      label: 'Bunte Bistro- & Slush-Puppie-Theke (Links Oben)',
      category: 'counter',
      x: 92,
      y: 250,
      width: 56,
      height: 295,
      fillColor: 0x4c1d95,
      strokeColor: 0x00f0ff,
    },
    {
      id: 'colorful-counter-backwall',
      label: 'Theken-Rückwand Links Oben',
      category: 'counter',
      x: 20,
      y: 250,
      width: 46,
      height: 295,
      fillColor: 0x1e1b4b,
      strokeColor: 0xf472b6,
    },

    // Bistro-Tische (Links Mitte)
    {
      id: 'bistro-table-col-1',
      label: 'Bistro-Tisch 1',
      category: 'furniture',
      x: 71,
      y: 636,
      width: 48,
      height: 48,
      fillColor: 0x451a03,
      strokeColor: 0xf59e0b,
    },
    {
      id: 'bistro-table-col-2',
      label: 'Bistro-Tisch 2',
      category: 'furniture',
      x: 201,
      y: 636,
      width: 48,
      height: 48,
      fillColor: 0x451a03,
      strokeColor: 0xf59e0b,
    },
    {
      id: 'bistro-table-col-3',
      label: 'Bistro-Tisch 3',
      category: 'furniture',
      x: 71,
      y: 756,
      width: 48,
      height: 48,
      fillColor: 0x451a03,
      strokeColor: 0xf59e0b,
    },
    {
      id: 'bistro-table-col-4',
      label: 'Bistro-Tisch 4',
      category: 'furniture',
      x: 201,
      y: 756,
      width: 48,
      height: 48,
      fillColor: 0x451a03,
      strokeColor: 0xf59e0b,
    },

    // 3 Sitzbänke entlang der Bande & Pro-Shop (Links Unten)
    {
      id: 'bench-collider-1',
      label: 'Sitzbank 1 (an der Bande)',
      category: 'bench',
      x: 348,
      y: 865,
      width: 26,
      height: 78,
      fillColor: 0x1e3a8a,
      strokeColor: 0x38bdf8,
    },
    {
      id: 'bench-collider-2',
      label: 'Sitzbank 2 (an der Bande)',
      category: 'bench',
      x: 348,
      y: 965,
      width: 26,
      height: 78,
      fillColor: 0x1e3a8a,
      strokeColor: 0x38bdf8,
    },
    {
      id: 'bench-collider-3',
      label: 'Sitzbank 3 (an der Bande)',
      category: 'bench',
      x: 348,
      y: 1065,
      width: 26,
      height: 28,
      fillColor: 0x1e3a8a,
      strokeColor: 0x38bdf8,
    },
    {
      id: 'pro-shop-counter',
      label: 'Pro-Shop & Skate-Verleih (Unten Links)',
      category: 'counter',
      x: 20,
      y: 920,
      width: 120,
      height: 240,
      fillColor: 0x064e3b,
      strokeColor: 0x10b981,
    },

    // =========================================================================
    // 6. OBEN RECHTS: DJ-PULT & STAGE
    // =========================================================================
    {
      id: 'dj-console-desk',
      label: 'DJ-Pult & Turntables (Oben Rechts)',
      category: 'dj-stage',
      x: 825,
      y: 152,
      width: 230,
      height: 42,
      fillColor: 0x3b0764,
      strokeColor: 0xec4899,
    },
    {
      id: 'dj-speaker-left',
      label: 'DJ-Subwoofer West',
      category: 'dj-stage',
      x: 775,
      y: 148,
      width: 40,
      height: 46,
      fillColor: 0x1e293b,
      strokeColor: 0xec4899,
    },
    {
      id: 'dj-speaker-right',
      label: 'DJ-Subwoofer Ost',
      category: 'dj-stage',
      x: 1065,
      y: 148,
      width: 40,
      height: 46,
      fillColor: 0x1e293b,
      strokeColor: 0xec4899,
    },
  ],
};
