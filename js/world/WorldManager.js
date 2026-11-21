/**
 * NULAR Living Archipelago — WorldManager (js/world/WorldManager.js)
 * Top-level playable cultural world orchestrator connecting all modular runtime systems.
 */
import { GameScene } from './GameScene.js';
import { InputManager } from './InputManager.js';
import { CollisionManager } from './CollisionManager.js';
import { CharacterController } from './CharacterController.js';
import { PlayerController } from './PlayerController.js';
import { CameraController } from './CameraController.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { SceneStreamingManager } from './SceneStreamingManager.js';
import { InteractionManager } from './InteractionManager.js';
import { ExplorationState } from './ExplorationState.js';
import { WorldNavigation } from './WorldNavigation.js';
import { CulturalPavilionManager } from './CulturalPavilionManager.js';
import { VehicleManager } from './VehicleManager.js';

export class WorldManager {
  constructor({ canvas, joystickBase, joystickKnob, houses, textiles, callbacks = {} }) {
    this.houses = houses;
    this.textiles = textiles;
    this.callbacks = callbacks;

    this.gameScene = new GameScene(canvas);
    this.input = new InputManager(canvas, { joystickBase, joystickKnob });
    this.collision = new CollisionManager();
    this.character = new CharacterController(this.gameScene.scene);
    this.player = new PlayerController(this.gameScene.scene, this.collision, this.character);
    this.cameraCtrl = new CameraController(this.gameScene.camera);
    this.environment = new EnvironmentManager(this.gameScene);
    this.streaming = new SceneStreamingManager(this.gameScene, this.collision);
    this.interaction = new InteractionManager(this.gameScene.scene);
    this.exploration = new ExplorationState();
    this.navigation = new WorldNavigation(this.gameScene, this.collision, this.interaction);
    this.pavilions = new CulturalPavilionManager(this.gameScene, this.interaction);
    this.vehicles = new VehicleManager(this.gameScene, this.collision, this.interaction);

    this.mode = 'hub'; // 'hub' | 'house'
    this.activeHouse = null;
    this.activeManifest = null;
    this.manualRoofCutaway = false;
    this.lastNearestId = null;
    this.lastZoneId = null;
    this.running = false;
    this.rafId = null;
    this.lastTime = 0;
  }

