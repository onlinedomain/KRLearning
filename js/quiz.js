const quiz = {
  pool: [],        // mots de la catégorie choisie
  numChoices: 6,
  direction: "fr-to-kr", // "fr-to-kr" ou "kr-to-fr"
  current: null,   // mot à trouver actuellement
  options: [],      // choix affichés pour la question actuelle
  index: 0,
  total: 10,
  correct: 0,
  wrong: 0,
  log: [],          // historique de la partie : { fr, kr, isCorrect }
};

/* ---------- helpers ---------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuizCategories() {
  const select = document.getElementById("quiz-cat");
  const cats = [...new Set(koreanData.map(w => w.cat))];
  select.innerHTML = `<option value="">Toutes les catégories (${koreanData.length} mots)</option>`;
  cats.forEach(cat => {
    const count = koreanData.filter(w => w.cat === cat).length;
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${count})`;
    select.appendChild(opt);
  });

  select.addEventListener("change", updateLengthOptions);
  updateLengthOptions();
}

function updateLengthOptions() {
  const cat = document.getElementById("quiz-cat").value;
  const poolSize = cat
    ? koreanData.filter(w => w.cat === cat).length
    : koreanData.length;

  const lengthSelect = document.getElementById("quiz-length");
  const presets = [5, 10, 15, 20, 30, 50];
  const options = presets.filter(n => n <= poolSize);
  if (options.length === 0 || options[options.length - 1] !== poolSize) {
    options.push(poolSize); // toujours proposer "tous les mots" de la sélection
  }

  lengthSelect.innerHTML = "";
  options.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n === poolSize ? `${n} (tous)` : n;
    lengthSelect.appendChild(opt);
  });

  // sélectionne 10 par défaut si possible, sinon le max disponible
  lengthSelect.value = options.includes(10) ? "10" : options[options.length - 1];
}

/* ---------- screen switching ---------- */
function showQuizScreen(name) {
  document.getElementById("quiz-setup").classList.toggle("hidden", name !== "setup");
  document.getElementById("quiz-game").classList.toggle("active", name === "game");
  document.getElementById("quiz-result").classList.toggle("active", name === "result");
}

function openQuiz() {
  document.getElementById("activity-picker").classList.add("hidden");
  document.getElementById("quiz-wrap").classList.add("active");
  pickQuizCategories();
  showQuizScreen("setup");
}

function closeQuiz() {
  document.getElementById("activity-picker").classList.remove("hidden");
  document.getElementById("quiz-wrap").classList.remove("active");
}

/* ---------- game flow ---------- */
function startQuiz() {
  const cat = document.getElementById("quiz-cat").value;
  quiz.direction = document.getElementById("quiz-direction").value;
  quiz.numChoices = parseInt(document.getElementById("quiz-choices").value, 10);
  quiz.pool = cat ? koreanData.filter(w => w.cat === cat) : koreanData;

  if (quiz.pool.length < quiz.numChoices) {
    alert("Pas assez de mots dans cette catégorie pour ce nombre de choix.");
    return;
  }

  const requestedLength = parseInt(document.getElementById("quiz-length").value, 10);
  quiz.total = Math.min(requestedLength, quiz.pool.length);
  quiz.sequence = shuffle(quiz.pool).slice(0, quiz.total);
  quiz.index = 0;
  quiz.correct = 0;
  quiz.wrong = 0;
  quiz.log = [];

  showQuizScreen("game");
  nextQuestion();
}

function nextQuestion() {
  if (quiz.index >= quiz.sequence.length) {
    finishQuiz();
    return;
  }

  quiz.current = quiz.sequence[quiz.index];
  const isFrToKr = quiz.direction === "fr-to-kr";

  // mot affiché dans la question vs. champ utilisé pour les options de réponse
  const promptField = isFrToKr ? "fr" : "kr";
  const answerField = isFrToKr ? "kr" : "fr";

  const others = shuffle(quiz.pool.filter(w => w.kr !== quiz.current.kr))
    .slice(0, quiz.numChoices - 1);
  quiz.options = shuffle([quiz.current, ...others]);

  document.getElementById("quiz-progress").textContent =
    `${quiz.index + 1} / ${quiz.sequence.length}`;
  document.getElementById("quiz-score").textContent =
    `${quiz.correct} ✅ · ${quiz.wrong} ❌`;
  document.getElementById("quiz-word").textContent = quiz.current[promptField];
  document.querySelector(".quiz-prompt-label").textContent =
    isFrToKr ? "Traduis en coréen" : "Traduis en français";

  const optionsEl = document.getElementById("quiz-options");
  optionsEl.innerHTML = "";
  quiz.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt[answerField];
    // si plusieurs mots partagent la même traduction française, on
    // identifie la bonne réponse via le mot coréen (toujours unique ici)
    btn.dataset.kr = opt.kr;
    btn.addEventListener("click", () => selectAnswer(btn, opt));
    optionsEl.appendChild(btn);
  });
}

function selectAnswer(btn, opt) {
  const allButtons = document.querySelectorAll(".quiz-option");
  allButtons.forEach(b => b.disabled = true);

  const isCorrect = opt.kr === quiz.current.kr;
  recordAnswer(quiz.current.kr, isCorrect, "quiz");
  const answerField = quiz.direction === "fr-to-kr" ? "kr" : "fr";

  if (isCorrect) {
    btn.classList.add("correct");
    quiz.correct++;
  } else {
    btn.classList.add("wrong");
    quiz.wrong++;
    allButtons.forEach(b => {
      if (b.dataset.kr === quiz.current.kr) b.classList.add("correct");
    });
  }

  quiz.log.push({
    fr: quiz.current.fr,
    kr: quiz.current.kr,
    isCorrect,
  });

  quiz.index++;
  setTimeout(nextQuestion, 900);
}

function renderResultList() {
  const listEl = document.getElementById("quiz-result-list");
  listEl.innerHTML = "";

  quiz.log.forEach(entry => {
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

function finishQuiz() {
  showQuizScreen("result");
  document.getElementById("quiz-result-score").textContent =
    `${quiz.correct} / ${quiz.sequence.length}`;

  const ratio = quiz.correct / quiz.sequence.length;
  let msg = "Continue comme ça !";
  if (ratio === 1) msg = "Parfait, sans faute ! 🎉";
  else if (ratio >= 0.8) msg = "Très solide !";
  else if (ratio >= 0.5) msg = "Pas mal, encore un peu d'entraînement.";
  else msg = "Ce vocabulaire mérite une petite révision.";

  document.getElementById("quiz-result-sub").textContent = msg;
  renderResultList();
}

/* ---------- wiring ---------- */
document.querySelector('[data-game="quiz"]').addEventListener("click", openQuiz);
document.getElementById("quiz-cancel").addEventListener("click", closeQuiz);
document.getElementById("quiz-start").addEventListener("click", startQuiz);
document.getElementById("quiz-quit").addEventListener("click", closeQuiz);
document.getElementById("quiz-back").addEventListener("click", closeQuiz);
document.getElementById("quiz-replay").addEventListener("click", () => showQuizScreen("setup"));