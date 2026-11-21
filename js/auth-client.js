/**
 * NULAR — Client Authentication & Settings Manager (js/auth-client.js)
 * Manages Guest Exploration Mode + Account Sessions via /api/auth,
 * and persists Camera, Graphics, Audio, and Accessibility settings.
 */
const SETTINGS_KEY = 'nular_world_settings_v1';
const ACCOUNT_KEY = 'nular_account_cache_v1';

const DEFAULT_SETTINGS = {
  cameraMode: 'third-person',
  sensitivity: 1.0,
  distance: 4.6,
  height: 1.85,
  invertY: false,
  fov: 52,
  smoothing: 0.16,
  showHints: true,
  showBodyFirstPerson: false,
  qualityProfile: 'auto',
  shadows: true,
  antialias: true,
  reducedMotion: false,
  showFps: false,
  ambientEnabled: true,
  sfxEnabled: true,
  volume: 0.55
};

export const AuthClient = {
  getSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(partial) {
    const next = { ...this.getSettings(), ...partial };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    if (next.reducedMotion) document.body.classList.add('reduced-motion');
    else document.body.classList.remove('reduced-motion');
    window.dispatchEvent(new CustomEvent('nular:settings-updated', { detail: next }));
    return next;
  },

  async getSession() {
    try {
      const res = await fetch('./api/auth');
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data));
        return data;
      }
    } catch {}
    try {
      const cached = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');
      if (cached) return cached;
    } catch {}
    return { authenticated: false, mode: 'guest' };
  },

  async signUp({ email, password, username }) {
    const res = await fetch('./api/auth?action=signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Pendaftaran gagal');
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('nular:auth-updated', { detail: data }));
    return data;
  },

  async login({ email, password }) {
    const res = await fetch('./api/auth?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('nular:auth-updated', { detail: data }));
    return data;
  },

  async logout() {
    await fetch('./api/auth?action=logout', { method: 'POST' }).catch(() => {});
    const guest = { authenticated: false, mode: 'guest' };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(guest));
    window.dispatchEvent(new CustomEvent('nular:auth-updated', { detail: guest }));
    return guest;
  },

  async requestReset(email) {
    const res = await fetch('./api/auth?action=reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  },

  async getProviders() {
    try {
      const res = await fetch('./api/auth?action=providers');
      if (res.ok) return (await res.json()).providers;
    } catch {}
    return {
      email: { enabled: true, smtpConfigured: false, storageMode: 'local_ephemeral' },
      google: { configured: false },
      phoneOtp: { configured: false, devModeAllowed: false }
    };
  },

  async startGoogleAuth() {
    const res = await fetch('./api/auth?action=google-start', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google OAuth belum terkonfigurasi.');
    if (data.authUrl) window.location.href = data.authUrl;
    return data;
  },

  async requestPhoneOtp(phone) {
    const res = await fetch('./api/auth?action=phone-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal meminta OTP.');
    return data;
  },

  async verifyPhoneOtp({ phone, code, username }) {
    const res = await fetch('./api/auth?action=phone-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, username })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verifikasi OTP gagal.');
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('nular:auth-updated', { detail: data }));
    return data;
  },

  async updateProfile(fields) {
    const res = await fetch('./api/auth?action=profile-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memperbarui profil.');
    const cur = await this.getSession();
    const merged = { ...cur, user: { ...(cur.user || {}), ...(data.user || {}) } };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('nular:auth-updated', { detail: merged }));
    return data;
  },

  getSafeNextUrl(fallback = 'world.html') {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || sessionStorage.getItem('nular_auth_next') || '';
    sessionStorage.removeItem('nular_auth_next');
    // Only allow safe same-origin relative paths
    if (next && !next.startsWith('http') && !next.startsWith('//') && /^[a-zA-Z0-9_.\-/?=&%#]+$/.test(next)) {
      return next;
    }
    return fallback;
  },

  buildAuthRedirectUrl(targetUrl = window.location.pathname + window.location.search) {
    const clean = targetUrl.replace(/^\/+/, '') || 'world.html';
    sessionStorage.setItem('nular_auth_next', clean);
    return `auth.html?next=${encodeURIComponent(clean)}`;
  },

  async deleteAccount() {
    await fetch('./api/auth', { method: 'DELETE' }).catch(() => {});
    localStorage.removeItem(ACCOUNT_KEY);
    return { ok: true, deleted: true };
  }
};
