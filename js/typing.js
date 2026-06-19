/* ===================================================================
   ACTIVITÉ — "Saisie libre"
   Tape la traduction au clavier, sans choix proposés.
   Tolère les espaces superflus en début/fin, rien d'autre.
=================================================================== */

const typing = {
  pool: [],
  direction: "fr-to-kr",
  sequence: [],
  current: null,
  index: 0,
  correct: 0,
  wrong: 0,
  log: [],
  awaitingNext: false, // bloque la saisie pendant l'affichage du feedback
};

function typingShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function typingPickCategories() {
  const select = document.getElementById("typing-cat");
  const cats = [...new Set(koreanData.map(w => w.cat))];
  select.innerHTML = `<option value="">Toutes les catégories (${koreanData.length} mots)</option>`;
  cats.forEach(cat => {
    const count = koreanData.filter(w => w.cat === cat).length;
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = `${cat} (${count})`;
    select.appendChild(opt);
  });

  select.addEventListener("change", typingUpdateLengthOptions);
  typingUpdateLengthOptions();
}

function typingUpdateLengthOptions() {
  const cat = document.getElementById("typing-cat").value;
  const poolSize = cat
    ? koreanData.filter(w => w.cat === cat).length
    : koreanData.length;

  const lengthSelect = document.getElementById("typing-length");
  const presets = [5, 10, 15, 20, 30];
  const options = presets.filter(n => n <= poolSize);
  if (options.length === 0 || options[options.length - 1] !== poolSize) {
    options.push(poolSize);
  }

  lengthSelect.innerHTML = "";
  options.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n === poolSize ? `${n} (tous)` : n;
    lengthSelect.appendChild(opt);
  });

  lengthSelect.value = options.includes(10) ? "10" : options[options.length - 1];
}

function showTypingScreen(name) {
  document.getElementById("typing-setup").classList.toggle("hidden", name !== "setup");
  document.getElementById("typing-game").classList.toggle("active", name === "game");
  document.getElementById("typing-result").classList.toggle("active", name === "result");
}

function openTyping() {
  document.getElementById("activity-picker").classList.add("hidden");
  document.getElementById("typing-wrap").classList.add("active");
  typingPickCategories();
  showTypingScreen("setup");
}

function closeTyping() {
  document.getElementById("activity-picker").classList.remove("hidden");
  document.getElementById("typing-wrap").classList.remove("active");
}

function startTyping() {
  const cat = document.getElementById("typing-cat").value;
  typing.direction = document.getElementById("typing-direction").value;
  typing.pool = cat ? koreanData.filter(w => w.cat === cat) : koreanData;

  const requestedLength = parseInt(document.getElementById("typing-length").value, 10);
  const total = Math.min(requestedLength, typing.pool.length);
  typing.sequence = typingShuffle(typing.pool).slice(0, total);
  typing.index = 0;
  typing.correct = 0;
  typing.wrong = 0;
  typing.log = [];
  typing.awaitingNext = false;

  showTypingScreen("game");
  typingNext();
}

function typingNext() {
  if (typing.index >= typing.sequence.length) {
    finishTyping();
    return;
  }

  typing.current = typing.sequence[typing.index];
  typing.awaitingNext = false;
  const isFrToKr = typing.direction === "fr-to-kr";
  const promptField = isFrToKr ? "fr" : "kr";

  document.getElementById("typing-progress").textContent =
    `${typing.index + 1} / ${typing.sequence.length}`;
  document.getElementById("typing-score").textContent =
    `${typing.correct} ✅ · ${typing.wrong} ❌`;
  document.getElementById("typing-word").textContent = typing.current[promptField];
  document.getElementById("typing-prompt-label").textContent =
    isFrToKr ? "Traduis en coréen" : "Traduis en français";

  const input = document.getElementById("typing-input");
  input.value = "";
  input.classList.remove("input-correct", "input-wrong");
  input.disabled = false;
  input.focus();

  const feedback = document.getElementById("typing-feedback");
  feedback.textContent = "";
  feedback.className = "typing-feedback";

  document.getElementById("typing-submit").textContent = "Valider";
}

function normalize(str) {
  return str.trim().toLowerCase();
}

function submitTyping() {
  const input = document.getElementById("typing-input");

  // si on est déjà en train d'afficher le feedback, le bouton sert à "continuer"
  if (typing.awaitingNext) {
    typing.index++;
    typingNext();
    return;
  }

  const isFrToKr = typing.direction === "fr-to-kr";
  const answerField = isFrToKr ? "kr" : "fr";
  const expected = typing.current[answerField];

  const userAnswer = normalize(input.value);
  const isCorrect = userAnswer.length > 0 && userAnswer === normalize(expected);

  recordAnswer(typing.current.kr, isCorrect, "typing");

  const feedback = document.getElementById("typing-feedback");
  input.disabled = true;

  if (isCorrect) {
    input.classList.add("input-correct");
    feedback.textContent = "Correct ! ✅";
    feedback.className = "typing-feedback show-correct";
    typing.correct++;
  } else {
    input.classList.add("input-wrong");
    feedback.textContent = `Réponse attendue : ${expected}`;
    feedback.className = "typing-feedback show-wrong";
    typing.wrong++;
  }

  typing.log.push({
    fr: typing.current.fr,
    kr: typing.current.kr,
    isCorrect,
  });

  typing.awaitingNext = true;
  document.getElementById("typing-submit").textContent = "Continuer";
}

function renderTypingList() {
  const listEl = document.getElementById("typing-result-list");
  listEl.innerHTML = "";
  typing.log.forEach(entry => {
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

function finishTyping() {
  showTypingScreen("result");
  document.getElementById("typing-result-score").textContent =
    `${typing.correct} / ${typing.sequence.length}`;

  const ratio = typing.correct / typing.sequence.length;
  let msg = "La saisie libre est exigeante, continue !";
  if (ratio === 1) msg = "Sans faute en saisie libre, impressionnant ! 🎉";
  else if (ratio >= 0.8) msg = "Très bonne maîtrise de l'écriture.";
  else if (ratio >= 0.5) msg = "Pas mal, l'orthographe progresse.";

  document.getElementById("typing-result-sub").textContent = msg;
  renderTypingList();
}

document.querySelector('[data-game="typing"]').addEventListener("click", openTyping);
document.getElementById("typing-cancel").addEventListener("click", closeTyping);
document.getElementById("typing-start").addEventListener("click", startTyping);
document.getElementById("typing-quit").addEventListener("click", closeTyping);
document.getElementById("typing-back").addEventListener("click", closeTyping);
document.getElementById("typing-replay").addEventListener("click", () => showTypingScreen("setup"));

document.getElementById("typing-form").addEventListener("submit", (e) => {
  e.preventDefault();
  submitTyping();
});