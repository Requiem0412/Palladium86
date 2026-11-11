import Phaser from 'phaser';
import {
  AnimatedNpcSpec,
  ARENA_CONFIG,
  ArenaZone,
  DEFAULT_PHYSICS_CONFIG,
  PlayerCharacterMode,
  SkaterPhysicsConfig,
  StaticColliderSpec,
} from '../config/arenaConfig';
import { SkaterController, SkaterTelemetry } from './SkaterController';
import { soundFX } from '../utils/soundEffects';

export type CameraMode = 'overview' | 'follow';

export interface SceneTelemetryPayload {
  skater: SkaterTelemetry;
  activeZone: ArenaZone | null;
  cameraMode: CameraMode;
  showHitboxes: boolean;
  lastCollidedLabel: string | null;
  hasCheckedInAtCashier: boolean;
  drinkTokens: number;
  slushCooldownRemainingSec: number;
  lapsCompletedForSlush: number;
  totalLapsCompleted: number;
  statusMessage: string | null;
}

interface NpcRuntimeState {
  spec: AnimatedNpcSpec;
  currentX: number;
  currentY: number;
  headingRad: number;
  orbitAngle: number;
  spinTrickAngle: number;
  nameTagContainer: Phaser.GameObjects.Container;
}

/**
 * Main Phaser 3 2.5D Retro Scene for ROLLER DISCO PALLADIUM HANAU (1150 x 1550 px).
 */
export class RinkScene extends Phaser.Scene {
  private skater!: SkaterController;
  private staticColliderGroup!: Phaser.Physics.Arcade.StaticGroup;
  private cashierGateColliderObj: Phaser.GameObjects.Rectangle | null = null;

  private debugGraphic!: Phaser.GameObjects.Graphics;
  private dynamicFxGraphic!: Phaser.GameObjects.Graphics;
  private npcGraphic!: Phaser.GameObjects.Graphics;
  private gateGraphic!: Phaser.GameObjects.Graphics;
  private slushPromptText!: Phaser.GameObjects.Text;
  private cashierPromptText!: Phaser.GameObjects.Text;

  private npcStates: NpcRuntimeState[] = [];

  private cameraMode: CameraMode = 'overview';
  private showHitboxes: boolean = false;
  private lastCollidedLabel: string | null = null;
  private physicsConfig: SkaterPhysicsConfig = { ...DEFAULT_PHYSICS_CONFIG };

  // Cashier Check-In, Token, Cooldown & Lap Counter State
  private hasCheckedInAtCashier: boolean = false;
  private gateOpenProgress: number = 0; // 0 = closed, 1 = open
  private drinkTokens: number = 0;
  private slushCooldownRemainingMs: number = 0;
  private lapsCompletedForSlush: number = 0;
  private totalLapsCompleted: number = 0;
  private passedNorthCheckpoint: boolean = false;
  private statusMessage: string | null = null;

  private onTelemetryCallback?: (payload: SceneTelemetryPayload) => void;
  private lastTelemetryEmitTime = 0;

  constructor(onTelemetry?: (payload: SceneTelemetryPayload) => void) {
    super({ key: 'RinkScene' });
    this.onTelemetryCallback = onTelemetry;
  }

  public create(): void {
    const { width, height, spawnPoint } = ARENA_CONFIG.world;

    // 1. Set Physics World Bounds to 1150 x 1550 px
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);

    // 2. Render 2.5D Hall Architecture, Continuous Dark Brown Parquet, Hollow U-Railings & Straight Sluices
    this.renderArenaArchitecture();

    // 3. Build Solid Arcade Physics Colliders (including unlockable Cashier Gate)
    this.buildStaticColliders();

    // 4. Create Dynamic Graphics Layers
    this.gateGraphic = this.add.graphics().setDepth(15);
    this.dynamicFxGraphic = this.add.graphics().setDepth(17);
    this.npcGraphic = this.add.graphics().setDepth(22);

    // 5. Initialize 19 Living Animated NPCs + Floating Retro-Pixel Nametags
    this.initializeAnimatedNpcs();

    // 6. Ceiling Roof Layer with subtle "/papi" Easter-Egg
    this.renderCeilingLayerWithEasterEgg();

    // 7. Create Singleplayer Wheelchair / Skater Character in Foyer near Cashier Booth
    this.skater = new SkaterController(
      this,
      spawnPoint.x,
      spawnPoint.y,
      spawnPoint.angleDeg,
      this.physicsConfig
    );

