/**
 * NULAR Living Archipelago — GameScene (js/world/GameScene.js)
 * Manages Three.js WebGLRenderer, PBR lighting, shadows, and clean resource disposal.
 */
import * as THREE from 'three';

export class GameScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfeadd);
    this.scene.fog = new THREE.FogExp2(0xdfeadd, 0.0072);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);

    this.camera = new THREE.PerspectiveCamera(54, w / Math.max(h, 1), 0.15, 240);

    // Warm tropical museum sunlight rig (front three-quarter golden key + sky/foliage bounce)
    this.hemiLight = new THREE.HemisphereLight(0xfff9ee, 0x5c7563, 1.45);
    this.hemiLight.position.set(0, 38, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3db, 2.55);
    this.sunLight.position.set(22, 26, 22);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 85;
    const d = 28;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.fillLight = new THREE.DirectionalLight(0xc4ded0, 0.95);
    this.fillLight.position.set(-16, 14, -14);
    this.scene.add(this.fillLight);

    // Adaptive state flags
    this.contextLost = false;
    this.isPaused = document.hidden || false;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._onVisibilityChange = () => {
      this.isPaused = document.hidden;
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);

    this._onContextLost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      console.warn('[GameScene] WebGL context lost. Rendering paused.');
    };
    this._onContextRestored = () => {
      this.contextLost = false;
      this.resize();
      console.info('[GameScene] WebGL context restored.');
    };
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
  }

  static detectDeviceCapability() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'performance';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
      const isWeakGpu = /Mali-400|PowerVR|Intel HD 3000|Intel HD 2000|Adreno 3|Adreno 2/i.test(renderer);
      const isAppleOrDiscrete = /Apple M|NVIDIA|GeForce|Radeon|RTX|GTX/i.test(renderer);
      const memory = navigator.deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 4;

      if (isWeakGpu || memory < 3 || cores <= 2) return 'performance';
      if (isAppleOrDiscrete && memory >= 6 && cores >= 6) return 'high';
      return 'balanced';
    } catch {
      return 'balanced';
    }
  }

  resize() {
    const w = this.canvas.parentElement?.clientWidth || window.innerWidth;
    const h = this.canvas.parentElement?.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setAtmosphere({ skyHex = 0xdbe7de, fogDensity = 0.0115, sunIntensity = 2.05 }) {
    this.scene.background.setHex(skyHex);
    this.scene.fog.color.setHex(skyHex);
    this.scene.fog.density = fogDensity;
    this.sunLight.intensity = sunIntensity;
  }

  setQualityProfile(profile = 'auto') {
    let resolved = profile.toLowerCase();
    if (resolved === 'auto') {
      resolved = GameScene.detectDeviceCapability();
    }
    // Canonical mapping for standard profiles
    if (resolved === 'low' || resolved === 'performance') resolved = 'low';
    else if (resolved === 'medium' || resolved === 'balanced') resolved = 'medium';
    else if (resolved === 'ultra') resolved = 'ultra';
    else resolved = 'high';

    const cfg = {
      low: { dpr: 1, shadows: false, shadowSize: 512, exposure: 1.05 },
      medium: { dpr: Math.min(window.devicePixelRatio || 1, 1.5), shadows: true, shadowSize: 1024, exposure: 1.08 },
      high: { dpr: Math.min(window.devicePixelRatio || 1, 2), shadows: true, shadowSize: 1024, exposure: 1.1 },
      ultra: { dpr: Math.min(window.devicePixelRatio || 1, 2), shadows: true, shadowSize: 2048, exposure: 1.12 }
    }[resolved] || { dpr: 1.5, shadows: true, shadowSize: 1024, exposure: 1.08 };

    this.renderer.setPixelRatio(cfg.dpr);
    this.renderer.shadowMap.enabled = cfg.shadows;
    this.sunLight.castShadow = cfg.shadows;
    this.renderer.toneMappingExposure = cfg.exposure;
    if (this.sunLight.shadow.mapSize.width !== cfg.shadowSize) {
      this.sunLight.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
      if (this.sunLight.shadow.map) {
        this.sunLight.shadow.map.dispose();
        this.sunLight.shadow.map = null;
      }
    }
    return resolved;
  }

  render() {
    if (this.contextLost || this.isPaused) return;
    this.renderer.render(this.scene, this.camera);
  }

  disposeObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          // Preserve shared cached textures from PbrTextureFactory across house transitions
          if (m.map && !m.userData?.nularPbrApplied) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.disposeObject(this.scene);
    this.renderer.dispose();
  }
}
