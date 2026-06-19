/* ===================================================================
   ACTIVITÉ — "Mode survie"
   Une erreur termine la partie. On garde la meilleure série en
   mémoire pendant la session (pas de stockage persistant).
=================================================================== */

const survival = {
  pool: [],
  direction: "fr-to-kr",
  numChoices: 6,
  current: null,
  streak: 0,
  best: 0,
  log: [], // { fr, kr, isCorrect } — uniquement les mots de la run en cours
};

function survivalShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function survivalPickCategories() {
  const select = document.getElementById("survival-cat");
  const cats = [...new Set(koreanData.map(w => w.cat))];
  select.innerHTML = `<option value="">Toutes les catégories (${koreanData.length} mots)</option>`;
  cats.forEach(cat => {
    const count = koreanData.filter(w => w.cat === cat).length;
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${count})`;
    select.appendChild(opt);
  });
}

function showSurvivalScreen(name) {
  document.getElementById("survival-setup").classList.toggle("hidden", name !== "setup");
  document.getElementById("survival-game").classList.toggle("active", name === "game");
  document.getElementById("survival-result").classList.toggle("active", name === "result");
}

function openSurvival() {
  document.getElementById("activity-picker").classList.add("hidden");
  document.getElementById("survival-wrap").classList.add("active");
  survivalPickCategories();
  showSurvivalScreen("setup");
}

function closeSurvival() {
  document.getElementById("activity-picker").classList.remove("hidden");
  document.getElementById("survival-wrap").classList.remove("active");
}

function startSurvival() {
  const cat = document.getElementById("survival-cat").value;
  survival.direction = document.getElementById("survival-direction").value;
  survival.numChoices = parseInt(document.getElementById("survival-choices").value, 10);
  survival.pool = cat ? koreanData.filter(w => w.cat === cat) : koreanData;

  if (survival.pool.length < survival.numChoices) {
    alert("Pas assez de mots dans cette catégorie pour ce nombre de choix.");
    return;
  }

  survival.streak = 0;
  survival.log = [];

  showSurvivalScreen("game");
  survivalNext();
}

function survivalNext() {
  const isFrToKr = survival.direction === "fr-to-kr";
  const promptField = isFrToKr ? "fr" : "kr";
  const answerField = isFrToKr ? "kr" : "fr";

  survival.current = survivalShuffle(survival.pool)[0];
  const others = survivalShuffle(survival.pool.filter(w => w.kr !== survival.current.kr))
    .slice(0, survival.numChoices - 1);
  const options = survivalShuffle([survival.current, ...others]);

  document.getElementById("survival-streak").textContent = `Série : ${survival.streak}`;
  document.getElementById("survival-best").textContent = `Record : ${survival.best}`;
  document.getElementById("survival-word").textContent = survival.current[promptField];
  document.getElementById("survival-prompt-label").textContent =
    isFrToKr ? "Traduis en coréen" : "Traduis en français";

  const optionsEl = document.getElementById("survival-options");
  optionsEl.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt[answerField];
    btn.dataset.kr = opt.kr;
    btn.addEventListener("click", () => survivalAnswer(btn, opt));
    optionsEl.appendChild(btn);
  });
}

function survivalAnswer(btn, opt) {
  const allButtons = document.querySelectorAll("#survival-options .quiz-option");
  allButtons.forEach(b => b.disabled = true);

  const isCorrect = opt.kr === survival.current.kr;
  recordAnswer(survival.current.kr, isCorrect);
  survival.log.push({ fr: survival.current.fr, kr: survival.current.kr, isCorrect });

  if (isCorrect) {
    btn.classList.add("correct");
    survival.streak++;
    if (survival.streak > survival.best) survival.best = survival.streak;
    setTimeout(survivalNext, 600);
  } else {
    btn.classList.add("wrong");
    allButtons.forEach(b => {
      if (b.dataset.kr === survival.current.kr) b.classList.add("correct");
    });
    setTimeout(survivalFinish, 1100);
  }
}

function survivalRenderList() {
  const listEl = document.getElementById("survival-result-list");
  listEl.innerHTML = "";
  survival.log.forEach(entry => {
    const li = document.createElement("li");
    li.className = "quiz-result-item " + (entry.isCorrect ? "is-correct" : "is-wrong");
    li.innerHTML = `
      <span class="rec-icon">${entry.isCorrect ? "✅" : "❌"}</span>
      <span class="rec-fr">${entry.fr}</span>
      <span class="rec-kr">${entry.kr}</span>
    `;
    listEl.appendChild(li);
  });
}

function survivalFinish() {
  showSurvivalScreen("result");
  document.getElementById("survival-result-score").textContent = `${survival.streak}`;

  let msg = "Belle série !";
  if (survival.streak === 0) msg = "Ça arrive, retente ta chance !";
  else if (survival.streak >= survival.best && survival.streak > 0) msg = "Nouveau record ! 🔥";

  document.getElementById("survival-result-sub").textContent = msg;
  survivalRenderList();
}

document.querySelector('[data-game="survival"]').addEventListener("click", openSurvival);
document.getElementById("survival-cancel").addEventListener("click", closeSurvival);
document.getElementById("survival-start").addEventListener("click", startSurvival);
document.getElementById("survival-quit").addEventListener("click", closeSurvival);
document.getElementById("survival-back").addEventListener("click", closeSurvival);
document.getElementById("survival-replay").addEventListener("click", () => showSurvivalScreen("setup"));