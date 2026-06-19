/* ===================================================================
   ACTIVITÉ — "Flashcards"
   Devine dans ta tête, clique pour révéler, auto-évalue-toi.
=================================================================== */

const flash = {
  pool: [],
  direction: "fr-to-kr",
  order: "random",
  sequence: [],
  index: 0,
  known: 0,
  unknown: 0,
  revealed: false,
  log: [], // { fr, kr, knew: true/false }
};

function flashShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function flashPickCategories() {
  const select = document.getElementById("flash-cat");
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

function showFlashScreen(name) {
  document.getElementById("flash-setup").classList.toggle("hidden", name !== "setup");
  document.getElementById("flash-game").classList.toggle("active", name === "game");
  document.getElementById("flash-result").classList.toggle("active", name === "result");
}

function openFlash() {
  document.getElementById("activity-picker").classList.add("hidden");
  document.getElementById("flash-wrap").classList.add("active");
  flashPickCategories();
  showFlashScreen("setup");
}

function closeFlash() {
  document.getElementById("activity-picker").classList.remove("hidden");
  document.getElementById("flash-wrap").classList.remove("active");
}

function startFlash() {
  const cat = document.getElementById("flash-cat").value;
  flash.direction = document.getElementById("flash-direction").value;
  flash.order = document.getElementById("flash-order").value;
  flash.pool = cat ? koreanData.filter(w => w.cat === cat) : koreanData;

  flash.sequence = flash.order === "random" ? flashShuffle(flash.pool) : [...flash.pool];
  flash.index = 0;
  flash.known = 0;
  flash.unknown = 0;
  flash.log = [];

  showFlashScreen("game");
  flashRenderCard();
}

function flashRenderCard() {
  const isFrToKr = flash.direction === "fr-to-kr";
  const word = flash.sequence[flash.index];
  flash.revealed = false;

  document.getElementById("flash-progress").textContent =
    `${flash.index + 1} / ${flash.sequence.length}`;
  document.getElementById("flash-score").textContent =
    `${flash.known} su · ${flash.unknown} à revoir`;

  document.getElementById("flash-label").textContent = isFrToKr ? "Français" : "Coréen";
  document.getElementById("flash-word").textContent = isFrToKr ? word.fr : word.kr;
  document.getElementById("flash-card").classList.remove("revealed");
  document.querySelector(".flash-hint").textContent = "Clique pour révéler";
  document.getElementById("flash-rate").classList.remove("show");
}

function flashReveal() {
  if (flash.revealed) return;
  flash.revealed = true;

  const isFrToKr = flash.direction === "fr-to-kr";
  const word = flash.sequence[flash.index];

  document.getElementById("flash-word").textContent = isFrToKr ? word.kr : word.fr;
  document.getElementById("flash-card").classList.add("revealed");
  document.querySelector(".flash-hint").textContent = isFrToKr ? word.fr : word.kr;
  document.getElementById("flash-rate").classList.add("show");
}

function flashRate(knew) {
  const word = flash.sequence[flash.index];
  recordAnswer(word.kr, knew, "flashcards");
  flash.log.push({ fr: word.fr, kr: word.kr, knew });

  if (knew) flash.known++;
  else flash.unknown++;

  flash.index++;
  if (flash.index >= flash.sequence.length) {
    flashFinish();
  } else {
    flashRenderCard();
  }
}

function flashRenderList() {
  const listEl = document.getElementById("flash-result-list");
  listEl.innerHTML = "";
  flash.log.forEach(entry => {
    const li = document.createElement("li");
    li.className = "quiz-result-item " + (entry.knew ? "is-correct" : "is-wrong");
    li.innerHTML = `
      <span class="rec-icon">${entry.knew ? "✅" : "❌"}</span>
      <span class="rec-fr">${entry.fr}</span>
      <span class="rec-kr">${entry.kr}</span>
    `;
    listEl.appendChild(li);
  });
}

function flashFinish() {
  showFlashScreen("result");
  document.getElementById("flash-result-score").textContent =
    `${flash.known} / ${flash.sequence.length}`;

  const ratio = flash.known / flash.sequence.length;
  let msg = "Continue, ça progresse !";
  if (ratio === 1) msg = "Tout su, impeccable ! 🎉";
  else if (ratio >= 0.8) msg = "Très bonne mémorisation.";
  else if (ratio >= 0.5) msg = "Pas mal, quelques mots à revoir.";

  document.getElementById("flash-result-sub").textContent = msg;
  flashRenderList();
}

document.querySelector('[data-game="flashcards"]').addEventListener("click", openFlash);
document.getElementById("flash-cancel").addEventListener("click", closeFlash);
document.getElementById("flash-start").addEventListener("click", startFlash);
document.getElementById("flash-quit").addEventListener("click", closeFlash);
document.getElementById("flash-back").addEventListener("click", closeFlash);
document.getElementById("flash-replay").addEventListener("click", () => showFlashScreen("setup"));

document.getElementById("flash-card").addEventListener("click", flashReveal);
document.getElementById("flash-no").addEventListener("click", () => flashRate(false));
document.getElementById("flash-yes").addEventListener("click", () => flashRate(true));