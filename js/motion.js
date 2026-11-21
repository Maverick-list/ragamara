/**
 * NULAR MOTION & INTERACTION ENGINE
 * Handles:
 * 1. Scroll-reveal triggers via IntersectionObserver
 * 2. View transition animations
 * 3. Flying XP particle feedback
 * 4. Mascot micro-interaction triggers
 * 5. Level-up celebratory ring burst
 * 6. Reduced-motion auto-adaptation
 */

window.NularMotion = (function() {
  'use strict';

  let observer = null;

  function isReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
           document.body.classList.contains('reduced-motion');
  }

  function initScrollObserver() {
    if (isReducedMotion()) {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));
      return;
    }

    if ('IntersectionObserver' in window) {
      if (observer) observer.disconnect();

      observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      });

      document.querySelectorAll('.reveal-on-scroll:not(.is-revealed)').forEach(el => {
        observer.observe(el);
      });
    } else {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));
    }
  }

  /**
   * Spawns an animated floating XP badge
   */
  function spawnXpBurst(x, y, amount = 45) {
    if (isReducedMotion()) return;

    const badge = document.createElement('div');
    badge.className = 'xp-particle-toast';
    badge.innerHTML = `+${amount} XP ⚡`;
    badge.style.left = `${x || window.innerWidth / 2}px`;
    badge.style.top = `${y || window.innerHeight / 2}px`;

    document.body.appendChild(badge);

    setTimeout(() => {
      badge.remove();
    }, 1200);
  }

  /**
   * Trigger mascot celebratory motion
   */
  function triggerMascotReaction(action = 'celebrate') {
    const mascotImgs = document.querySelectorAll('#raga-mascot-img, #raga-expression-viewer img, .mascot-interactive');
    mascotImgs.forEach(img => {
      if (action === 'celebrate') {
        img.classList.remove('animate-mascot-celebrate', 'animate-mascot-nod');
        void img.offsetWidth; // trigger reflow
        img.classList.add('animate-mascot-celebrate');
        setTimeout(() => img.classList.remove('animate-mascot-celebrate'), 700);
      } else if (action === 'nod') {
        img.classList.remove('animate-mascot-celebrate', 'animate-mascot-nod');
        void img.offsetWidth;
        img.classList.add('animate-mascot-nod');
        setTimeout(() => img.classList.remove('animate-mascot-nod'), 500);
      }
    });
  }

  /**
   * Smooth View Switcher transition helper
   */
  function animateViewEntrance(paneEl) {
    if (!paneEl || isReducedMotion()) return;
    paneEl.classList.remove('view-fade-in');
    void paneEl.offsetWidth;
    paneEl.classList.add('view-fade-in');
  }

  return {
    init() {
      initScrollObserver();
      // Listen for reduced motion changes
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
        initScrollObserver();
      });
    },
    spawnXpBurst,
    triggerMascotReaction,
    animateViewEntrance,
    refreshScrollObserver: initScrollObserver
  };
})();

// Backward compatibility alias
window.RagamaraMotion = window.NularMotion;

// Auto initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.NularMotion.init());
} else {
  window.NularMotion.init();
}
