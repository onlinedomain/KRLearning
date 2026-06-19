/* ===================================================================
   ONGLET SCORE — sélection du jeu + rendu des graphiques.
   Tout est calculé à partir du journal d'événements (stats.js).
=================================================================== */

let currentScoreGame = null;

function renderGamePicker() {
  const picker = document.getElementById("score-game-picker");
  picker.innerHTML = "";

  Object.entries(GAME_LABELS).forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.className = "score-game-btn" + (currentScoreGame === key ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      currentScoreGame = key;
      renderGamePicker();
      renderScoreDashboard();
    });
    picker.appendChild(btn);
  });
}

function renderScoreDashboard() {
  const events = currentScoreGame ? getEventsForGame(currentScoreGame) : [];
  const emptyEl = document.getElementById("score-empty");
  const dashEl = document.getElementById("score-dashboard");

  if (!currentScoreGame || events.length === 0) {
    emptyEl.classList.add("show");
    dashEl.classList.remove("show");
    return;
  }

  emptyEl.classList.remove("show");
  dashEl.classList.add("show");

  renderSummary(events);
  renderProgressChart(events);
  renderCategoryBars(events);
  renderToplist(events);
  renderDailyBars(events);
}

/* ---------- summary cards ---------- */
function renderSummary(events) {
  const total = events.length;
  const correct = events.filter(e => e.correct).length;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
  const sessions = groupIntoSessions(events);

  const el = document.getElementById("score-summary");
  el.innerHTML = `
    <div class="score-stat">
      <span class="score-stat-value">${total}</span>
      <span class="score-stat-label">Réponses données</span>
    </div>
    <div class="score-stat">
      <span class="score-stat-value">${rate}%</span>
      <span class="score-stat-label">Taux de réussite global</span>
    </div>
    <div class="score-stat">
      <span class="score-stat-value">${sessions.length}</span>
      <span class="score-stat-label">Sessions jouées</span>
    </div>
  `;
}

/* ---------- progress line chart ---------- */
function renderProgressChart(events) {
  const sessions = groupIntoSessions(events);
  const points = sessions.map(session => {
    const correct = session.filter(e => e.correct).length;
    return Math.round((correct / session.length) * 100);
  });

  const svg = document.getElementById("chart-progress");
  const W = 600, H = 220, padL = 36, padR = 10, padT = 16, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  let parts = [];

  // grid lines (0/50/100)
  [0, 50, 100].forEach(v => {
    const y = padT + innerH - (v / 100) * innerH;
    parts.push(`<line class="grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" />`);
    parts.push(`<text class="axis-label" x="4" y="${y + 4}">${v}%</text>`);
  });

  if (points.length === 1) {
    const y = padT + innerH - (points[0] / 100) * innerH;
    parts.push(`<circle class="progress-dot" cx="${padL + innerW / 2}" cy="${y}" r="4" />`);
  } else if (points.length > 1) {
    const stepX = innerW / (points.length - 1);
    const coords = points.map((v, i) => {
      const x = padL + i * stepX;
      const y = padT + innerH - (v / 100) * innerH;
      return [x, y];
    });

    const linePath = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(" ");
    const areaPath = `${linePath} L${coords[coords.length - 1][0]},${padT + innerH} L${coords[0][0]},${padT + innerH} Z`;

    parts.push(`<path class="progress-area" d="${areaPath}" />`);
    parts.push(`<path class="progress-line" d="${linePath}" />`);

    coords.forEach(([x, y], i) => {
      const cls = points[i] < 50 ? "progress-dot dot-low" : "progress-dot";
      parts.push(`<circle class="${cls}" cx="${x}" cy="${y}" r="4" />`);
    });
  }

  svg.innerHTML = parts.join("");
}

