// Settings: graphic style, light/dark/auto, reading, translations, audio, flashcards, gestures.
import { state, setSetting, DEFAULT_SETTINGS, save } from '../store.js';
import { applySettings } from '../app.js';
import { $$ } from '../util.js';

export const STYLES = {
  hanji: { name: 'Hanji', desc: 'Papier chaud, sceau vermillon', light: ['#FAF6EE', '#2B2420', '#C2502F'], dark: ['#1A1613', '#F1E9DE', '#E67C56'], serif: true },
  clair: { name: 'Clair', desc: 'Blanc net, indigo', light: ['#FFFFFF', '#1B1E2B', '#4F5BD5'], dark: ['#191C27', '#ECEEF6', '#8E97FF'] },
  jade: { name: 'Jade', desc: 'Céladon apaisant', light: ['#F2F6F2', '#1C2A23', '#2C7A58'], dark: ['#17201B', '#E5F0E9', '#5CC495'] },
  encre: { name: 'Encre', desc: 'Noir & blanc + surligneur', light: ['#FFFFFF', '#121212', '#F2C500'], dark: ['#151515', '#F4F4F0', '#F0C828'] },
};

const seg = (key, opts) => `<div class="seg" role="group">${Object.entries(opts).map(([v, l]) =>
  `<button data-seg="${key}" data-v="${v}" class="${String(state.settings[key]) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const sw = (key) => `<span class="switch"><input type="checkbox" data-sw="${key}" ${state.settings[key] ? 'checked' : ''} aria-label="${key}"><i></i></span>`;
const row = (title, sub, ctrl, col) => `<div class="set-row${col ? ' col' : ''}"><div class="lbl"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>${ctrl}</div>`;

