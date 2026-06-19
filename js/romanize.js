/* ===================================================================
   ROMANISATION — conversion simplifiée du hangeul vers l'alphabet
   latin, basée sur la Romanisation Révisée (norme officielle sud-
   coréenne), sans gestion des règles d'assimilation avancées.
   Suffisant pour une aide à la lecture, pas pour un usage académique.
=================================================================== */

const ROMA_CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const ROMA_JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const ROMA_JONG = ["","k","k","k","n","n","n","t","l","k","l","l","l","l","l","l","m","p","p","t","t","ng","t","t","k","t","p","h"];

function romanizeSyllable(code) {
  const offset = code - 0xAC00;
  const cho = Math.floor(offset / 588);
  const jung = Math.floor((offset % 588) / 28);
  const jong = offset % 28;
  return ROMA_CHO[cho] + ROMA_JUNG[jung] + ROMA_JONG[jong];
}

function romanize(str) {
  let result = "";
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      result += romanizeSyllable(code);
    } else {
      result += ch; // espaces, ponctuation : inchangés
    }
  }
  return result;
}