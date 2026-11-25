// App shell: theme, navigation (burger drawer on mobile), hash router.
import { loadData } from './data.js';
import { state, subscribe } from './store.js';
import { dueCount } from './srs.js';
import { icon, onSwipe, closeSheet, toast, $, $$ } from './util.js';

const NAV = [
  { href: '#/', id: 'library', label: 'Bibliothèque', icon: 'book', tab: true },
  { href: '#/words', id: 'words', label: 'Banque de mots', short: 'Mots', icon: 'bank', tab: true },
  { href: '#/cards', id: 'cards', label: 'Flashcards', short: 'Cartes', icon: 'cards', tab: true },
  { href: '#/stats', id: 'stats', label: 'Statistiques', short: 'Stats', icon: 'stats', tab: true },
  { href: '#/backup', id: 'backup', label: 'Sauvegarde & transfert', icon: 'backup', sep: true },
  { href: '#/settings', id: 'settings', label: 'Paramètres', icon: 'settings' },
];

// ---------- Theme ----------
const mq = matchMedia('(prefers-color-scheme: dark)');
export function applySettings() {
  const S = state.settings, root = document.documentElement;
  const mode = S.mode === 'auto' ? (mq.matches ? 'dark' : 'light') : S.mode;
  root.dataset.style = S.style;
  root.dataset.mode = mode;
  root.style.setProperty('--read-size', `${S.fontSize}px`);
  root.style.setProperty('--read-lh', S.lineHeight);
  root.style.setProperty('--read-font', S.readFont === 'serif' ? 'var(--font-serif-ko)' : 'var(--font-sans-ko)');
  const body = $('.text-body');
  if (body) { body.classList.toggle('show-known', S.showKnown); body.classList.toggle('hide-gloss', !S.showGloss); }
  // Phone status bar colour. Read the --bg token, NOT body's computed background:
  // body animates its background (0.25 s), so it would still hold the OLD theme.
  root.style.colorScheme = mode;
  $('meta[name="theme-color"]').content = getComputedStyle(root).getPropertyValue('--bg').trim() || (mode === 'dark' ? '#1A1613' : '#FAF6EE');
}
mq.addEventListener('change', () => state.settings.mode === 'auto' && applySettings());

// ---------- Navigation ----------
function renderNav(active) {
  const due = dueCount();
  const words = Object.keys(state.words).length;
  const count = (id) => id === 'cards' && due ? `<span class="count due">${due}</span>` : id === 'words' && words ? `<span class="count">${words}</span>` : '';
  $('.topnav').innerHTML = NAV.map((n) => `<a href="${n.href}" class="${n.id === active ? 'on' : ''}" ${n.id === active ? 'aria-current="page"' : ''}>${n.label}${n.id === 'cards' && due ? ` <span class="badge">${due}</span>` : ''}</a>`).join('');
  $('.drawer-nav').innerHTML = NAV.map((n) => `${n.sep ? '<hr>' : ''}<a href="${n.href}" class="${n.id === active ? 'on' : ''}" ${n.id === active ? 'aria-current="page"' : ''}>${icon(n.icon)}${n.label}${count(n.id)}</a>`).join('');
  $('.topbar-right').innerHTML = due && active !== 'cards'
    ? `<a class="btn sm soft" href="#/cards" aria-label="${due} cartes à réviser">${icon('cards', 16)} ${due}</a>` : '';
  $('.tabbar').innerHTML = NAV.filter((n) => n.tab).map((n) =>
    `<a href="${n.href}" class="${n.id === active || (active === 'reader' && n.id === 'library') ? 'on' : ''}" ${n.id === active ? 'aria-current="page"' : ''}>
      <span class="ti">${icon(n.icon, 22)}</span>${n.short || n.label}${n.id === 'cards' && due ? `<span class="tb">${due}</span>` : ''}</a>`).join('');
  const st = state.meta.lastBackup;
  $('.drawer-foot').innerHTML = `Niveaux 1 à 4 · 326 textes<br>${!st || Date.now() - st > 7 * 864e5 ? '⚠️ Pense à sauvegarder tes données' : 'Données sauvegardées récemment ✓'}`;
}

