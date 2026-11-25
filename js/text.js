// Text helpers shared by the app and by tools/build-data.mjs.
// splitKo MUST stay identical to the original app's splitter: the audio
// timestamps (meta.audio[id].s) are indexed by these sentences.

export const splitKo = (s) =>
  s.replace(/([.!?…”])\s+/g, '$1\0').split('\0').filter(Boolean);

export const splitEn = (s) =>
  s.replace(/([.!?…”"])\s+(?=[A-Z"“'(])/g, '$1\0').split('\0').filter(Boolean);

// Dialogue lines look like "점원: 어서 오세요." -> speaker + rest.
export const SPEAKER_RE = /^([^:\s“"]{1,8}):\s*/;

// Hangul syllables + jamo; used to find tappable word tokens.
export const HANGUL_RUN = /[ᄀ-ᇿ㄰-㆏가-힯]+/g;

// English text for sentence `i` of paragraph `p` (p.al = alignment groups
// [k0,k1,e0,e1] computed at build time when sentence counts differ).
export function enForSentence(p, i) {
  const en = splitEn(p.en);
  if (!p.al) return en[i] ?? p.en;
  const g = p.al.find(([k0, k1]) => i >= k0 && i < k1);
  return g ? en.slice(g[2], g[3]).join(' ') : p.en;
}

// Is position `i` in `s` the start of an eojeol (space/punct/quote before)?
export const isTokenStart = (s, i) => i === 0 || /[\s.,!?…“”"'‘’()\[\]:·~\-]/.test(s[i - 1]);
