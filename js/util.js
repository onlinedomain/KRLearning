// Small DOM + formatting helpers.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);

// Tagged template: interpolations are escaped unless raw() or arrays of raw.
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += flat(vals[i]);
  });
  return raw(out);
}
function flat(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(flat).join('');
  return esc(v);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function relDays(ts) {
  if (!ts) return 'jamais';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  return `il y a ${d} jours`;
}

export function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

// ---------- Toast ----------
export function toast(msg, { action, onAction, ms = 3800 } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  root.replaceChildren(el);
  const t = setTimeout(() => el.remove(), ms);
  if (action) el.querySelector('button').onclick = () => { clearTimeout(t); el.remove(); onAction?.(); };
}

// ---------- Bottom sheet ----------
let sheetCleanup = null;
export function openSheet(content, { onClose, label = 'Fenêtre' } = {}) {
  closeSheet();
  const root = document.getElementById('sheet-root');
  root.innerHTML = `<div class="sheet-scrim"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="grab"></div>
      <button class="icon-btn close" data-sheet-close aria-label="Fermer">${icon('x')}</button>
      <div class="sheet-body">${content}</div>
    </div>`;
  const sheet = root.querySelector('.sheet');
  const close = () => closeSheet();
  root.querySelector('.sheet-scrim').onclick = close;
  root.querySelectorAll('[data-sheet-close]').forEach((b) => (b.onclick = close));
  const key = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  // Drag the grab handle down to dismiss.
  let y0 = null;
  sheet.addEventListener('touchstart', (e) => { if (sheet.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (dy > 110) close(); else sheet.style.transform = '';
  });
  sheetCleanup = () => { document.removeEventListener('keydown', key); onClose?.(); };
  setTimeout(() => sheet.querySelector('button:not(.close), input, a')?.focus({ preventScroll: true }), 50);
  return sheet;
}
export function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (!root.firstChild) return;
  root.innerHTML = '';
  const c = sheetCleanup; sheetCleanup = null; c?.();
}

// ---------- Horizontal swipe ----------
// Calls onSwipe('left'|'right') when a mostly-horizontal swipe passes threshold.
// onMove(dx) lets callers animate while dragging.
export function onSwipe(el, { onSwipe: cb, onMove, threshold = 80, enabled = () => true }) {
  let x0, y0, dx, locked, active = false;
  el.addEventListener('touchstart', (e) => {
    if (!enabled() || e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; locked = null; active = true;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!active) return;
    const x = e.touches[0].clientX - x0, y = e.touches[0].clientY - y0;
    if (locked == null && Math.hypot(x, y) > 12) locked = Math.abs(x) > Math.abs(y) * 1.4 ? 'h' : 'v';
    if (locked === 'h') { dx = x; onMove?.(dx); }
  }, { passive: true });
  const end = () => {
    if (!active) return;
    active = false;
    if (locked === 'h' && Math.abs(dx) >= threshold) cb(dx < 0 ? 'left' : 'right');
    onMove?.(0, true);
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

// ---------- Text-to-speech (single word / fallback) ----------
let koVoice = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() || [];
  koVoice = vs.find((v) => v.lang?.toLowerCase().startsWith('ko')) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
export const hasTTS = () => 'speechSynthesis' in window;
export function speak(text, { rate = 1, onend } = {}) {
  if (!hasTTS()) { onend?.(); return null; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = rate;
  if (koVoice) u.voice = koVoice;
  if (onend) { u.onend = onend; u.onerror = onend; }
  speechSynthesis.speak(u);
  return u;
}
export const stopSpeech = () => { if (hasTTS()) speechSynthesis.cancel(); };

// ---------- Tooltip (charts) ----------
let tipEl = null;
export function bindTooltips(root) {
  const show = (t) => {
    const s = t.dataset.tip; if (!s) return;
    tipEl ??= Object.assign(document.createElement('div'), { className: 'tooltip' });
    document.body.append(tipEl);
    tipEl.textContent = s;
    const r = t.getBoundingClientRect();
    tipEl.style.left = `${Math.min(innerWidth - 80, Math.max(80, r.left + r.width / 2))}px`;
    tipEl.style.top = `${r.top}px`;
  };
  const hide = () => tipEl?.remove();
  root.addEventListener('pointerover', (e) => { const t = e.target.closest('[data-tip]'); if (t) show(t); });
  root.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) hide(); });
  root.addEventListener('click', (e) => { const t = e.target.closest('[data-tip]'); if (t) { show(t); setTimeout(hide, 1800); } });
}

// ---------- Icons (inline SVG, stroke = currentColor) ----------
const P = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  bank: '<path d="M5 4h14v17l-7-4-7 4z"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  backup: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  paste: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 18l-8.5-6L18 6zM6 6v12"/>',
  skip: '<path d="M6 6l8.5 6L6 18zM18 6v12"/>',
  speaker: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  heartFill: '<path fill="currentColor" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  translate: '<path d="M4 5h8M8 3v2M5 9c1.5 3 4 5 7 6M11 5c-1 4-3 7-7 9"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
};
export const icon = (name, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const levelBadge = (n) =>
  `<span class="lv" title="Niveau ${n}"><i>${[1, 2, 3, 4].map((k) => `<b class="${k <= n ? 'f' : ''}"></b>`).join('')}</i>Niv. ${n}</span>`;
