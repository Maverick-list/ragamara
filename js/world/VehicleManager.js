/**
 * NULAR Living World — Arcade Transportation System (js/world/VehicleManager.js)
 * Implements 4 accessible exploration vehicles:
 *  1. Motorcycle ('motor')   — agile land riding with wheel spin & lean tilt
 *  2. Car ('mobil')          — expedition vehicle with 4-wheel spin & driving camera
 *  3. Boat ('perahu')        — traditional wooden Nusantara craft floating on waterways
 *  4. Airplane ('pesawat')   — accessible propeller plane with takeoff, altitude & landing
 */
import * as THREE from 'three';

export const VEHICLE_CATALOG = [
  { id: 'motor', name: 'Sepeda Motor Jelajah', icon: 'two_wheeler', kind: 'land', maxSpeed: 13.5, accel: 14, turnRate: 2.3, spawn: [-4.8, 0, 11.2] },
  { id: 'mobil', name: 'Mobil Ekspedisi NULAR', icon: 'directions_car', kind: 'land', maxSpeed: 16.0, accel: 11, turnRate: 1.85, spawn: [5.2, 0, 11.6] },
  { id: 'perahu', name: 'Perahu Layar Nusantara', icon: 'sailing', kind: 'water', maxSpeed: 12.0, accel: 8, turnRate: 1.45, spawn: [0, 0.08, 38.5] },
  { id: 'pesawat', name: 'Pesawat Perintis Nusantara', icon: 'flight', kind: 'air', maxSpeed: 24.0, accel: 12, turnRate: 1.5, spawn: [-16.5, 0, 13.0] }
];

export class VehicleManager {
  constructor(gameScene, collisionManager, interactionManager) {
    this.gameScene = gameScene;
    this.collision = collisionManager;
    this.interaction = interactionManager;

    this.group = new THREE.Group();
    this.group.name = 'WORLD_VEHICLES';
    this.gameScene.scene.add(this.group);

    this.vehicles = new Map(); // id -> { spec, root, wheels, propeller, speed, yaw, altitude, baseY }
    this.activeVehicleId = null;
    this._time = 0;

    // Lightweight procedural engine sound
    this._audioCtx = null;
    this._engineOsc = null;
    this._engineGain = null;
  }

  clear() {
    this.activeVehicleId = null;
    this._stopEngineAudio();
    this.vehicles.clear();
    while (this.group.children.length > 0) {
      const c = this.group.children[0];
      this.group.remove(c);
      this.gameScene.disposeObject(c);
    }
  }

  mountVehicles(islandKey = 'Hub') {
    this.clear();
    const hasWater = ['Hub', 'Kalimantan', 'Maluku'].includes(islandKey);

    for (const spec of VEHICLE_CATALOG) {
      // Boat spawns on water ring when region has water, or coastal dock edge
      const spawn = [...spec.spawn];
      if (spec.id === 'perahu' && !hasWater) {
        spawn[0] = 16.5;
        spawn[2] = 13.0;
      }

      const built = this._buildVehicleMesh(spec);
      built.root.position.set(spawn[0], spawn[1], spawn[2]);
      this.group.add(built.root);

      const entry = {
        spec,
        root: built.root,
        wheels: built.wheels,
        propeller: built.propeller,
        speed: 0,
        yaw: 0,
        altitude: spawn[1],
        pitch: 0,
        roll: 0
      };
      this.vehicles.set(spec.id, entry);

      this.interaction.addInteractable({
        id: `vehicle-${spec.id}`,
        x: spawn[0],
        y: spawn[1] + 0.1,
        z: spawn[2],
        radius: 3.2,
        label: `Naik ${spec.name} [F / E]`,
        kind: 'vehicle',
        payload: { vehicleId: spec.id, name: spec.name },
        color: 0x4aa894
      });
    }
  }

