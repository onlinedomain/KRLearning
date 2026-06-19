/* ===================================================================
   ACTIVITÉ — "Révision ciblée"
   Pioche en priorité les mots avec le plus haut taux d'erreur,
   d'après les stats enregistrées par les autres jeux.
=================================================================== */

const review = {
  direction: "fr-to-kr",
  numChoices: 6,
  sequence: [],
  current: null,
  index: 0,
  correct: 0,
  wrong: 0,
  log: [],
};

function reviewShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showReviewScreen(name) {
  document.getElementById("review-setup").classList.toggle("hidden", name !== "setup");
  document.getElementById("review-game").classList.toggle("active", name === "game");
  document.getElementById("review-result").classList.toggle("active", name === "result");
}

function updateReviewStatus() {
  const ranked = getWordsByDifficulty();
  const withMistakes = ranked.filter(r => r.wrong > 0).length;
  const neverSeen = ranked.filter(r => r.seen === 0).length;

  document.getElementById("review-status").textContent =
    withMistakes > 0
      ? `${withMistakes} mot(s) à problème détecté(s), ${neverSeen} jamais vu(s). On commence par les pires.`
      : `Aucune erreur enregistrée encore — joue au Quiz, à la Survie ou aux Flashcards d'abord, ou lance une session sur des mots jamais vus.`;
}

function openReview() {
  document.getElementById("activity-picker").classList.add("hidden");
  document.getElementById("review-wrap").classList.add("active");
  updateReviewStatus();
  showReviewScreen("setup");
}

function closeReview() {
  document.getElementById("activity-picker").classList.remove("hidden");
  document.getElementById("review-wrap").classList.remove("active");
}

function startReview() {
  review.direction = document.getElementById("review-direction").value;
  review.numChoices = parseInt(document.getElementById("review-choices").value, 10);

  if (koreanData.length < review.numChoices) {
    alert("Pas assez de mots au total pour ce nombre de choix.");
    return;
  }

  const ranked = getWordsByDifficulty();
  const length = Math.min(10, ranked.length);
  review.sequence = ranked.slice(0, length).map(r => r.word);
  review.index = 0;
  review.correct = 0;
  review.wrong = 0;
  review.log = [];

  showReviewScreen("game");
  reviewNext();
}

function reviewNext() {
  if (review.index >= review.sequence.length) {
    finishReview();
    return;
  }

  review.current = review.sequence[review.index];
  const isFrToKr = review.direction === "fr-to-kr";
  const promptField = isFrToKr ? "fr" : "kr";
  const answerField = isFrToKr ? "kr" : "fr";

  const others = reviewShuffle(koreanData.filter(w => w.kr !== review.current.kr))
    .slice(0, review.numChoices - 1);
  const options = reviewShuffle([review.current, ...others]);

  document.getElementById("review-progress").textContent =
    `${review.index + 1} / ${review.sequence.length}`;
  document.getElementById("review-score").textContent =
    `${review.correct} ✅ · ${review.wrong} ❌`;
  document.getElementById("review-word").textContent = review.current[promptField];
  document.getElementById("review-prompt-label").textContent =
    isFrToKr ? "Traduis en coréen" : "Traduis en français";

  const optionsEl = document.getElementById("review-options");
  optionsEl.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt[answerField];
    btn.dataset.kr = opt.kr;
    btn.addEventListener("click", () => reviewAnswer(btn, opt));
    optionsEl.appendChild(btn);
  });
}

function reviewAnswer(btn, opt) {
  const allButtons = document.querySelectorAll("#review-options .quiz-option");
  allButtons.forEach(b => b.disabled = true);

  const isCorrect = opt.kr === review.current.kr;
  recordAnswer(review.current.kr, isCorrect, "review");

  if (isCorrect) {
    btn.classList.add("correct");
    review.correct++;
  } else {
    btn.classList.add("wrong");
    review.wrong++;
    allButtons.forEach(b => {
      if (b.dataset.kr === review.current.kr) b.classList.add("correct");
    });
  }

  review.log.push({ fr: review.current.fr, kr: review.current.kr, isCorrect });

  review.index++;
  setTimeout(reviewNext, 900);
}

function renderReviewList() {
  const listEl = document.getElementById("review-result-list");
  listEl.innerHTML = "";
  review.log.forEach(entry => {
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

function finishReview() {
  showReviewScreen("result");
  document.getElementById("review-result-score").textContent =
    `${review.correct} / ${review.sequence.length}`;

  const ratio = review.correct / review.sequence.length;
  let msg = "Ces mots méritaient bien une révision.";
  if (ratio === 1) msg = "Tous corrigés, bravo ! 🎉";
  else if (ratio >= 0.7) msg = "Bonne progression sur tes points faibles.";

  document.getElementById("review-result-sub").textContent = msg;
  renderReviewList();
}

document.querySelector('[data-game="review"]').addEventListener("click", openReview);
document.getElementById("review-cancel").addEventListener("click", closeReview);
document.getElementById("review-start").addEventListener("click", startReview);
document.getElementById("review-quit").addEventListener("click", closeReview);
document.getElementById("review-back").addEventListener("click", closeReview);
document.getElementById("review-replay").addEventListener("click", () => {
  updateReviewStatus();
  showReviewScreen("setup");
});
document.getElementById("review-reset").addEventListener("click", () => {
  if (confirm("Effacer tout l'historique d'erreurs ?")) {
    resetStats();
    updateReviewStatus();
  }
});