/* ---------- category bars ---------- */
function renderCategoryBars(events) {
  const byCat = {};
  events.forEach(e => {
    if (!byCat[e.cat]) byCat[e.cat] = { seen: 0, correct: 0 };
    byCat[e.cat].seen++;
    if (e.correct) byCat[e.cat].correct++;
  });

  const rows = Object.entries(byCat)
    .map(([cat, d]) => ({ cat, rate: d.correct / d.seen, seen: d.seen }))
    .sort((a, b) => a.rate - b.rate); // pires en premier : priorité visuelle

  const container = document.getElementById("chart-categories");
  container.innerHTML = "";

  rows.forEach(row => {
    const pct = Math.round(row.rate * 100);
    // couleur : rouge si faible, accent turquoise si fort
    const hue = row.rate < 0.5 ? "#E5707A" : row.rate < 0.75 ? "#F0C868" : "#5EEAD4";

    const div = document.createElement("div");
    div.className = "score-bar-row";
    div.innerHTML = `
      <div class="score-bar-top">
        <span>${row.cat}</span>
        <span>${pct}% (${row.seen})</span>
      </div>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${pct}%; background:${hue}"></div>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ---------- hardest words ---------- */
function renderToplist(events) {
  const byWord = {};
  events.forEach(e => {
    if (!byWord[e.kr]) byWord[e.kr] = { seen: 0, correct: 0 };
    byWord[e.kr].seen++;
    if (e.correct) byWord[e.kr].correct++;
  });

  const ranked = Object.entries(byWord)
    .filter(([, d]) => d.seen >= 2)
    .map(([kr, d]) => {
      const word = koreanData.find(w => w.kr === kr);
      return {
        kr,
        fr: word ? word.fr : "?",
        rate: d.correct / d.seen,
        seen: d.seen,
      };
    })
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  const listEl = document.getElementById("chart-toplist");
  listEl.innerHTML = "";

  if (ranked.length === 0) {
    listEl.innerHTML = `<li class="score-toplist-item"><span class="score-toplist-fr">Pas encore assez de données (il faut au moins 2 essais sur un mot).</span></li>`;
    return;
  }

  ranked.forEach((r, i) => {
    const li = document.createElement("li");
    li.className = "score-toplist-item";
    li.innerHTML = `
      <span class="score-toplist-rank">${i + 1}</span>
      <span class="score-toplist-word">
        <span class="score-toplist-kr">${r.kr}</span>
        <span class="score-toplist-fr">${r.fr}</span>
      </span>
      <span class="score-toplist-rate">${Math.round(r.rate * 100)}%</span>
    `;
    listEl.appendChild(li);
  });
}

/* ---------- daily practice volume ---------- */
function renderDailyBars(events) {
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const counts = days.map(day => {
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    return events.filter(e => e.t >= dayStart && e.t < dayEnd).length;
  });

  const max = Math.max(1, ...counts);
  const container = document.getElementById("chart-daily");
  container.innerHTML = "";

  days.forEach((day, i) => {
    const count = counts[i];
    const heightPct = Math.max(2, Math.round((count / max) * 100));
    const label = `${day.getDate()}/${day.getMonth() + 1}`;

    const col = document.createElement("div");
    col.className = "score-day-col";
    col.innerHTML = `
      <div class="score-day-bar ${count === 0 ? "empty" : ""}" style="height:${heightPct}%" title="${count} mot(s)"></div>
      <span class="score-day-label">${label}</span>
    `;
    container.appendChild(col);
  });
}

/* ---------- init on tab switch ---------- */
document.querySelector('[data-view="scores"]').addEventListener("click", () => {
  if (!currentScoreGame) {
    const withData = getAllGamesWithData();
    currentScoreGame = withData.length > 0 ? withData[0] : Object.keys(GAME_LABELS)[0];
  }
  renderGamePicker();
  renderScoreDashboard();
});

document.getElementById("score-reset-all").addEventListener("click", () => {
  if (confirm("Effacer définitivement tout l'historique de toutes les activités (scores, progression, statistiques) ? Cette action est irréversible.")) {
    resetStats();
    renderScoreDashboard();
  }
});