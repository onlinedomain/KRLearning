// Spaced repetition for the word bank.
import { state, save, logActivity } from './store.js';
import { dayKey } from './util.js';

const DAY = 86400000;
export const GRADES = [
  { g: 0, label: 'Encore', key: '1' },
  { g: 1, label: 'Difficile', key: '2' },
  { g: 2, label: 'Bien', key: '3' },
  { g: 3, label: 'Facile', key: '4' },
];

/**
 * Compute the next review state of a card.
 * @param {null|{ivl:number, ease:number, reps:number, lapses:number}} srs
 *        Current state, or null for a card never reviewed.
 *        ivl = current interval in days (can be fractional, e.g. 10 min = 10/1440).
 *        ease = growth multiplier (starts around 2.5).
 * @param {0|1|2|3} grade  0 Encore (forgot), 1 Difficile, 2 Bien, 3 Facile.
 * @returns {{ivl:number, ease:number, reps:number, lapses:number}}
 */
export function schedule(srs, grade) {
  const s = srs || { ivl: 0, ease: 2.5, reps: 0, lapses: 0 };
  // TODO(human): replace this placeholder with real spaced-repetition rules.
  const ivl = grade === 0 ? 10 / 1440 : Math.max(1, s.ivl * 2);
  return { ivl, ease: s.ease, reps: s.reps + 1, lapses: s.lapses + (grade === 0 ? 1 : 0) };
}

export function review(word, grade) {
  const w = state.words[word];
  if (!w) return;
  const next = schedule(w.srs, grade);
  w.srs = { ...next, due: Date.now() + next.ivl * DAY, last: Date.now(), first: w.srs?.first || Date.now() };
  w.updated = Date.now();
  logActivity('cards');
  save();
}

export const fmtIvl = (days) => {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} j`;
  if (days < 365) return `${Math.round(days / 30)} mois`;
  return `${(days / 365).toFixed(1)} an`;
};
export const preview = (w, grade) => fmtIvl(schedule(w.srs, grade).ivl);

export const isNew = (w) => !w.srs;
export const isDue = (w) => w.status !== 'known' && w.srs && w.srs.due <= Date.now();

// New cards introduced today (so the daily limit survives reloads).
export function newToday() {
  const t0 = new Date(dayKey()).getTime();
  return Object.values(state.words).filter((w) => w.srs && w.srs.reps >= 1 && w.added >= 0 && w.srs.first >= t0).length;
}

export function buildQueue({ includeKnown = false } = {}) {
  const words = Object.values(state.words).filter((w) => includeKnown || w.status !== 'known');
  const due = words.filter((w) => w.srs && w.srs.due <= Date.now()).sort((a, b) => a.srs.due - b.srs.due);
  const room = Math.max(0, state.settings.newPerDay - newToday());
  const fresh = words.filter(isNew).sort((a, b) => a.added - b.added).slice(0, room);
  return [...due, ...fresh];
}

export const dueCount = () => buildQueue().length;
