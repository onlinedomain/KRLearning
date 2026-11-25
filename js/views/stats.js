// Statistics: tiles, texts read per level, 16-week activity heatmap, last 14 days.
import { db, LEVELS, TYPES } from '../data.js';
import { state, streak } from '../store.js';
import { dayKey, bindTooltips, esc } from '../util.js';

const fmtMin = (sec) => (sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1).replace('.', ',')} h`);
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function mountStats(root) {
  const st = streak();
  const words = Object.values(state.words);
  const read = db.texts.filter((t) => state.texts[t.id]?.read);
  const act = state.activity;
  const totalSec = Object.values(act).reduce((a, d) => a + (d.sec || 0), 0);
  const totalCards = Object.values(act).reduce((a, d) => a + (d.cards || 0), 0);
  const quizzes = Object.values(state.texts).filter((x) => x.quiz);
  const qc = quizzes.reduce((a, x) => a + x.quiz.c, 0), qn = quizzes.reduce((a, x) => a + x.quiz.n, 0);
  const known = words.filter((w) => w.status === 'known' || (w.srs && w.srs.ivl >= 21)).length;

  // Per level / per type
  const perLevel = LEVELS.map((L) => {
    const all = db.texts.filter((t) => t.level === L.n);
    return { label: `Niveau ${L.n}`, n: all.filter((t) => state.texts[t.id]?.read).length, of: all.length };
  });
  const perType = Object.entries(TYPES).map(([k, v]) => {
    const all = db.texts.filter((t) => t.type === k);
    return { label: v.many, n: all.filter((t) => state.texts[t.id]?.read).length, of: all.length };
  });

  // Heatmap: 16 weeks, Monday-first columns. Level = reading minutes + reviews.
  const score = (d) => (d ? (d.sec || 0) / 60 + (d.read || 0) * 5 + (d.cards || 0) / 5 : 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - 15 * 7);
  const cells = [];
  for (let d = new Date(start); cells.length < 16 * 7; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d), a = act[k], s = score(a);
    const lvl = s === 0 ? 0 : s < 5 ? 1 : s < 15 ? 2 : s < 30 ? 3 : 4;
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    cells.push(d > today
      ? '<i class="future"></i>'
      : `<i data-l="${lvl}" data-tip="${esc(label)} · ${a ? `${fmtMin(a.sec || 0)} de lecture, ${a.read || 0} texte(s), ${a.cards || 0} carte(s)` : 'aucune activité'}"></i>`);
  }

  // Last 14 days of reading minutes.
  const days14 = [];
  for (let k = 13; k >= 0; k--) {
    const d = new Date(today); d.setDate(d.getDate() - k);
    const a = act[dayKey(d)] || {};
    days14.push({ d, min: Math.round((a.sec || 0) / 60), cards: a.cards || 0, read: a.read || 0 });
  }
  const maxMin = Math.max(5, ...days14.map((x) => x.min));

  const hbars = (rows) => rows.map((r) => `
    <div class="hbar" data-tip="${esc(r.label)} : ${r.n} lus sur ${r.of}"><span>${esc(r.label)}</span>
      <span class="track"><i style="width:${r.of ? (r.n / r.of) * 100 : 0}%"></i></span><span class="val">${r.n} / ${r.of}</span></div>`).join('');

  root.innerHTML = `
    <div class="page-head"><h1>Statistiques</h1><p>Ta progression depuis le ${new Date(state.meta.created).toLocaleDateString('fr-FR')}.</p></div>
    <div class="tiles">
      <div class="card tile"><div class="v">${st.cur}<small> j</small></div><div class="k">Série actuelle · record ${st.best} j</div></div>
      <div class="card tile"><div class="v">${read.length}<small> / ${db.texts.length}</small></div><div class="k">Textes lus</div></div>
      <div class="card tile"><div class="v">${words.length}</div><div class="k">Mots dans ta banque · ${known} maîtrisés</div></div>
      <div class="card tile"><div class="v">${fmtMin(totalSec)}</div><div class="k">Temps de lecture</div></div>
      <div class="card tile"><div class="v">${totalCards}</div><div class="k">Cartes révisées</div></div>
      <div class="card tile"><div class="v">${qn ? Math.round((qc / qn) * 100) : '–'}<small>${qn ? ' %' : ''}</small></div><div class="k">Bonnes réponses aux quiz (${qn} questions)</div></div>
      <div class="card tile"><div class="v">${Object.values(state.texts).filter((x) => x.fav).length}</div><div class="k">Textes favoris</div></div>
      <div class="card tile"><div class="v">${Object.keys(act).filter((k) => score(act[k]) > 0).length}</div><div class="k">Jours actifs</div></div>
    </div>

    <section class="card chart-card">
      <h2>Activité des 16 dernières semaines</h2>
      <div class="sub">Chaque case est un jour (lecture, textes terminés et révisions).</div>
      <div style="display:flex;gap:6px"><div style="display:grid;grid-template-rows:repeat(7,14px);gap:3px;font-size:10px;color:var(--muted)">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="heat" role="img" aria-label="Calendrier d’activité">${cells.join('')}</div></div>
      <div class="legend-scale">Moins ${[0, 1, 2, 3, 4].map((l) => `<i style="background:${l ? `color-mix(in srgb, var(--accent) ${[0, 30, 55, 80, 100][l]}%, var(--surface-2))` : 'var(--surface-2)'}"></i>`).join('')} Plus</div>
    </section>

    <section class="card chart-card">
      <h2>Minutes de lecture · 14 derniers jours</h2>
      <div class="sub">Maximum : ${maxMin} min</div>
      <div class="vbars">${days14.map((x) => `<div class="col" data-tip="${esc(x.d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }))} · ${x.min} min, ${x.read} texte(s), ${x.cards} carte(s)"><i style="height:${(x.min / maxMin) * 100}%"></i></div>`).join('')}</div>
      <div class="vlabels">${days14.map((x, k) => `<span>${k % 2 === 1 ? '' : x.d.getDate()}</span>`).join('')}</div>
      <details class="table-view"><summary>Voir en tableau</summary><table><tr><th>Jour</th><th>Minutes</th><th>Textes</th><th>Cartes</th></tr>
        ${days14.map((x) => `<tr><td>${x.d.toLocaleDateString('fr-FR')}</td><td>${x.min}</td><td>${x.read}</td><td>${x.cards}</td></tr>`).join('')}</table></details>
    </section>

    <section class="card chart-card">
      <h2>Textes lus par niveau</h2>
      <div class="sub">Part de chaque niveau déjà terminée.</div>
      ${hbars(perLevel)}
    </section>
    <section class="card chart-card">
      <h2>Textes lus par type</h2>
      <div class="sub">Histoires, séries, contes, actualités, dialogues.</div>
      ${hbars(perType)}
    </section>`;
  bindTooltips(root);
}
