// Persistent state (localStorage) + backup / transfer / merge.
import { dayKey } from './util.js';

const KEY = 'dadok-plus.v1';
export const SCHEMA = 1;

export const DEFAULT_SETTINGS = {
  style: 'hanji',          // hanji | clair | jade | encre
  mode: 'auto',            // auto | light | dark
  fontSize: 20,
  lineHeight: 1.9,
  readFont: 'sans',        // sans | serif
  transMode: 'sentence',   // sentence | paragraph
  showAllTrans: false,
  showGloss: true,         // underline secondary "help" words
  showKnown: false,        // underline words marked as known
  audioSource: 'voice',    // voice (recorded mp3) | tts
  audioRate: 1,
  autoScroll: true,
  cardDir: 'ko-en',        // ko-en | en-ko | type | mix
  cardContext: 'back',     // front | back | off
  cardAudio: true,
  newPerDay: 15,
  gestures: true,
  dailyGoal: 1,
  dict: 'kofr',            // kofr (Naver coréen-français) | koen (coréen-anglais)
};

export const dictUrl = (q) =>
  `https://korean.dict.naver.com/${state.settings.dict === 'koen' ? 'koendict' : 'kofrdict'}/#/search?query=${encodeURIComponent(q)}`;

const fresh = () => ({
  v: SCHEMA,
  settings: { ...DEFAULT_SETTINGS },
  words: {},      // key(word) -> entry
  texts: {},      // id -> { pos, progress, read, readAt, opened, fav, quiz:{c,n} }
  activity: {},   // 'YYYY-MM-DD' -> { read, sec, cards, added }
  ui: { tipsSeen: {}, lib: null },
  meta: { created: Date.now(), updated: Date.now(), lastBackup: 0, device: guessDevice() },
});

function guessDevice() {
  const ua = navigator.userAgent;
  if (/iPhone|Android.+Mobile/.test(ua)) return 'téléphone';
  if (/iPad|Android/.test(ua)) return 'tablette';
  return 'ordinateur';
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v) return normalize(s);
  } catch {}
  return fresh();
}
function normalize(s) {
  const f = fresh();
  return {
    ...f, ...s,
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    ui: { ...f.ui, ...(s.ui || {}) },
    meta: { ...f.meta, ...(s.meta || {}) },
    words: s.words || {}, texts: s.texts || {}, activity: s.activity || {},
  };
}

export const state = load();
const listeners = new Set();
let saveTimer = null;

export function save() {
  state.meta.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
  listeners.forEach((l) => l(state));
}
export function flush() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error('save failed', e); }
}
addEventListener('pagehide', flush);
addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

