// Flashcards: KO→sens, sens→KO, typing, mixed; context sentence; swipe to grade.
import { rerender } from '../app.js';
import { db, audioUrl, audioTiming, posFr } from '../data.js';
import { state, setSetting, dictUrl } from '../store.js';
import { buildQueue, review, GRADES, preview } from '../srs.js';
import { html, raw, esc, icon, speak, stopSpeech, onSwipe, toast, $ } from '../util.js';

const DIRS = { 'ko-en': 'Coréen → sens', 'en-ko': 'Sens → coréen', type: 'Écrire en coréen', mix: 'Mélange' };

// Play one sentence from the recorded audio (fallback: speech synthesis).
let clip = null;
function playSentence(src) {
  stopClip();
  const tm = src?.id && audioTiming(src.id);
  if (!tm || src.g == null || !tm.s[src.g]) { speak(src?.sentence || ''); return; }
  const [a, b] = tm.s[src.g];
  clip = new Audio(audioUrl(src.id));
  const c = clip;
  c.addEventListener('loadedmetadata', () => { c.currentTime = a; c.play().catch(() => speak(src.sentence)); }, { once: true });
  c.addEventListener('timeupdate', () => { if (c.currentTime >= b) c.pause(); });
  c.addEventListener('error', () => { if (clip === c) speak(src.sentence); }, { once: true });
}
function stopClip() {
  const c = clip; clip = null;
  if (c) { c.pause(); c.removeAttribute('src'); c.load(); }
  stopSpeech();
}

const norm = (s) => (s || '').replace(/[\s.,!?~·]/g, '').trim();