    // 8. Floating Prompts at Cashier Booth (bottom-right) and Slush Counter (top-left)
    const { triggerX: slushX, triggerY: slushY } = ARENA_CONFIG.slushStation;
    this.slushPromptText = this.add
      .text(slushX, slushY - 52, '[E] SLUSH-PUPPIE EINLÖSEN', {
        fontFamily: '"Silkscreen", "JetBrains Mono", monospace',
        fontSize: '10px',
        color: '#00F0FF',
        backgroundColor: '#090D16EB',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(36)
      .setVisible(false);

    const { boothBounds } = ARENA_CONFIG.cashierStation;
    this.cashierPromptText = this.add
      .text(
        boothBounds.x + boothBounds.width / 2 - 20,
        boothBounds.y - 16,
        '▼ HIER ANROLLEN FÜR NAMENS-CHECK-IN ▼',
        {
          fontFamily: '"Silkscreen", "JetBrains Mono", monospace',
          fontSize: '10px',
          color: '#39FF14',
          backgroundColor: '#090D16EB',
          padding: { x: 8, y: 4 },
        }
      )
      .setOrigin(0.5)
      .setDepth(36);

    // 9. Wire Collision Detection between Player and Static Colliders
    this.physics.add.collider(
      this.skater.container,
      this.staticColliderGroup,
      (_skaterObj, obstacleObj) => {
        const zoneRect = obstacleObj as Phaser.GameObjects.Rectangle;
        const spec = zoneRect.getData('spec') as StaticColliderSpec | undefined;
        if (spec) {
          this.lastCollidedLabel = spec.label;
        }
        this.skater.registerBarrierCollision();
      }
    );

    // 10. Initialize Debug / Hitbox Graphics Overlay
    this.debugGraphic = this.add.graphics().setDepth(50);

    // 11. Setup Keyboard Shortcuts (guarded when typing in Cashier input)
    this.input.keyboard?.on('keydown-E', () => {
      if (!this.isDomInputActive()) {
        this.tryInteractWithSlushStation();
      }
    });
    this.input.keyboard?.on('keydown-V', () => {
      if (!this.isDomInputActive()) {
        this.toggleCharacterMode();
      }
    });
    this.input.keyboard?.on('keydown-C', () => {
      if (!this.isDomInputActive()) {
        this.setCameraMode(this.cameraMode === 'overview' ? 'follow' : 'overview');
      }
    });
    this.input.keyboard?.on('keydown-H', () => {
      if (!this.isDomInputActive()) {
        this.setShowHitboxes(!this.showHitboxes);
      }
    });
    this.input.keyboard?.on('keydown-R', () => {
      if (!this.isDomInputActive()) {
        this.respawnSkater();
      }
    });

    this.applyCameraMode();
  }

  private isDomInputActive(): boolean {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  }

  public update(time: number, delta: number): void {
    const dtSeconds = delta / 1000;
    this.skater.update(time, dtSeconds);

    // 1. Update Slush-Puppie Cooldown Timer (60s "friert nach")
    if (this.slushCooldownRemainingMs > 0) {
      this.slushCooldownRemainingMs = Math.max(
        0,
        this.slushCooldownRemainingMs - delta
      );
      if (this.slushCooldownRemainingMs === 0 && this.drinkTokens === 0) {
        this.drinkTokens = 1;
        this.lapsCompletedForSlush = 0;
        this.statusMessage =
          '🥤 Slush-Maschine fertig nachgefroren! Neuer Token bereit!';
        soundFX.playTokenRecharged();
      }
    }

    // 2. Track Rink Laps around the center U-Islands (2 laps recharge Slush early!)
    this.updateLapDetection();

    // 3. Check Cashier Booth & Slush Station Proximity
    this.updateInteractionZones(time);

    // 4. Animate Turnstile Gate Opening
    this.renderTurnstileGate(dtSeconds);

    // 5. Update & Render all 19 Living Animated NPCs + Mirror Reflections + Nametags
    this.updateAndRenderAnimatedNpcs(time, dtSeconds);

    // 6. Animate Neon-Green Wall of Memories Glow, Shimmering Picture Frames & DJ Stage
    this.renderDynamicWallAndStageFX(time);

    // 7. Render Debug Hitbox & Vector Overlay
    this.renderDebugOverlay();

    // 8. Emit Telemetry to React Shell at ~20 Hz
    if (time - this.lastTelemetryEmitTime > 50) {
      this.lastTelemetryEmitTime = time;
      this.emitTelemetry();
    }
  }

  // ===========================================================================
  // CASHIER CHECK-IN ("ZEITSPRUNG"), LAP TRACKING & SLUSH-PUPPIE TOKEN LOGIC
  // ===========================================================================

  public completeCashierCheckIn(enteredName: string): void {
    this.skater.setPlayerName(enteredName);

    if (!this.hasCheckedInAtCashier) {
      this.hasCheckedInAtCashier = true;
      this.drinkTokens = Math.max(1, this.drinkTokens + 1);
      this.statusMessage =
        '🎟️ 1 Freigetränk-Token erhalten! Durchlass zur Bahn geöffnet!';

      // Disable the physical turnstile gate collider so the player can roll through
      if (this.cashierGateColliderObj && this.cashierGateColliderObj.body) {
        const staticBody = this.cashierGateColliderObj
          .body as Phaser.Physics.Arcade.StaticBody;
        staticBody.enable = false;
      }
      this.cashierPromptText.setText('✓ EINGECHECKT · ZEITSPRUNG AKTIV');
      this.cashierPromptText.setColor('#00F0FF');
    }

    soundFX.playKaChing();
    this.emitTelemetry();
  }

  private updateLapDetection(): void {
    const sx = this.skater.container.x;
    const sy = this.skater.container.y;

    // Must be on the main hardwood rink (X > 400)
    if (sx < 405) return;

    // North curve above the top U-island (Y < 410)
    if (sy < 415 && !this.passedNorthCheckpoint) {
      this.passedNorthCheckpoint = true;
    }

    // South curve below the bottom U-island (Y > 1180) after passing North checkpoint
    if (sy > 1180 && this.passedNorthCheckpoint) {
      this.passedNorthCheckpoint = false;
      this.totalLapsCompleted += 1;

      if (this.slushCooldownRemainingMs > 0 || this.drinkTokens === 0) {
        this.lapsCompletedForSlush += 1;
        const requiredLaps = ARENA_CONFIG.slushStation.lapsToRecharge;

        if (this.lapsCompletedForSlush >= requiredLaps) {
          this.slushCooldownRemainingMs = 0;
          this.drinkTokens += 1;
          this.lapsCompletedForSlush = 0;
          this.statusMessage =
            '🏁 2 Runden geschafft! Neuer Slush-Puppie-Token freigeschaltet!';
          soundFX.playTokenRecharged();
        } else {
          this.statusMessage = `🛼 Runde ${this.lapsCompletedForSlush}/${requiredLaps} für Slush-Nachschub!`;
        }
      }
    }
  }

  private updateInteractionZones(time: number): void {
    const sx = this.skater.container.x;
    const sy = this.skater.container.y;

    // 1. Cashier Booth Proximity (Bottom-Right)
    const { triggerX: cashX, triggerY: cashY, triggerRadius: cashR } =
      ARENA_CONFIG.cashierStation;
    const distCashier = Phaser.Math.Distance.Between(sx, sy, cashX, cashY);
    this.skater.inCashierTriggerZone = distCashier <= cashR;

    if (!this.hasCheckedInAtCashier) {
      this.cashierPromptText.setY(
        ARENA_CONFIG.cashierStation.boothBounds.y -
          18 +
          Math.sin(time * 0.008) * 3
      );
    }

    // 2. Slush-Puppie Machine Proximity (Top-Left Counter)
    const { triggerX: slushX, triggerY: slushY, triggerRadius: slushR } =
      ARENA_CONFIG.slushStation;
    const distSlush = Phaser.Math.Distance.Between(sx, sy, slushX, slushY);
    const insideSlush = distSlush <= slushR;
    this.skater.inSlushTriggerZone = insideSlush;

    if (insideSlush) {
      this.slushPromptText.setVisible(true);
      this.slushPromptText.setY(slushY - 54 + Math.sin(time * 0.008) * 3);

      if (this.drinkTokens > 0) {
        this.slushPromptText.setText(
          `[TASTE E] SLUSH-PUPPIE HOLEN (🎟️ ${this.drinkTokens} TOKEN BEREIT)`
        );
        this.slushPromptText.setColor('#00F0FF');
      } else if (this.slushCooldownRemainingMs > 0) {
        const sec = Math.ceil(this.slushCooldownRemainingMs / 1000);
        const remLaps =
          ARENA_CONFIG.slushStation.lapsToRecharge - this.lapsCompletedForSlush;
        this.slushPromptText.setText(
          `❄️ MASCHINE FRIERT NACH: ${sec}s (ODER NOCH ${remLaps} RUNDEN FAHREN)`
        );
        this.slushPromptText.setColor('#F472B6');
      } else {
        this.slushPromptText.setText(
          '🎟️ ERST AN DER KASSE (UNTEN RECHTS) NAMEN EINTRAGEN FÜR FREIGETRÄNK!'
        );
        this.slushPromptText.setColor('#FDE047');
      }
    } else {
      this.slushPromptText.setVisible(false);
    }
  }

  public tryInteractWithSlushStation(): void {
    if (!this.skater || !this.skater.inSlushTriggerZone) return;

    if (this.drinkTokens <= 0) {
      if (!this.hasCheckedInAtCashier) {
        this.statusMessage =
          '🎟️ Bitte zuerst unten rechts an der Kasse mit deinem Namen einchecken!';
      } else {
        const sec = Math.ceil(this.slushCooldownRemainingMs / 1000);
        this.statusMessage = `❄️ Slush-Maschine friert noch ${sec}s nach (oder fahre 2 Runden auf der Bahn)!`;
      }
      this.emitTelemetry();
      return;
    }

    // Consume 1 Drink Token, activate 8s Speed + Ice Trail Boost & start 60s freeze cooldown
    this.drinkTokens -= 1;
    this.lapsCompletedForSlush = 0;
    this.slushCooldownRemainingMs = ARENA_CONFIG.slushStation.cooldownSec * 1000;

    const { boostDurationMs, speedMultiplier, driftAgilityMultiplier } =
      ARENA_CONFIG.slushStation;
    this.skater.activateSlushBoost(
      boostDurationMs,
      speedMultiplier,
      driftAgilityMultiplier
    );
    this.statusMessage =
      '⚡ SLUSH-PUPPIE BOOST AKTIV! 8s +25% Speed & Neon-Eis-Spur!';
    this.emitTelemetry();
  }

  // ===========================================================================
  // PUBLIC CONTROL API
  // ===========================================================================

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.applyCameraMode();
    this.emitTelemetry();
  }

