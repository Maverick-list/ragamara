/**
 * NULAR — Centralized Internationalization Engine (js/i18n/I18nManager.js)
 * Supports: id (default), en, ar (RTL), ja, ko, zh, es, fr + Indonesian regional registry.
 * Automatically updates <html lang="..." dir="...">, translates [data-i18n], [data-i18n-placeholder],
 * and persists selection in localStorage ('nular_lang_v1') and active player profile.
 */

const LANG_KEY = 'nular_lang_v1';
export const SUPPORTED_LOCALES = [
  { code: 'id', label: 'ID · Indonesia', dir: 'ltr' },
  { code: 'en', label: 'EN · English', dir: 'ltr' },
  { code: 'ar', label: 'AR · العربية (RTL)', dir: 'rtl' },
  { code: 'ja', label: 'JA · 日本語', dir: 'ltr' },
  { code: 'ko', label: 'KO · 한국어', dir: 'ltr' },
  { code: 'zh', label: 'ZH · 中文', dir: 'ltr' },
  { code: 'es', label: 'ES · Español', dir: 'ltr' },
  { code: 'fr', label: 'FR · Français', dir: 'ltr' }
];

const cache = new Map();
let activeLang = 'id';
let activeDict = {};
let fallbackDict = {};

async function loadLocaleJson(code) {
  if (cache.has(code)) return cache.get(code);
  try {
    const res = await fetch(`./js/i18n/locales/${code}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(code, data);
    return data;
  } catch {
    return null;
  }
}

function resolveKey(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

export const I18nManager = {
  getLanguage() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) return saved;
    } catch {}
    return activeLang;
  },

  t(key, fallbackText = '') {
    const val = resolveKey(activeDict, key) ?? resolveKey(fallbackDict, key);
    return typeof val === 'string' ? val : (fallbackText || key);
  },

  async setLanguage(code) {
    const target = SUPPORTED_LOCALES.some((l) => l.code === code) ? code : 'id';
    activeLang = target;
    try {
      localStorage.setItem(LANG_KEY, target);
    } catch {}

    if (!Object.keys(fallbackDict).length) {
      fallbackDict = (await loadLocaleJson('id')) || {};
    }
    activeDict = (await loadLocaleJson(target)) || fallbackDict;

    const meta = SUPPORTED_LOCALES.find((l) => l.code === target) || SUPPORTED_LOCALES[0];
    document.documentElement.lang = target;
    document.documentElement.dir = meta.dir;

    this.applyTranslations(document);
    document.querySelectorAll('[data-lang-selector]').forEach((sel) => {
      if (sel.value !== target) sel.value = target;
    });

    window.dispatchEvent(new CustomEvent('nular:lang-changed', { detail: { lang: target, dir: meta.dir } }));
    return target;
  },

  applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const translated = this.t(key);
      if (translated && translated !== key) {
        el.textContent = translated;
      }
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translated = this.t(key);
      if (translated && translated !== key) {
        el.setAttribute('placeholder', translated);
      }
    });
  },

  async init() {
    const initial = this.getLanguage();
    return this.setLanguage(initial);
  }
};

window.NularI18n = I18nManager;
