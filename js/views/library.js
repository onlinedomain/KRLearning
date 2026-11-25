// Library: continue reading, search, many filters, sorting, grouping.
import { rerender, setFab } from '../app.js';
import { db, TYPES, TOPICS_FR, LEVELS } from '../data.js';
import { state, save, streak, wordKey } from '../store.js';
import { dueCount } from '../srs.js';
import { html, raw, esc, icon, levelBadge, openSheet, closeSheet, debounce, shuffle, dayKey, $, $$ } from '../util.js';

const DEFAULT_F = {
  q: '', inText: false, levels: [], types: [], tags: [], mins: [], status: 'all', vocab: 'all',
  quiz: 'all', grammar: '', domain: '', series: '', sort: 'order',
};
const STATUS = { all: 'Tous', unread: 'Non lus', progress: 'En cours', read: 'Lus', fav: 'Favoris' };
const VOCAB = { all: 'Peu importe', bank: 'Contient des mots de ma banque', easy: 'Plutôt facile pour moi (≥ 50 % des mots clés déjà vus)', fresh: 'Beaucoup de mots nouveaux (≥ 80 %)' };
const QUIZ = { all: 'Peu importe', none: 'Quiz pas encore fait', perfect: 'Quiz réussi sans faute', missed: 'Quiz avec erreurs' };
const SORT = {
  order: 'Ordre de lecture', short: 'Plus courts d’abord', long: 'Plus longs d’abord', fewWords: 'Moins de mots clés',
  manyWords: 'Plus de mots clés', recent: 'Ouverts récemment', title: 'Titre (가나다)', random: 'Aléatoire',
};

const F = () => (state.ui.lib = { ...DEFAULT_F, ...(state.ui.lib || {}) });
let randomSeed = null;

function bankForms() {
  const s = new Set();
  Object.values(state.words).forEach((w) => s.add(wordKey(w.word)));
  return s;
}
const seenRatio = (t, bank) => t.vocab.length ? t.vocab.filter((v) => bank.has(wordKey(v.word))).length / t.vocab.length : 0;