  _buildVehicleMesh(spec) {
    const root = new THREE.Group();
    root.name = `VEHICLE_${spec.id.toUpperCase()}`;
    const wheels = [];
    let propeller = null;

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.3, metalness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x89c2d9, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.75 });

    if (spec.id === 'motor') {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8f2d24, roughness: 0.45, metalness: 0.35 });
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 1.55), bodyMat);
      chassis.position.set(0, 0.56, 0);
      chassis.castShadow = true;
      root.add(chassis);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.72), wheelMat);
      seat.position.set(0, 0.84, 0.15);
      root.add(seat);

      const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), chromeMat);
      handlebar.rotation.z = Math.PI / 2;
      handlebar.position.set(0, 1.02, -0.58);
      root.add(handlebar);

      for (const wz of [-0.62, 0.62]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.16, 16), wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(0, 0.30, wz);
        w.castShadow = true;
        root.add(w);
        wheels.push(w);
      }
    } else if (spec.id === 'mobil') {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f4a38, roughness: 0.5, metalness: 0.25 });
      const goldTrim = new THREE.MeshStandardMaterial({ color: 0xc89d54, roughness: 0.4, metalness: 0.45 });

      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.62, 3.35), bodyMat);
      lower.position.set(0, 0.66, 0);
      lower.castShadow = true;
      root.add(lower);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.10, 3.36), goldTrim);
      stripe.position.set(0, 0.72, 0);
      root.add(stripe);

      const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.56, 0.08), glassMat);
      windshield.position.set(0, 1.24, -0.68);
      windshield.rotation.x = -0.25;
      root.add(windshield);

      for (const wx of [-0.88, 0.88]) {
        for (const wz of [-1.05, 1.05]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), wheelMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(wx, 0.36, wz);
          w.castShadow = true;
          root.add(w);
          wheels.push(w);
        }
      }
    } else if (spec.id === 'perahu') {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.78 });
      const sailMat = new THREE.MeshStandardMaterial({ color: 0xfaf3e3, roughness: 0.85, side: THREE.DoubleSide });

      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 3.8), woodMat);
      hull.position.set(0, 0.28, 0);
      hull.castShadow = true;
      root.add(hull);

      const prow = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.2, 4), woodMat);
      prow.rotation.x = -Math.PI / 2;
      prow.rotation.y = Math.PI / 4;
      prow.position.set(0, 0.36, -2.45);
      root.add(prow);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), woodMat);
      mast.position.set(0, 1.95, -0.2);
      root.add(mast);

      const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), sailMat);
      sail.position.set(0, 2.25, -0.05);
      sail.rotation.y = Math.PI / 2;
      root.add(sail);
    } else if (spec.id === 'pesawat') {
      const fuselageMat = new THREE.MeshStandardMaterial({ color: 0xf4eee1, roughness: 0.42, metalness: 0.2 });
      const accentMat = new THREE.MeshStandardMaterial({ color: 0xa54b34, roughness: 0.45, metalness: 0.3 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 3.8, 12), fuselageMat);
      body.rotation.x = Math.PI / 2;
      body.position.set(0, 0.95, 0);
      body.castShadow = true;
      root.add(body);

      const wings = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 1.15), accentMat);
      wings.position.set(0, 1.15, -0.25);
      wings.castShadow = true;
      root.add(wings);

      const tailWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.10, 0.55), accentMat);
      tailWing.position.set(0, 1.05, 1.72);
      root.add(tailWing);

      const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.95, 0.65), accentMat);
      tailFin.position.set(0, 1.48, 1.72);
      root.add(tailFin);

      const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), glassMat);
      cockpit.position.set(0, 1.24, -0.35);
      root.add(cockpit);

      propeller = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.10, 0.06), chromeMat);
      propeller.position.set(0, 0.95, -1.96);
      root.add(propeller);

      for (const wx of [-0.65, 0.65]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12), wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.24, -0.45);
        root.add(w);
        wheels.push(w);
      }
    }

    return { root, wheels, propeller };
  }

  get activeVehicle() {
    return this.activeVehicleId ? this.vehicles.get(this.activeVehicleId) : null;
  }

  mount(vehicleId, playerController) {
    const v = this.vehicles.get(vehicleId);
    if (!v) return null;
    this.activeVehicleId = vehicleId;
    if (playerController) {
      playerController.position.copy(v.root.position);
      playerController.position.y += 0.45;
      playerController.character.playAnimation('Sit');
    }
    this._startEngineAudio();
    return v.spec;
  }

  dismount(playerController) {
    const v = this.activeVehicle;
    if (!v) return false;
    v.speed = 0;
    if (v.spec.id === 'pesawat') {
      v.altitude = 0;
      v.root.position.y = 0;
      v.pitch = 0;
      v.roll = 0;
      v.root.rotation.set(0, v.yaw, 0);
    }
    if (playerController) {
      // Place player safely to the side of the vehicle
      const exitX = v.root.position.x + Math.cos(v.yaw) * 2.1;
      const exitZ = v.root.position.z - Math.sin(v.yaw) * 2.1;
      const clampedX = Math.max(-27, Math.min(27, exitX));
      const clampedZ = Math.max(-27, Math.min(27, exitZ));
      playerController.setSpawn([clampedX, 0.08, clampedZ], v.yaw);
    }
    this.activeVehicleId = null;
    this._stopEngineAudio();
    return true;
  }

  update(dt, input, playerController) {
    this._time += dt;

    // Gentle idle water bobbing for the boat
    const boat = this.vehicles.get('perahu');
    if (boat && this.activeVehicleId !== 'perahu') {
      boat.root.position.y = 0.08 + Math.sin(this._time * 1.8) * 0.05;
      boat.root.rotation.z = Math.sin(this._time * 1.3) * 0.03;
    }

    const v = this.activeVehicle;
    if (!v) return null;

    const mv = input.getMovementInput(); // z: forward(-1)/back(+1), x: left(-1)/right(+1)
    const throttle = -mv.z; // +1 forward, -1 reverse/brake
    const steer = -mv.x;    // +1 left, -1 right

    if (Math.abs(throttle) > 0.05) {
      v.speed += throttle * v.spec.accel * dt;
    } else {
      // Natural friction drag
      v.speed *= Math.max(0, 1 - dt * (v.spec.kind === 'air' ? 0.65 : 2.6));
    }
    const minSpeed = v.spec.kind === 'air' ? 0 : -v.spec.maxSpeed * 0.4;
    v.speed = Math.max(minSpeed, Math.min(v.spec.maxSpeed, v.speed));

    // Steering scales smoothly with movement
    const steerFactor = v.spec.kind === 'air' ? 1.0 : Math.min(1, Math.abs(v.speed) / 2.2);
    const reverseSign = v.speed < -0.1 ? -1 : 1;
    v.yaw += steer * v.spec.turnRate * steerFactor * reverseSign * dt;

    // Forward displacement (-Z is local forward)
    const fx = -Math.sin(v.yaw);
    const fz = -Math.cos(v.yaw);
    let nextX = v.root.position.x + fx * v.speed * dt;
    let nextZ = v.root.position.z + fz * v.speed * dt;

    // Boundary containment (keeps land vehicles inside courtyard, boat on water ring, plane across sky)
    const maxR = v.spec.kind === 'air' ? 56 : (v.spec.kind === 'water' ? 45 : 33);
    const dist = Math.hypot(nextX, nextZ);
    if (dist > maxR) {
      nextX = (nextX / dist) * maxR;
      nextZ = (nextZ / dist) * maxR;
      v.speed *= 0.6;
    }

    if (v.spec.kind === 'air') {
      // Accessible takeoff & altitude control: Space/Jump ascends when moving, Shift/Sprint descends
      if (input.keys?.has('Space') || input.mobileJump) {
        if (v.speed < 6) v.speed = Math.min(v.spec.maxSpeed, v.speed + 10 * dt);
        v.altitude = Math.min(18, v.altitude + 7.5 * dt);
        v.pitch = THREE.MathUtils.lerp(v.pitch, 0.22, dt * 5);
      } else if (input.isSprinting()) {
        v.altitude = Math.max(0, v.altitude - 7.5 * dt);
        v.pitch = THREE.MathUtils.lerp(v.pitch, v.altitude > 0.2 ? -0.18 : 0, dt * 5);
      } else {
        v.pitch = THREE.MathUtils.lerp(v.pitch, 0, dt * 4);
      }
      v.roll = THREE.MathUtils.lerp(v.roll, steer * 0.35, dt * 5);
      v.root.position.set(nextX, v.altitude, nextZ);
      v.root.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
      if (v.propeller) v.propeller.rotation.z += dt * (12 + v.speed * 1.4);
    } else if (v.spec.kind === 'water') {
      v.root.position.set(nextX, 0.08 + Math.sin(this._time * 2.4) * 0.06, nextZ);
      v.root.rotation.set(0, v.yaw, steer * 0.08);
    } else {
      v.root.position.set(nextX, 0, nextZ);
      const lean = v.spec.id === 'motor' ? steer * 0.24 * steerFactor : 0;
      v.root.rotation.set(0, v.yaw, lean);
    }

    // Spin wheels
    for (const w of v.wheels) {
      w.rotation.x -= v.speed * dt * 2.8;
    }

    // Sync player avatar seated inside vehicle
    if (playerController) {
      playerController.position.copy(v.root.position);
      playerController.position.y += v.spec.id === 'mobil' ? 0.55 : (v.spec.id === 'pesawat' ? 0.65 : 0.45);
      playerController.yaw = v.yaw + Math.PI;
      playerController.root.position.copy(playerController.position);
      playerController.root.rotation.y = playerController.yaw;
      playerController.character.update(dt, 'sit');
    }

    // Sync interactable beacon position with parked vehicle
    const beacon = this.interaction.interactables.find((i) => i.id === `vehicle-${v.spec.id}`);
    if (beacon) {
      beacon.position.set(v.root.position.x, v.root.position.y + 0.1, v.root.position.z);
      if (beacon.mesh) beacon.mesh.position.copy(beacon.position);
    }

    // Modulate procedural engine pitch
    if (this._engineOsc && this._audioCtx) {
      const baseFreq = v.spec.id === 'pesawat' ? 115 : (v.spec.id === 'motor' ? 92 : 68);
      this._engineOsc.frequency.setTargetAtTime(baseFreq + Math.abs(v.speed) * 4.5, this._audioCtx.currentTime, 0.08);
    }

    return {
      vehicleId: v.spec.id,
      name: v.spec.name,
      speedKmh: Math.round(Math.abs(v.speed) * 3.6),
      altitudeM: Math.round(v.altitude)
    };
  }

  _startEngineAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this._audioCtx) this._audioCtx = new Ctx();
      if (this._audioCtx.state === 'suspended') this._audioCtx.resume();
      this._stopEngineAudio();
      const osc = this._audioCtx.createOscillator();
      const filter = this._audioCtx.createBiquadFilter();
      const gain = this._audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 72;
      filter.type = 'lowpass';
      filter.frequency.value = 210;
      gain.gain.value = 0.025;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this._audioCtx.destination);
      osc.start();
      this._engineOsc = osc;
      this._engineGain = gain;
    } catch {}
  }

  _stopEngineAudio() {
    try {
      if (this._engineOsc) { this._engineOsc.stop(); this._engineOsc.disconnect(); this._engineOsc = null; }
      if (this._engineGain) { this._engineGain.disconnect(); this._engineGain = null; }
    } catch {}
  }
}
