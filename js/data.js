// Loads the reading content and builds lookup tables.
import { splitKo } from './text.js';

export const TYPES = {
  standalone: { fr: 'Histoire', many: 'Histoires' },
  series: { fr: 'Série', many: 'Séries' },
  tale: { fr: 'Conte', many: 'Contes' },
  news: { fr: 'Actualité', many: 'Actualités' },
  dialogue: { fr: 'Dialogue', many: 'Dialogues' },
};
export const TOPICS_FR = {
  daily: 'Quotidien', family: 'Famille', friends: 'Amis & amour', work: 'Travail', school: 'École & études',
  travel: 'Voyage', food: 'Cuisine', nature: 'Nature', city: 'Ville', culture: 'Culture', society: 'Société',
  tech: 'Technologie', health: 'Santé', tradition: 'Tradition', memory: 'Souvenirs', reflection: 'Réflexion',
};
export const LEVELS = [
  { n: 1, ko: '초급 1', fr: 'Débutant 1' },
  { n: 2, ko: '초급 2', fr: 'Débutant 2' },
  { n: 3, ko: '중급 1', fr: 'Intermédiaire 1' },
  { n: 4, ko: '중급 2', fr: 'Intermédiaire 2' },
];
export const POS_FR = {
  noun: 'nom', verb: 'verbe', adjective: 'adjectif', adverb: 'adverbe', expression: 'expression',
  particle: 'particule', pronoun: 'pronom', number: 'nombre', counter: 'classificateur', interjection: 'interjection',
  determiner: 'déterminant', conjunction: 'conjonction', phrase: 'expression', 'dependent noun': 'nom dépendant',
};
POS_FR.adj = 'adjectif';
export const posFr = (p) => (p || '').split('/').map((x) => POS_FR[x.trim()] || x).join(' / ');

export const db = {
  texts: [], byId: new Map(), meta: null, order: [], series: new Map(), grammar: [], sentCount: new Map(),
};

export async function loadData() {
  const [texts, meta] = await Promise.all([
    fetch('data/texts.json').then((r) => r.json()),
    fetch('data/meta.json').then((r) => r.json()),
  ]);
  db.texts = texts; db.meta = meta;
  texts.forEach((t, i) => {
    db.byId.set(t.id, t);
    t._i = i;
    t._quiz = [t.quiz, ...(t.extraQuiz || [])].filter(Boolean);
    t._sents = t.paragraphs.reduce((a, p) => a + splitKo(p.ko).length, 0);
    t._hay = `${t.title} ${t.titleEn} ${t.summary} ${t.series || ''} ${t.seriesEn || ''} ${t.grammar?.pattern || ''}`.toLowerCase();
  });
  // Reading order like the original: per level, standalone pieces first, then series by episode.
  for (const L of LEVELS) {
    const lv = texts.filter((t) => t.level === L.n && t.type !== 'series' && !['news', 'tale', 'dialogue'].includes(t.type));
    const typed = texts.filter((t) => t.level === L.n && ['news', 'tale', 'dialogue'].includes(t.type));
    const ser = texts.filter((t) => t.level === L.n && t.type === 'series')
      .sort((a, b) => a.series.localeCompare(b.series, 'ko') || a.episode - b.episode);
    db.order.push(...lv, ...ser, ...typed);
  }
  db.order.forEach((t, i) => (t._ord = i));
  for (const t of texts.filter((t) => t.type === 'series')) {
    if (!db.series.has(t.series)) db.series.set(t.series, { name: t.series, en: t.seriesEn, level: t.level, eps: [] });
    db.series.get(t.series).eps.push(t);
  }
  db.series.forEach((s) => s.eps.sort((a, b) => a.episode - b.episode));
  const g = new Map();
  for (const t of db.order) {
    const p = t.grammar?.pattern?.trim();
    if (!p) continue;
    if (!g.has(p)) g.set(p, { pattern: p, level: t.level, n: 0 });
    g.get(p).n++;
  }
  db.grammar = [...g.values()].sort((a, b) => a.level - b.level || a.pattern.localeCompare(b.pattern, 'ko'));
}

export const audioUrl = (id) =>
  `https://www.topikguide.com/graded-reader/app/audio/${db.meta.audioStamp}/${id}.mp3`;
export const audioTiming = (id) => db.meta.audio[id] || null;

// Previous / next text in reading order (same type family for news/tales/dialogues).
export function neighbours(t) {
  const fam = ['news', 'tale', 'dialogue'].includes(t.type)
    ? db.texts.filter((x) => x.type === t.type).sort((a, b) => a.level - b.level || a._i - b._i)
    : db.order.filter((x) => !['news', 'tale', 'dialogue'].includes(x.type));
  const i = fam.indexOf(t);
  return { prev: fam[i - 1] || null, next: fam[i + 1] || null };
}
