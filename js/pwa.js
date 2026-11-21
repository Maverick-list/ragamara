/**
 * NULAR — PWA & Service Worker Registration (js/pwa.js)
 * Manages installability prompts, offline readiness indicators, and seamless cache updates.
 */

export const PWA = {
  deferredPrompt: null,
  isInstalled: false,

  init() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then((reg) => {
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this._showUpdateBanner(reg);
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this._surfaceInstallUI();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this._hideInstallUI();
    });
  },

  _surfaceInstallUI() {
    // Show install buttons if present in DOM
    document.querySelectorAll('[data-pwa-install-btn]').forEach((btn) => {
      btn.hidden = false;
      btn.onclick = () => this.promptInstall();
    });
  },

  _hideInstallUI() {
    document.querySelectorAll('[data-pwa-install-btn]').forEach((btn) => {
      btn.hidden = true;
    });
  },

  async promptInstall() {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.deferredPrompt = null;
      this._hideInstallUI();
    }
  },

  _showUpdateBanner(reg) {
    if (document.getElementById('pwa-update-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'pwa-update-toast';
    toast.setAttribute('role', 'alert');
    toast.style.cssText = `
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom, 20px));
      right: max(20px, env(safe-area-inset-right, 20px));
      z-index: 9999;
      background: #153027;
      color: #FAF7F2;
      border: 1px solid #C6A274;
      border-radius: 4px;
      padding: 12px 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.85rem;
      font-family: 'Plus Jakarta Sans', sans-serif;
    `;
    toast.innerHTML = `
      <span>Pembaruan NULAR tersedia.</span>
      <button type="button" style="background:#C6A274;color:#141B18;border:none;padding:6px 12px;font-weight:600;font-size:0.75rem;cursor:pointer;border-radius:2px;">
        Muat Ulang
      </button>
      <button type="button" style="background:none;border:none;color:#FFFDF9;font-size:1.1rem;cursor:pointer;padding:0 4px;" aria-label="Tutup">×</button>
    `;

    toast.querySelector('button').addEventListener('click', () => {
      if (reg.waiting) {
        reg.waiting.postMessage({ action: 'skipWaiting' });
      }
      window.location.reload();
    });
    toast.querySelector('button[aria-label="Tutup"]').addEventListener('click', () => {
      toast.remove();
    });

    document.body.appendChild(toast);
  }
};

// Auto-initialize if DOM is ready or on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
  PWA.init();
}
