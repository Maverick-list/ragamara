/**
 * NULAR — Nusa Learn Interactive 3D Architectural Viewer (js/viewer-3d.js)
 * Built with Three.js (GLTFLoader, DRACOLoader, OrbitControls).
 *
 * Capabilities:
 * - Lazy-loaded binary GLB/GLTF models configured purely via data/houses.json
 * - 360° Orbit, Zoom (wheel, pinch, buttons), Pan, Camera Reset, Auto-Rotate, Fullscreen
 * - Exterior, Interior (only when model supports it), Detail, and Exploded View (only when separated components exist)
 * - 3D Projected Hotspots + Direct Mesh Raycast Picking + Component Highlighting
 * - Loading progress indicator, error retry flow, WebGL-unavailable photographic fallback, full GPU disposal
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export class NularArchitectureViewer {
  constructor(containerEl, house, options = {}) {
    this.container = containerEl;
    this.house = house;
    this.options = {
      compact: false,
      autoRotateDefault: false,
      onSelectHotspot: null,
      onModeChange: null,
      onLoaded: null,
      ...options
    };

    this.disposed = false;
    this.rafId = null;
    this.modelRoot = null;
    this.componentGroups = new Map(); // meshName -> { group, basePos, explodeVec, originalMaterials }
    this.hotspotElements = new Map(); // hotspot.id -> DOM button
    this.selectedHotspotId = null;
    this.currentMode = 'exterior';
    this.isExploded = false;
    this.explodeFactor = 0;
    this.targetExplodeFactor = 0;
    this.roofLiftFactor = 0;
    this.targetRoofLiftFactor = 0;
    this.showHotspots = !this.options.compact;
    this.cameraTween = null;

    this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    this.autoRotate = this.prefersReducedMotion ? false : Boolean(this.options.autoRotateDefault);

    this.raycaster = new THREE.Raycaster();
    this.pointerDownPos = { x: 0, y: 0 };

    this._init();
  }

  _init() {
    this.container.innerHTML = '';

    // 1. Check WebGL availability cleanly
    if (!isWebGLAvailable()) {
      this._renderWebGLFallback('Browser atau perangkat Anda tidak mendukung WebGL. Ditampilkan dokumentasi fotografis terverifikasi sebagai alternatif.');
      return;
    }

    // 2. Build DOM inside container
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'viewer-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('aria-label', `Model 3D interaktif ${this.house.houseName}. Gunakan seret untuk memutar, gulir atau tombol +/- untuk memperbesar, dan tombol panah untuk menggerakkan kamera.`);
    this.container.appendChild(this.canvas);

    this.hotspotLayer = document.createElement('div');
    this.hotspotLayer.className = 'hotspot-layer';
    this.container.appendChild(this.hotspotLayer);

    // Loading overlay
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'viewer-overlay';
    this.loadingOverlay.innerHTML = `
      <span class="eyebrow eyebrow--light">Memuat Model 3D GLB</span>
      <p style="font-family:var(--font-serif);font-size:1.35rem;margin:10px 0 4px;">${this.house.houseName}</p>
      <p data-progress-text style="font-family:var(--font-mono);font-size:0.75rem;color:var(--ink-on-dark-muted);margin:0;">Menyiapkan geometri arsitektur...</p>
      <div class="viewer-progress-track"><div data-progress-bar class="viewer-progress-bar"></div></div>
    `;
    this.container.appendChild(this.loadingOverlay);

    // Error overlay
    this.errorOverlay = document.createElement('div');
    this.errorOverlay.className = 'viewer-overlay';
    this.errorOverlay.hidden = true;
    this.errorOverlay.innerHTML = `
      <span class="eyebrow eyebrow--light">Kendala Pemuatan Model</span>
      <p data-error-msg style="max-width:40ch;margin:12px 0 18px;font-size:0.92rem;color:var(--ink-on-dark-muted);"></p>
      <button type="button" data-retry-btn class="btn-museum btn-museum--bronze btn-museum--sm">Coba Muat Ulang</button>
    `;
    this.errorOverlay.querySelector('[data-retry-btn]').addEventListener('click', () => {
      this.errorOverlay.hidden = true;
      this.loadingOverlay.hidden = false;
      this._loadModel();
    });
    this.container.appendChild(this.errorOverlay);

    // Full viewer HUD controls (skip HUD in compact homepage hero preview)
    if (!this.options.compact) {
      this._buildControlsHUD();
    }

    // 3. Setup Three.js Renderer, Scene, Camera, Lighting
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      this._renderWebGLFallback('Konteks WebGL tidak dapat diinisialisasi pada perangkat ini.');
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 520;
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 160);
    const ext = this.house.cameraPresets?.exterior || { position: [8.5, 5.2, 9.5], target: [0, 2.8, 0] };
    this.camera.position.set(...ext.position);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(...ext.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = !this.options.compact;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.update();

    // Stop active camera tween when user interacts manually
    this.controls.addEventListener('start', () => {
      this.cameraTween = null;
    });

    // Gallery 3-point architectural lighting
    const hemi = new THREE.HemisphereLight(0xfff5e4, 0x26352e, 1.15);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(11, 16, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 42;
    const d = 10;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0008;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa7c5b6, 0.95);
    rimLight.position.set(-10, 8, -11);
    this.scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xe5b97d, 0.65, 25);
    warmFill.position.set(-4, 3, 6);
    this.scene.add(warmFill);

    // Architectural Museum Pedestal & Subtle Scale Grid
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 7.6, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: 0x202824, roughness: 0.92, metalness: 0.05 })
    );
    pedestal.position.y = -0.08;
    pedestal.receiveShadow = true;
    this.scene.add(pedestal);

    const grid = new THREE.GridHelper(14, 14, 0x6b5b43, 0x2f3b35);
    grid.position.y = 0.004;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    this.scene.add(grid);

    // Resize handling
    this._handleResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || 800;
      const h = this.container.clientHeight || 520;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    this._handleResize();

    this.resizeObserver = new ResizeObserver(this._handleResize);
    this.resizeObserver.observe(this.container);

    // Pointer picking (distinguish clicks from drags!)
    this._onPointerDown = (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    };
    this._onPointerUp = (e) => {
      if (this.options.compact || !this.modelRoot) return;
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return; // User was orbiting/panning, not clicking
      this._pickMeshAt(e.clientX, e.clientY);
    };
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointerup', this._onPointerUp);

    // Keyboard navigation when canvas is focused
    this._onKeyDown = (e) => {
      if (this.disposed) return;
      if (e.key === 'ArrowLeft') { this.rotateBy(-0.22); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { this.rotateBy(0.22); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { this.zoomBy(0.84); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { this.zoomBy(1.18); e.preventDefault(); }
      else if (e.key.toLowerCase() === 'r') { this.resetCamera(); e.preventDefault(); }
      else if (e.key === 'Escape') { this.clearSelection(); }
    };
    this.canvas.addEventListener('keydown', this._onKeyDown);

    // Handle WebGL Context Loss gracefully
    this._onContextLost = (e) => {
      e.preventDefault();
      this._renderWebGLFallback('Sesi WebGL terhenti oleh perangkat. Muat ulang halaman atau jelajahi galeri foto referensi.');
    };
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);

    this._loadModel();
    this._animate();
  }

  _buildControlsHUD() {
    const caps = this.house.modelCapabilities || {};
    const topHud = document.createElement('div');
    topHud.className = 'viewer-hud-top';
    topHud.innerHTML = `
      <div class="viewer-mode-group" role="group" aria-label="Mode Tampilan Arsitektur">
        <button type="button" class="viewer-btn is-active" data-mode="exterior" aria-pressed="true">Eksterior</button>
        <button type="button" class="viewer-btn" data-mode="interior" aria-pressed="false" ${caps.interiorSupported ? '' : 'disabled title="Ruang interior belum dimodelkan terpisah pada berkas 3D ini"'}>
          Interior
        </button>
        <button type="button" class="viewer-btn" data-mode="detail" aria-pressed="false">Detail</button>
        <button type="button" class="viewer-btn" data-mode="exploded" aria-pressed="false" ${caps.explodedSupported ? '' : 'disabled title="Model ini tidak memiliki komponen terpisah untuk tampilan exploded"'}>
          Exploded View
        </button>
      </div>

      <div class="viewer-mode-group" role="group" aria-label="Alat Bantu Penampil 3D">
        <button type="button" class="viewer-btn ${this.showHotspots ? 'is-active' : ''}" data-action="toggle-hotspots" aria-pressed="${this.showHotspots}" aria-label="Tampilkan atau sembunyikan pin komponen">
          <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">pin_drop</span>
          <span>Hotspot</span>
        </button>
        <button type="button" class="viewer-btn ${this.autoRotate ? 'is-active' : ''}" data-action="toggle-rotate" aria-pressed="${this.autoRotate}" aria-label="Putar otomatis 360 derajat">
          <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">360</span>
          <span>Putar</span>
        </button>
        <button type="button" class="viewer-btn" data-action="fullscreen" aria-label="Layar penuh">
          <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">fullscreen</span>
        </button>
      </div>
    `;
    this.container.appendChild(topHud);

    const bottomHud = document.createElement('div');
    bottomHud.className = 'viewer-hud-bottom';
    bottomHud.innerHTML = `
      <span class="viewer-hint">Seret: Putar 360° · Gulir/Cubit: Zoom · Klik Bagian: Inspeksi Komponen</span>
      <div class="viewer-mode-group" role="group" aria-label="Kontrol Kamera 3D">
        <button type="button" class="viewer-btn" data-action="zoom-in" aria-label="Perbesar model">
          <span class="material-symbols-outlined" style="font-size:17px" aria-hidden="true">add</span>
        </button>
        <button type="button" class="viewer-btn" data-action="zoom-out" aria-label="Perkecil model">
          <span class="material-symbols-outlined" style="font-size:17px" aria-hidden="true">remove</span>
        </button>
        <button type="button" class="viewer-btn" data-action="reset" aria-label="Reset posisi kamera">
          <span class="material-symbols-outlined" style="font-size:16px" aria-hidden="true">restart_alt</span>
          <span>Reset</span>
        </button>
      </div>
    `;
    this.container.appendChild(bottomHud);

    this.container.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn && !modeBtn.disabled) {
        this.setViewMode(modeBtn.getAttribute('data-mode'));
        return;
      }
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.getAttribute('data-action');
      if (action === 'zoom-in') this.zoomBy(0.8);
      else if (action === 'zoom-out') this.zoomBy(1.25);
      else if (action === 'reset') this.resetCamera();
      else if (action === 'toggle-rotate') {
        this.autoRotate = !this.autoRotate;
        this.controls.autoRotate = this.autoRotate;
        actionBtn.classList.toggle('is-active', this.autoRotate);
        actionBtn.setAttribute('aria-pressed', String(this.autoRotate));
      } else if (action === 'toggle-hotspots') {
        this.showHotspots = !this.showHotspots;
        this.hotspotLayer.style.display = this.showHotspots ? '' : 'none';
        actionBtn.classList.toggle('is-active', this.showHotspots);
        actionBtn.setAttribute('aria-pressed', String(this.showHotspots));
      } else if (action === 'fullscreen') {
        this.toggleFullscreen();
      }
    });
  }

  _loadModel() {
    const loader = new GLTFLoader();
    // Optional DRACOLoader ready for future Draco-compressed GLB models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    const progressBar = this.loadingOverlay.querySelector('[data-progress-bar]');
    const progressText = this.loadingOverlay.querySelector('[data-progress-text]');

    loader.load(
      this.house.model3DUrl,
      (gltf) => {
        if (this.disposed) return;
        this.modelRoot = gltf.scene;
        this.componentGroups.clear();

        // Index named component groups and enable shadows
        const hotspotByMesh = new Map((this.house.hotspots || []).map((h) => [h.meshName, h]));

        this.modelRoot.traverse((obj) => {
          if (obj.name && obj.name.toUpperCase().startsWith('COLLISION')) {
            obj.visible = false;
            return;
          }
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
            // Clone materials per mesh so component highlight never leaks globally
            if (obj.material) {
              obj.material = Array.isArray(obj.material)
                ? obj.material.map((m) => m.clone())
                : obj.material.clone();
            }
          }
        });

        // Register top-level separated structural groups
        const rootContainer = this.modelRoot.children.length === 1 && this.modelRoot.children[0].children.length > 0
          ? this.modelRoot.children[0]
          : this.modelRoot;

        for (const child of rootContainer.children) {
          if (child.name && child.name.toUpperCase().startsWith('COLLISION')) {
            child.visible = false;
            continue;
          }
          const hs = hotspotByMesh.get(child.name);
          let explodeVec = hs?.explodeOffset ? new THREE.Vector3(...hs.explodeOffset) : new THREE.Vector3(0, 0, 0);
          if (explodeVec.lengthSq() === 0 && child.name) {
            const up = child.name.toUpperCase();
            if (up.includes('ROOF_BRUNJUNG')) explodeVec.set(0, 3.0, 0);
            else if (up.includes('ROOF')) explodeVec.set(0, 2.2, 0);
            else if (up.includes('TUMPANG')) explodeVec.set(0, 1.5, 0);
            else if (up.includes('WALL') || up.includes('DOOR')) explodeVec.set(0, 0.75, 0);
            else if (up.includes('FOUNDATION') || up.includes('UMPAK')) explodeVec.set(0, -0.5, 0);
          }
          const meshes = [];
          child.traverse((o) => {
            if (o.isMesh) {
              o.userData.componentMeshName = child.name;
              meshes.push({
                mesh: o,
                baseEmissive: o.material?.emissive ? o.material.emissive.clone() : new THREE.Color(0x000000),
                baseOpacity: o.material?.opacity ?? 1
              });
            }
          });
          this.componentGroups.set(child.name, {
            group: child,
            basePos: child.position.clone(),
            explodeVec,
            meshes
          });
        }

        this.scene.add(this.modelRoot);
        this._buildHotspotPins();

        if (progressBar) progressBar.style.width = '100%';
        this.loadingOverlay.hidden = true;
        if (typeof this.options.onLoaded === 'function') {
          this.options.onLoaded(this);
        }
      },
      (xhr) => {
        if (this.disposed) return;
        if (xhr.total > 0) {
          const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (progressText) progressText.textContent = `Mengunduh geometri 3D (${pct}%)...`;
        }
      },
      (err) => {
        if (this.disposed) return;
        console.error('NULAR 3D Model Load Error:', err);
        this.loadingOverlay.hidden = true;
        const msgEl = this.errorOverlay.querySelector('[data-error-msg]');
        if (msgEl) {
          msgEl.textContent = `Model 3D (${this.house.model3DUrl}) tidak dapat dimuat. Periksa koneksi jaringan atau coba muat ulang.`;
        }
        this.errorOverlay.hidden = false;
      }
    );
  }

  _buildHotspotPins() {
    this.hotspotLayer.innerHTML = '';
    this.hotspotElements.clear();
    if (this.options.compact || !this.house.hotspots?.length) return;

    this.house.hotspots.forEach((hs, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot-pin';
      btn.setAttribute('data-hotspot-id', hs.id);
      btn.setAttribute('aria-label', `Inspeksi komponen ${hs.title} (${hs.localName})`);
      btn.innerHTML = `<span class="hotspot-pin__dot">${idx + 1}</span><span>${hs.localName}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectHotspot(hs.id);
      });
      this.hotspotLayer.appendChild(btn);
      this.hotspotElements.set(hs.id, btn);
    });
  }

  _pickMeshAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.modelRoot, true);
    if (!hits.length) return;

    const hitMeshName = hits[0].object?.userData?.componentMeshName;
    if (!hitMeshName) return;

    const matchedHotspot = (this.house.hotspots || []).find((h) => h.meshName === hitMeshName);
    if (matchedHotspot) {
      this.selectHotspot(matchedHotspot.id);
    }
  }

  selectHotspot(hotspotId) {
    const hs = (this.house.hotspots || []).find((h) => h.id === hotspotId);
    if (!hs) return;

    this.selectedHotspotId = hs.id;

    // Highlight selected 3D mesh group & gently mute others
    for (const [meshName, entry] of this.componentGroups.entries()) {
      const isSelected = meshName === hs.meshName;
      for (const item of entry.meshes) {
        const mat = item.mesh.material;
        if (!mat) continue;
        if (mat.emissive) {
          if (isSelected) mat.emissive.setHex(0x8e6026);
          else mat.emissive.copy(item.baseEmissive);
        }
        mat.transparent = !isSelected;
        mat.opacity = isSelected ? 1 : 0.42;
      }
    }

    // Update pin active states
    for (const [id, el] of this.hotspotElements.entries()) {
      el.classList.toggle('is-selected', id === hs.id);
    }

    // Smooth camera focus onto component (accounting for exploded offset if active)
    const offset = hs.explodeOffset || [0, 0, 0];
    const targetVec = new THREE.Vector3(
      hs.anchor[0] + offset[0] * this.targetExplodeFactor,
      hs.anchor[1] + offset[1] * this.targetExplodeFactor,
      hs.anchor[2] + offset[2] * this.targetExplodeFactor
    );
    const camVec = hs.cameraPos
      ? new THREE.Vector3(
          hs.cameraPos[0] + offset[0] * this.targetExplodeFactor * 0.5,
          hs.cameraPos[1] + offset[1] * this.targetExplodeFactor * 0.5,
          hs.cameraPos[2] + offset[2] * this.targetExplodeFactor * 0.5
        )
      : targetVec.clone().add(new THREE.Vector3(4.5, 2.2, 4.5));

    // If selecting Honai interior component, automatically lift roof cutaway so it is visible!
    if (this.house.id === 'honai-papua' && ['hn-loteng', 'hn-heke', 'hn-tungku'].includes(hs.id)) {
      this.targetRoofLiftFactor = 1;
    }

    this._tweenCamera(camVec, targetVec);

    if (typeof this.options.onSelectHotspot === 'function') {
      this.options.onSelectHotspot(hs);
    }
  }

  clearSelection() {
    this.selectedHotspotId = null;
    for (const entry of this.componentGroups.values()) {
      for (const item of entry.meshes) {
        const mat = item.mesh.material;
        if (!mat) continue;
        if (mat.emissive) mat.emissive.copy(item.baseEmissive);
        mat.transparent = false;
        mat.opacity = item.baseOpacity;
      }
    }
    for (const el of this.hotspotElements.values()) {
      el.classList.remove('is-selected');
    }
    if (typeof this.options.onSelectHotspot === 'function') {
      this.options.onSelectHotspot(null);
    }
  }

  setViewMode(mode) {
    const caps = this.house.modelCapabilities || {};
    if (mode === 'interior' && !caps.interiorSupported) return;
    if (mode === 'exploded' && !caps.explodedSupported) return;

    this.currentMode = mode;
    this.targetExplodeFactor = mode === 'exploded' ? 1 : 0;
    this.targetRoofLiftFactor = (mode === 'interior' && this.house.id === 'honai-papua') ? 1 : 0;
    if (this.controls) {
      // Allow upward gaze inside interior spaces (e.g., Joglo Tumpang Sari) while preventing under-floor clipping in exterior
      this.controls.maxPolarAngle = mode === 'interior' ? Math.PI * 0.78 : Math.PI * 0.495;
    }

    // Update mode buttons UI
    this.container.querySelectorAll('[data-mode]').forEach((btn) => {
      const active = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const presets = this.house.cameraPresets || {};
    if (mode === 'exterior' && presets.exterior) {
      this.clearSelection();
      this._tweenCamera(new THREE.Vector3(...presets.exterior.position), new THREE.Vector3(...presets.exterior.target));
    } else if (mode === 'interior' && presets.interior) {
      this.clearSelection();
      this._tweenCamera(new THREE.Vector3(...presets.interior.position), new THREE.Vector3(...presets.interior.target));
    } else if (mode === 'detail' && presets.detail) {
      this._tweenCamera(new THREE.Vector3(...presets.detail.position), new THREE.Vector3(...presets.detail.target));
    } else if (mode === 'exploded' && presets.exterior) {
      const pos = new THREE.Vector3(...presets.exterior.position).multiplyScalar(1.22);
      pos.y += 1.4;
      this._tweenCamera(pos, new THREE.Vector3(...presets.exterior.target).add(new THREE.Vector3(0, 0.4, 0)));
    }

    if (typeof this.options.onModeChange === 'function') {
      this.options.onModeChange(mode);
    }
  }

  resetCamera() {
    this.setViewMode('exterior');
  }

  zoomBy(factor) {
    if (!this.controls) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const nextLen = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    offset.setLength(nextLen);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  rotateBy(angleRad) {
    if (!this.controls) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleRad);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  _tweenCamera(endPos, endTarget) {
    if (this.prefersReducedMotion) {
      this.camera.position.copy(endPos);
      this.controls.target.copy(endTarget);
      this.controls.update();
      return;
    }
    this.cameraTween = {
      startTime: performance.now(),
      duration: 620,
      startPos: this.camera.position.clone(),
      endPos: endPos.clone(),
      startTarget: this.controls.target.clone(),
      endTarget: endTarget.clone()
    };
  }

  _animate() {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(() => this._animate());

    // Smoothly interpolate exploded view & Honai interior roof cutaway
    const lerpSpeed = this.prefersReducedMotion ? 1 : 0.1;
    if (Math.abs(this.explodeFactor - this.targetExplodeFactor) > 0.001 || Math.abs(this.roofLiftFactor - this.targetRoofLiftFactor) > 0.001) {
      this.explodeFactor += (this.targetExplodeFactor - this.explodeFactor) * lerpSpeed;
      this.roofLiftFactor += (this.targetRoofLiftFactor - this.roofLiftFactor) * lerpSpeed;

      for (const [meshName, entry] of this.componentGroups.entries()) {
        const extraLiftY = (meshName === 'atap_kubah_jerami' && this.targetExplodeFactor === 0)
          ? this.roofLiftFactor * 2.4
          : 0;
        entry.group.position.set(
          entry.basePos.x + entry.explodeVec.x * this.explodeFactor,
          entry.basePos.y + entry.explodeVec.y * this.explodeFactor + extraLiftY,
          entry.basePos.z + entry.explodeVec.z * this.explodeFactor
        );
      }
    }

    // Active camera tween
    if (this.cameraTween) {
      const t = Math.min(1, (performance.now() - this.cameraTween.startTime) / this.cameraTween.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(this.cameraTween.startPos, this.cameraTween.endPos, ease);
      this.controls.target.lerpVectors(this.cameraTween.startTarget, this.cameraTween.endTarget, ease);
      if (t >= 1) this.cameraTween = null;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._updateHotspotPositions();
  }

  _updateHotspotPositions() {
    if (!this.showHotspots || !this.hotspotElements.size) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const tmp = new THREE.Vector3();

    for (const hs of this.house.hotspots || []) {
      const el = this.hotspotElements.get(hs.id);
      if (!el) continue;
      const offset = hs.explodeOffset || [0, 0, 0];
      const extraY = (hs.meshName === 'atap_kubah_jerami' && this.targetExplodeFactor === 0)
        ? this.roofLiftFactor * 2.4
        : 0;
      tmp.set(
        hs.anchor[0] + offset[0] * this.explodeFactor,
        hs.anchor[1] + offset[1] * this.explodeFactor + extraY,
        hs.anchor[2] + offset[2] * this.explodeFactor
      );
      tmp.project(this.camera);

      const visible = tmp.z < 1 && tmp.x >= -1.05 && tmp.x <= 1.05 && tmp.y >= -1.05 && tmp.y <= 1.05;
      el.style.display = visible ? 'inline-flex' : 'none';
      if (visible) {
        const sx = (tmp.x * 0.5 + 0.5) * width;
        const sy = (-tmp.y * 0.5 + 0.5) * height;
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
      }
    }
  }

  _renderWebGLFallback(message) {
    const photo = this.house.referenceImages?.[0];
    this.container.innerHTML = `
      <div style="position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;background:#151a18;color:#FAF7F2;">
        ${photo ? `<img src="${photo.url}" alt="${photo.caption}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.42;" />` : ''}
        <div style="position:relative;z-index:2;padding:28px;background:linear-gradient(to top, rgba(14,24,20,0.96), rgba(14,24,20,0.4));">
          <span class="eyebrow eyebrow--light">Mode Alternatif Non-WebGL</span>
          <h3 style="font-family:var(--font-serif);font-size:1.5rem;margin:8px 0;">${this.house.houseName}</h3>
          <p style="font-size:0.9rem;color:#D0D9D2;max-width:56ch;margin:0;">${message}</p>
        </div>
      </div>
    `;
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
      this.canvas.removeEventListener('pointerup', this._onPointerUp);
      this.canvas.removeEventListener('keydown', this._onKeyDown);
      this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    }
    if (this.controls) this.controls.dispose();
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