export function filterTexts(f) {
  const bank = bankForms();
  const q = f.q.trim().toLowerCase();
  let list = db.order.filter((t) => {
    const ts = state.texts[t.id] || {};
    if (f.levels.length && !f.levels.includes(t.level)) return false;
    if (f.types.length && !f.types.includes(t.type)) return false;
    if (f.tags.length && !(t.tags || []).some((g) => f.tags.includes(g))) return false;
    if (f.mins.length && !f.mins.includes(t.minutes)) return false;
    if (f.grammar && t.grammar?.pattern?.trim() !== f.grammar) return false;
    if (f.domain && t.domain !== f.domain) return false;
    if (f.series && t.series !== f.series) return false;
    if (f.status === 'unread' && (ts.read || ts.progress > 0)) return false;
    if (f.status === 'progress' && (ts.read || !(ts.progress > 0))) return false;
    if (f.status === 'read' && !ts.read) return false;
    if (f.status === 'fav' && !ts.fav) return false;
    if (f.quiz === 'none' && ts.quiz) return false;
    if (f.quiz === 'perfect' && !(ts.quiz && ts.quiz.c === ts.quiz.n)) return false;
    if (f.quiz === 'missed' && !(ts.quiz && ts.quiz.c < ts.quiz.n)) return false;
    if (f.vocab !== 'all') {
      const r = seenRatio(t, bank);
      if (f.vocab === 'bank' && !t.vocab.some((v) => bank.has(wordKey(v.word))) && !Object.values(state.words).some((w) => w.forms?.some((fm) => fm.length > 1 && t.paragraphs.some((p) => p.ko.includes(fm))))) return false;
      if (f.vocab === 'easy' && r < 0.5) return false;
      if (f.vocab === 'fresh' && r > 0.2) return false;
    }
    if (q) {
      if (t._hay.includes(q)) return true;
      if (f.inText && t.paragraphs.some((p) => p.ko.includes(f.q.trim()) || p.en.toLowerCase().includes(q))) return true;
      return false;
    }
    return true;
  });
  const S = f.sort;
  if (S === 'short') list.sort((a, b) => a.minutes - b.minutes || a._ord - b._ord);
  if (S === 'long') list.sort((a, b) => b.minutes - a.minutes || a._ord - b._ord);
  if (S === 'fewWords') list.sort((a, b) => a.vocab.length - b.vocab.length);
  if (S === 'manyWords') list.sort((a, b) => b.vocab.length - a.vocab.length);
  if (S === 'recent') list.sort((a, b) => (state.texts[b.id]?.opened || 0) - (state.texts[a.id]?.opened || 0));
  if (S === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  if (S === 'random') { randomSeed ??= shuffle(db.texts.map((t) => t.id)); list.sort((a, b) => randomSeed.indexOf(a.id) - randomSeed.indexOf(b.id)); }
  return list;
}

const advancedCount = (f) =>
  ['types', 'tags', 'mins'].reduce((n, k) => n + (f[k].length ? 1 : 0), 0) +
  ['status', 'vocab', 'quiz'].reduce((n, k) => n + (f[k] !== 'all' ? 1 : 0), 0) +
  ['grammar', 'domain', 'series'].reduce((n, k) => n + (f[k] ? 1 : 0), 0) + (f.inText ? 1 : 0);

function card(t) {
  const ts = state.texts[t.id] || {};
  const typeLbl = t.type === 'series' ? `${t.series} · ép. ${t.episode}` : TYPES[t.type].fr;
  return `<a class="card text-card${ts.read ? ' read' : ''}" href="#/t/${t.id}">
    ${ts.fav ? `<span class="fav-dot">${icon('heartFill', 16)}</span>` : ''}
    <span class="t-ko" lang="ko">${esc(t.title)}</span>
    <span class="t-en">${esc(t.titleEn)}</span>
    <span class="t-meta">${levelBadge(t.level)}<span>${esc(typeLbl)}</span><span>${t.minutes} min</span><span>${t.vocab.length} mots</span>
      ${ts.quiz ? `<span>Quiz ${ts.quiz.c}/${ts.quiz.n}</span>` : ''}</span>
    <span class="t-sum">${esc(t.summary)}</span>
    ${ts.progress > 0 && !ts.read ? `<span class="prog"><i style="width:${Math.round(ts.progress * 100)}%"></i></span>` : ''}
  </a>`;
}

export function mountLibrary(root) {
  const f = F();
  const st = streak();
  const due = dueCount();
  const today = state.activity[dayKey()] || {};
  const cont = Object.entries(state.texts)
    .filter(([id, x]) => db.byId.has(id) && !x.read && x.progress > 0)
    .sort((a, b) => (b[1].opened || 0) - (a[1].opened || 0))[0];
  const ct = cont && db.byId.get(cont[0]);
  const readCount = Object.values(state.texts).filter((x) => x.read).length;

  root.innerHTML = String(html`
    <section class="hero">
      <h1 lang="ko">오늘도 읽어 볼까요?</h1>
      <p>${readCount} / ${db.texts.length} textes lus · ${Object.keys(state.words).length} mots dans ta banque</p>
      <div class="hero-stats">
        <span class="pill-stat">${raw(icon('flame', 18))} <b>${st.cur}</b> jour${st.cur > 1 ? 's' : ''} d’affilée</span>
        <span class="pill-stat">${raw(icon('book', 18))} <b>${today.read || 0} / ${state.settings.dailyGoal}</b> aujourd’hui</span>
        ${due ? html`<a class="pill-stat accent" href="#/cards">${raw(icon('cards', 18))} <b>${due}</b> carte${due > 1 ? 's' : ''} à réviser</a>` : ''}
      </div>
    </section>
    ${ct ? html`<a class="card continue" href="#/t/${ct.id}">
        <span class="ring" style="--p:${Math.round(cont[1].progress * 100)}"><span>${Math.round(cont[1].progress * 100)}%</span></span>
        <span style="min-width:0"><span class="muted small">Continuer la lecture</span><br><b style="font-family:var(--font-title);font-size:17px" lang="ko">${ct.title}</b>
        <span class="muted small"> · ${ct.titleEn}</span></span>
        <span class="spacer"></span>${raw(icon('next'))}</a>` : ''}

    <div class="lib-tools">
      <div class="search">
        ${raw(icon('search', 18))}
        <input class="input" type="search" id="q" placeholder="Rechercher : titre, résumé, grammaire… (coréen ou anglais)" value="${f.q}" aria-label="Rechercher" autocomplete="off">
        <button class="icon-btn clear" data-act="clear-q" aria-label="Effacer" ${f.q ? '' : 'hidden'}>${raw(icon('x', 18))}</button>
      </div>
      <div class="row">
        <div class="chips scroll" style="flex:1">
          ${LEVELS.map((L) => html`<button class="chip ${f.levels.includes(L.n) ? 'on' : ''}" data-lv="${L.n}">Niv. ${L.n} <span class="n">${L.ko}</span></button>`)}
          ${Object.entries(STATUS).filter(([k]) => k !== 'all').map(([k, v]) => html`<button class="chip ${f.status === k ? 'on' : ''}" data-st="${k}">${v}</button>`)}
        </div>
      </div>
    </div>
    <div class="result-bar">
      <button class="btn sm" data-act="filters">${raw(icon('filter', 16))} Filtres ${advancedCount(f) ? raw(`<span class="badge">${advancedCount(f)}</span>`) : ''}</button>
      <select class="input" id="sort" aria-label="Trier">${Object.entries(SORT).map(([k, v]) => html`<option value="${k}" ${f.sort === k ? 'selected' : ''}>${v}</option>`)}</select>
      <button class="btn sm ghost" data-act="surprise" title="Ouvrir un texte au hasard parmi les résultats">${raw(icon('shuffle', 16))} Au hasard</button>
      <span class="spacer"></span>
      <span id="count"></span>
      <button class="btn sm ghost" data-act="reset" id="reset">Réinitialiser</button>
    </div>
    <div class="text-list" id="list"></div>
  `);

  const nextUp = ct || db.order.find((t) => !state.texts[t.id]?.read);
  if (nextUp) setFab({ label: ct ? 'Continuer' : (readCount ? 'Texte suivant' : 'Commencer'), icon: 'play', href: `#/t/${nextUp.id}` });
  const listEl = $('#list', root);
  function renderList() {
    const list = filterTexts(f);
    $('#count', root).textContent = `${list.length} texte${list.length > 1 ? 's' : ''}`;
    $('#reset', root).hidden = JSON.stringify(f) === JSON.stringify({ ...DEFAULT_F, sort: f.sort });
    if (!list.length) {
      listEl.innerHTML = '<div class="empty" style="grid-column:1/-1"><b>Aucun texte ne correspond</b>Essaie d’enlever un filtre.</div>';
      return;
    }
    if (f.sort === 'order') {
      let out = '', lv = 0;
      for (const t of list) {
        if (t.level !== lv) {
          lv = t.level;
          const L = LEVELS[lv - 1];
          const n = list.filter((x) => x.level === lv).length;
          const r = list.filter((x) => x.level === lv && state.texts[x.id]?.read).length;
          out += `<div class="group-h"><h2>Niveau ${lv}</h2><span class="muted" lang="ko">${L.ko}</span><span class="muted small">· ${r}/${n} lus</span></div>`;
        }
        out += card(t);
      }
      listEl.innerHTML = out;
    } else listEl.innerHTML = list.map(card).join('');
  }
  renderList();

  const persist = () => { save(); renderList(); };
  const qIn = $('#q', root);
  qIn.addEventListener('input', debounce(() => {
    f.q = qIn.value; $('[data-act="clear-q"]', root).hidden = !f.q; persist();
  }, 140));
  $('#sort', root).addEventListener('change', (e) => { f.sort = e.target.value; randomSeed = null; persist(); });

  root.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-lv]');
    if (lv) {
      const n = +lv.dataset.lv;
      f.levels = f.levels.includes(n) ? f.levels.filter((x) => x !== n) : [...f.levels, n];
      lv.classList.toggle('on'); persist(); return;
    }
    const sb = e.target.closest('[data-st]');
    if (sb) {
      f.status = f.status === sb.dataset.st ? 'all' : sb.dataset.st;
      $$('[data-st]', root).forEach((b) => b.classList.toggle('on', b.dataset.st === f.status)); persist(); return;
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'clear-q') { f.q = ''; qIn.value = ''; e.target.closest('button').hidden = true; persist(); qIn.focus(); }
    if (a === 'reset') { Object.assign(f, DEFAULT_F, { sort: f.sort }); save(); rerender(); }
    if (a === 'filters') filterSheet(f, () => { save(); rerender(); });
    if (a === 'surprise') {
      const unread = filterTexts(f).filter((t) => !state.texts[t.id]?.read);
      const pool = unread.length ? unread : filterTexts(f);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) location.hash = `#/t/${pick.id}`;
    }
  });
}

