import Phaser from 'phaser';
import { PlayerCharacterMode, SkaterPhysicsConfig } from '../config/arenaConfig';
import { soundFX } from '../utils/soundEffects';

export interface SkaterTelemetry {
  x: number;
  y: number;
  speed: number;
  headingDeg: number;
  velocityAngleDeg: number;
  driftAngleDeg: number;
  isDrifting: boolean;
  isSpinning360: boolean;
  isAccelerating: boolean;
  isBraking: boolean;
  collisionCount: number;
  characterMode: PlayerCharacterMode;
  playerName: string;
  isSlushBoostActive: boolean;
  slushBoostRemainingSec: number;
  inSlushTriggerZone: boolean;
  inCashierTriggerZone: boolean;
}

interface DriftTrailSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  color: number;
  width: number;
  isIceBoost: boolean;
}

interface IceCrystalSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: number;
}

/**
 * 2.5D Player Controller supporting both Wheelchair (WCMX) & Roller-Skater modes,
 * inertial drift physics, 360° spins on the spot, bobbing Retro-Pixel Nametag,
 * and 8-second Slush-Puppie Speed-Lines & Neon-Ice Trail.
 */
export class SkaterController {
  private scene: Phaser.Scene;
  private config: SkaterPhysicsConfig;

  public container: Phaser.GameObjects.Container;
  public body: Phaser.Physics.Arcade.Body;

  private skaterGraphic: Phaser.GameObjects.Graphics;
  private trailGraphic: Phaser.GameObjects.Graphics;
  private nameTagContainer: Phaser.GameObjects.Container;
  private nameTagBg: Phaser.GameObjects.Graphics;
  private nameTagText: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private keyQ!: Phaser.Input.Keyboard.Key;

  private headingRad: number = 0;
  private currentDriftAngleDeg: number = 0;
  private isDriftingState: boolean = false;
  private isAcceleratingState: boolean = false;
  private isBrakingState: boolean = false;
  private visualLeanRad: number = 0;
  private wheelPushPhase: number = 0;
  public collisionCount: number = 0;

  // 360° Spin state
  private spin360ProgressRad: number = 0;
  private isSpinning360: boolean = false;

  // Character mode & NameTag
  public characterMode: PlayerCharacterMode = 'wheelchair';
  public playerName: string = 'GAST #86';

  // Slush-Puppie 8s Boost State
  private slushBoostRemainingMs: number = 0;
  private slushSpeedMultiplier: number = 1.25;
  private slushAgilityMultiplier: number = 1.32;
  public inSlushTriggerZone: boolean = false;
  public inCashierTriggerZone: boolean = false;

  private prevLeftWheelPos: { x: number; y: number } | null = null;
  private prevRightWheelPos: { x: number; y: number } | null = null;
  private trailSegments: DriftTrailSegment[] = [];
  private iceSparks: IceCrystalSpark[] = [];
  private trailHueIndex: number = 0;

  public readonly radius = 17;