const drawer = $('#drawer'), scrim = $('.drawer-scrim'), burger = $('.burger');
function openDrawer() {
  scrim.hidden = false;
  requestAnimationFrame(() => { scrim.classList.add('open'); drawer.classList.add('open'); });
  drawer.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true');
  setTimeout(() => $('a', drawer)?.focus({ preventScroll: true }), 50);
}
function closeDrawer() {
  if (!drawer.classList.contains('open')) return;
  scrim.classList.remove('open'); drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true'); burger.setAttribute('aria-expanded', 'false');
  setTimeout(() => (scrim.hidden = true), 280);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]')?.dataset.action;
  if (a === 'drawer-open') openDrawer();
  if (a === 'drawer-close') closeDrawer();
  if (e.target.closest('.drawer-nav a')) closeDrawer();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());
onSwipe(drawer, { onSwipe: (d) => d === 'right' && closeDrawer(), enabled: () => true, threshold: 60 });

// Swipe in from the right edge of the screen opens the menu.
(() => {
  let x0 = null, y0 = 0;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    x0 = state.settings.gestures && e.touches.length === 1 && t.clientX > innerWidth - 24 && !drawer.classList.contains('open') && !$('.sheet') ? t.clientX : null;
    y0 = t.clientY;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (x0 == null) return;
    const t = e.touches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
    if (dy > 40) x0 = null;
    else if (dx < -50) { x0 = null; openDrawer(); }
  }, { passive: true });
})();

// ---------- Scroll: hide the tab bar while reading down, show it on the way up ----------
let lastY = scrollY;
const fabEl = $('.fab'), topBtn = $('.to-top');
addEventListener('scroll', () => {
  const y = scrollY, dy = y - lastY;
  const nearBottom = y + innerHeight >= document.documentElement.scrollHeight - 40;
  if (Math.abs(dy) > 6) {
    const hide = dy > 0 && y > 120 && !nearBottom;
    document.body.classList.toggle('tabs-hidden', hide);
    fabEl.classList.toggle('mini', hide);
    lastY = y;
  }
  if (nearBottom) document.body.classList.remove('tabs-hidden');
  topBtn.hidden = !(showTopBtn && y > 1400);
}, { passive: true });
topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
let showTopBtn = false;

// ---------- Contextual action button ----------
// setFab({ label, icon, href }) or setFab(null). Views call it after mounting.
export function setFab(cfg) {
  if (!cfg) { fabEl.hidden = true; fabEl.removeAttribute('href'); return; }
  fabEl.hidden = false;
  fabEl.href = cfg.href;
  fabEl.setAttribute('aria-label', cfg.label);
  fabEl.innerHTML = `${icon(cfg.icon || 'next', 22)}<span>${cfg.label}</span>`;
  fabEl.classList.remove('mini');
}