function filterSheet(f, done) {
  const domains = [...new Set(db.texts.map((t) => t.domain).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const chipGroup = (key, entries) => `<div class="chips">${entries.map(([v, label, n]) =>
    `<button class="chip ${f[key].includes(v) ? 'on' : ''}" data-multi="${key}" data-v="${esc(v)}">${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
  const radio = (key, obj) => `<div class="chips">${Object.entries(obj).map(([v, label]) =>
    `<button class="chip ${f[key] === v ? 'on' : ''}" data-one="${key}" data-v="${v}">${esc(label)}</button>`).join('')}</div>`;
  const count = (fn) => db.texts.filter(fn).length;

  const sheet = openSheet(`
    <h2>Filtres</h2>
    <div class="fgroup" style="margin-top:16px"><h3>Type de texte</h3>
      ${chipGroup('types', Object.entries(TYPES).map(([k, v]) => [k, v.many, count((t) => t.type === k)]))}</div>
    <div class="fgroup"><h3>Thème</h3>
      ${chipGroup('tags', Object.entries(TOPICS_FR).map(([k, v]) => [k, v, count((t) => t.tags?.includes(k))]).filter((x) => x[2]))}</div>
    <div class="fgroup"><h3>Durée de lecture</h3>
      ${chipGroup('mins', [3, 4, 5, 6].map((m) => [m, `${m} min`, count((t) => t.minutes === m)]))}</div>
    <div class="fgroup"><h3>Progression</h3>${radio('status', STATUS)}</div>
    <div class="fgroup"><h3>Vocabulaire (selon ta banque de mots)</h3>${radio('vocab', VOCAB)}</div>
    <div class="fgroup"><h3>Quiz</h3>${radio('quiz', QUIZ)}</div>
    <div class="fgroup"><h3>Point de grammaire</h3>
      <select class="input" data-sel="grammar"><option value="">Tous les points de grammaire</option>
      ${db.grammar.map((g) => `<option value="${esc(g.pattern)}" ${f.grammar === g.pattern ? 'selected' : ''}>${esc(g.pattern)} · niv. ${g.level} (${g.n})</option>`).join('')}</select></div>
    <div class="fgroup"><h3>Série</h3>
      <select class="input" data-sel="series"><option value="">Toutes les séries</option>
      ${[...db.series.values()].map((s) => `<option value="${esc(s.name)}" ${f.series === s.name ? 'selected' : ''}>${esc(s.name)} · ${esc(s.en)} (niv. ${s.level}, ${s.eps.length} ép.)</option>`).join('')}</select></div>
    <div class="fgroup"><h3>Catégorie (actualités, contes, dialogues)</h3>
      <select class="input" data-sel="domain"><option value="">Toutes</option>
      ${domains.map((d) => `<option ${f.domain === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
    <div class="fgroup"><h3>Recherche</h3>
      <label class="row" style="cursor:pointer"><span class="switch"><input type="checkbox" data-bool="inText" ${f.inText ? 'checked' : ''}><i></i></span>
      Chercher aussi dans le contenu des textes (coréen et anglais)</label></div>
    <div class="sheet-actions">
      <button class="btn" data-f="clear">Tout effacer</button>
      <button class="btn primary" data-f="apply">Voir les résultats</button>
    </div>`, { label: 'Filtres', onClose: done });

  const live = () => { const n = filterTexts(f).length; sheet.querySelector('[data-f="apply"]').textContent = `Voir ${n} texte${n > 1 ? 's' : ''}`; };
  live();
  sheet.addEventListener('click', (e) => {
    const m = e.target.closest('[data-multi]');
    if (m) {
      const k = m.dataset.multi; const v = k === 'mins' ? +m.dataset.v : m.dataset.v;
      f[k] = f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v];
      m.classList.toggle('on'); live(); return;
    }
    const o = e.target.closest('[data-one]');
    if (o) {
      const k = o.dataset.one; f[k] = o.dataset.v;
      $$(`[data-one="${k}"]`, sheet).forEach((b) => b.classList.toggle('on', b === o)); live(); return;
    }
    const a = e.target.closest('[data-f]')?.dataset.f;
    if (a === 'clear') { Object.assign(f, DEFAULT_F, { q: f.q, levels: f.levels, sort: f.sort }); closeSheet(); }
    if (a === 'apply') closeSheet();
  });
  sheet.addEventListener('change', (e) => {
    if (e.target.dataset.sel) { f[e.target.dataset.sel] = e.target.value; live(); }
    if (e.target.dataset.bool) { f[e.target.dataset.bool] = e.target.checked; live(); }
  });
}
