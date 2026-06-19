/* ===================================================================
   HANGEUL DECOMPOSITION
   Décompose une syllabe coréenne en ses jamo (consonnes/voyelles)
   pour l'affichage au survol des cartes. Pure logique Unicode,
   pas de lib externe nécessaire.
=================================================================== */
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

function decomposeHangul(str) {
  const parts = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const cho = Math.floor(offset / 588);
      const jung = Math.floor((offset % 588) / 28);
      const jong = offset % 28;
      let syll = CHO[cho] + JUNG[jung];
      if (JONG[jong]) syll += JONG[jong];
      parts.push(syll);
    }
    // non-hangul characters (spaces, punctuation) are skipped in the jamo line
  }
  return parts.join(" · ");
}

/* ===================================================================
   RENDERING
=================================================================== */
function renderGrid(gridEl, pillsEl, data, activeCategory, query, isEnglish) {
  const categories = [...new Set(data.map(w => w.cat))];

  // Pills
  pillsEl.innerHTML = "";
  const allPill = document.createElement("button");
  allPill.className = "pill" + (activeCategory === null ? " active" : "");
  allPill.textContent = `Tout (${data.length})`;
  allPill.dataset.cat = "";
  pillsEl.appendChild(allPill);

  categories.forEach(cat => {
    const count = data.filter(w => w.cat === cat).length;
    const pill = document.createElement("button");
    pill.className = "pill" + (activeCategory === cat ? " active" : "");
    pill.textContent = `${cat} (${count})`;
    pill.dataset.cat = cat;
    pillsEl.appendChild(pill);
  });

  // Filter
  let filtered = data;
  if (activeCategory) filtered = filtered.filter(w => w.cat === activeCategory);
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(w =>
      w.fr.toLowerCase().includes(q) ||
      w.kr.toLowerCase().includes(q) ||
      w.cat.toLowerCase().includes(q)
    );
  }

  // Cards
  gridEl.innerHTML = "";
  filtered.forEach(word => {
    const card = document.createElement("div");
    card.className = "word-card";
    card.innerHTML = `
      <span class="cat-tag">${word.cat}</span>
      <div class="fr">${word.fr}</div>
      <div class="kr">${word.kr}</div>
      ${!isEnglish ? `<div class="jamo">${decomposeHangul(word.kr)}</div>` : ""}
    `;
    gridEl.appendChild(card);
  });

  return filtered.length;
}

/* ===================================================================
   STATE
=================================================================== */
const state = {
  kr: { cat: null, query: "" },
  en: { cat: null, query: "" },
};

function refreshKorean() {
  renderGrid(
    document.getElementById("kr-grid"),
    document.getElementById("kr-pills"),
    koreanData,
    state.kr.cat,
    state.kr.query,
    false
  );
}

/* ===================================================================
   NAVIGATION
=================================================================== */
function switchView(viewName) {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach(section => {
    section.classList.toggle("active", section.id === `view-${viewName}`);
  });
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

/* ===================================================================
   PILLS — delegated click handling
=================================================================== */
document.getElementById("kr-pills").addEventListener("click", e => {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  state.kr.cat = pill.dataset.cat || null;
  refreshKorean();
});

/* ===================================================================
   SEARCH
=================================================================== */
document.getElementById("kr-search").addEventListener("input", e => {
  state.kr.query = e.target.value;
  refreshKorean();
});

/* ===================================================================
   INIT
=================================================================== */
document.getElementById("word-count").textContent =
  `${koreanData.length} mots appris`;

refreshKorean();
