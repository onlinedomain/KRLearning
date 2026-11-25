// Word bank: search, filter, one-tap remove (with undo), swipe-to-remove.
import { setFab } from '../app.js';
import { db, posFr, POS_FR } from '../data.js';
import { state, save, addWord, removeWord, setWordStatus, dictUrl, wordKey } from '../store.js';
import { isDue, isNew, fmtIvl, dueCount } from '../srs.js';
import { html, raw, esc, icon, toast, openSheet, closeSheet, speak, debounce, $, $$ } from '../util.js';

const FILTERS = { all: 'Tous', learning: 'À apprendre', due: 'À réviser', known: 'Connus', custom: 'Ajoutés par moi' };
const SORTS = { recent: 'Ajoutés récemment', alpha: 'Alphabétique (가나다)', due: 'Prochaine révision', hard: 'Les plus ratés' };
let ui = { q: '', f: 'all', sort: 'recent' };

export function mountWords(root) {
  const words = () => Object.values(state.words);
  root.innerHTML = String(html`
    <div class="page-head row" style="align-items:flex-end;flex-wrap:wrap">
      <div><h1>Ma banque de mots</h1><p id="wsum"></p></div>
      <span class="spacer"></span>
      <div class="row" style="gap:8px">
        <button class="btn primary" data-add>${raw(icon('plus', 18))} Ajouter un mot</button>
        <a class="btn" href="#/cards">${raw(icon('cards', 18))} Réviser</a>
      </div>
    </div>
    <div class="search" style="margin-top:12px">${raw(icon('search', 18))}
      <input class="input" type="search" id="wq" placeholder="Chercher un mot ou un sens" value="${ui.q}" aria-label="Chercher dans ma banque"></div>
    <div class="row" style="margin-top:10px;flex-wrap:wrap">
      <div class="chips scroll" style="flex:1">${Object.entries(FILTERS).map(([k, v]) => html`<button class="chip ${ui.f === k ? 'on' : ''}" data-f="${k}">${v} <span class="n" data-n="${k}"></span></button>`)}</div>
    </div>
    <div class="result-bar"><select class="input" id="wsort" aria-label="Trier">${Object.entries(SORTS).map(([k, v]) => html`<option value="${k}" ${ui.sort === k ? 'selected' : ''}>${v}</option>`)}</select>
      <span class="spacer"></span><span class="small muted">Glisse une ligne vers la gauche pour la retirer</span></div>
    <div class="wlist" id="wl"></div>
  `);

  const match = {
    all: () => true, learning: (w) => w.status !== 'known', due: (w) => isDue(w) || (isNew(w) && w.status !== 'known'),
    known: (w) => w.status === 'known', custom: (w) => w.custom,
  };

  function render() {
    const all = words();
    const due = dueCount();
    setFab(due ? { label: `Réviser ${due} carte${due > 1 ? 's' : ''}`, icon: 'cards', href: '#/cards' } : null);
    $('#wsum', root).textContent = `${all.length} mot${all.length > 1 ? 's' : ''} · ${all.filter((w) => w.status === 'known').length} connu${all.filter((w) => w.status === 'known').length > 1 ? 's' : ''}`;
    Object.keys(FILTERS).forEach((k) => { $(`[data-n="${k}"]`, root).textContent = all.filter(match[k]).length; });
    const q = ui.q.trim().toLowerCase();
    let list = all.filter(match[ui.f]).filter((w) => !q || w.word.includes(ui.q.trim()) || (w.meaning || '').toLowerCase().includes(q) || w.forms?.some((f) => f.includes(ui.q.trim())));
    if (ui.sort === 'recent') list.sort((a, b) => b.added - a.added);
    if (ui.sort === 'alpha') list.sort((a, b) => a.word.localeCompare(b.word, 'ko'));
    if (ui.sort === 'due') list.sort((a, b) => (a.srs?.due ?? 0) - (b.srs?.due ?? 0));
    if (ui.sort === 'hard') list.sort((a, b) => (b.srs?.lapses || 0) - (a.srs?.lapses || 0));
    const wl = $('#wl', root);
    if (!all.length) {
      wl.innerHTML = `<div class="empty"><b>Ta banque est vide</b>Ouvre un texte et touche un mot pour l’ajouter, ou ajoute-le toi-même.<br><br><button class="btn primary" data-add>${icon('plus', 18)} Ajouter un mot</button> <a class="btn" href="#/">Aller à la bibliothèque</a></div>`;
      return;
    }
    if (!list.length) { wl.innerHTML = '<div class="empty"><b>Aucun mot</b>Rien ne correspond à ce filtre.</div>'; return; }
    wl.innerHTML = list.map((w) => `
      <div class="wrow" data-k="${esc(w.word)}">
        <div class="bg">${icon('trash', 18)}&nbsp;Retirer</div>
        <div class="fg">
          ${isDue(w) ? '<span class="due-dot" title="À réviser"></span>' : ''}
          <button class="wk" data-a="open" lang="ko" style="background:none;border:0;padding:0;cursor:pointer">${esc(w.word)}</button>
          <div class="wm" data-a="open">${esc(w.meaning || '—')}${w.pos ? ` <span class="muted">· ${esc(posFr(w.pos))}</span>` : ''}
            <span class="src">${w.src?.title ? `${esc(w.src.title)} · ` : ''}${w.srs ? `prochaine révision ${w.srs.due <= Date.now() ? 'maintenant' : 'dans ' + fmtIvl((w.srs.due - Date.now()) / 86400000)}` : 'jamais révisé'}</span></div>
          <div class="acts">
            <button class="icon-btn known-btn ${w.status === 'known' ? 'on' : ''}" data-a="known" aria-label="${w.status === 'known' ? 'Remettre en révision' : 'Marquer comme connu'}" title="${w.status === 'known' ? 'Connu (toucher pour remettre en révision)' : 'Marquer comme connu'}">${icon('check', 20)}</button>
            <button class="icon-btn" data-a="remove" aria-label="Retirer ${esc(w.word)} de ma banque" title="Retirer">${icon('x', 20)}</button>
          </div>
        </div>
      </div>`).join('');
    $$('.wrow', wl).forEach(bindSwipe);
  }

  function remove(key) {
    const undo = removeWord(key);
    render();
    toast(`« ${key} » retiré`, { action: 'Annuler', onAction: () => { undo(); render(); } });
  }

  function bindSwipe(row) {
    const fg = $('.fg', row);
    let x0 = null, y0 = 0, dx = 0, lock = null;
    row.addEventListener('touchstart', (e) => { if (!state.settings.gestures) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null; fg.style.transition = 'none'; }, { passive: true });
    row.addEventListener('touchmove', (e) => {
      if (x0 == null) return;
      const x = e.touches[0].clientX - x0, y = e.touches[0].clientY - y0;
      if (lock == null && Math.hypot(x, y) > 10) lock = Math.abs(x) > Math.abs(y) ? 'h' : 'v';
      if (lock === 'h') { dx = Math.min(0, x); fg.style.transform = `translateX(${dx}px)`; }
    }, { passive: true });
    row.addEventListener('touchend', () => {
      if (x0 == null) return;
      x0 = null; fg.style.transition = '';
      if (dx < -row.offsetWidth * 0.35) { fg.style.transform = 'translateX(-100%)'; setTimeout(() => remove(row.dataset.k), 180); }
      else fg.style.transform = '';
    });
  }

  render();
  $('#wq', root).addEventListener('input', debounce((e) => { ui.q = e.target.value; render(); }, 120));
  $('#wsort', root).addEventListener('change', (e) => { ui.sort = e.target.value; render(); });
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) { addWordSheet(render); return; }
    const f = e.target.closest('[data-f]');
    if (f) { ui.f = f.dataset.f; $$('[data-f]', root).forEach((b) => b.classList.toggle('on', b === f)); render(); return; }
    const a = e.target.closest('[data-a]');
    if (!a?.closest('.wrow')) return;
    const key = a.closest('.wrow').dataset.k;
    if (a.dataset.a === 'remove') remove(key);
    if (a.dataset.a === 'known') {
      const w = state.words[key];
      setWordStatus(key, w.status === 'known' ? 'learning' : 'known');
      toast(w.status === 'known' ? `« ${key} » marqué comme connu` : `« ${key} » remis en révision`);
      render();
    }
    if (a.dataset.a === 'open') wordDetail(key, render);
  });
}

