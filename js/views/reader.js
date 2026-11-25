// Reader: underlined words (every occurrence), word / sentence sheets,
// sentence translations, recorded audio with live highlight, resume position.
import { db, TYPES, posFr, neighbours } from '../data.js';
import { splitKo, enForSentence, SPEAKER_RE, HANGUL_RUN, isTokenStart } from '../text.js';
import {
  state, save, addWord, removeWord, setWordStatus, getWord, wordKey, textState, patchText,
  logActivity, setSetting, dictUrl,
} from '../store.js';
import { html, raw, esc, icon, levelBadge, openSheet, closeSheet, toast, speak, onSwipe, $, $$ } from '../util.js';
import { Player } from '../audio.js';
import { applySettings } from '../app.js';

const RATES = [0.75, 0.9, 1, 1.15, 1.3];

export function mountReader(root, id) {
  const t = db.byId.get(id);
  if (!t) { root.innerHTML = '<div class="empty"><b>Texte introuvable</b><a href="#/">Retour à la bibliothèque</a></div>'; return; }
  const S = state.settings;
  const ts = textState(t.id);
  patchText(t.id, { opened: Date.now() });

  // Flat sentence list (global index g is what the audio timestamps use).
  const sents = [];
  t.paragraphs.forEach((p, pi) => splitKo(p.ko).forEach((ko, i) => sents.push({ ko, p: pi, i, g: sents.length })));
  const firstOfPara = t.paragraphs.map((_, pi) => sents.find((s) => s.p === pi).g);

  const openTr = new Set();
  let allTr = S.showAllTrans;
  const started = Date.now();
  let lastUserScroll = 0;

  const player = new Player(t, sents, {
    source: S.audioSource, rate: S.audioRate,
    onChange: (st) => updatePlayer(st),
  });
  if (ts.pos > 0 && !ts.read) player.cur = firstOfPara[Math.min(ts.pos, firstOfPara.length - 1)];

  const { prev, next } = neighbours(t);
  const typeLbl = t.type === 'series' ? `${TYPES.series.fr} · ${t.series} · ép. ${t.episode}` : TYPES[t.type]?.fr;

  root.classList.add('has-player');
  root.innerHTML = String(html`
    <article class="reader">
      <header class="reader-head">
        <div class="crumbs">
          <a class="btn ghost sm" href="#/" style="margin-left:-12px">${raw(icon('back', 18))} Bibliothèque</a>
          <span class="spacer"></span>
          <button class="icon-btn" data-act="fav" aria-pressed="${!!ts.fav}" aria-label="Favori">${raw(icon(ts.fav ? 'heartFill' : 'heart'))}</button>
        </div>
        <h1>${t.title}</h1>
        <div class="sub">${t.titleEn}</div>
        <div class="t-meta">
          ${raw(levelBadge(t.level))}
          <span class="tag">${typeLbl}</span>
          <span class="tag">${t.minutes} min</span>
          <span class="tag">${t.vocab.length} mots clés</span>
          ${ts.read ? raw('<span class="tag accent">✓ Lu</span>') : ''}
        </div>
        <div class="reader-tools">
          <button class="btn sm ${allTr ? 'soft' : ''}" data-act="all-tr" aria-pressed="${allTr}">${raw(icon('translate', 18))} Traductions</button>
          <button class="btn sm" data-act="font" data-d="-1" aria-label="Texte plus petit">A−</button>
          <button class="btn sm" data-act="font" data-d="1" aria-label="Texte plus grand">A+</button>
        </div>
        ${!state.ui.tipsSeen.reader ? raw(`<div class="tip"><span>👆 <b>Touche un mot</b> pour sa définition (tous les mots sont touchables, même non soulignés). <b>Appui long sur une phrase</b> pour sa traduction. Glisse à gauche/droite pour changer de texte.</span><button class="btn sm ghost" data-act="tip-ok">OK</button></div>`) : ''}
      </header>
      <div class="text-body"></div>
      <div class="end-sentinel"></div>
      <section class="card end-block">
        <h2>Point de grammaire</h2>
        <div class="grammar-pat">${t.grammar.pattern}</div>
        <p>${t.grammar.explain}</p>
        <p class="muted" style="font-family:var(--read-font)">${t.grammar.example}</p>
      </section>
      <section class="card end-block quiz">
        <h2>Compréhension</h2>
        <div class="quiz-body"></div>
      </section>
      <div class="row" style="margin-top:18px;flex-wrap:wrap">
        <button class="btn ${ts.read ? '' : 'primary'}" data-act="read">${raw(icon('check', 18))} ${ts.read ? 'Marquer comme non lu' : 'Marquer comme lu'}</button>
      </div>
      <nav class="nav-pair">
        ${prev ? html`<a class="card prev" href="#/t/${prev.id}"><span class="muted">← Précédent</span><b>${prev.title}</b></a>` : raw('<span></span>')}
        ${next ? html`<a class="card next" href="#/t/${next.id}"><span class="muted">Suivant →</span><b>${next.title}</b></a>` : ''}
      </nav>
    </article>
    <div class="player" role="region" aria-label="Lecture audio">
      <button class="icon-btn" data-act="step" data-d="-1" aria-label="Phrase précédente">${raw(icon('prev'))}</button>
      <button class="play" data-act="play" aria-label="Lire">${raw(icon('play', 22))}</button>
      <button class="icon-btn" data-act="step" data-d="1" aria-label="Phrase suivante">${raw(icon('skip'))}</button>
      <div class="info"><div class="l1"></div><div class="l2"></div><div class="bar"><i></i></div></div>
      <button class="btn sm ghost rate" data-act="rate" aria-label="Vitesse">${S.audioRate}×</button>
      <button class="icon-btn stop" data-act="stop" aria-label="Arrêter" hidden>${raw(icon('stop'))}</button>
    </div>
    <div class="swipe-hint l">${raw(icon('back', 26))}</div><div class="swipe-hint r">${raw(icon('next', 26))}</div>
  `);

  const body = $('.text-body', root);

  // ---------- Text rendering ----------
  function matchList() {
    const map = new Map();
    const add = (e, kind) => {
      const k = wordKey(e.word);
      if (!map.has(k)) map.set(k, { key: k, entry: e, kind, forms: new Set() });
      const c = map.get(k);
      (e.forms || []).forEach((f) => c.forms.add(f));
      c.forms.add(e.word);
    };
    t.vocab.forEach((e) => add(e, 'vocab'));
    (t.gloss || []).forEach((e) => add(e, 'gloss'));
    Object.values(state.words).forEach((w) => add(w, 'bank'));
    const list = [];
    map.forEach((c) => c.forms.forEach((f) => { if (f && !f.startsWith('-') && f.trim()) list.push({ form: f, c }); }));
    list.sort((a, b) => b.form.length - a.form.length);
    return { map, list };
  }
  let M = matchList();

  const statusOf = (c) => {
    const b = state.words[c.key];
    if (b) return b.status === 'known' ? 'known' : 'learning';
    return c.kind === 'gloss' ? 'gloss' : 'new';
  };

  function renderSentence(s, offset = 0) {
    const str = s.ko.slice(offset);
    const taken = new Array(str.length).fill(null);
    for (const m of M.list) {
      let i = str.indexOf(m.form);
      while (i >= 0) {
        const end = i + m.form.length;
        if (isTokenStart(str, i) && !taken.slice(i, end).some(Boolean)) {
          const mark = { m, start: i };
          for (let k = i; k < end; k++) taken[k] = mark;
        }
        i = str.indexOf(m.form, i + 1);
      }
    }
    let out = '';
    let i = 0;
    while (i < str.length) {
      if (taken[i]) {
        const mk = taken[i]; let j = i;
        while (j < str.length && taken[j] === mk) j++;
        const frag = str.slice(i, j);
        out += `<span class="vw ${statusOf(mk.m.c)}" data-k="${esc(mk.m.c.key)}" data-f="${esc(frag)}" role="button" tabindex="0">${esc(frag)}</span>`;
        i = j;
      } else {
        let j = i;
        while (j < str.length && !taken[j]) j++;
        out += esc(str.slice(i, j)).replace(HANGUL_RUN, (w) => `<span class="w" data-t="${w}">${w}</span>`);
        i = j;
      }
    }
    return out;
  }

  function trHtml(p, pi) {
    if (S.transMode === 'paragraph') return `<div class="tr">${esc(p.en)}</div>`;
    // Sentence by sentence (groups when one English sentence covers several Korean ones).
    const ks = splitKo(p.ko);
    const groups = p.al || ks.map((_, i) => [i, i + 1, i, i + 1]);
    return `<div class="tr">${groups.map(([k0, k1]) =>
      `<p class="pair"><span class="k">${esc(ks.slice(k0, k1).join(' '))}</span>${esc(enForSentence(p, k0))}</p>`).join('')}</div>`;
  }

  function renderBody() {
    M = matchList();
    body.classList.toggle('show-known', S.showKnown);
    body.classList.toggle('hide-gloss', !S.showGloss);
    body.innerHTML = t.paragraphs.map((p, pi) => {
      const ps = sents.filter((s) => s.p === pi);
      const open = allTr || openTr.has(pi);
      const sp = t.type === 'dialogue' ? p.ko.match(SPEAKER_RE) : null;
      const inner = ps.map((s, k) => {
        const off = k === 0 && sp ? sp[0].length : 0;
        return `<span class="sent${s.g === player.cur && player.state !== 'idle' ? ' playing' : ''}" data-g="${s.g}">${renderSentence(s, off)}</span>`;
      }).join(' ');
      return `<div class="para${open ? ' tr-open' : ''}" data-p="${pi}">
        <p class="ko" lang="ko">${sp ? `<span class="speaker">${esc(sp[1])}</span>` : ''}${inner}</p>
        <button class="tr-btn" data-act="tr" aria-label="Traduction du paragraphe" aria-expanded="${open}">EN</button>
        ${open ? trHtml(p, pi) : ''}
      </div>`;
    }).join('');
  }
  renderBody();

  // ---------- Quiz ----------
  const answers = {};
  function renderQuiz() {
    const qb = $('.quiz-body', root);
    qb.innerHTML = t._quiz.map((q, qi) => `
      <div class="quiz-q" lang="ko">${qi + 1}. ${esc(q.q)}</div>
      <div class="quiz-opts">${q.options.map((o, oi) => {
        const a = answers[qi];
        const cls = a == null ? '' : oi === q.answer ? 'right' : oi === a ? 'wrong' : '';
        return `<button class="quiz-opt ${cls}" data-act="quiz" data-q="${qi}" data-o="${oi}" ${a != null ? 'disabled' : ''} lang="ko">${esc(o)}</button>`;
      }).join('')}</div>`).join('') +
      (Object.keys(answers).length === t._quiz.length
        ? `<p class="tip" style="margin-top:14px">Score : <b>${t._quiz.filter((q, i) => answers[i] === q.answer).length} / ${t._quiz.length}</b></p>` : '');
  }
  renderQuiz();

  // ---------- Player UI ----------
  const P = $('.player', root);
  function updatePlayer(st) {
    if (!P) return;
    const playing = st.state === 'playing' || st.state === 'loading';
    $('.play', P).innerHTML = icon(playing ? 'pause' : 'play', 22);
    $('.play', P).setAttribute('aria-label', playing ? 'Pause' : 'Lire');
    $('.stop', P).hidden = st.state === 'idle';
    const n = sents.length;
    $('.l1', P).textContent = st.state === 'idle' ? 'Écouter le texte' : st.state === 'loading' ? 'Chargement…' : `Phrase ${st.cur + 1} / ${n}`;
    $('.l2', P).textContent = st.mode === 'voice' ? 'Voix enregistrée' : 'Synthèse vocale';
    $('.bar i', P).style.width = `${st.cur < 0 ? 0 : ((st.cur + 1) / n) * 100}%`;
    $$('.sent.playing', body).forEach((e) => e.classList.remove('playing'));
    if (st.state !== 'idle' && st.cur >= 0) {
      const el = body.querySelector(`.sent[data-g="${st.cur}"]`);
      if (el) {
        el.classList.add('playing');
        if (S.autoScroll && playing && Date.now() - lastUserScroll > 2500) {
          const r = el.getBoundingClientRect();
          if (r.top < 90 || r.bottom > innerHeight - 140) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }
  updatePlayer({ state: 'idle', cur: player.cur, mode: player.mode });

  // ---------- Sheets ----------
  function sentenceCtx(g, form) {
    const s = sents[g];
    const p = t.paragraphs[s.p];
    let ko = esc(s.ko);
    if (form) ko = ko.replace(esc(form), `<mark>${esc(form)}</mark>`);
    return `<div class="ctx"><div class="k" lang="ko">${ko}</div><div class="e">${esc(enForSentence(p, s.i))}</div></div>`;
  }

  function wordSheet(key, form, g) {
    const c = M.map.get(key);
    const bank = state.words[key];
    const e = c ? { ...c.entry, ...(bank || {}) } : bank;
    if (!e) return;
    // Prefer the text's own meaning if the bank entry is custom/empty.
    const meaning = bank?.meaning || c?.entry.meaning || '';
    const st = bank ? bank.status : null;
    const sheet = openSheet(`
      <div class="word-head"><span class="w-big" lang="ko">${esc(e.word)}</span>
        ${form && form !== e.word ? `<span class="w-form" lang="ko">→ ${esc(form)}</span>` : ''}</div>
      <div class="row" style="margin-top:6px;flex-wrap:wrap">
        ${e.pos ? `<span class="tag">${esc(posFr(e.pos))}</span>` : ''}
        <span class="word-status ${st || ''}">${st === 'known' ? '✓ Connu' : st ? '● Dans ma banque' : 'Pas dans ma banque'}</span>
      </div>
      <p class="word-meaning">${esc(meaning) || '<span class="muted">Pas de définition — ajoute-la ci-dessous ou regarde Naver.</span>'}</p>
      ${g != null ? sentenceCtx(g, form) : ''}
      ${bank?.custom ? `<div class="field"><label for="wm">Ma définition</label><input id="wm" class="input" value="${esc(bank.meaning)}" placeholder="Sens du mot"></div>` : ''}
      <div class="sheet-actions">
        ${!bank ? `
          <button class="btn primary wide" data-w="add">${icon('plus', 18)} Ajouter à ma banque</button>
          <button class="btn" data-w="known">${icon('check', 18)} Je le connais</button>`
        : st === 'known' ? `
          <button class="btn soft" data-w="learn">Remettre en révision</button>
          <button class="btn danger" data-w="remove">${icon('minus', 18)} Retirer</button>`
        : `
          <button class="btn danger wide" data-w="remove">${icon('minus', 18)} Retirer de ma banque</button>
          <button class="btn" data-w="known">${icon('check', 18)} Je le connais</button>`}
        <button class="btn" data-w="say">${icon('speaker', 18)} Prononcer</button>
        <a class="btn ${!bank ? '' : 'wide'}" href="${dictUrl(e.word)}" target="_blank" rel="noopener">Naver ${icon('ext', 16)}</a>
      </div>`, { label: `Mot ${e.word}` });
    const entryForBank = () => ({
      word: e.word, pos: e.pos, meaning, forms: [...(c?.forms || []), ...(form ? [form] : [])],
    });
    const src = g != null ? { id: t.id, title: t.title, g, sentence: sents[g].ko, en: enForSentence(t.paragraphs[sents[g].p], sents[g].i), form } : null;
    sheet.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-w]');
      if (!b) return;
      const a = b.dataset.w;
      if (a === 'say') { speak(e.word); return; }
      if (a === 'add') { addWord(entryForBank(), src); toast(`« ${e.word} » ajouté à ta banque`); }
      if (a === 'known') { addWord({ ...entryForBank(), status: 'known' }, src); setWordStatus(e.word, 'known'); toast(`« ${e.word} » marqué comme connu`); }
      if (a === 'learn') setWordStatus(e.word, 'learning');
      if (a === 'remove') {
        const undo = removeWord(e.word);
        toast(`« ${e.word} » retiré de ta banque`, { action: 'Annuler', onAction: () => { undo(); renderBody(); } });
      }
      closeSheet();
      renderBody();
    });
    const wm = sheet.querySelector('#wm');
    if (wm) wm.addEventListener('change', () => { bank.meaning = wm.value.trim(); bank.updated = Date.now(); save(); });
  }

  function tokenSheet(token, g) {
    const sheet = openSheet(`
      <div class="word-head"><span class="w-big" lang="ko">${esc(token)}</span></div>
      <p class="muted small" style="margin:4px 0 0">Ce mot n’est pas dans la liste du texte. Tu peux l’ajouter à ta banque quand même.</p>
      ${sentenceCtx(g, token)}
      <div class="field"><label for="tw">Mot à enregistrer (tu peux mettre la forme du dictionnaire, ex. 먹다)</label>
        <input id="tw" class="input" lang="ko" value="${esc(token)}"></div>
      <div class="field"><label for="tm">Sens (optionnel)</label>
        <input id="tm" class="input" placeholder="ex. manger"></div>
      <div class="sheet-actions">
        <button class="btn primary wide" data-w="add">${icon('plus', 18)} Ajouter à ma banque</button>
        <button class="btn" data-w="say">${icon('speaker', 18)} Prononcer</button>
        <a class="btn" href="${dictUrl(token)}" target="_blank" rel="noopener">Naver ${icon('ext', 16)}</a>
      </div>`, { label: `Mot ${token}` });
    sheet.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-w]');
      if (!b) return;
      if (b.dataset.w === 'say') { speak(token); return; }
      const word = $('#tw', sheet).value.trim() || token;
      addWord({ word, meaning: $('#tm', sheet).value.trim(), forms: [token, word], custom: true },
        { id: t.id, title: t.title, g, sentence: sents[g].ko, en: enForSentence(t.paragraphs[sents[g].p], sents[g].i), form: token });
      toast(`« ${word} » ajouté à ta banque`);
      closeSheet(); renderBody();
    });
  }

  function sentenceSheet(g) {
    const s = sents[g];
    const sheet = openSheet(`
      <h2 style="font-size:16px;font-family:var(--font-ui);color:var(--muted)">Phrase ${g + 1}</h2>
      ${sentenceCtx(g)}
      <div class="sheet-actions">
        <button class="btn primary" data-s="play">${icon('play', 16)} Écouter</button>
        <button class="btn" data-s="copy">${icon('copy', 16)} Copier</button>
        <button class="btn wide" data-s="para">Traduction du paragraphe</button>
      </div>`, { label: 'Traduction de la phrase' });
    sheet.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'play') { player.playSentence(g); closeSheet(); }
      if (b.dataset.s === 'copy') { navigator.clipboard?.writeText(`${s.ko}\n${enForSentence(t.paragraphs[s.p], s.i)}`); toast('Copié'); }
      if (b.dataset.s === 'para') { openTr.add(s.p); closeSheet(); renderBody(); }
    });
  }

  // ---------- Events ----------
  let pressTimer = null, pressed = false, pressAt = 0, pressXY = null;
  body.addEventListener('pointerdown', (e) => {
    const s = e.target.closest('.sent');
    if (!s || e.button > 0) return;
    pressed = false; pressXY = [e.clientX, e.clientY];
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      pressed = true; pressAt = Date.now();
      s.classList.add('pressing'); setTimeout(() => s.classList.remove('pressing'), 400);
      navigator.vibrate?.(12);
      sentenceSheet(+s.dataset.g);
    }, 480);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  body.addEventListener('pointermove', (e) => { if (pressXY && Math.hypot(e.clientX - pressXY[0], e.clientY - pressXY[1]) > 10) cancelPress(); });
  body.addEventListener('pointerup', cancelPress);
  body.addEventListener('pointercancel', cancelPress);
  body.addEventListener('contextmenu', (e) => {
    const s = e.target.closest('.sent');
    if (!s) return;
    e.preventDefault();
    if (Date.now() - pressAt > 800) sentenceSheet(+s.dataset.g);
  });

  const activate = (e) => {
    if (pressed) { pressed = false; return; }
    const v = e.target.closest('.vw');
    const g = +e.target.closest('.sent')?.dataset.g;
    if (v) { v.classList.add('flash'); setTimeout(() => v.classList.remove('flash'), 300); wordSheet(v.dataset.k, v.dataset.f, g); return; }
    const w = e.target.closest('.w');
    if (w) { tokenSheet(w.dataset.t, g); return; }
    const tb = e.target.closest('[data-act="tr"]');
    if (tb) {
      const pi = +tb.closest('.para').dataset.p;
      openTr.has(pi) || allTr ? openTr.delete(pi) : openTr.add(pi);
      if (allTr) { allTr = false; t.paragraphs.forEach((_, i) => i !== pi && openTr.add(i)); syncAllTrBtn(); }
      renderBody();
    }
  };
  body.addEventListener('click', activate);
  body.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.vw')) { e.preventDefault(); activate(e); } });

  const syncAllTrBtn = () => {
    const b = $('[data-act="all-tr"]', root);
    b.classList.toggle('soft', allTr); b.setAttribute('aria-pressed', allTr);
  };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || body.contains(b)) return;
    const a = b.dataset.act;
    if (a === 'play') player.toggle();
    else if (a === 'stop') player.stop();
    else if (a === 'step') player.step(+b.dataset.d);
    else if (a === 'rate') {
      const r = RATES[(RATES.indexOf(player.rate) + 1) % RATES.length] || 1;
      player.setRate(r); setSetting('audioRate', r); b.textContent = `${r}×`;
    } else if (a === 'all-tr') { allTr = !allTr; openTr.clear(); syncAllTrBtn(); renderBody(); }
    else if (a === 'font') {
      setSetting('fontSize', Math.max(14, Math.min(32, S.fontSize + 2 * +b.dataset.d))); applySettings();
    } else if (a === 'fav') {
      patchText(t.id, { fav: !ts.fav });
      b.innerHTML = icon(ts.fav ? 'heartFill' : 'heart'); b.setAttribute('aria-pressed', !!ts.fav);
      toast(ts.fav ? 'Ajouté aux favoris' : 'Retiré des favoris');
    } else if (a === 'tip-ok') { state.ui.tipsSeen.reader = 1; save(); b.closest('.tip').remove(); }
    else if (a === 'read') {
      setRead(!ts.read);
      b.classList.toggle('primary', !ts.read);
      b.innerHTML = `${icon('check', 18)} ${ts.read ? 'Marquer comme non lu' : 'Marquer comme lu'}`;
    }
    else if (a === 'quiz') {
      const qi = +b.dataset.q, oi = +b.dataset.o;
      answers[qi] = oi; renderQuiz();
      if (Object.keys(answers).length === t._quiz.length) {
        const c = t._quiz.filter((q, i) => answers[i] === q.answer).length;
        patchText(t.id, { quiz: { c, n: t._quiz.length, at: Date.now() } });
        if (!ts.read) setRead(true);
      }
    }
  });

  function setRead(v) {
    if (v && !ts.read) logActivity('read');
    patchText(t.id, { read: v, readAt: v ? Date.now() : undefined, progress: v ? 1 : ts.progress });
    if (v) toast('Texte marqué comme lu ✓');
  }

  // ---------- Progress & resume ----------
  const paras = () => $$('.para', body);
  const onScroll = () => {
    const top = 70;
    const list = paras();
    let idx = 0;
    for (let i = 0; i < list.length; i++) { if (list[i].getBoundingClientRect().bottom > top) { idx = i; break; } }
    const prog = Math.max(ts.progress || 0, (idx + 1) / list.length);
    if (idx !== ts.pos || prog !== ts.progress) { ts.pos = idx; ts.progress = prog; save(); }
  };
  // Progress is tracked on every scroll; only real user input (wheel/touch/keys)
  // pauses the audio auto-scroll, so our own scrollIntoView doesn't block itself.
  let scrollRaf = 0;
  const scrollHandler = () => { cancelAnimationFrame(scrollRaf); scrollRaf = requestAnimationFrame(onScroll); };
  const markUser = () => { lastUserScroll = Date.now(); };
  addEventListener('wheel', markUser, { passive: true });
  addEventListener('touchmove', markUser, { passive: true });
  addEventListener('scroll', scrollHandler, { passive: true });

  const endObs = new IntersectionObserver((ents) => {
    if (ents.some((x) => x.isIntersecting) && !ts.read && Date.now() - started > 20000) setRead(true);
  });
  endObs.observe($('.end-sentinel', root));

  if (ts.pos > 0 && !ts.read) {
    requestAnimationFrame(() => {
      paras()[ts.pos]?.scrollIntoView({ block: 'start' });
      scrollBy(0, -80);
      toast(`Reprise au paragraphe ${ts.pos + 1}`, { action: 'Revenir au début', onAction: () => { scrollTo({ top: 0, behavior: 'smooth' }); player.cur = 0; } });
    });
  }

  // Reading time (only while the tab is visible).
  const timer = setInterval(() => { if (document.visibilityState === 'visible') logActivity('sec', 15); }, 15000);

  // ---------- Keyboard & gestures ----------
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select') || document.querySelector('.sheet')) return;
    if (e.key === ' ') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'Escape') player.stop();
    else if (e.key === 'ArrowRight' && e.altKey && next) location.hash = `#/t/${next.id}`;
    else if (e.key === 'ArrowLeft' && e.altKey && prev) location.hash = `#/t/${prev.id}`;
    else if (e.key === 'ArrowRight') player.step(1);
    else if (e.key === 'ArrowLeft') player.step(-1);
  };
  document.addEventListener('keydown', onKey);

  const hintL = $('.swipe-hint.l', root), hintR = $('.swipe-hint.r', root);
  onSwipe(body, {
    enabled: () => S.gestures && !document.querySelector('.sheet'),
    threshold: 90,
    onMove: (dx, done) => {
      hintL.style.opacity = !done && dx > 0 && prev ? Math.min(1, dx / 90) : 0;
      hintR.style.opacity = !done && dx < 0 && next ? Math.min(1, -dx / 90) : 0;
    },
    onSwipe: (dir) => {
      cancelPress();
      if (dir === 'left' && next) location.hash = `#/t/${next.id}`;
      if (dir === 'right' && prev) location.hash = `#/t/${prev.id}`;
    },
  });

  // ---------- Cleanup ----------
  return () => {
    player.destroy();
    clearInterval(timer);
    endObs.disconnect();
    document.removeEventListener('keydown', onKey);
    removeEventListener('wheel', markUser);
    removeEventListener('touchmove', markUser);
    removeEventListener('scroll', scrollHandler);
    root.classList.remove('has-player');
    closeSheet();
  };
}