  constructor(
    scene: Phaser.Scene,
    spawnX: number,
    spawnY: number,
    spawnAngleDeg: number,
    initialConfig: SkaterPhysicsConfig
  ) {
    this.scene = scene;
    this.config = { ...initialConfig };
    this.headingRad = Phaser.Math.DegToRad(spawnAngleDeg);

    // 1. Floor trail layer underneath the player
    this.trailGraphic = this.scene.add.graphics();
    this.trailGraphic.setDepth(12);

    // 2. Player 2.5D sprite container (rotates with heading + 360° spin)
    this.skaterGraphic = this.scene.add.graphics();
    this.container = this.scene.add.container(spawnX, spawnY, [this.skaterGraphic]);
    this.container.setDepth(26);

    // 3. Floating Retro-Pixel Nametag (independent of player rotation so text is always upright!)
    this.nameTagBg = this.scene.add.graphics();
    this.nameTagText = this.scene.add
      .text(0, 0, this.playerName, {
        fontFamily: '"Silkscreen", "JetBrains Mono", monospace',
        fontSize: '10px',
        color: '#39FF14',
        stroke: '#050811',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.nameTagContainer = this.scene.add.container(spawnX, spawnY - 32, [
      this.nameTagBg,
      this.nameTagText,
    ]);
    this.nameTagContainer.setDepth(34);
    this.redrawNameTagBadge();

    // 4. Arcade Physics Circular Hitbox
    this.scene.physics.world.enable(this.container);
    this.body = this.container.body as Phaser.Physics.Arcade.Body;
    this.body.setCircle(this.radius, -this.radius, -this.radius);
    this.body.setBounce(this.config.wallBounce, this.config.wallBounce);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxSpeed(this.config.maxSpeed * 1.4);

    this.setupKeyboardInputs();
    this.drawPlayerVisual(0, false, false, false, 0);
  }

  private setupKeyboardInputs(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.keyW = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W, false);
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A, false);
    this.keyS = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S, false);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D, false);
    this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.keyShift = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    this.keyQ = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q, false);

    this.keyQ.on('down', () => {
      if (!this.isInputFocusedInDom()) {
        this.trigger360Spin();
      }
    });
  }

  private isInputFocusedInDom(): boolean {
    const active = document.activeElement;
    return (
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    );
  }

  public setPlayerName(name: string): void {
    const cleaned = name.trim().slice(0, 18);
    this.playerName = cleaned.length > 0 ? cleaned.toUpperCase() : 'PALLADIUM VIP';
    this.nameTagText.setText(`★ ${this.playerName}`);
    this.nameTagText.setColor('#00F0FF');
    this.redrawNameTagBadge();
  }

  public setCharacterMode(mode: PlayerCharacterMode): void {
    this.characterMode = mode;
  }

  public toggleCharacterMode(): PlayerCharacterMode {
    this.characterMode =
      this.characterMode === 'wheelchair' ? 'skater' : 'wheelchair';
    return this.characterMode;
  }

  public trigger360Spin(): void {
    if (this.isSpinning360) return;
    this.isSpinning360 = true;
    this.spin360ProgressRad = 0;
    soundFX.playSpin360();
  }

  private redrawNameTagBadge(): void {
    this.nameTagBg.clear();
    const w = Math.max(54, this.nameTagText.width + 14);
    const h = 18;
    this.nameTagBg.fillStyle(0x090d16, 0.86);
    this.nameTagBg.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    this.nameTagBg.lineStyle(1.5, 0x39ff14, 0.9);
    this.nameTagBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
  }

  public activateSlushBoost(
    durationMs: number = 8000,
    speedMultiplier: number = 1.25,
    agilityMultiplier: number = 1.32
  ): void {
    this.slushBoostRemainingMs = durationMs;
    this.slushSpeedMultiplier = speedMultiplier;
    this.slushAgilityMultiplier = agilityMultiplier;

    soundFX.playSlushBoost();

    const forwardX = Math.cos(this.headingRad);
    const forwardY = Math.sin(this.headingRad);
    const currentSpeed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    const boostKick = Math.max(currentSpeed, this.config.maxSpeed * 0.78);
    this.body.setVelocity(forwardX * boostKick, forwardY * boostKick);
  }

  public updatePhysicsConfig(newConfig: SkaterPhysicsConfig): void {
    this.config = { ...newConfig };
    this.body.setBounce(this.config.wallBounce, this.config.wallBounce);
    this.body.setMaxSpeed(this.config.maxSpeed * 1.4);
  }

  public respawn(x: number, y: number, angleDeg: number): void {
    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.headingRad = Phaser.Math.DegToRad(angleDeg);
    this.currentDriftAngleDeg = 0;
    this.isDriftingState = false;
    this.isSpinning360 = false;
    this.spin360ProgressRad = 0;
    this.prevLeftWheelPos = null;
    this.prevRightWheelPos = null;
  }

  public clearTrails(): void {
    this.trailSegments = [];
    this.iceSparks = [];
    this.trailGraphic.clear();
  }

  public registerBarrierCollision(): void {
    this.collisionCount += 1;
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.hypot(vx, vy);
    if (speed > 45) {
      const bounceAngle = Math.atan2(vy, vx);
      this.headingRad = Phaser.Math.Angle.RotateTo(this.headingRad, bounceAngle, 0.35);
    }
  }

  public update(timeMs: number, dtSeconds: number): void {
    const dt = Math.min(dtSeconds, 0.05);

    if (this.slushBoostRemainingMs > 0) {
      this.slushBoostRemainingMs = Math.max(0, this.slushBoostRemainingMs - dt * 1000);
    }
    const isBoostActive = this.slushBoostRemainingMs > 0;
    const effectiveMaxSpeed =
      this.config.maxSpeed * (isBoostActive ? this.slushSpeedMultiplier : 1.0);
    const effectiveAcceleration =
      this.config.acceleration * (isBoostActive ? this.slushSpeedMultiplier : 1.0);
    const effectiveTurnSpeed =
      this.config.turnSpeed * (isBoostActive ? this.slushAgilityMultiplier : 1.0);

    // Disable movement keys while typing name into Cashier modal input
    const inputBlocked = this.isInputFocusedInDom();

    const up =
      !inputBlocked && ((this.cursors?.up?.isDown || this.keyW?.isDown) ?? false);
    const down =
      !inputBlocked && ((this.cursors?.down?.isDown || this.keyS?.isDown) ?? false);
    const left =
      !inputBlocked && ((this.cursors?.left?.isDown || this.keyA?.isDown) ?? false);
    const right =
      !inputBlocked && ((this.cursors?.right?.isDown || this.keyD?.isDown) ?? false);
    const driftKey =
      !inputBlocked && ((this.keySpace?.isDown || this.keyShift?.isDown) ?? false);

    // Trigger a 360° spin on the spot if pressing Space while nearly stationary
    const currentSpeedBefore = Math.hypot(this.body.velocity.x, this.body.velocity.y);
    if (driftKey && currentSpeedBefore < 45 && !this.isSpinning360) {
      this.trigger360Spin();
    }

    // Update 360° spin animation
    if (this.isSpinning360) {
      this.spin360ProgressRad += dt * Math.PI * 5.2; // Full 360° spin in ~0.38s
      if (this.spin360ProgressRad >= Math.PI * 2) {
        this.spin360ProgressRad = 0;
        this.isSpinning360 = false;
      }
    }

    const turnInput = (left ? -1 : 0) + (right ? 1 : 0);

    const turnRateRad = Phaser.Math.DegToRad(
      effectiveTurnSpeed * (driftKey ? this.config.driftTurnMultiplier : 1.0)
    );
    this.headingRad = Phaser.Math.Angle.Wrap(
      this.headingRad + turnInput * turnRateRad * dt
    );

    const targetLean = turnInput * (driftKey ? 0.4 : 0.24);
    this.visualLeanRad = Phaser.Math.Linear(this.visualLeanRad, targetLean, 12 * dt);

    const forwardX = Math.cos(this.headingRad);
    const forwardY = Math.sin(this.headingRad);
    const rightX = -forwardY;
    const rightY = forwardX;

    let vx = this.body.velocity.x;
    let vy = this.body.velocity.y;

    let forwardSpeed = vx * forwardX + vy * forwardY;
    let lateralSpeed = vx * rightX + vy * rightY;

    this.isAcceleratingState = up;
    this.isBrakingState = down;

    if (up) {
      forwardSpeed += effectiveAcceleration * dt;
      this.wheelPushPhase += dt * (9 + Math.min(forwardSpeed / 50, 8));
    } else if (down) {
      if (forwardSpeed > 25) {
        forwardSpeed = Math.max(
          0,
          forwardSpeed - this.config.reverseAcceleration * 1.45 * dt
        );
      } else {
        forwardSpeed = Math.max(
          -effectiveMaxSpeed * 0.45,
          forwardSpeed - this.config.reverseAcceleration * 0.8 * dt
        );
      }
      this.wheelPushPhase -= dt * 6;
    } else if (Math.abs(forwardSpeed) > 10) {
      this.wheelPushPhase += dt * (forwardSpeed / 85);
    }

    const frameScale = dt * 60;
    const forwardRetention = Math.pow(1 - this.config.forwardDrag, frameScale);
    forwardSpeed *= forwardRetention;

    const baseDriftGrip = isBoostActive
      ? this.config.driftLateralGrip * 0.8
      : this.config.driftLateralGrip;
    const activeLateralGrip = driftKey ? baseDriftGrip : this.config.normalLateralGrip;

    const lateralRetention = Math.pow(1 - activeLateralGrip, frameScale);
    lateralSpeed *= lateralRetention;

    if (!driftKey && Math.abs(lateralSpeed) > 8 && forwardSpeed > 0) {
      const recovered = Math.abs(lateralSpeed) * activeLateralGrip * 0.24 * frameScale;
      forwardSpeed = Math.min(effectiveMaxSpeed, forwardSpeed + recovered);
    }

    vx = forwardSpeed * forwardX + lateralSpeed * rightX;
    vy = forwardSpeed * forwardY + lateralSpeed * rightY;

    const totalSpeed = Math.hypot(vx, vy);
    if (totalSpeed > effectiveMaxSpeed) {
      const scale = effectiveMaxSpeed / totalSpeed;
      vx *= scale;
      vy *= scale;
    } else if (totalSpeed < 2 && !up && !down) {
      vx = 0;
      vy = 0;
    }

    this.body.setVelocity(vx, vy);

    if (totalSpeed > 35) {
      const velAngle = Math.atan2(vy, vx);
      const diffRad = Phaser.Math.Angle.Wrap(velAngle - this.headingRad);
      this.currentDriftAngleDeg = Math.abs(Phaser.Math.RadToDeg(diffRad));
    } else {
      this.currentDriftAngleDeg = 0;
    }

    this.isDriftingState =
      totalSpeed > 68 && (driftKey || this.currentDriftAngleDeg > 17);

    // Apply visual rotation (heading + 360° spin offset)
    const visualHeading = this.headingRad + this.spin360ProgressRad;
    this.container.setRotation(visualHeading);

    // Update floating Retro-Pixel Nametag position with rhythmic bobbing
    const bobOffset = Math.sin(timeMs * 0.007) * 2.8;
    this.nameTagContainer.setPosition(
      this.container.x,
      this.container.y - 31 + bobOffset
    );

    this.updateWheelTrails(
      Math.cos(visualHeading),
      Math.sin(visualHeading),
      -Math.sin(visualHeading),
      Math.cos(visualHeading),
      totalSpeed,
      isBoostActive,
      dt
    );
    this.drawPlayerVisual(
      totalSpeed,
      this.isDriftingState,
      up,
      isBoostActive,
      timeMs
    );
  }

  private updateWheelTrails(
    forwardX: number,
    forwardY: number,
    rightX: number,
    rightY: number,
    speed: number,
    isBoostActive: boolean,
    dt: number
  ): void {
    const cx = this.container.x;
    const cy = this.container.y;

    const wheelSpan = this.characterMode === 'wheelchair' ? 13.5 : 10.5;
    const leftWheelX = cx - forwardX * 3 - rightX * wheelSpan;
    const leftWheelY = cy - forwardY * 3 - rightY * wheelSpan;
    const rightWheelX = cx - forwardX * 3 + rightX * wheelSpan;
    const rightWheelY = cy - forwardY * 3 + rightY * wheelSpan;

    const shouldEmitTrail =
      (this.isDriftingState ||
        this.isSpinning360 ||
        (isBoostActive && speed > 20)) &&
      this.prevLeftWheelPos &&
      this.prevRightWheelPos;

    if (shouldEmitTrail && this.prevLeftWheelPos && this.prevRightWheelPos) {
      // Rainbow / Neon Ice palette during Slush-Puppie Boost
      const iceColors = [0x00f0ff, 0x38bdf8, 0x39ff14, 0xff2a85, 0xfde047];
      this.trailHueIndex = (this.trailHueIndex + 1) % iceColors.length;

      const leftColor = isBoostActive
        ? 0x00f0ff
        : this.isSpinning360
        ? 0x39ff14
        : this.currentDriftAngleDeg > 30
        ? 0xec4899
        : 0x06b6d4;
      const rightColor = isBoostActive
        ? iceColors[this.trailHueIndex]
        : leftColor;

      this.trailSegments.push(
        {
          x1: this.prevLeftWheelPos.x,
          y1: this.prevLeftWheelPos.y,
          x2: leftWheelX,
          y2: leftWheelY,
          alpha: isBoostActive ? 0.92 : Math.min(0.68, speed / 480 + 0.2),
          color: leftColor,
          width: isBoostActive ? 4.6 : 2.6,
          isIceBoost: isBoostActive,
        },
        {
          x1: this.prevRightWheelPos.x,
          y1: this.prevRightWheelPos.y,
          x2: rightWheelX,
          y2: rightWheelY,
          alpha: isBoostActive ? 0.92 : Math.min(0.68, speed / 480 + 0.2),
          color: rightColor,
          width: isBoostActive ? 4.6 : 2.6,
          isIceBoost: isBoostActive,
        }
      );

      if (isBoostActive && Math.random() < 0.72) {
        this.iceSparks.push({
          x: cx - forwardX * 12 + (Math.random() - 0.5) * 20,
          y: cy - forwardY * 12 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 48,
          vy: (Math.random() - 0.5) * 48,
          alpha: 0.96,
          size: 2 + Math.random() * 2.5,
          color: iceColors[Math.floor(Math.random() * iceColors.length)],
        });
      }

      if (this.trailSegments.length > 360) {
        this.trailSegments.splice(0, 2);
      }
    }

    this.prevLeftWheelPos = { x: leftWheelX, y: leftWheelY };
    this.prevRightWheelPos = { x: rightWheelX, y: rightWheelY };

    this.trailGraphic.clear();

    for (let i = this.trailSegments.length - 1; i >= 0; i--) {
      const seg = this.trailSegments[i];
      seg.alpha -= dt * (seg.isIceBoost ? 0.17 : 0.28);
      if (seg.alpha <= 0.02) {
        this.trailSegments.splice(i, 1);
        continue;
      }
      if (seg.isIceBoost) {
        this.trailGraphic.lineStyle(seg.width + 3.5, 0x00f0ff, seg.alpha * 0.32);
        this.trailGraphic.beginPath();
        this.trailGraphic.moveTo(seg.x1, seg.y1);
        this.trailGraphic.lineTo(seg.x2, seg.y2);
        this.trailGraphic.strokePath();
      }
      this.trailGraphic.lineStyle(seg.width, seg.color, seg.alpha);
      this.trailGraphic.beginPath();
      this.trailGraphic.moveTo(seg.x1, seg.y1);
      this.trailGraphic.lineTo(seg.x2, seg.y2);
      this.trailGraphic.strokePath();
    }

    for (let i = this.iceSparks.length - 1; i >= 0; i--) {
      const sp = this.iceSparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.alpha -= dt * 0.85;
      if (sp.alpha <= 0.03) {
        this.iceSparks.splice(i, 1);
        continue;
      }
      this.trailGraphic.fillStyle(sp.color, sp.alpha);
      this.trailGraphic.fillCircle(sp.x, sp.y, sp.size);
    }
  }

  private drawPlayerVisual(
    speed: number,
    isDrifting: boolean,
    isAccelerating: boolean,
    isBoostActive: boolean,
    timeMs: number
  ): void {
    const g = this.skaterGraphic;
    g.clear();

    const leanY = this.visualLeanRad * 9;

    // 1. 2.5D Drop Shadow on Parquet
    g.fillStyle(0x000000, 0.42);
    g.fillEllipse(-2, 4, 34, 30);

    // 2. Under-player neon aura glow
    const glowColor = isBoostActive
      ? 0x00f0ff
      : this.isSpinning360
      ? 0x39ff14
      : isDrifting
      ? 0xec4899
      : 0x06b6d4;
    g.fillStyle(glowColor, isBoostActive ? 0.4 : isDrifting ? 0.28 : 0.16);
    g.fillCircle(0, 0, this.radius + (isBoostActive ? 8 : isDrifting ? 5 : 2));

    // 3. Animated Speed-Lines when Slush-Puppie Boost is active
    if (isBoostActive) {
      g.lineStyle(2, 0x00f0ff, 0.85);
      const streakOffset = ((timeMs * 0.06) % 12);
      g.lineBetween(-16 - streakOffset, -14, -28 - streakOffset, -14);
      g.lineBetween(-18 - streakOffset, 0, -32 - streakOffset, 0);
      g.lineBetween(-16 - streakOffset, 14, -28 - streakOffset, 14);
    }

    if (this.characterMode === 'wheelchair') {
      // =======================================================================
      // MODE A: SPORTLICHER ROLLSTUHL-SKATER (WCMX / Retro Wheelchair)
      // =======================================================================
      const pushOffset = Math.sin(this.wheelPushPhase) * 2.5;

      // Front footplate / bumper bar (+X forward)
      g.lineStyle(2.5, 0x94a3b8, 1);
      g.strokeRoundedRect(6, -8, 9, 16, 3);
      g.fillStyle(0x334155, 1);
      g.fillRoundedRect(8, -6, 6, 12, 2);

      // Cambered Sport Wheelchair Main Wheels (Left & Right) with Neon Rim LEDs
      const wheelColor = isBoostActive
        ? 0x00f0ff
        : isDrifting
        ? 0xf472b6
        : 0x39ff14;

      // Left main wheel & hand-rim
      g.fillStyle(0x0f172a, 1);
      g.fillRoundedRect(-11, -16, 18, 4.5, 2);
      g.lineStyle(2, wheelColor, 1);
      g.strokeRoundedRect(-11, -16, 18, 4.5, 2);
      // Animated spoke / LED flash on wheel
      g.fillStyle(0xf8fafc, 0.9);
      g.fillCircle(-2 + pushOffset, -13.8, 1.5);

      // Right main wheel & hand-rim
      g.fillStyle(0x0f172a, 1);
      g.fillRoundedRect(-11, 11.5, 18, 4.5, 2);
      g.lineStyle(2, wheelColor, 1);
      g.strokeRoundedRect(-11, 11.5, 18, 4.5, 2);
      g.fillStyle(0xf8fafc, 0.9);
      g.fillCircle(-2 - pushOffset, 13.8, 1.5);

      // Seat Frame & Backrest
      g.fillStyle(0x1e293b, 1);
      g.lineStyle(1.5, 0x38bdf8, 0.9);
      g.fillRoundedRect(-10, -11, 16, 22, 4);
      g.strokeRoundedRect(-10, -11, 16, 22, 4);
      // Padded backrest bar
      g.fillStyle(0xec4899, 1);
      g.fillRoundedRect(-12, -10, 4, 20, 2);

      // Rider Torso & Pushing Arms
      g.fillStyle(isBoostActive ? 0x083344 : 0x3b0764, 1);
      g.lineStyle(2, isBoostActive ? 0x00f0ff : 0x39ff14, 1);
      g.fillRoundedRect(-6, -10 + leanY, 13, 20, 6);
      g.strokeRoundedRect(-6, -10 + leanY, 13, 20, 6);

      // Rider Hands gripping the wheels
      g.fillStyle(0xfde047, 1);
      g.fillCircle(-1 + pushOffset, -11.5, 3);
      g.fillCircle(-1 - pushOffset, 11.5, 3);
    } else {
      // =======================================================================
      // MODE B: KLASSISCHER QUAD-ROLLSCHUH-SKATER
      // =======================================================================
      const strideOffset = isAccelerating ? Math.sin(this.wheelPushPhase) * 3.5 : 0;
      const leftSkateX = -2 + strideOffset;
      const leftSkateY = -10 + leanY * 0.5;
      const rightSkateX = -2 - strideOffset;
      const rightSkateY = 10 + leanY * 0.5;

      const wheelColor = isBoostActive
        ? 0x00f0ff
        : isDrifting
        ? 0xf472b6
        : 0x39ff14;
      g.fillStyle(wheelColor, 1);
      g.fillRect(leftSkateX - 6, leftSkateY - 4, 4, 2);
      g.fillRect(leftSkateX + 3, leftSkateY - 4, 4, 2);
      g.fillRect(leftSkateX - 6, leftSkateY + 2, 4, 2);
      g.fillRect(leftSkateX + 3, leftSkateY + 2, 4, 2);

      g.fillRect(rightSkateX - 6, rightSkateY - 4, 4, 2);
      g.fillRect(rightSkateX + 3, rightSkateY - 4, 4, 2);
      g.fillRect(rightSkateX - 6, rightSkateY + 2, 4, 2);
      g.fillRect(rightSkateX + 3, rightSkateY + 2, 4, 2);

      g.fillStyle(0xf8fafc, 1);
      g.fillRoundedRect(leftSkateX - 7, leftSkateY - 2.5, 15, 5, 2);
      g.fillRoundedRect(rightSkateX - 7, rightSkateY - 2.5, 15, 5, 2);

      g.fillStyle(isBoostActive ? 0x083344 : 0x0f172a, 1);
      g.lineStyle(2, isBoostActive ? 0x00f0ff : isDrifting ? 0xec4899 : 0x38bdf8, 1);
      g.fillRoundedRect(-8, -12 + leanY, 16, 24, 7);
      g.strokeRoundedRect(-8, -12 + leanY, 16, 24, 7);
    }

    // Rider Head, Retro Headband & Visor facing +X
    g.fillStyle(0xf8fafc, 1);
    g.fillCircle(2, leanY, 7.2);
    // Neon 80s Sweatband / Visor
    g.fillStyle(isBoostActive ? 0x00f0ff : 0x39ff14, 1);
    g.beginPath();
    g.arc(3.5, leanY, 5.8, -0.85, 0.85, false);
    g.fillPath();

    // Forward direction chevron
    const chevronAlpha = Math.min(0.95, 0.35 + speed / 600);
    g.lineStyle(
      2,
      isBoostActive ? 0x00f0ff : isDrifting ? 0xf43f5e : 0x39ff14,
      chevronAlpha
    );
    g.beginPath();
    g.moveTo(17, -5);
    g.lineTo(23, 0);
    g.lineTo(17, 5);
    g.strokePath();
  }

  public getTelemetry(): SkaterTelemetry {
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.hypot(vx, vy);
    const velocityAngleDeg =
      speed > 5
        ? Phaser.Math.RadToDeg(Math.atan2(vy, vx))
        : Phaser.Math.RadToDeg(this.headingRad);

    return {
      x: Math.round(this.container.x),
      y: Math.round(this.container.y),
      speed: Math.round(speed),
      headingDeg: Math.round(Phaser.Math.RadToDeg(this.headingRad)),
      velocityAngleDeg: Math.round(velocityAngleDeg),
      driftAngleDeg: Math.round(this.currentDriftAngleDeg),
      isDrifting: this.isDriftingState,
      isSpinning360: this.isSpinning360,
      isAccelerating: this.isAcceleratingState,
      isBraking: this.isBrakingState,
      collisionCount: this.collisionCount,
      characterMode: this.characterMode,
      playerName: this.playerName,
      isSlushBoostActive: this.slushBoostRemainingMs > 0,
      slushBoostRemainingSec: Math.ceil(this.slushBoostRemainingMs / 100) / 10,
      inSlushTriggerZone: this.inSlushTriggerZone,
      inCashierTriggerZone: this.inCashierTriggerZone,
    };
  }
}