// ---------- Activity ----------
export function logActivity(kind, n = 1) {
  const k = dayKey();
  const d = (state.activity[k] ||= { read: 0, sec: 0, cards: 0, added: 0 });
  d[kind] = (d[kind] || 0) + n;
  save();
}
const isActive = (d) => d && (d.read > 0 || d.cards > 0 || d.sec >= 60);
export function streak() {
  let cur = 0, best = 0, run = 0;
  const days = Object.keys(state.activity).sort();
  if (days.length) {
    const start = new Date(days[0]);
    for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) {
      run = isActive(state.activity[dayKey(d)]) ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  // Current streak: today counts if active; otherwise streak from yesterday still alive.
  const d = new Date();
  if (!isActive(state.activity[dayKey(d)])) d.setDate(d.getDate() - 1);
  while (isActive(state.activity[dayKey(d)])) { cur++; d.setDate(d.getDate() - 1); }
  return { cur, best: Math.max(best, cur) };
}

// ---------- Word bank ----------
export const wordKey = (w) => w.trim();
export const getWord = (word) => state.words[wordKey(word)];

export function addWord(entry, src) {
  const key = wordKey(entry.word);
  const now = Date.now();
  const prev = state.words[key];
  state.words[key] = {
    word: key,
    pos: entry.pos || prev?.pos || '',
    meaning: entry.meaning ?? prev?.meaning ?? '',
    forms: [...new Set([...(prev?.forms || []), ...(entry.forms || []), key])].filter((f) => f && !f.startsWith('-')),
    src: prev?.src || src || null,
    custom: !!(entry.custom ?? prev?.custom),
    status: entry.status || prev?.status || 'learning',
    added: prev?.added || now,
    updated: now,
    srs: prev?.srs || null,
  };
  if (!prev) logActivity('added');
  save();
  return state.words[key];
}

// Returns a function that restores the removed entry (for "Annuler").
export function removeWord(word) {
  const key = wordKey(word);
  const prev = state.words[key];
  if (!prev) return () => {};
  delete state.words[key];
  state.meta.removed = { ...(state.meta.removed || {}), [key]: Date.now() };
  save();
  return () => {
    state.words[key] = { ...prev, updated: Date.now() };
    if (state.meta.removed) delete state.meta.removed[key];
    save();
  };
}

export function setWordStatus(word, status) {
  const w = getWord(word);
  if (!w) return;
  w.status = status; w.updated = Date.now();
  save();
}

// ---------- Text progress ----------
export const textState = (id) => (state.texts[id] ||= {});
export function patchText(id, patch) {
  Object.assign(textState(id), patch, { updated: Date.now() });
  save();
}

// ---------- Settings ----------
export function setSetting(k, v) {
  state.settings[k] = v;
  save();
}

// ---------- Backup ----------
export function exportData() {
  flush();
  return { app: 'dadok-plus', ...JSON.parse(JSON.stringify(state)), exportedAt: Date.now() };
}

export function summarize(d) {
  const words = Object.values(d.words || {});
  return {
    words: words.length,
    known: words.filter((w) => w.status === 'known').length,
    read: Object.values(d.texts || {}).filter((t) => t.read).length,
    days: Object.keys(d.activity || {}).length,
    device: d.meta?.device || '?',
    date: d.exportedAt || d.meta?.updated || 0,
  };
}

export function validateImport(d) {
  if (!d || typeof d !== 'object' || d.app !== 'dadok-plus' || !d.v) throw new Error('Ce fichier ne vient pas de 다독+.');
  if (d.v > SCHEMA) throw new Error('Sauvegarde créée par une version plus récente de l’appli.');
  return d;
}

// Merge another device's data into ours: newest wins per word, progress is
// combined (read if read anywhere, furthest position), activity takes the max per day.
export function mergeData(other) {
  const o = normalize(other);
  const removed = { ...(o.meta.removed || {}), ...(state.meta.removed || {}) };
  for (const [k, w] of Object.entries(o.words)) {
    const mine = state.words[k];
    if (!mine) {
      if (removed[k] && removed[k] > (w.updated || 0) && (state.meta.removed || {})[k]) continue; // deleted here after
      state.words[k] = w;
    } else if ((w.updated || 0) > (mine.updated || 0)) state.words[k] = { ...w, forms: [...new Set([...(mine.forms || []), ...(w.forms || [])])] };
  }
  // Words deleted on the other device after our last change.
  for (const [k, t] of Object.entries(o.meta.removed || {})) {
    if (state.words[k] && t > (state.words[k].updated || 0)) delete state.words[k];
  }
  state.meta.removed = removed;
  for (const [id, t] of Object.entries(o.texts)) {
    const m = state.texts[id] || {};
    state.texts[id] = {
      ...m, ...((t.updated || 0) > (m.updated || 0) ? t : {}),
      read: !!(m.read || t.read),
      readAt: Math.max(m.readAt || 0, t.readAt || 0) || undefined,
      progress: Math.max(m.progress || 0, t.progress || 0),
      fav: (t.updated || 0) > (m.updated || 0) ? t.fav : m.fav,
      quiz: best(m.quiz, t.quiz),
      opened: Math.max(m.opened || 0, t.opened || 0) || undefined,
    };
  }
  for (const [day, a] of Object.entries(o.activity)) {
    const m = state.activity[day] || {};
    state.activity[day] = {
      read: Math.max(m.read || 0, a.read || 0), sec: Math.max(m.sec || 0, a.sec || 0),
      cards: Math.max(m.cards || 0, a.cards || 0), added: Math.max(m.added || 0, a.added || 0),
    };
  }
  save(); flush();
}
const best = (a, b) => (!a ? b : !b ? a : (b.c / b.n > a.c / a.n ? b : a));

export function replaceData(other) {
  const o = normalize(other);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, o);
  save(); flush();
}

export function markBackedUp() { state.meta.lastBackup = Date.now(); save(); }

// Compact transfer code: gzip + base64url, prefixed so we can recognise it.
const PREFIX = 'DADOK1.';
export async function toCode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let out = bytes;
  if ('CompressionStream' in window) {
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    out = new Uint8Array(await new Response(s).arrayBuffer());
  }
  let bin = '';
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return PREFIX + ('CompressionStream' in window ? 'z' : 'p') + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function fromCode(code) {
  code = code.trim().replace(/\s+/g, '');
  if (code.startsWith('{')) return JSON.parse(code);
  if (!code.startsWith(PREFIX)) throw new Error('Code non reconnu : il doit commencer par DADOK1.');
  const kind = code[PREFIX.length];
  const b64 = code.slice(PREFIX.length + 1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  let bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  if (kind === 'z') {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(s).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