  public setShowHitboxes(show: boolean): void {
    this.showHitboxes = show;
    this.renderDebugOverlay();
    this.emitTelemetry();
  }

  public setCharacterMode(mode: PlayerCharacterMode): void {
    if (this.skater) {
      this.skater.setCharacterMode(mode);
      this.emitTelemetry();
    }
  }

  public toggleCharacterMode(): void {
    if (this.skater) {
      this.skater.toggleCharacterMode();
      this.emitTelemetry();
    }
  }

  public triggerPlayerSpin(): void {
    if (this.skater) {
      this.skater.trigger360Spin();
    }
  }

  public updatePhysicsConfig(config: SkaterPhysicsConfig): void {
    this.physicsConfig = { ...config };
    if (this.skater) {
      this.skater.updatePhysicsConfig(this.physicsConfig);
    }
  }

  public respawnSkater(): void {
    const { spawnPoint } = ARENA_CONFIG.world;
    this.skater.respawn(spawnPoint.x, spawnPoint.y, spawnPoint.angleDeg);
    this.skater.clearTrails();
    this.lastCollidedLabel = null;
    this.emitTelemetry();
  }

  private applyCameraMode(): void {
    const cam = this.cameras.main;
    if (!cam) return;

    if (this.cameraMode === 'overview') {
      cam.stopFollow();
      cam.setZoom(1);
      cam.centerOn(ARENA_CONFIG.world.width / 2, ARENA_CONFIG.world.height / 2);
    } else if (this.skater) {
      cam.startFollow(this.skater.container, true, 0.09, 0.09);
      cam.setZoom(1.48);
    }
  }

  private emitTelemetry(): void {
    if (!this.onTelemetryCallback || !this.skater) return;

    const skaterTelemetry = this.skater.getTelemetry();
    const activeZone = this.detectZoneAt(skaterTelemetry.x, skaterTelemetry.y);

    this.onTelemetryCallback({
      skater: skaterTelemetry,
      activeZone,
      cameraMode: this.cameraMode,
      showHitboxes: this.showHitboxes,
      lastCollidedLabel: this.lastCollidedLabel,
      hasCheckedInAtCashier: this.hasCheckedInAtCashier,
      drinkTokens: this.drinkTokens,
      slushCooldownRemainingSec: Math.ceil(this.slushCooldownRemainingMs / 1000),
      lapsCompletedForSlush: this.lapsCompletedForSlush,
      totalLapsCompleted: this.totalLapsCompleted,
      statusMessage: this.statusMessage,
    });
  }