  async init(initialHouseId = null) {
    this.applySavedSettings();
    const savedAvatar = this.exploration.getSelectedAvatar();
    await this.character.loadAvatar(savedAvatar);
    try {
      const custom = JSON.parse(localStorage.getItem('nular_avatar_custom_v1') || 'null');
      if (custom) this.character.setCustomization(custom);
    } catch {}

    if (initialHouseId) {
      const target = this.houses.find((h) => h.id === initialHouseId);
      if (target) await this.enterHouse(target.id);
      else await this.enterHub();
    } else {
      await this.enterHub();
    }

    this.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  async enterHub() {
    this.mode = 'hub';
    this.activeHouse = null;
    this.activeManifest = null;
    this.manualRoofCutaway = false;
    this.streaming.unloadActiveScene();
    this.interaction.clear();

    const biome = this.environment.buildRegionEnvironment('Hub');
    this.navigation.mountHubPlaza(this.streaming.activeWorldGroup);
    await this.pavilions.mountPavilions('hub', 'Hub');
    this.vehicles.mountVehicles('Hub');
    this.player.setInteriorZones([]);
    this.player.setSpawn([0, 0.05, 8.2], Math.PI);
    this.cameraCtrl.resetBehind(this.player.position, this.player.yaw);
    this.character.playOneShot('Wave', 1.3);

    this.callbacks.onLocationChange?.({
      mode: 'hub',
      house: null,
      room: 'Alun-Alun Utama Nusantara',
      biome: biome.label
    });
  }

  async enterHouse(houseId) {
    const house = this.houses.find((h) => h.id === houseId);
    if (!house) throw new Error(`House not found: ${houseId}`);

    this.callbacks.onLoading?.(true, house.houseName);
    this.navigation.unmountHubPlaza(this.streaming.activeWorldGroup);

    const biome = this.environment.buildRegionEnvironment(house.island);
    const manifest = await this.streaming.loadHouseScene(house);

    this.mode = 'house';
    this.activeHouse = house;
    this.activeManifest = manifest;
    this.manualRoofCutaway = false;

    this.player.setInteriorZones(manifest.interiorZones || []);
    this.player.setSpawn(manifest.spawnPoint || [0, 0.05, 8.5], Math.PI);
    this.cameraCtrl.resetBehind(this.player.position, this.player.yaw);
    this.interaction.registerHouseInteractables(house, manifest);
    await this.pavilions.mountPavilions('house', house.island);
    this.vehicles.mountVehicles(house.island);
    this.exploration.recordHouseVisit(house.id);

    this.callbacks.onLoading?.(false, house.houseName);
    this.callbacks.onLocationChange?.({
      mode: 'house',
      house,
      room: 'Halaman Eksterior',
      biome: biome.label,
      mission: this.exploration.getMissionStatus(house.id, (house.hotspots || []).length)
    });
  }

  async switchAvatar(outfitId) {
    const res = await this.character.loadAvatar(outfitId);
    this.exploration.setSelectedAvatar(outfitId);
    this.character.playOneShot('Wave', 1.2);
    return res;
  }

  applySavedSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('nular_world_settings_v1') || '{}');
      this.cameraCtrl.applySettings(s);
      if (s.qualityProfile) this.gameScene.setQualityProfile(s.qualityProfile);
      else this.gameScene.setQualityProfile('auto');
      this.character.setVisible(this.cameraCtrl.mode !== 'first-person' || this.cameraCtrl.showBodyFirstPerson);
    } catch {}
  }

  setCameraMode(mode) {
    this.cameraCtrl.setMode(mode, this.player.position);
    this.character.setVisible(mode !== 'first-person' || this.cameraCtrl.showBodyFirstPerson);
    try {
      const s = JSON.parse(localStorage.getItem('nular_world_settings_v1') || '{}');
      localStorage.setItem('nular_world_settings_v1', JSON.stringify({ ...s, cameraMode: mode }));
    } catch {}
    this.callbacks.onCameraModeChange?.(mode);
    return mode;
  }

  cycleCameraMode() {
    const order = ['third-person', 'first-person', 'free-explore'];
    const idx = order.indexOf(this.cameraCtrl.mode);
    return this.setCameraMode(order[(idx + 1) % order.length]);
  }

  toggleRoofCutaway() {
    this.manualRoofCutaway = !this.manualRoofCutaway;
    return this.manualRoofCutaway;
  }

  mountVehicle(vehicleId) {
    const spec = this.vehicles.mount(vehicleId, this.player);
    if (spec) {
      this.callbacks.onVehicleChange?.(spec);
      window.dispatchEvent(new CustomEvent('nular:vehicle-mounted', { detail: spec }));
    }
    return spec;
  }

  dismountVehicle() {
    const ok = this.vehicles.dismount(this.player);
    if (ok) {
      this.callbacks.onVehicleChange?.(null);
      window.dispatchEvent(new CustomEvent('nular:vehicle-mounted', { detail: null }));
    }
    return ok;
  }

  getContextSnapshot() {
    return {
      mode: this.mode,
      houseId: this.activeHouse?.id || null,
      houseName: this.activeHouse?.houseName || 'Alun-Alun Nusantara',
      province: this.activeHouse?.province || 'Nusantara',
      roomName: this.player.currentZone?.name || (this.mode === 'hub' ? 'Alun-Alun Utama Nusantara' : 'Halaman Eksterior'),
      playerPosition: this.player.position.toArray().map((n) => Number(n.toFixed(2))),
      avatarId: this.character.currentOutfitId,
      roofCutaway: this.streaming.roofCutawayActive
    };
  }

  _loop(now) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.input.consumeAction('roofToggle')) {
      this.toggleRoofCutaway();
      this.callbacks.onRoofToggle?.(this.manualRoofCutaway);
    }

    if (this.input.consumeAction('cameraCycle')) {
      this.cycleCameraMode();
    }

    if (this.input.consumeAction('menu')) {
      this.callbacks.onToggleMenu?.();
    }

    let currentZone = null;
    if (this.vehicles.activeVehicle) {
      const vState = this.vehicles.update(dt, this.input, this.player);
      if (vState) this.callbacks.onVehicleTelemetry?.(vState);
      if (this.input.consumeAction('interact')) {
        this.dismountVehicle();
      }
    } else {
      const res = this.player.update(dt, this.input, this.cameraCtrl.yaw);
      currentZone = res.currentZone;
    }

    const isInside = Boolean(currentZone);
    this.cameraCtrl.update(dt, this.player.position, this.input, isInside, this.collision.walls);
    this.environment.update(dt);
    this.pavilions.update(dt);
    if (!this.vehicles.activeVehicle) this.vehicles.update(dt, this.input, null);

    // Automatically lift roof cutaway smoothly when inside interior OR manually toggled!
    this.streaming.updateRoofCutaway(dt, this.manualRoofCutaway || isInside);

    // Room change notification + discovery tracking
    const zoneId = currentZone?.id || 'exterior';
    if (this.mode === 'house' && zoneId !== this.lastZoneId) {
      this.lastZoneId = zoneId;
      if (currentZone && this.activeHouse) {
        this.exploration.recordRoomVisit(this.activeHouse.id, currentZone.id);
      }
      this.callbacks.onRoomChange?.({
        room: currentZone ? currentZone.name : 'Halaman Eksterior',
        isInside,
        mission: this.activeHouse ? this.exploration.getMissionStatus(this.activeHouse.id, (this.activeHouse.hotspots || []).length) : null
      });
    }

    // Proximity interactable update
    const nearest = this.interaction.update(dt, this.player.position);
    const nearId = nearest?.id || null;
    if (nearId !== this.lastNearestId) {
      this.lastNearestId = nearId;
      this.callbacks.onNearestInteractable?.(nearest);
    }

    if (!this.vehicles.activeVehicle && this.input.consumeAction('interact') && nearest) {
      if (nearest.kind === 'vehicle') {
        this.mountVehicle(nearest.payload.vehicleId);
      } else {
        this.character.playOneShot(nearest.kind === 'component' ? 'Point' : 'Interact', 1.0);
        if (nearest.kind === 'component' && this.activeHouse) {
          this.exploration.recordComponentInspected(this.activeHouse.id, nearest.id);
        }
        this.callbacks.onInteract?.(nearest, this.activeHouse ? this.exploration.getMissionStatus(this.activeHouse.id, (this.activeHouse.hotspots || []).length) : null);
      }
    }

    this.gameScene.render();
  }

  dispose() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.input.dispose();
    this.pavilions.clear();
    this.vehicles.clear();
    this.streaming.unloadActiveScene();
    this.gameScene.dispose();
  }
}
