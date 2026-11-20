/**
 * NULAR — Reusable 3D Cultural Artifact Viewer (js/artifact-viewer.js)
 * Displays rotatable 3D clothing mannequins and historical museum weapon artifacts.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let activeViewer = null;

export async function mountArtifactViewer(container, glbUrl) {
  if (!container || !glbUrl) return null;
  if (activeViewer) {
    activeViewer.dispose();
    activeViewer = null;
  }

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  container.querySelectorAll('canvas').forEach((c) => c.remove());
  container.appendChild(canvas);

  const w = container.clientWidth || 420;
  const h = container.clientHeight || 340;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, w / Math.max(h, 1), 0.1, 40);
  camera.position.set(1.4, 1.15, 1.9);

  const hemi = new THREE.HemisphereLight(0xfff5e4, 0x26382f, 1.4);
  const key = new THREE.DirectionalLight(0xfff1d6, 2.0);
  key.position.set(2.5, 4, 2.5);
  scene.add(hemi, key);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.target.set(0, 0.72, 0);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(`./${glbUrl.replace(/^\.\//, '')}`);
  scene.add(gltf.scene);

  let running = true;
  let rafId = 0;
  const loop = () => {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  };
  loop();

  activeViewer = {
    dispose() {
      running = false;
      cancelAnimationFrame(rafId);
      controls.dispose();
      gltf.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
    }
  };
  return activeViewer;
}