// ---------- Router ----------
const view = $('#view');
let viewRef = view;
let cleanup = null;
const ROUTES = [
  [/^#\/t\/(.+)$/, 'reader', () => import('./views/reader.js').then((m) => m.mountReader)],
  [/^#\/words$/, 'words', () => import('./views/words.js').then((m) => m.mountWords)],
  [/^#\/cards$/, 'cards', () => import('./views/cards.js').then((m) => m.mountCards)],
  [/^#\/stats$/, 'stats', () => import('./views/stats.js').then((m) => m.mountStats)],
  [/^#\/settings$/, 'settings', () => import('./views/settings.js').then((m) => m.mountSettings)],
  [/^#\/backup$/, 'backup', () => import('./views/backup.js').then((m) => m.mountBackup)],
  [/^.*$/, 'library', () => import('./views/library.js').then((m) => m.mountLibrary)],
];

let lastHash = null;
const scrollMem = {};
// Re-mount the current view on a fresh element (keeps the scroll position).
export async function rerender() {
  const y = scrollY;
  lastHash = null;
  await route();
  scrollTo(0, y);
}
async function route() {
  const h = location.hash || '#/';
  if (lastHash) scrollMem[lastHash] = scrollY;
  const [re, id, load] = ROUTES.find(([r]) => r.test(h));
  const arg = h.match(re)[1] && decodeURIComponent(h.match(re)[1]);
  const mount = await load();
  closeSheet(); closeDrawer();
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  // Fresh element so old listeners from the previous view are dropped.
  // (A brand-new element, not a clone: a clone would copy data-* flags such as
  // data-bound and the next view would think its listeners are already attached.)
  const fresh = Object.assign(document.createElement('main'), { id: 'view', tabIndex: -1 });
  viewRef.replaceWith(fresh);
  viewRef = fresh;
  setFab(null);
  document.body.classList.remove('tabs-hidden');
  showTopBtn = id === 'library' || id === 'words';
  topBtn.hidden = true;
  cleanup = mount(fresh, arg) || null;
  renderNav(id);
  document.title = `${id === 'reader' ? (document.querySelector('.reader h1')?.textContent + ' · ') : ''}다독+`;
  scrollTo(0, id === 'library' && lastHash !== h ? (scrollMem[h] || 0) : 0);
  lastHash = h;
}

subscribe(() => {
  clearTimeout(subscribe.t);
  subscribe.t = setTimeout(() => {
    const active = (ROUTES.find(([r]) => r.test(location.hash || '#/')) || [])[1];
    renderNav(active);
  }, 120);
});

// ---------- Boot ----------
applySettings();
loadData().then(() => {
  addEventListener('hashchange', route);
  route();
}).catch((e) => {
  console.error(e);
  view.innerHTML = '<div class="empty"><b>Impossible de charger les textes</b>Ouvre l’appli via un serveur (voir le README), pas en double-cliquant sur le fichier.</div>';
});

// Offline cache (skipped on localhost so edits show up immediately; add ?sw to test it).
const devHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes('sw');
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !devHost) {
  const hadController = !!navigator.serviceWorker.controller;
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
  // A new service worker took over: reload right away if we just opened the app,
  // otherwise offer it (don't interrupt a reading in progress).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (performance.now() < 6000) location.reload();
    else offerReload();
  });
}

// ---------- New version detection ----------
// When the app comes back to the foreground (a phone PWA stays in memory for
// days), ask the server whether any app file changed since this page loaded.
const WATCH = ['index.html', 'css/app.css', 'js/app.js', 'js/util.js', 'js/store.js', 'js/data.js', 'js/text.js',
  'js/srs.js', 'js/audio.js', 'js/views/library.js', 'js/views/reader.js', 'js/views/words.js', 'js/views/cards.js',
  'js/views/stats.js', 'js/views/settings.js', 'js/views/backup.js', 'data/texts.json'];
const stamp = async (f) => {
  const r = await fetch(f, { method: 'HEAD', cache: 'no-store' });
  return r.ok ? (r.headers.get('etag') || r.headers.get('last-modified')) : null;
};
const signature = () => Promise.all(WATCH.map((f) => stamp(f).catch(() => null)));
let baseline = null, offered = false, lastCheck = 0;
export async function checkForUpdate() {
  if (!navigator.onLine || offered) return false;
  lastCheck = Date.now();
  const now = await signature();
  if (!baseline) { baseline = now; return false; }
  const changed = now.some((s, i) => s && baseline[i] && s !== baseline[i]);
  if (changed) offerReload();
  return changed;
}
function offerReload() {
  if (offered) return;
  offered = true;
  toast('Nouvelle version de l’appli disponible', { action: 'Mettre à jour', ms: 60000, onAction: () => location.reload() });
}
addEventListener('load', () => setTimeout(checkForUpdate, 3000));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastCheck > 60000) {
    navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    checkForUpdate();
  }
});
setInterval(() => document.visibilityState === 'visible' && checkForUpdate(), 10 * 60000);
// Ask the browser not to evict our data (helps on phones).
if (navigator.storage?.persist) navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