export function mountSettings(root) {
  const S = state.settings;
  const dark = document.documentElement.dataset.mode === 'dark';
  root.innerHTML = `
    <div class="page-head"><h1>Paramètres</h1></div>

    <h2 class="section-title">Apparence</h2>
    <div class="styles-grid">${Object.entries(STYLES).map(([k, s]) => {
      const [bg, ink, ac] = dark ? s.dark : s.light;
      return `<button class="style-card ${S.style === k ? 'on' : ''}" data-style="${k}" aria-pressed="${S.style === k}">
        <div class="pv" style="background:${bg};color:${ink}">
          <span class="k" style="font-family:${s.serif ? 'var(--font-serif-ko)' : 'var(--font-sans-ko)'}">가 <span class="u" style="text-decoration-color:${ac}">읽기</span></span>
          <span class="dots"><i style="background:${ac}"></i><i style="background:${ac};opacity:.45"></i><i style="background:${ink};opacity:.2"></i></span>
        </div><div class="nm">${s.name}<br><span class="muted small" style="font-weight:400">${s.desc}</span></div></button>`;
    }).join('')}</div>
    <div class="card set-group" style="margin-top:12px">
      ${row('Thème', 'Automatique suit le réglage clair/sombre de ton appareil', seg('mode', { auto: 'Auto', light: 'Clair', dark: 'Sombre' }))}
    </div>

    <h2 class="section-title">Lecture</h2>
    <div class="card set-group">
      ${row(`Taille du texte · <span id="fsv">${S.fontSize}px</span>`, '', `<input class="range" type="range" min="14" max="32" step="1" value="${S.fontSize}" data-range="fontSize">`, true)}
      ${row(`Interligne · <span id="lhv">${S.lineHeight}</span>`, '', `<input class="range" type="range" min="1.5" max="2.4" step="0.1" value="${S.lineHeight}" data-range="lineHeight">`, true)}
      ${row('Police du coréen', '', seg('readFont', { sans: 'Sans', serif: 'Avec empattements' }))}
      ${row('Souligner les mots d’aide', 'Mots secondaires du texte (pointillés gris)', sw('showGloss'))}
      ${row('Souligner les mots connus', 'Sinon, les mots marqués « connus » ne sont plus soulignés', sw('showKnown'))}
      ${row('Dictionnaire', 'Lien ouvert depuis un mot', seg('dict', { kofr: 'Naver 🇫🇷', koen: 'Naver 🇬🇧' }))}
    </div>

    <h2 class="section-title">Traductions</h2>
    <div class="card set-group">
      ${row('Traduction affichée', 'Phrase par phrase (alignée) ou tout le paragraphe', seg('transMode', { sentence: 'Par phrase', paragraph: 'Par paragraphe' }))}
      ${row('Tout afficher à l’ouverture', 'Les traductions sont visibles dès qu’on ouvre un texte', sw('showAllTrans'))}
    </div>

    <h2 class="section-title">Audio</h2>
    <div class="card set-group">
      ${row('Source', 'Voix enregistrée (en ligne) ou synthèse vocale de l’appareil (hors ligne)', seg('audioSource', { voice: 'Voix', tts: 'Synthèse' }))}
      ${row('Vitesse par défaut', '', seg('audioRate', { 0.75: '0,75×', 0.9: '0,9×', 1: '1×', 1.15: '1,15×', 1.3: '1,3×' }))}
      ${row('Suivre la lecture', 'Faire défiler le texte avec la phrase lue', sw('autoScroll'))}
    </div>

    <h2 class="section-title">Flashcards</h2>
    <div class="card set-group">
      ${row('Sens des cartes', '', seg('cardDir', { 'ko-en': 'KO → sens', 'en-ko': 'Sens → KO', type: 'Écrire', mix: 'Mélange' }), true)}
      ${row('Phrase de contexte', 'La phrase où tu as trouvé le mot', seg('cardContext', { front: 'Au recto', back: 'Au verso', off: 'Jamais' }))}
      ${row('Prononcer automatiquement', '', sw('cardAudio'))}
      ${row('Nouvelles cartes par jour', '', seg('newPerDay', { 5: '5', 10: '10', 15: '15', 25: '25', 50: '50' }))}
    </div>

    <h2 class="section-title">Général</h2>
    <div class="card set-group">
      ${row('Gestes', 'Glisser pour changer de texte, noter une carte, retirer un mot', sw('gestures'))}
      ${row('Objectif quotidien', 'Textes à lire par jour', seg('dailyGoal', { 1: '1', 2: '2', 3: '3', 5: '5' }))}
      ${row('Réinitialiser les paramètres', 'Tes mots et ta progression sont conservés', '<button class="btn sm" data-act="reset-settings">Réinitialiser</button>')}
    </div>
    <p class="small muted" style="margin-top:24px">Textes et audio : TOPIK GUIDE Graded Reader (usage personnel). 다독+ · version locale.</p>`;

  if (root.dataset.bound) return;
  root.dataset.bound = '1';
  const num = (k, v) => (typeof DEFAULT_SETTINGS[k] === 'number' ? +v : v);
  root.addEventListener('click', (e) => {
    const st = e.target.closest('.style-card[data-style]');
    if (st) { setSetting('style', st.dataset.style); applySettings(); mountSettings(root); return; }
    const sg = e.target.closest('[data-seg]');
    if (sg) {
      setSetting(sg.dataset.seg, num(sg.dataset.seg, sg.dataset.v));
      $$(`[data-seg="${sg.dataset.seg}"]`, root).forEach((b) => b.classList.toggle('on', b === sg));
      applySettings();
      if (sg.dataset.seg === 'mode') mountSettings(root);
      return;
    }
    if (e.target.closest('[data-act="reset-settings"]')) {
      Object.assign(state.settings, DEFAULT_SETTINGS); save(); applySettings(); mountSettings(root);
    }
  });
  root.addEventListener('change', (e) => { if (e.target.dataset.sw) { setSetting(e.target.dataset.sw, e.target.checked); applySettings(); } });
  root.addEventListener('input', (e) => {
    const k = e.target.dataset.range;
    if (!k) return;
    setSetting(k, +e.target.value);
    root.querySelector(k === 'fontSize' ? '#fsv' : '#lhv').textContent = k === 'fontSize' ? `${e.target.value}px` : e.target.value;
    applySettings();
  });
}