function wordDetail(key, after) {
  const w = state.words[key];
  const sheet = openSheet(`
    <div class="word-head"><span class="w-big" lang="ko">${esc(w.word)}</span>${w.custom ? '<span class="tag">ajouté à la main</span>' : ''}</div>
    <div class="field"><label for="dm">Sens</label><input id="dm" class="input" value="${esc(w.meaning)}"></div>
    <div class="field"><label for="dp">Classe grammaticale</label>${posSelect('dp', w.pos)}</div>
    <div class="field"><label for="df">Formes reconnues dans les textes (séparées par des virgules)</label><input id="df" class="input" lang="ko" value="${esc((w.forms || []).join(', '))}"></div>
    ${w.src?.sentence ? `<div class="ctx"><div class="k" lang="ko">${esc(w.src.sentence)}</div><div class="e">${esc(w.src.en || '')}</div>
      <div class="small muted" style="margin-top:6px">— <a href="#/t/${esc(w.src.id)}">${esc(w.src.title)}</a></div></div>` : ''}
    <p class="small muted">${w.srs ? `Révisé ${w.srs.reps} fois · raté ${w.srs.lapses} fois · intervalle ${fmtIvl(w.srs.ivl)}` : 'Jamais révisé'}</p>
    <div class="sheet-actions">
      <button class="btn" data-d="say">${icon('speaker', 18)} Prononcer</button>
      <a class="btn" href="${dictUrl(w.word)}" target="_blank" rel="noopener">Naver ${icon('ext', 16)}</a>
      <button class="btn" data-d="reset">Recommencer l’apprentissage</button>
      <button class="btn danger" data-d="remove">${icon('minus', 18)} Retirer</button>
    </div>`, { label: `Mot ${w.word}`, onClose: after });
  const commit = () => {
    if (!state.words[key]) return;
    w.meaning = $('#dm', sheet).value.trim();
    w.pos = $('#dp', sheet).value;
    w.forms = [...new Set($('#df', sheet).value.split(/[,，]/).map((s) => s.trim()).filter(Boolean).concat(w.word))];
    w.updated = Date.now(); save();
  };
  sheet.addEventListener('change', commit);
  sheet.addEventListener('click', (e) => {
    const d = e.target.closest('[data-d]')?.dataset.d;
    if (d === 'say') speak(w.word);
    if (d === 'reset') { w.srs = null; w.status = 'learning'; w.updated = Date.now(); save(); toast('Remis à zéro'); closeSheet(); }
    if (d === 'remove') {
      const undo = removeWord(key);
      closeSheet();
      toast(`« ${key} » retiré`, { action: 'Annuler', onAction: () => { undo(); after(); } });
    }
  });
}