  private detectZoneAt(x: number, y: number): ArenaZone | null {
    for (const zone of ARENA_CONFIG.zones) {
      const b = zone.bounds;
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
        return zone;
      }
    }
    return null;
  }

  // ===========================================================================
  // 2.5D ARCHITECTURAL RENDERING (CONTINUOUS DARK WOOD PARQUET & STRAIGHT SLUICES)
  // ===========================================================================

  private renderArenaArchitecture(): void {
    const g = this.add.graphics().setDepth(1);
    const { width, height } = ARENA_CONFIG.world;

    // 1. Base Hall Floor & Subtle Retro Tile Grid
    g.fillStyle(0x080c14, 1);
    g.fillRect(0, 0, width, height);

    g.lineStyle(1, 0x1e293b, 0.4);
    for (let x = 0; x <= width; x += 40) {
      g.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 40) {
      g.lineBetween(0, y, width, y);
    }

    // 2. Render Functional Outer Zones
    for (const zone of ARENA_CONFIG.zones) {
      if (zone.id === 'main-rink') continue;
      const { x, y, width: zw, height: zh } = zone.bounds;

      g.fillStyle(zone.floorColor, 0.94);
      g.fillRoundedRect(x, y, zw, zh, 8);

      g.lineStyle(1.5, zone.accentColor, 0.35);
      g.strokeRoundedRect(x, y, zw, zh, 8);

      this.add
        .text(x + 12, y + 8, zone.name.toUpperCase(), {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '11.5px',
          fontStyle: 'bold',
          color: zone.accentHex,
        })
        .setAlpha(0.86)
        .setDepth(4);
    }

    // 3. Render Seamless Warm Dark-Brown Hardwood Parquet (NO bright circles or floor breaks!)
    this.renderSeamlessDarkHardwoodParquet(g);

    // 4. Render 2 Slim Hollow Railing Arches (∩) & 2 Straight Sluices with Central Pillars
    this.renderHollowRailingArchesAndStraightSluices(g);

    // 5. Render Left Side (WC, Colorful Slush Counter, Bistro Tables, Pro-Shop & 3 Benches)
    this.renderLeftWingAndSlushCounter(g);

    // 6. Render Bottom-Right Cashier Booth ("Eintritt frei - hier zahlen Sie mit Ihrem Namen!")
    this.renderCashierBoothBottomRight(g);

    // 7. Render Top Mirror Wall, DJ Booth & Massive 2.5D Right Wall of Memories (Neon Green)
    this.renderTopAndRightWallOfMemories(g);
  }

  private renderSeamlessDarkHardwoodParquet(g: Phaser.GameObjects.Graphics): void {
    const { bounds, plankSpacingY, centerLogo } = ARENA_CONFIG.rinkGeometry;
    const { x, y, width, height } = bounds;

    // Continuous warm dark-brown wood floor across the entire rink AND inside the hollow U-arches
    g.fillStyle(0x28150c, 1);
    g.fillRect(x + 8, y + 8, width - 8, height - 16);

    const innerX = x + 14;
    const innerY = y + 14;
    const innerW = width - 16;
    const innerH = height - 28;

    for (let py = innerY; py < innerY + innerH; py += plankSpacingY) {
      const rowIdx = Math.floor((py - innerY) / plankSpacingY);
      const plankTone = rowIdx % 2 === 0 ? 0x331b10 : 0x2b160d;

      g.fillStyle(plankTone, 0.96);
      g.fillRect(innerX, py, innerW, plankSpacingY - 1);

      // Subtle dark wood grain seam lines
      g.lineStyle(1, 0x1a0c06, 0.55);
      g.lineBetween(innerX, py, innerX + innerW, py);

      // Staggered plank butt-joints
      const offset = (rowIdx * 95) % 170;
      for (let px = innerX + offset; px < innerX + innerW - 20; px += 170) {
        g.lineBetween(px, py, px, py + plankSpacingY - 1);
      }
    }

    // Subtle inlaid Center-Court Typography ("ROLLER DISCO PALLADIUM HANAU") without bright circles
    const cx = centerLogo.centerX;
    const cy = centerLogo.centerY;

    this.add
      .text(cx, cy - 22, centerLogo.title, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#854D0E',
        letterSpacing: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0.55)
      .setDepth(4);

    this.add
      .text(cx, cy + 2, centerLogo.subtitle, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#A16207',
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setAlpha(0.5)
      .setDepth(4);

    this.add
      .text(cx, cy + 26, `— ${centerLogo.city} —`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#854D0E',
        letterSpacing: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0.52)
      .setDepth(4);
  }

  private renderHollowRailingArchesAndStraightSluices(
    g: Phaser.GameObjects.Graphics
  ): void {
    const { hollowHorseshoes, straightSluices } = ARENA_CONFIG.rinkGeometry;

    // 1. TWO SLIM, HOLLOW RAILING ARCHES (∩) IN THE CENTER
    // (Interior has the exact same continuous dark hardwood parquet!)
    for (const rail of hollowHorseshoes) {
      const halfW = rail.outerWidth / 2;
      const leftX = rail.centerX - halfW;
      const rightX = rail.centerX + halfW;
      const archRadius = halfW;
      const archCenterY = rail.topY + archRadius;

      // 2.5D Railing Drop Shadow on the Parquet
      g.lineStyle(12, 0x000000, 0.42);
      g.beginPath();
      g.moveTo(leftX + 8, rail.bottomY + 6);
      g.lineTo(leftX + 8, archCenterY + 6);
      g.arc(
        rail.centerX,
        archCenterY + 6,
        archRadius - 8,
        Math.PI,
        Math.PI * 2,
        false
      );
      g.lineTo(rightX - 8, rail.bottomY + 6);
      g.strokePath();

      // 2.5D Metallic Post Stanchions along the hollow railing
      const postPositions = [
        { px: leftX + 8, py: rail.bottomY - 6 },
        { px: leftX + 8, py: archCenterY },
        { px: rail.centerX, py: rail.topY + 8 },
        { px: rightX - 8, py: archCenterY },
        { px: rightX - 8, py: rail.bottomY - 6 },
      ];
      for (const p of postPositions) {
        g.fillStyle(0x0f172a, 1);
        g.fillCircle(p.px, p.py + 3, 7);
        g.fillStyle(0x94a3b8, 1);
        g.fillCircle(p.px, p.py - 2, 6);
      }

      // Slim Hollow Chrome & Neon Top Handrail (Elevated in 2.5D)
      g.lineStyle(10, 0x1e293b, 1);
      g.beginPath();
      g.moveTo(leftX + 8, rail.bottomY);
      g.lineTo(leftX + 8, archCenterY);
      g.arc(rail.centerX, archCenterY, archRadius - 8, Math.PI, Math.PI * 2, false);
      g.lineTo(rightX - 8, rail.bottomY);
      g.strokePath();

      g.lineStyle(3.5, 0x00f0ff, 0.95);
      g.beginPath();
      g.moveTo(leftX + 8, rail.bottomY - 2);
      g.lineTo(leftX + 8, archCenterY - 2);
      g.arc(
        rail.centerX,
        archCenterY - 2,
        archRadius - 8,
        Math.PI,
        Math.PI * 2,
        false
      );
      g.lineTo(rightX - 8, rail.bottomY - 2);
      g.strokePath();
    }

    // 2. TWO STRAIGHT SLUICES (ENTRANCES) ON THE LEFT WITH FIXED CENTRAL DIVIDER PILLAR
    for (const sluice of straightSluices) {
      const p = sluice.centralPillar;

      // Subtle floor arrows indicating left/right bypass around the central pillar
      g.lineStyle(1.5, 0x39ff14, 0.45);
      g.lineBetween(p.x - 10, sluice.openingYStart + 32, p.x + p.width + 10, sluice.openingYStart + 32);
      g.lineBetween(p.x - 10, sluice.openingYEnd - 32, p.x + p.width + 10, sluice.openingYEnd - 32);

      // 2.5D Central Divider Pillar (Pfosten / Mittelteiler)
      // Shadow
      g.fillStyle(0x000000, 0.5);
      g.fillRoundedRect(p.x + 3, p.y + 6, p.width, p.height, 5);
      // 2.5D Front Wall Face
      g.fillStyle(0x0f172a, 1);
      g.fillRoundedRect(p.x, p.y + 4, p.width, p.height, 5);
      // 2.5D Top Cap with Neon-Green Trim
      g.fillStyle(0x1e293b, 1);
      g.lineStyle(2.5, 0x39ff14, 1);
      g.fillRoundedRect(p.x, p.y - 3, p.width, p.height, 5);
      g.strokeRoundedRect(p.x, p.y - 3, p.width, p.height, 5);

      this.add
        .text(p.x + p.width / 2, p.y + p.height / 2 - 3, 'PFEILER', {
          fontFamily: '"Silkscreen", monospace',
          fontSize: '8px',
          color: '#39FF14',
        })
        .setOrigin(0.5)
        .setDepth(16);

      this.add
        .text(p.x - 12, p.y + p.height / 2, `⇄ ${sluice.label}`, {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#38BDF8',
        })
        .setOrigin(1, 0.5)
        .setDepth(16);
    }
  }

  private renderLeftWingAndSlushCounter(g: Phaser.GameObjects.Graphics): void {
    // 1. WC Area (Top-Left)
    for (let wx = 45; wx <= 195; wx += 50) {
      g.fillStyle(0x1e293b, 0.9);
      g.lineStyle(1, 0x38bdf8, 0.6);
      g.fillRoundedRect(wx, 52, 38, 40, 4);
      g.strokeRoundedRect(wx, 52, 38, 40, 4);
    }

    // 2. Colorful Bistro & Slush-Puppie Counter (Top-Left below WC)
    const { machineBounds, triggerX, triggerY, triggerRadius } =
      ARENA_CONFIG.slushStation;

    // Multi-colored neon stripes on the colorful counter
    const stripeColors = [0x00f0ff, 0xff2a85, 0xfde047, 0x39ff14];
    for (let i = 0; i < 4; i++) {
      g.fillStyle(stripeColors[i], 0.85);
      g.fillRect(142, 260 + i * 70, 5, 58);
    }

    // Interactive Slush-Puppie Floor Trigger Zone Pad
    g.fillStyle(0x00f0ff, 0.12);
    g.fillCircle(triggerX, triggerY, triggerRadius);
    g.lineStyle(2, 0x00f0ff, 0.72);
    g.strokeCircle(triggerX, triggerY, triggerRadius);

    this.add
      .text(triggerX, triggerY - 8, 'SLUSH-PUPPIE STATION', {
        fontFamily: '"Silkscreen", monospace',
        fontSize: '9.5px',
        color: '#00F0FF',
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.add
      .text(triggerX, triggerY + 8, '[E] Token → 8s Ice-Boost', {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9.5px',
        color: '#F472B6',
      })
      .setOrigin(0.5)
      .setDepth(6);

    // 2.5D Slush-Puppie Twin-Chamber Machine (Blue Ice & Cherry Pink)
    g.fillStyle(0x0f172a, 1);
    g.lineStyle(2, 0x00f0ff, 1);
    g.fillRoundedRect(
      machineBounds.x,
      machineBounds.y,
      machineBounds.width,
      machineBounds.height,
      6
    );
    g.strokeRoundedRect(
      machineBounds.x,
      machineBounds.y,
      machineBounds.width,
      machineBounds.height,
      6
    );
    g.fillStyle(0x00f0ff, 0.95);
    g.fillRoundedRect(machineBounds.x + 6, machineBounds.y + 8, 36, 26, 4);
    g.fillStyle(0xff2a85, 0.95);
    g.fillRoundedRect(machineBounds.x + 6, machineBounds.y + 40, 36, 26, 4);

    // 3. Bistro Tables & Chairs (Middle-Left)
    for (const table of ARENA_CONFIG.bistroTables) {
      g.fillStyle(0x78350f, 0.92);
      g.lineStyle(1.5, 0xf59e0b, 0.75);
      const chairs = [
        { dx: -34, dy: 0 },
        { dx: 34, dy: 0 },
        { dx: 0, dy: -34 },
        { dx: 0, dy: 34 },
      ];
      for (const c of chairs) {
        g.fillCircle(table.x + c.dx, table.y + c.dy, 7);
        g.strokeCircle(table.x + c.dx, table.y + c.dy, 7);
      }
    }

    // 4. Pro-Shop & 3 Benches along the Barrier (Bottom-Left)
    this.add
      .text(80, 1040, 'PRO-SHOP &\nSKATE-VERLEIH', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#6EE7B7',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(16);
  }

  private renderCashierBoothBottomRight(g: Phaser.GameObjects.Graphics): void {
    const { boothBounds, signText, triggerX, triggerY, triggerRadius } =
      ARENA_CONFIG.cashierStation;

    // Trigger Carpet in front of the Cashier Window
    g.fillStyle(0x39ff14, 0.1);
    g.fillCircle(triggerX, triggerY, triggerRadius * 0.72);
    g.lineStyle(2, 0x39ff14, 0.65);
    g.strokeCircle(triggerX, triggerY, triggerRadius * 0.72);

    // 2.5D Cashier Booth Roof & Glowing Signboard
    g.fillStyle(0x090d16, 0.96);
    g.lineStyle(2.5, 0x39ff14, 1);
    g.fillRoundedRect(
      boothBounds.x - 10,
      boothBounds.y + 8,
      boothBounds.width + 10,
      44,
      6
    );
    g.strokeRoundedRect(
      boothBounds.x - 10,
      boothBounds.y + 8,
      boothBounds.width + 10,
      44,
      6
    );

    this.add
      .text(
        boothBounds.x + boothBounds.width / 2 - 5,
        boothBounds.y + 22,
        '★ KASSE · ZEITSPRUNG-SCHALTER ★',
        {
          fontFamily: '"Silkscreen", monospace',
          fontSize: '9.5px',
          color: '#39FF14',
        }
      )
      .setOrigin(0.5)
      .setDepth(18);

    this.add
      .text(
        boothBounds.x + boothBounds.width / 2 - 5,
        boothBounds.y + 39,
        `„${signText}“`,
        {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#FDE047',
        }
      )
      .setOrigin(0.5)
      .setDepth(18);
  }

  private renderTopAndRightWallOfMemories(g: Phaser.GameObjects.Graphics): void {
    // 1. TOP-CENTER MIRROR WALL (Glass Backing for Synchronized Dancers)
    g.fillStyle(0xbae6fd, 0.26);
    g.fillRect(355, 20, 365, 28);
    g.lineStyle(2.5, 0x38bdf8, 0.95);
    g.strokeRect(355, 20, 365, 28);

    // Diagonal reflection sheen lines across the mirror glass
    g.lineStyle(1, 0xe0f2fe, 0.45);
    for (let mx = 375; mx < 700; mx += 45) {
      g.lineBetween(mx, 22, mx - 14, 46);
    }

    // 2. TOP-RIGHT DJ BOOTH & TURNTABLES
    g.fillStyle(0x090d16, 0.95);
    g.lineStyle(2, 0xec4899, 0.9);
    g.fillRoundedRect(775, 28, 330, 62, 6);
    g.strokeRoundedRect(775, 28, 330, 62, 6);

    this.add
      .text(940, 46, 'PALLADIUM SOUND STAGE · LIVE DJ', {
        fontFamily: '"Silkscreen", monospace',
        fontSize: '10px',
        color: '#F472B6',
      })
      .setOrigin(0.5)
      .setDepth(6);

    // 3. RIGHT WALL: MASSIVE 2.5D "WALL OF MEMORIES" WITH NEON-GREEN "PALLADIUM HANAU" LOGO
    // & WINGED ROLLER SKATE EMBLEM + PICTURE FRAMES BELOW
    const { wallBounds, logoTitle } = ARENA_CONFIG.wallOfMemories;

    // Massive 2.5D Wall Face along X = 1114 .. 1150
    g.fillStyle(0x07170d, 1);
    g.fillRect(wallBounds.x - 6, wallBounds.y, wallBounds.width + 6, wallBounds.height);
    g.lineStyle(3, 0x39ff14, 0.95);
    g.strokeRect(wallBounds.x - 4, wallBounds.y, wallBounds.width + 4, wallBounds.height);

    // Soft Green Ambient Glow cast from the right wall onto the dark brown parquet
    g.fillStyle(0x39ff14, 0.085);
    g.fillEllipse(wallBounds.x - 28, 725, 135, 540);
    g.fillStyle(0x39ff14, 0.05);
    g.fillEllipse(wallBounds.x - 55, 725, 210, 740);

    // Mounted Neon-Green Signboard Box on the Right Wall (Y = 530 .. 940)
    g.fillStyle(0x051209, 0.96);
    g.lineStyle(3, 0x39ff14, 1);
    g.fillRoundedRect(wallBounds.x - 12, 520, 44, 420, 6);
    g.strokeRoundedRect(wallBounds.x - 12, 520, 44, 420, 6);

    // Winged Roller Skate Icon drawn in intense Neon Green (#39FF14) above the title
    const skateIconX = wallBounds.x + 8;
    const skateIconY = 568;
    g.lineStyle(2.5, 0x39ff14, 1);
    g.fillStyle(0x39ff14, 0.9);
    // Skate boot
    g.fillRoundedRect(skateIconX - 8, skateIconY - 8, 14, 16, 3);
    // 4 wheels
    g.fillCircle(skateIconX - 11, skateIconY - 5, 2.5);
    g.fillCircle(skateIconX - 11, skateIconY + 5, 2.5);
    // Neon Wings spreading out from the skate
    g.beginPath();
    g.moveTo(skateIconX + 4, skateIconY - 6);
    g.lineTo(skateIconX + 14, skateIconY - 18);
    g.lineTo(skateIconX + 10, skateIconY - 4);
    g.lineTo(skateIconX + 15, skateIconY - 10);
    g.strokePath();

    // Large Horizontal "PALLADIUM HANAU" Neon-Green Logo mounted along the Wall
    this.add
      .text(wallBounds.x + 8, 750, `🛼 ${logoTitle} ★`, {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#39FF14',
        letterSpacing: 4,
        stroke: '#052E16',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setAngle(-90)
      .setDepth(20);
  }

  private renderCeilingLayerWithEasterEgg(): void {
    const ceilingGraphics = this.add.graphics().setDepth(38);
    const { ceilingEasterEgg } = ARENA_CONFIG.world;

    ceilingGraphics.lineStyle(2, 0x334155, 0.2);
    ceilingGraphics.lineBetween(410, ceilingEasterEgg.y - 16, 1110, ceilingEasterEgg.y - 16);
    ceilingGraphics.lineBetween(410, ceilingEasterEgg.y + 16, 1110, ceilingEasterEgg.y + 16);

    this.add
      .text(ceilingEasterEgg.x, ceilingEasterEgg.y, ceilingEasterEgg.text, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#94A3B8',
      })
      .setOrigin(0.5)
      .setAlpha(0.32)
      .setDepth(39);
  }

  // ===========================================================================
  // 19 ANIMATED NPCS + FLOATING RETRO-PIXEL NAMETAGS + MIRROR REFLECTION
  // ===========================================================================

  private initializeAnimatedNpcs(): void {
    this.npcStates = ARENA_CONFIG.npcs.map((spec) => {
      const tagBg = this.add.graphics();
      const tagText = this.add
        .text(0, 0, spec.nameTag, {
          fontFamily: '"Silkscreen", "JetBrains Mono", monospace',
          fontSize: '8.5px',
          color: spec.nameTagColor,
          stroke: '#050811',
          strokeThickness: 2.5,
        })
        .setOrigin(0.5);

      const w = Math.max(44, tagText.width + 10);
      tagBg.fillStyle(0x090d16, 0.82);
      tagBg.fillRoundedRect(-w / 2, -8, w, 16, 3);
      tagBg.lineStyle(1, 0x334155, 0.8);
      tagBg.strokeRoundedRect(-w / 2, -8, w, 16, 3);

      const nameTagContainer = this.add.container(spec.x, spec.y - 26, [
        tagBg,
        tagText,
      ]);
      nameTagContainer.setDepth(32);

      return {
        spec,
        currentX: spec.x,
        currentY: spec.y,
        headingRad: -Math.PI / 2,
        orbitAngle: spec.phaseOffset,
        spinTrickAngle: 0,
        nameTagContainer,
      };
    });
  }

  private updateAndRenderAnimatedNpcs(time: number, dt: number): void {
    if (!this.npcGraphic) return;
    const g = this.npcGraphic;
    g.clear();

    // Global 122 BPM Disco Beat
    const beatRad = time * 0.0064;
    const beatBounce = Math.abs(Math.sin(beatRad * 2)) * 3.2;

    for (const state of this.npcStates) {
      const { spec } = state;

      // 1. Update Position & Animation State by Role
      if (
        spec.role === 'mirror-street-dancer' ||
        spec.role === 'mirror-jam-skater'
      ) {
        const isSkater = spec.role === 'mirror-jam-skater';
        const syncSwayX = Math.sin(beatRad) * (isSkater ? 20 : 13);
        const syncStepY = Math.cos(beatRad * 2) * (isSkater ? 7 : 4);
        state.currentX = spec.x + syncSwayX;
        state.currentY = spec.y + syncStepY;
        state.spinTrickAngle = isSkater
          ? Math.sin(beatRad * 0.5) * Math.PI
          : Math.sin(beatRad) * 0.35;

        // Draw Synchronized Reflection inside the Top-Center Mirror Glass (Y = 24..44)
        const refX = state.currentX;
        const refY = 34 - syncStepY * 0.35;
        g.fillStyle(spec.outfitColor, 0.45);
        g.fillRoundedRect(refX - 8, refY - 5, 16, 10, 4);
        g.fillStyle(spec.trimColor, 0.55);
        g.fillCircle(refX, refY - 2, 4.5);
        g.fillStyle(spec.shoeOrWheelColor, 0.6);
        g.fillCircle(refX - 5, refY + 4, 2);
        g.fillCircle(refX + 5, refY + 4, 2);
      } else if (spec.role === 'oval-lap-skater') {
        // Skate oval laps around the 2 central hollow U-islands + gently avoid player
        const speed = spec.orbitSpeed ?? 0.6;
        state.orbitAngle = (state.orbitAngle + dt * speed) % (Math.PI * 2);

        const rx = 225 + (spec.laneRadiusOffset ?? 0);
        const ry = 445 + (spec.laneRadiusOffset ?? 0) * 1.1;
        const centerX = 754;
        const centerY = 795;

        let targetX = centerX + Math.cos(state.orbitAngle) * rx;
        let targetY = centerY + Math.sin(state.orbitAngle) * ry;

        // Gentle avoidance if player is very close
        if (this.skater) {
          const distToPlayer = Phaser.Math.Distance.Between(
            targetX,
            targetY,
            this.skater.container.x,
            this.skater.container.y
          );
          if (distToPlayer < 65) {
            const pushAngle = Math.atan2(
              targetY - this.skater.container.y,
              targetX - this.skater.container.x
            );
            targetX += Math.cos(pushAngle) * (65 - distToPlayer) * 0.6;
            targetY += Math.sin(pushAngle) * (65 - distToPlayer) * 0.6;
          }
        }

        const dx = targetX - state.currentX;
        const dy = targetY - state.currentY;
        if (Math.hypot(dx, dy) > 0.5) {
          state.headingRad = Math.atan2(dy, dx);
        }
        state.currentX = targetX;
        state.currentY = targetY;
      } else if (spec.role === 'island-trick-skater') {
        // Freestyle skater inside the hollow U-railing arch doing figure-8s & 360° spins
        const t = time * 0.0022 + spec.phaseOffset;
        state.currentX = spec.x + Math.sin(t) * 42;
        state.currentY = spec.y + Math.sin(t * 2) * 28;
        state.spinTrickAngle = (time * 0.006 + spec.phaseOffset) % (Math.PI * 2);
      } else if (spec.role === 'dj-master') {
        // DJ moving records and bobbing at the Top-Right booth
        state.currentX = spec.x + Math.sin(beatRad * 2) * 8;
        state.currentY = spec.y + Math.cos(beatRad * 4) * 2;
      } else if (spec.role === 'bistro-guest') {
        // Hanging out, chatting, gesturing & bobbing to the beat
        state.currentX = spec.x + Math.sin(beatRad + spec.phaseOffset) * 2.5;
        state.currentY = spec.y + Math.cos(beatRad * 2 + spec.phaseOffset) * 2;
      }

      // 2. Draw 2.5D NPC Figure
      this.drawSingleNpc25D(g, state, beatRad, beatBounce);

      // 3. Update Floating Retro-Pixel Nametag with rhythmic bobbing
      const nametagBob = Math.sin(beatRad * 2 + spec.phaseOffset) * 2.5;
      const labelText = spec.chatSymbol
        ? `${spec.nameTag} ${spec.chatSymbol}`
        : spec.nameTag;
      const textObj = state.nameTagContainer.list[1] as Phaser.GameObjects.Text;
      if (textObj && textObj.text !== labelText) {
        textObj.setText(labelText);
      }
      state.nameTagContainer.setPosition(
        state.currentX,
        state.currentY - 26 + nametagBob
      );
    }
  }

  private drawSingleNpc25D(
    g: Phaser.GameObjects.Graphics,
    state: NpcRuntimeState,
    beatRad: number,
    beatBounce: number
  ): void {
    const { spec, currentX: x, currentY: y } = state;

    // 2.5D Drop shadow on floor
    g.fillStyle(0x000000, 0.38);
    g.fillEllipse(x, y + 5, 24, 16);

    const stride = Math.sin(beatRad * 2 + spec.phaseOffset) * 4.5;

    // Feet: Quad Skates vs. Street Sneakers
    const hasSkates =
      spec.role === 'mirror-jam-skater' ||
      spec.role === 'oval-lap-skater' ||
      spec.role === 'island-trick-skater';

    if (hasSkates) {
      // Glowing roller skate wheels
      g.fillStyle(spec.shoeOrWheelColor, 1);
      g.fillCircle(x - 6, y + 4 + stride * 0.5, 2.5);
      g.fillCircle(x + 6, y + 4 - stride * 0.5, 2.5);
      g.fillStyle(0xf8fafc, 1);
      g.fillRoundedRect(x - 8, y + 1 + stride * 0.5, 5, 6, 1.5);
      g.fillRoundedRect(x + 3, y + 1 - stride * 0.5, 5, 6, 1.5);
    } else {
      // Street Sneakers
      g.fillStyle(spec.shoeOrWheelColor, 1);
      g.fillRoundedRect(x - 7, y + 2 + stride * 0.4, 5, 6, 2);
      g.fillRoundedRect(x + 2, y + 2 - stride * 0.4, 5, 6, 2);
    }

    // 2.5D Torso (bounces vertically with the beat)
    const bodyY = y - beatBounce * 0.6;
    g.fillStyle(spec.outfitColor, 1);
    g.lineStyle(1.8, spec.trimColor, 1);
    g.fillRoundedRect(x - 9, bodyY - 8, 18, 14, 5);
    g.strokeRoundedRect(x - 9, bodyY - 8, 18, 14, 5);

    // Animated Arms (DJ scratching turntables, dancers grooving, or guests gesturing)
    const armWave = Math.sin(beatRad * 2 + spec.phaseOffset) * 5;
    g.lineStyle(2.5, spec.trimColor, 0.95);
    if (spec.role === 'dj-master') {
      // DJ hands scratching left & right turntables below him
      g.lineBetween(x - 7, bodyY, x - 14 + armWave, bodyY + 14);
      g.lineBetween(x + 7, bodyY, x + 14 - armWave, bodyY + 14);
    } else {
      g.lineBetween(x - 9, bodyY - 2, x - 13, bodyY - 6 + armWave);
      g.lineBetween(x + 9, bodyY - 2, x + 13, bodyY - 6 - armWave);
    }

    // Head & Retro Hair/Cap/Headphones
    g.fillStyle(0xf8fafc, 1);
    g.fillCircle(x, bodyY - 5, 5.5);
    g.fillStyle(spec.hairOrCapColor, 1);
    g.fillRoundedRect(x - 5, bodyY - 10, 10, 4, 2);

    if (spec.role === 'dj-master') {
      // DJ Headphones
      g.lineStyle(2, 0x39ff14, 1);
      g.strokeCircle(x, bodyY - 5, 6.5);
    }
  }

  // ===========================================================================
  // TURNSTILE GATE ANIMATION & WALL OF MEMORIES NEON-GREEN SHIMMER
  // ===========================================================================

  private renderTurnstileGate(dt: number): void {
    if (!this.gateGraphic) return;
    this.gateGraphic.clear();

    const targetOpen = this.hasCheckedInAtCashier ? 1 : 0;
    this.gateOpenProgress = Phaser.Math.Linear(
      this.gateOpenProgress,
      targetOpen,
      dt * 5
    );

    const { gateBounds } = ARENA_CONFIG.cashierStation;
    const currentHeight = gateBounds.height * (1 - this.gateOpenProgress * 0.88);

    if (currentHeight > 6) {
      this.gateGraphic.fillStyle(
        this.hasCheckedInAtCashier ? 0x10b981 : 0xe11d48,
        0.92
      );
      this.gateGraphic.lineStyle(
        2,
        this.hasCheckedInAtCashier ? 0x39ff14 : 0xfda4af,
        1
      );
      this.gateGraphic.fillRoundedRect(
        gateBounds.x,
        gateBounds.y,
        gateBounds.width,
        currentHeight,
        4
      );
      this.gateGraphic.strokeRoundedRect(
        gateBounds.x,
        gateBounds.y,
        gateBounds.width,
        currentHeight,
        4
      );
    }
  }

  private renderDynamicWallAndStageFX(time: number): void {
    if (!this.dynamicFxGraphic) return;
    this.dynamicFxGraphic.clear();

    const pulse = (Math.sin(time * 0.005) + 1) * 0.5;
    const { wallBounds, memoryFrames } = ARENA_CONFIG.wallOfMemories;

    // 1. Pulsing Neon-Green Glow from "PALLADIUM HANAU" Sign onto the Parquet
    this.dynamicFxGraphic.fillStyle(0x39ff14, 0.045 + pulse * 0.055);
    this.dynamicFxGraphic.fillEllipse(wallBounds.x - 42, 730, 140, 480);

    // 2. Small Animated Shimmering Picture Frames on the Right Wall of Memories
    for (let i = 0; i < memoryFrames.length; i++) {
      const frame = memoryFrames[i];
      const shimmer = (Math.sin(time * 0.006 + i * 1.1) + 1) * 0.5;
      const fx = wallBounds.x - 8;

      // Picture frame backing
      this.dynamicFxGraphic.fillStyle(0x0f172a, 0.95);
      this.dynamicFxGraphic.fillRoundedRect(fx, frame.y, 18, frame.height, 3);
      // Shimmering picture surface
      this.dynamicFxGraphic.fillStyle(frame.tint, 0.45 + shimmer * 0.45);
      this.dynamicFxGraphic.fillRect(fx + 3, frame.y + 4, 12, frame.height - 8);
      // Neon-green / gold frame border
      this.dynamicFxGraphic.lineStyle(1.5, 0x39ff14, 0.5 + shimmer * 0.5);
      this.dynamicFxGraphic.strokeRoundedRect(fx, frame.y, 18, frame.height, 3);
    }

    // 3. Animated Spinning Vinyl Records & Equalizer at the Top-Right DJ Booth
    const recAngle = time * 0.008;
    [895, 985].forEach((rx) => {
      this.dynamicFxGraphic.fillStyle(0x090d16, 1);
      this.dynamicFxGraphic.fillCircle(rx, 172, 13);
      this.dynamicFxGraphic.lineStyle(1.5, 0x00f0ff, 0.9);
      this.dynamicFxGraphic.strokeCircle(rx, 172, 13);
      this.dynamicFxGraphic.lineStyle(2, 0xff2a85, 1);
      this.dynamicFxGraphic.lineBetween(
        rx,
        172,
        rx + Math.cos(recAngle) * 11,
        172 + Math.sin(recAngle) * 11
      );
    });

    // Equalizer bars on the DJ screen
    for (let i = 0; i < 18; i++) {
      const barH = 6 + Math.abs(Math.sin(time * 0.007 + i * 0.5)) * 22;
      this.dynamicFxGraphic.fillStyle(
        i % 2 === 0 ? 0x39ff14 : 0xff2a85,
        0.45 + pulse * 0.35
      );
      this.dynamicFxGraphic.fillRect(792 + i * 16, 84 - barH, 10, barH);
    }
  }

  // ===========================================================================
  // STATIC COLLISION BODIES (ARCADE PHYSICS)
  // ===========================================================================

  private buildStaticColliders(): void {
    this.staticColliderGroup = this.physics.add.staticGroup();
    const obstacleGraphics = this.add.graphics().setDepth(14);

    for (const spec of ARENA_CONFIG.colliders) {
      const centerX = spec.x + spec.width / 2;
      const centerY = spec.y + spec.height / 2;

      // Hollow U-railings, sluice pillars, and animated gate have dedicated 2.5D renderers
      if (
        spec.category !== 'u-island' &&
        spec.category !== 'sluice-pillar' &&
        spec.category !== 'cashier-gate'
      ) {
        // 2.5D Drop shadow
        obstacleGraphics.fillStyle(0x000000, 0.35);
        obstacleGraphics.fillRoundedRect(
          spec.x + 2,
          spec.y + 4,
          spec.width,
          spec.height,
          4
        );
        obstacleGraphics.fillStyle(spec.fillColor, 1);
        obstacleGraphics.fillRoundedRect(
          spec.x,
          spec.y,
          spec.width,
          spec.height,
          4
        );
        obstacleGraphics.lineStyle(2, spec.strokeColor, 0.9);
        obstacleGraphics.strokeRoundedRect(
          spec.x,
          spec.y,
          spec.width,
          spec.height,
          4
        );
      }

      const colliderRect = this.add.rectangle(
        centerX,
        centerY,
        spec.width,
        spec.height,
        spec.fillColor,
        0
      );
      colliderRect.setData('spec', spec);
      this.physics.add.existing(colliderRect, true);
      this.staticColliderGroup.add(colliderRect);

      if (spec.unlocksOnCheckIn) {
        this.cashierGateColliderObj = colliderRect;
      }
    }
  }

  // ===========================================================================
  // DEBUG HITBOX & VECTOR OVERLAY
  // ===========================================================================

  private renderDebugOverlay(): void {
    if (!this.debugGraphic) return;
    this.debugGraphic.clear();

    if (!this.showHitboxes) return;

    for (const spec of ARENA_CONFIG.colliders) {
      if (spec.unlocksOnCheckIn && this.hasCheckedInAtCashier) continue;

      const color =
        spec.category === 'u-island'
          ? 0x00f0ff
          : spec.category === 'sluice-pillar'
          ? 0x39ff14
          : spec.category === 'rink-barrier'
          ? 0x22d3ee
          : 0xfacc15;

      this.debugGraphic.lineStyle(1.5, color, 0.92);
      this.debugGraphic.strokeRect(spec.x, spec.y, spec.width, spec.height);
      this.debugGraphic.fillStyle(color, 0.16);
      this.debugGraphic.fillRect(spec.x, spec.y, spec.width, spec.height);
    }

    if (this.skater) {
      const sx = this.skater.container.x;
      const sy = this.skater.container.y;
      const vx = this.skater.body.velocity.x;
      const vy = this.skater.body.velocity.y;
      const headingRad = this.skater.container.rotation;

      this.debugGraphic.lineStyle(2, 0x39ff14, 1);
      this.debugGraphic.strokeCircle(sx, sy, this.skater.radius);

      this.debugGraphic.lineStyle(2, 0x00f0ff, 0.95);
      this.debugGraphic.lineBetween(
        sx,
        sy,
        sx + Math.cos(headingRad) * 55,
        sy + Math.sin(headingRad) * 55
      );

      this.debugGraphic.lineStyle(2.5, 0xf59e0b, 0.95);
      this.debugGraphic.lineBetween(sx, sy, sx + vx * 0.25, sy + vy * 0.25);
    }
  }
}
