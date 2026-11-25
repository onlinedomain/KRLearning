// Adds sentence alignment (Korean <-> English) to data/texts.json.
// Run: node tools/build-data.mjs
import fs from 'node:fs';
import { splitKo, splitEn } from '../js/text.js';

const file = new URL('../data/texts.json', import.meta.url);
const texts = JSON.parse(fs.readFileSync(file, 'utf8'));

// Small Gale-Church style DP: groups of 1-1, 1-2, 2-1, 1-3, 3-1, 2-2 sentences,
// cost = length-ratio mismatch + penalty for merges.
function align(K, E) {
  const kl = K.map((s) => s.length), el = E.map((s) => s.length);
  const ratio = el.reduce((a, b) => a + b, 0) / Math.max(1, kl.reduce((a, b) => a + b, 0));
  const moves = [[1, 1, 0], [2, 1, 0.6], [1, 2, 0.6], [3, 1, 1.4], [1, 3, 1.4], [2, 2, 1.0]];
  const n = K.length, m = E.length, INF = 1e9;
  const cost = Array.from({ length: n + 1 }, () => Array(m + 1).fill(INF));
  const back = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
  cost[0][0] = 0;
  const sum = (arr, a, b) => { let t = 0; for (let i = a; i < b; i++) t += arr[i]; return t; };
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    if (cost[i][j] === INF) continue;
    for (const [dk, de, pen] of moves) {
      const a = i + dk, b = j + de;
      if (a > n || b > m) continue;
      const k = sum(kl, i, a) * ratio, e = sum(el, j, b);
      const c = cost[i][j] + Math.abs(Math.log((e + 5) / (k + 5))) * 2 + pen;
      if (c < cost[a][b]) { cost[a][b] = c; back[a][b] = [i, j]; }
    }
  }
  if (cost[n][m] === INF) return null;
  const groups = [];
  for (let i = n, j = m; i > 0 || j > 0;) {
    const [pi, pj] = back[i][j];
    groups.unshift([pi, i, pj, j]);
    i = pi; j = pj;
  }
  return groups;
}

let aligned = 0, fallback = 0;
for (const t of texts) {
  for (const p of t.paragraphs) {
    delete p.al;
    const K = splitKo(p.ko), E = splitEn(p.en);
    if (K.length === E.length) continue;
    const g = align(K, E);
    if (g) { p.al = g; aligned++; } else { p.al = [[0, K.length, 0, E.length]]; fallback++; }
  }
}
fs.writeFileSync(file, JSON.stringify(texts));
console.log(`aligned ${aligned} paragraphs, ${fallback} fell back to whole paragraph`);
