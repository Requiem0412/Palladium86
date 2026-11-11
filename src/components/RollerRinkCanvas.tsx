import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import {
  ARENA_CONFIG,
  PlayerCharacterMode,
  SkaterPhysicsConfig,
} from '../config/arenaConfig';
import { CameraMode, RinkScene, SceneTelemetryPayload } from '../game/RinkScene';

interface RollerRinkCanvasProps {
  cameraMode: CameraMode;
  showHitboxes: boolean;
  characterMode: PlayerCharacterMode;
  checkedInName: string | null;
  checkInTrigger: number;
  spinTrigger: number;
  physicsConfig: SkaterPhysicsConfig;
  respawnTrigger: number;
  onTelemetryUpdate: (payload: SceneTelemetryPayload) => void;
}

export function RollerRinkCanvas({
  cameraMode,
  showHitboxes,
  characterMode,
  checkedInName,
  checkInTrigger,
  spinTrigger,
  physicsConfig,
  respawnTrigger,
  onTelemetryUpdate,
}: RollerRinkCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<RinkScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const telemetryCallbackRef = useRef(onTelemetryUpdate);

  useEffect(() => {
    telemetryCallbackRef.current = onTelemetryUpdate;
  }, [onTelemetryUpdate]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const rinkScene = new RinkScene((payload) => {
      telemetryCallbackRef.current(payload);
    });
    sceneRef.current = rinkScene;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: ARENA_CONFIG.world.width,
      height: ARENA_CONFIG.world.height,
      backgroundColor: '#070A12',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [rinkScene],
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.sys?.isActive()) {
      sceneRef.current.setCameraMode(cameraMode);
    }
  }, [cameraMode]);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.sys?.isActive()) {
      sceneRef.current.setShowHitboxes(showHitboxes);
    }
  }, [showHitboxes]);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.sys?.isActive()) {
      sceneRef.current.setCharacterMode(characterMode);
    }
  }, [characterMode]);

  useEffect(() => {
    if (
      checkInTrigger > 0 &&
      checkedInName &&
      sceneRef.current &&
      sceneRef.current.sys?.isActive()
    ) {
      sceneRef.current.completeCashierCheckIn(checkedInName);
    }
  }, [checkInTrigger, checkedInName]);

  useEffect(() => {
    if (spinTrigger > 0 && sceneRef.current && sceneRef.current.sys?.isActive()) {
      sceneRef.current.triggerPlayerSpin();
    }
  }, [spinTrigger]);

  useEffect(() => {
    if (sceneRef.current && sceneRef.current.sys?.isActive()) {
      sceneRef.current.updatePhysicsConfig(physicsConfig);
    }
  }, [physicsConfig]);

  useEffect(() => {
    if (respawnTrigger > 0 && sceneRef.current && sceneRef.current.sys?.isActive()) {
      sceneRef.current.respawnSkater();
    }
  }, [respawnTrigger]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden select-none"
      aria-label="Interaktive 1150x1550 2.5D Retro Rollschuh-Arena Palladium Hanau"
    />
  );
}