export function mountCards(root) {
  const queue = buildQueue();
  let i = 0, flipped = false, dir = null, typed = null, done = 0;
  const S = state.settings;
  const start = Date.now();

  if (!Object.keys(state.words).length) {
    root.innerHTML = `<div class="page-head"><h1>Flashcards</h1></div><div class="empty"><b>Aucun mot à réviser</b>Ajoute d’abord des mots à ta banque en lisant.<br><br><a class="btn primary" href="#/">Aller lire</a></div>`;
    return;
  }

  root.innerHTML = String(html`
    <div class="fc-wrap">
      <div class="page-head"><h1>Flashcards</h1></div>
      <div class="chips scroll" id="dirs">${Object.entries(DIRS).map(([k, v]) => html`<button class="chip ${S.cardDir === k ? 'on' : ''}" data-dir="${k}">${v}</button>`)}</div>
      <div class="fc-top"><div class="fc-progress"><i></i></div><span class="small muted" id="cnt"></span></div>
      <div id="stage"></div>
    </div>`);
  const stage = $('#stage', root);

  function pickDir() {
    if (S.cardDir !== 'mix') return S.cardDir;
    return ['ko-en', 'en-ko', 'type'][Math.floor(Math.random() * 3)];
  }

  function ctxHtml(w, blank) {
    const s = w.src;
    if (!s?.sentence) return '';
    let k = esc(s.sentence);
    const form = s.form || w.word;
    k = blank ? k.replace(esc(form), '<mark>＿＿＿</mark>') : k.replace(esc(form), `<mark>${esc(form)}</mark>`);
    return `<div class="ctx"><div class="k" lang="ko">${k}</div>${blank ? '' : `<div class="e">${esc(s.en || '')}</div>`}
      <button class="btn sm ghost" data-c="sent" style="margin-top:6px;margin-left:-10px">${icon('play', 14)} Écouter la phrase</button></div>`;
  }

  function render() {
    stopClip();
    $('.fc-progress i', root).style.width = `${queue.length ? (i / queue.length) * 100 : 100}%`;
    $('#cnt', root).textContent = `${Math.min(i + 1, queue.length)} / ${queue.length}`;
    if (i >= queue.length) return finish();
    const w = state.words[queue[i].word];
    if (!w) { i++; return render(); }
    if (!flipped && !typed) dir = pickDir();
    const ctxFront = S.cardContext === 'front', ctxBack = S.cardContext !== 'off';
    const meaning = w.meaning || '(pas de définition)';
    let front = '', back = '';
    if (dir === 'ko-en') {
      front = `<div class="big" lang="ko">${esc(w.word)}</div>${w.pos ? `<div class="pos">${esc(posFr(w.pos))}</div>` : ''}${ctxFront ? ctxHtml(w, false) : ''}`;
      back = `<div class="big en">${esc(meaning)}</div>${ctxBack && !ctxFront ? ctxHtml(w, false) : ''}`;
    } else {
      front = `<div class="big en">${esc(meaning)}</div>${w.pos ? `<div class="pos">${esc(posFr(w.pos))}</div>` : ''}${ctxFront ? ctxHtml(w, true) : ''}`;
      back = `<div class="big" lang="ko">${esc(w.word)}</div>${ctxBack ? ctxHtml(w, false) : ''}`;
    }
    const typing = dir === 'type' && !flipped;
    stage.innerHTML = `
      <div class="card fc-card" id="fc" ${typing ? '' : 'role="button" tabindex="0" aria-label="Retourner la carte"'}>
        ${front}
        ${typing ? `<form class="typed" id="tf"><input class="input" id="ti" lang="ko" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Écris le mot en coréen"><button class="btn primary block" style="margin-top:8px">Vérifier</button></form>` : ''}
        ${typed ? `<div class="${typed.ok ? 'diff-ok' : 'diff-bad'}">${typed.ok ? '✓ Correct' : `✗ Tu as écrit « ${esc(typed.v)} »`}</div>` : ''}
        ${flipped ? `<div class="back">${back}</div>` : ''}
        ${!flipped && !typing ? '<span class="hint">Touche pour retourner</span>' : ''}
      </div>
      ${flipped ? `<div class="grades">${GRADES.map((g) => `<button class="btn g${g.g}" data-g="${g.g}">${g.label}<small>${preview(w, g.g)}</small></button>`).join('')}</div>
        <div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm ghost" data-c="say">${icon('speaker', 16)} Prononcer</button>
        <a class="btn sm ghost" href="${dictUrl(w.word)}" target="_blank" rel="noopener">Naver ${icon('ext', 14)}</a></div>
        <p class="small muted" style="text-align:center">Glisse → « Bien », ← « Encore » · touches 1 à 4</p>` : ''}`;
    if (S.cardAudio && ((dir === 'ko-en' && !flipped) || (dir !== 'ko-en' && flipped))) speak(w.word);
    const ti = $('#ti', stage);
    if (ti) {
      ti.focus();
      $('#tf', stage).addEventListener('submit', (e) => {
        e.preventDefault();
        const v = ti.value;
        typed = { v, ok: [w.word, ...(w.forms || [])].some((f) => norm(f) === norm(v)) };
        flipped = true; render();
      });
    }
    const fc = $('#fc', stage);
    onSwipe(fc, {
      enabled: () => flipped && S.gestures,
      onMove: (dx, end) => {
        fc.style.transform = end ? '' : `translateX(${dx}px) rotate(${dx / 30}deg)`;
        fc.classList.toggle('swipe-r', !end && dx > 40); fc.classList.toggle('swipe-l', !end && dx < -40);
      },
      onSwipe: (d) => grade(d === 'right' ? 2 : 0),
    });
  }

  function flip() { if (!flipped && !(dir === 'type' && !typed)) { flipped = true; render(); } }
  function grade(g) {
    const w = queue[i];
    review(w.word, g);
    done++;
    // "Encore" cards come back at the end of this session.
    if (g === 0 && queue.filter((x) => x.word === w.word).length < 3) queue.push(w);
    i++; flipped = false; typed = null; render();
  }
  function finish() {
    const mins = Math.max(1, Math.round((Date.now() - start) / 60000));
    const more = buildQueue().length;
    stage.innerHTML = `<div class="card fc-card" style="cursor:default">
      <div class="big">🎉</div><h2>${queue.length ? 'Session terminée !' : 'Rien à réviser pour l’instant'}</h2>
      <p class="muted">${done} révision${done > 1 ? 's' : ''} en ${mins} min.${more ? ` Encore ${more} carte${more > 1 ? 's' : ''} disponible${more > 1 ? 's' : ''}.` : ' Reviens plus tard pour les prochaines révisions.'}</p>
      <div class="row">${more ? '<button class="btn primary" data-c="again">Continuer</button>' : ''}<a class="btn" href="#/words">Ma banque</a><a class="btn" href="#/">Lire</a></div></div>`;
  }

  stage.addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]');
    if (c) {
      const w = state.words[queue[i]?.word];
      if (c.dataset.c === 'sent' && w) playSentence(w.src);
      if (c.dataset.c === 'say' && w) speak(w.word);
      if (c.dataset.c === 'again') rerender();
      return;
    }
    const g = e.target.closest('[data-g]');
    if (g) return grade(+g.dataset.g);
    if (e.target.closest('#fc') && !e.target.closest('form')) flip();
  });
  root.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dir]');
    if (!d) return;
    setSetting('cardDir', d.dataset.dir);
    root.querySelectorAll('[data-dir]').forEach((b) => b.classList.toggle('on', b === d));
    if (!flipped) { typed = null; render(); }
  });
  const onKey = (e) => {
    if (e.target.closest('input')) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade(+e.key - 1);
  };
  document.addEventListener('keydown', onKey);
  render();
  return () => { document.removeEventListener('keydown', onKey); stopClip(); };
}
