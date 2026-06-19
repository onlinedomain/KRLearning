/* ===================================================================
   STATS — suivi des erreurs par mot, persistant via localStorage.
   Utilisé par tous les jeux pour enregistrer les réponses, et par
   le mode "Révision ciblée" pour savoir quels mots prioriser.
=================================================================== */

const STATS_KEY = "vocab-stats-v1";

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    // stockage indisponible (navigation privée, quota...) : on ignore silencieusement
  }
}

/**
 * Enregistre une réponse pour un mot donné.
 * @param {string} kr - le mot coréen (clé unique)
 * @param {boolean} isCorrect
 */
function recordAnswer(kr, isCorrect) {
  const stats = loadStats();
  if (!stats[kr]) stats[kr] = { seen: 0, wrong: 0 };
  stats[kr].seen++;
  if (!isCorrect) stats[kr].wrong++;
  saveStats(stats);
}

/**
 * Retourne koreanData trié par "score de difficulté" décroissant.
 * Score = taux d'erreur, avec un bonus pour les mots jamais vus
 * (pour qu'ils remontent aussi, pas seulement ceux ratés).
 */
function getWordsByDifficulty() {
  const stats = loadStats();
  return [...koreanData]
    .map(word => {
      const s = stats[word.kr];
      let score;
      if (!s || s.seen === 0) {
        score = 0.5; // mot jamais vu : priorité moyenne
      } else {
        score = s.wrong / s.seen;
      }
      return { word, score, seen: s ? s.seen : 0, wrong: s ? s.wrong : 0 };
    })
    .sort((a, b) => b.score - a.score);
}

function resetStats() {
  localStorage.removeItem(STATS_KEY);
}