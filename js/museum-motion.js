/**
 * NULAR — Purposeful Museum Motion Controller (js/museum-motion.js)
 * Orchestrates scroll-linked exhibition reveals, subtle reading progress indicator,
 * and damped desktop spotlighting while strictly honoring prefers-reduced-motion.
 */

let motionInitialized = false;

function isReducedMotionPreferred() {
  try {
    if (document.body?.classList.contains('reduced-motion')) return true;
    const raw = JSON.parse(localStorage.getItem('nular_settings_v1') || 'null');
    if (raw?.reducedMotion) return true;
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function attachScrollProgress() {
  const header = document.querySelector('.museum-header');
  if (!header || header.querySelector('.museum-scroll-progress')) return;
  const bar = document.createElement('div');
  bar.className = 'museum-scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  header.appendChild(bar);

  let rafPending = false;
  const update = () => {
    rafPending = false;
    const docEl = document.documentElement;
    const scrollable = Math.max(1, docEl.scrollHeight - window.innerHeight);
    const pct = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
    bar.style.width = `${pct.toFixed(2)}%`;
  };

  const onScroll = () => {
    if (rafPending) return;
    rafPending = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

function attachHeroSpotlight(reduced) {
  if (reduced) return;
  const frame = document.querySelector('.hero-viewer-frame');
  if (!frame || !(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches)) {
    return;
  }
  frame.addEventListener('pointermove', (e) => {
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    frame.style.setProperty('--spot-x', `${x.toFixed(1)}%`);
    frame.style.setProperty('--spot-y', `${y.toFixed(1)}%`);
  }, { passive: true });
}

function attachExhibitionReveals(reduced) {
  const targets = Array.from(document.querySelectorAll(
    '[data-museum-reveal], .exhibition-plate, .curatorial-quote-inner'
  ));
  if (!targets.length) return;

  targets.forEach((el, idx) => {
    if (!el.hasAttribute('data-museum-reveal')) {
      el.setAttribute('data-museum-reveal', '');
    }
    if (!el.style.getPropertyValue('--reveal-delay')) {
      const stagger = (idx % 4) * 70;
      el.style.setProperty('--reveal-delay', `${stagger}ms`);
    }
  });

  if (reduced || typeof IntersectionObserver === 'undefined') {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  targets.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      el.classList.add('is-revealed');
    } else {
      observer.observe(el);
    }
  });
}

export function initMuseumMotion() {
  if (motionInitialized) return;
  motionInitialized = true;
  const reduced = isReducedMotionPreferred();
  if (reduced && document.body) {
    document.body.classList.add('reduced-motion');
  }
  attachScrollProgress();
  attachHeroSpotlight(reduced);
  attachExhibitionReveals(reduced);
}
