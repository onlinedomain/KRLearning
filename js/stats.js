/* ===================================================================
   STATS — suivi des erreurs par mot + journal d'événements horodatés.
   - `wordStats` (ancien système) : utilisé par Révision ciblée.
   - `eventLog` (nouveau) : chaque réponse, avec timestamp, jeu et
     catégorie. Sert de base à l'onglet Score / graphiques.
=================================================================== */

const STATS_KEY = "vocab-stats-v1";
const EVENTS_KEY = "vocab-events-v1";
const MAX_EVENTS = 5000; // garde-fou pour ne pas saturer localStorage

/* ---------- ancien système (compteurs cumulés par mot) ---------- */
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
    // stockage indisponible : on ignore silencieusement
  }
}

/* ---------- nouveau système (journal d'événements) ---------- */
function loadEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEvents(events) {
  try {
    // garde seulement les MAX_EVENTS plus récents
    const trimmed = events.length > MAX_EVENTS ? events.slice(-MAX_EVENTS) : events;
    localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    // ignore
  }
}

/**
 * Enregistre une réponse pour un mot donné.
 * @param {string} kr - le mot coréen (clé unique)
 * @param {boolean} isCorrect
 * @param {string} game - identifiant du jeu ("quiz", "survival", "flashcards", "review", "fillblank", "typing")
 */
function recordAnswer(kr, isCorrect, game) {
  // ancien système, toujours utilisé par Révision ciblée
  const stats = loadStats();
  if (!stats[kr]) stats[kr] = { seen: 0, wrong: 0 };
  stats[kr].seen++;
  if (!isCorrect) stats[kr].wrong++;
  saveStats(stats);

  // nouveau système : journal d'événements
  const word = koreanData.find(w => w.kr === kr);
  const events = loadEvents();
  events.push({
    t: Date.now(),
    kr,
    cat: word ? word.cat : "Inconnu",
    correct: !!isCorrect,
    game: game || "unknown",
  });
  saveEvents(events);
}

/**
 * Retourne koreanData trié par "score de difficulté" décroissant.
 */
function getWordsByDifficulty() {
  const stats = loadStats();
  return [...koreanData]
    .map(word => {
      const s = stats[word.kr];
      let score;
      if (!s || s.seen === 0) {
        score = 0.5;
      } else {
        score = s.wrong / s.seen;
      }
      return { word, score, seen: s ? s.seen : 0, wrong: s ? s.wrong : 0 };
    })
    .sort((a, b) => b.score - a.score);
}

function resetStats() {
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(EVENTS_KEY);
}

/* ---------- helpers pour l'onglet Score ---------- */

const GAME_LABELS = {
  quiz: "Trouve la traduction",
  survival: "Mode survie",
  flashcards: "Flashcards",
  review: "Révision ciblée",
  fillblank: "Phrase à trous",
  typing: "Saisie libre",
};

function getEventsForGame(game) {
  return loadEvents().filter(e => e.game === game);
}

function getAllGamesWithData() {
  const events = loadEvents();
  const games = new Set(events.map(e => e.game));
  return [...games];
}

/**
 * Regroupe les événements d'un jeu en "sessions" : une session = une
 * suite d'événements sans pause de plus de 5 minutes entre deux.
 */
function groupIntoSessions(events) {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const sessions = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].t - sorted[i - 1].t;
    if (gap > 5 * 60 * 1000) {
      sessions.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  sessions.push(current);
  return sessions;
}