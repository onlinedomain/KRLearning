/* ===================================================================
   ACTIVITÉ — "Phrase à trous"
   Complète une phrase coréenne en choisissant le bon mot parmi
   plusieurs propositions (les distracteurs viennent d'autres
   mots utilisés comme blank ailleurs dans la banque).
=================================================================== */

const fillblank = {
  sequence: [],
  current: null,
  index: 0,
  correct: 0,
  wrong: 0,
  log: [],
};

function fillblankShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showFillblankScreen(name) {
  document.getElementById("fillblank-setup").classList.toggle("hidden", name !== "setup");
  document.getElementById("fillblank-game").classList.toggle("active", name === "game");
  document.getElementById("fillblank-result").classList.toggle("active", name === "result");
}

function fillblankSetupLength() {
  const select = document.getElementById("fillblank-length");
  const max = sentenceBank.length;
  const presets = [5, 10, 15, 20];
  const options = presets.filter(n => n <= max);
  if (options.length === 0 || options[options.length - 1] !== max) options.push(max);

  select.innerHTML = "";
  options.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n === max ? `${n} (toutes)` : n;
    select.appendChild(opt);
  });
  select.value = options.includes(10) ? "10" : options[options.length - 1];
}

function openFillblank() {
  document.getElementById("activity-picker").classList.add("hidden");
  document.getElementById("fillblank-wrap").classList.add("active");
  fillblankSetupLength();
  showFillblankScreen("setup");
}

function closeFillblank() {
  document.getElementById("activity-picker").classList.remove("hidden");
  document.getElementById("fillblank-wrap").classList.remove("active");
}

function startFillblank() {
  const length = parseInt(document.getElementById("fillblank-length").value, 10);
  fillblank.sequence = fillblankShuffle(sentenceBank).slice(0, length);
  fillblank.index = 0;
  fillblank.correct = 0;
  fillblank.wrong = 0;
  fillblank.log = [];

  showFillblankScreen("game");
  fillblankNext();
}

function fillblankNext() {
  if (fillblank.index >= fillblank.sequence.length) {
    finishFillblank();
    return;
  }

  fillblank.current = fillblank.sequence[fillblank.index];
  const item = fillblank.current;

  // découpe la phrase autour du mot à trouver, garde uniquement la
  // première occurrence pour éviter les soucis si le mot apparaît 2x
  const displaySentence = item.sentence.replace(
    item.blank,
    '<span class="blank">___</span>'
  );

  document.getElementById("fillblank-progress").textContent =
    `${fillblank.index + 1} / ${fillblank.sequence.length}`;
  document.getElementById("fillblank-score").textContent =
    `${fillblank.correct} ✅ · ${fillblank.wrong} ❌`;
  document.getElementById("fillblank-sentence").innerHTML = displaySentence;
  document.getElementById("fillblank-translation").textContent = item.fr;

  // distracteurs : les mots "blank" des autres phrases de la banque
  const others = fillblankShuffle(
    sentenceBank.filter(s => s.blank !== item.blank)
  )
    .map(s => s.blank)
    .filter((word, i, arr) => arr.indexOf(word) === i) // dédoublonne
    .slice(0, 5);

  const options = fillblankShuffle([item.blank, ...others]);

  const optionsEl = document.getElementById("fillblank-options");
  optionsEl.innerHTML = "";
  options.forEach(word => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = word;
    btn.addEventListener("click", () => fillblankAnswer(btn, word));
    optionsEl.appendChild(btn);
  });
}

function fillblankAnswer(btn, word) {
  const allButtons = document.querySelectorAll("#fillblank-options .quiz-option");
  allButtons.forEach(b => b.disabled = true);

  const isCorrect = word === fillblank.current.blank;
  recordAnswer(fillblank.current.blank, isCorrect, "fillblank");

  if (isCorrect) {
    btn.classList.add("correct");
    fillblank.correct++;
  } else {
    btn.classList.add("wrong");
    fillblank.wrong++;
    allButtons.forEach(b => {
      if (b.textContent === fillblank.current.blank) b.classList.add("correct");
    });
  }

  fillblank.log.push({
    fr: fillblank.current.fr,
    kr: fillblank.current.sentence,
    isCorrect,
  });

  fillblank.index++;
  setTimeout(fillblankNext, 1000);
}

function renderFillblankList() {
  const listEl = document.getElementById("fillblank-result-list");
  listEl.innerHTML = "";
  fillblank.log.forEach(entry => {
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

function finishFillblank() {
  showFillblankScreen("result");
  document.getElementById("fillblank-result-score").textContent =
    `${fillblank.correct} / ${fillblank.sequence.length}`;

  const ratio = fillblank.correct / fillblank.sequence.length;
  let msg = "Continue, ça vient !";
  if (ratio === 1) msg = "Toutes les phrases complétées ! 🎉";
  else if (ratio >= 0.8) msg = "Très bonne maîtrise des phrases.";
  else if (ratio >= 0.5) msg = "Pas mal, encore un peu de pratique.";

  document.getElementById("fillblank-result-sub").textContent = msg;
  renderFillblankList();
}

document.querySelector('[data-game="fillblank"]').addEventListener("click", openFillblank);
document.getElementById("fillblank-cancel").addEventListener("click", closeFillblank);
document.getElementById("fillblank-start").addEventListener("click", startFillblank);
document.getElementById("fillblank-quit").addEventListener("click", closeFillblank);
document.getElementById("fillblank-back").addEventListener("click", closeFillblank);
document.getElementById("fillblank-replay").addEventListener("click", () => {
  fillblankSetupLength();
  showFillblankScreen("setup");
});