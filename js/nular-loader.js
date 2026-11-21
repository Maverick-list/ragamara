/**
 * NULAR — Cinematic Real-Progress Loading Screen (js/nular-loader.js)
 * Tracks real measurable loading tasks (critical JSON datasets, fonts, WebGL capability)
 * without fake indefinite progress bars. Respects prefers-reduced-motion & session caching.
 */

export function detectWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    return false;
  }
}

export async function runNularLoader({
  tasks = [],
  forceShow = false,
  title = 'NULAR',
  subtitle = 'The Living World of Nusantara'
} = {}) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    || document.body.classList.contains('reduced-motion');
  const seen = sessionStorage.getItem('nular_intro_seen_v1');

  // Skip full splash on repeat intra-session page visits unless forced
  if (seen && !forceShow) {
    const results = await Promise.allSettled(tasks.map((t) => t.run()));
    return { skipped: true, webgl: detectWebGLSupport(), results };
  }

  const overlay = document.createElement('div');
  overlay.id = 'nular-splash-loader';
  overlay.className = 'nular-splash';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="nular-splash__backdrop" aria-hidden="true"></div>
    <div class="nular-splash__inner">
      <div class="nular-splash__emblem" aria-hidden="true">
        <svg viewBox="0 0 80 80" width="68" height="68" fill="none">
          <rect x="12" y="12" width="56" height="56" rx="2" transform="rotate(45 40 40)" stroke="#C89D54" stroke-width="2" />
          <path d="M18 46 Q40 24 62 46" stroke="#FAF7F2" stroke-width="2.5" stroke-linecap="round" />
          <path d="M24 52 L40 34 L56 52" stroke="#C89D54" stroke-width="2" stroke-linejoin="round" />
          <circle cx="40" cy="24" r="3" fill="#C89D54" />
        </svg>
      </div>
      <div class="nular-splash__brand">${title}</div>
      <div class="nular-splash__tagline">${subtitle}</div>
      <div class="nular-splash__bar-wrap" aria-hidden="true">
        <div id="nular-splash-bar" class="nular-splash__bar" style="width:0%"></div>
      </div>
      <div class="nular-splash__meta">
        <span id="nular-splash-status">Memuat arsip budaya Nusantara…</span>
        <span id="nular-splash-pct">0%</span>
      </div>
      <div id="nular-splash-slow" class="nular-splash__notice" hidden>
        Koneksi melambat — memuat aset ringan terlebih dahulu.
      </div>
      <div id="nular-splash-webgl" class="nular-splash__notice" hidden>
        WebGL tidak terdeteksi pada peramban ini — mode katalog &amp; monograf tetap tersedia.
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const barEl = overlay.querySelector('#nular-splash-bar');
  const statusEl = overlay.querySelector('#nular-splash-status');
  const pctEl = overlay.querySelector('#nular-splash-pct');
  const slowEl = overlay.querySelector('#nular-splash-slow');
  const webglEl = overlay.querySelector('#nular-splash-webgl');

  const hasWebGL = detectWebGLSupport();
  if (!hasWebGL && webglEl) webglEl.hidden = false;

  const slowTimer = setTimeout(() => {
    if (slowEl) slowEl.hidden = false;
  }, 4000);

  const allTasks = [
    ...tasks,
    {
      label: 'Menyiapkan tipografi & antarmuka',
      run: () => document.fonts
        ? Promise.race([document.fonts.ready.catch(() => {}), new Promise((r) => setTimeout(r, 700))])
        : Promise.resolve()
    }
  ];

  let completed = 0;
  const total = Math.max(1, allTasks.length);
  const updateProgress = (label) => {
    const pct = Math.min(100, Math.round((completed / total) * 100));
    if (barEl) barEl.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (statusEl && label) statusEl.textContent = label;
  };

  const results = [];
  for (const t of allTasks) {
    updateProgress(t.label);
    try {
      const val = await t.run();
      results.push({ status: 'fulfilled', value: val });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
    completed += 1;
    updateProgress(completed >= total ? 'Siap menjelajahi Nusantara' : t.label);
  }

  clearTimeout(slowTimer);
  sessionStorage.setItem('nular_intro_seen_v1', '1');

  const exitDelay = reducedMotion ? 60 : 280;
  await new Promise((r) => setTimeout(r, exitDelay));
  overlay.classList.add('is-leaving');
  await new Promise((r) => setTimeout(r, reducedMotion ? 50 : 380));
  overlay.remove();

  return { skipped: false, webgl: hasWebGL, results };
}