// ---------- Manual add ----------
// One option per French label (POS_FR maps several English codes to the same label).
const POS_OPTIONS = [...new Map(Object.entries(POS_FR).map(([k, v]) => [v, k])).entries()];

function posSelect(id, value = '') {
  const opts = POS_OPTIONS.map(([fr, code]) => `<option value="${code}" ${value && posFr(value) === fr ? 'selected' : ''}>${fr}</option>`);
  // Keep a value we don't list (e.g. "noun/verb" from the texts) selectable as-is.
  if (value && !POS_OPTIONS.some(([fr]) => fr === posFr(value))) opts.unshift(`<option value="${esc(value)}" selected>${esc(posFr(value))}</option>`);
  return `<select id="${id}" class="input"><option value="">— non précisée —</option>${opts.join('')}</select>`;
}

// Every word from the texts' vocab/gloss lists, built once on first use.
let lexicon = null;
function lookup(word) {
  if (!lexicon) {
    lexicon = new Map();
    for (const t of db.texts) for (const v of [...(t.vocab || []), ...(t.gloss || [])]) if (v.word && !lexicon.has(v.word)) lexicon.set(v.word, v);
  }
  return lexicon.get(word);
}

function addWordSheet(after) {
  const sheet = openSheet(`
    <h2 style="margin:0 40px 4px 0">Ajouter un mot</h2>
    <p class="small muted" style="margin:0">Il sera souligné partout dans les textes et ajouté à tes cartes.</p>
    <form id="aw" novalidate>
      <div class="field"><label for="aw-k">Mot coréen</label>
        <input id="aw-k" class="input" lang="ko" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ex. 지하철"></div>
      <div id="aw-hint"></div>
      <div class="field"><label for="aw-p">Classe grammaticale</label><span id="aw-ps">${posSelect('aw-p')}</span></div>
      <div class="field"><label for="aw-m">Traduction</label>
        <input id="aw-m" class="input" autocomplete="off" placeholder="ex. métro"></div>
      <div class="field"><label for="aw-f">Autres formes à reconnaître <span class="muted" style="font-weight:400">(facultatif, séparées par des virgules)</span></label>
        <input id="aw-f" class="input" lang="ko" autocomplete="off" placeholder="ex. 지하철을, 지하철로"></div>
      <div class="sheet-actions">
        <button type="button" class="btn" data-sheet-close>Annuler</button>
        <button type="submit" class="btn primary">${icon('plus', 18)} Ajouter</button>
      </div>
    </form>`, { label: 'Ajouter un mot', onClose: after });
  const $k = $('#aw-k', sheet), $m = $('#aw-m', sheet), $f = $('#aw-f', sheet), hint = $('#aw-hint', sheet);
  let found = null;
  $k.focus(); // here the keyboard is wanted: the user asked to type a word

  const check = () => {
    const k = wordKey($k.value);
    found = null;
    if (k && state.words[k]) {
      hint.innerHTML = `<div class="ctx small row" style="margin:0">« ${esc(k)} » est déjà dans ta banque.<span class="spacer"></span><button type="button" class="btn" data-open>Ouvrir</button></div>`;
      return;
    }
    found = k ? lookup(k) : null;
    hint.innerHTML = found ? `<div class="ctx small row" style="margin:0"><span>Dans les textes : <b>${esc(found.meaning)}</b>${found.pos ? ` · ${esc(posFr(found.pos))}` : ''}</span>
      <span class="spacer"></span><button type="button" class="btn" data-use>Utiliser</button></div>` : '';
  };
  $k.addEventListener('input', debounce(check, 150));
  hint.addEventListener('click', (e) => {
    if (e.target.closest('[data-open]')) { const k = wordKey($k.value); closeSheet(); wordDetail(k, after); return; }
    if (e.target.closest('[data-use]') && found) {
      $m.value = found.meaning || '';
      $('#aw-ps', sheet).innerHTML = posSelect('aw-p', found.pos);
      $f.value = (found.forms || []).filter((x) => x !== found.word).join(', ');
      hint.innerHTML = '';
    }
  });

  $('#aw', sheet).addEventListener('submit', (e) => {
    e.preventDefault();
    const word = wordKey($k.value), meaning = $m.value.trim();
    if (!word) { $k.focus(); toast('Écris d’abord le mot coréen'); return; }
    if (state.words[word]) { check(); toast('Ce mot est déjà dans ta banque'); return; }
    if (!meaning) { $m.focus(); toast('Ajoute une traduction'); return; }
    const forms = $f.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
    addWord({ word, meaning, pos: $('#aw-p', sheet).value, forms, custom: true });
    closeSheet();
    toast(`« ${word} » ajouté`, { action: 'Annuler', onAction: () => { removeWord(word); after(); } });
  });
}
