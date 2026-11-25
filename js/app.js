// App shell: theme, navigation (burger drawer on mobile), hash router.
import { loadData } from './data.js';
import { state, subscribe } from './store.js';
import { dueCount } from './srs.js';
import { icon, onSwipe, closeSheet, $, $$ } from './util.js';

const NAV = [
  { href: '#/', id: 'library', label: 'Bibliothèque', icon: 'book' },
  { href: '#/words', id: 'words', label: 'Banque de mots', icon: 'bank' },
  { href: '#/cards', id: 'cards', label: 'Flashcards', icon: 'cards' },
  { href: '#/stats', id: 'stats', label: 'Statistiques', icon: 'stats' },
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
  requestAnimationFrame(() => {
    $('meta[name="theme-color"]').content = getComputedStyle(document.body).backgroundColor;
  });
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
onSwipe(drawer, { onSwipe: (d) => d === 'left' && closeDrawer(), enabled: () => true, threshold: 60 });

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
  const fresh = viewRef.cloneNode(false);
  fresh.className = '';
  viewRef.replaceWith(fresh);
  viewRef = fresh;
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
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// Ask the browser not to evict our data (helps on phones).
if (navigator.storage?.persist) navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
