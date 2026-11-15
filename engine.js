// Moteur d'Éclipse : génération de grilles soleil/lune à solution unique, solveur logique, indices.
// Valeurs de case : 0 = vide, 1 = soleil, 2 = lune. Signes : 1 = « = », 2 = « × ».
(function (root) {
  "use strict";

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, r) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Toutes les lignes valides de longueur n : autant de soleils que de lunes, jamais trois identiques à la suite.
  const patCache = {};
  function patterns(n) {
    if (patCache[n]) return patCache[n];
    const out = [], cur = [];
    (function rec(i, a, b) {
      if (i === n) { out.push(cur.slice()); return; }
      for (const v of [1, 2]) {
        if (v === 1 && a >= n / 2) continue;
        if (v === 2 && b >= n / 2) continue;
        if (i >= 2 && cur[i - 1] === v && cur[i - 2] === v) continue;
        cur[i] = v;
        rec(i + 1, a + (v === 1), b + (v === 2));
      }
    })(0, 0, 0);
    return (patCache[n] = out);
  }

  // Lignes et colonnes, avec leurs cases et la clé des signes entre cases voisines.
  const lineCache = {};
  function lines(n) {
    if (lineCache[n]) return lineCache[n];
    const L = [];
    for (let r = 0; r < n; r++) L.push({ kind: "row", idx: r, cells: Array.from({ length: n }, (_, c) => r * n + c) });
    for (let c = 0; c < n; c++) L.push({ kind: "col", idx: c, cells: Array.from({ length: n }, (_, r) => r * n + c) });
    return (lineCache[n] = L);
  }
  const ekey = (a, b) => (a < b ? a + "," + b : b + "," + a);
  function edgeMap(edges) {
    const m = new Map();
    for (const e of edges) m.set(ekey(e.a, e.b), e.t);
    return m;
  }

  function genSolution(n, r) {
    const P = patterns(n), rows = [];
    const colCount = Array.from({ length: n }, () => [0, 0, 0]);
    function fits(p) {
      const k = rows.length;
      for (let c = 0; c < n; c++) {
        if (colCount[c][p[c]] + 1 > n / 2) return false;
        if (k >= 2 && rows[k - 1][c] === p[c] && rows[k - 2][c] === p[c]) return false;
      }
      return true;
    }
    (function rec() {
      if (rows.length === n) return true;
      for (const p of shuffle(P.slice(), r)) {
        if (!fits(p)) continue;
        rows.push(p); p.forEach((v, c) => colCount[c][v]++);
        if (rec()) return true;
        rows.pop(); p.forEach((v, c) => colCount[c][v]--);
      }
      return false;
    })();
    return [].concat(...rows);
  }

  const opp = v => 3 - v;

  // Déductions « simples » sur une ligne : signes, paires, trous, comptage.
  function simpleDeductions(n, g, em, line, out) {
    const c = line.cells, v = c.map(i => g[i]), half = n / 2;
    const push = (k, val, rule, extra) => { if (v[k] === 0) out.push(Object.assign({ cell: c[k], value: val, rule, line }, extra)); };
    for (let k = 0; k < n - 1; k++) {
      const t = em.get(ekey(c[k], c[k + 1]));
      if (!t) continue;
      if (v[k] && !v[k + 1]) push(k + 1, t === 1 ? v[k] : opp(v[k]), t === 1 ? "eq" : "x", { from: c[k] });
      if (v[k + 1] && !v[k]) push(k, t === 1 ? v[k + 1] : opp(v[k + 1]), t === 1 ? "eq" : "x", { from: c[k + 1] });
    }
    for (let k = 0; k < n - 1; k++) {
      if (v[k] && v[k] === v[k + 1]) {
        if (k > 0) push(k - 1, opp(v[k]), "pair", { sym: v[k] });
        if (k + 2 < n) push(k + 2, opp(v[k]), "pair", { sym: v[k] });
      }
    }
    for (let k = 0; k < n - 2; k++) {
      if (v[k] && v[k] === v[k + 2]) push(k + 1, opp(v[k]), "gap", { sym: v[k] });
    }
    for (const s of [1, 2]) {
      if (v.filter(x => x === s).length === half) {
        for (let k = 0; k < n; k++) push(k, opp(s), "count", { sym: s });
      }
    }
  }

  // Déduction « complète » sur une ligne : on garde les lignes valides compatibles, les cases communes sont forcées.
  function patternDeductions(n, g, em, line, out) {
    const c = line.cells, v = c.map(i => g[i]);
    if (!v.includes(0)) return true;
    const sig = [];
    for (let k = 0; k < n - 1; k++) sig.push(em.get(ekey(c[k], c[k + 1])) || 0);
    let first = null, agree = null;
    for (const p of patterns(n)) {
      let ok = true;
      for (let k = 0; k < n && ok; k++) if (v[k] && v[k] !== p[k]) ok = false;
      for (let k = 0; k < n - 1 && ok; k++) {
        if (sig[k] === 1 && p[k] !== p[k + 1]) ok = false;
        else if (sig[k] === 2 && p[k] === p[k + 1]) ok = false;
      }
      if (!ok) continue;
      if (!first) { first = p; agree = v.map(() => true); }
      else for (let k = 0; k < n; k++) if (p[k] !== first[k]) agree[k] = false;
    }
    if (!first) return false; // contradiction
    for (let k = 0; k < n; k++) if (!v[k] && agree[k]) out.push({ cell: c[k], value: first[k], rule: "line", line });
    return true;
  }

  // Résout autant que possible. level : "simple" ou "full". Renvoie { grid, solved, contradiction }.
  function solve(n, start, em, level) {
    const g = start.slice(), L = lines(n);
    for (let guard = 0; guard < 500; guard++) {
      const ds = [];
      for (const line of L) simpleDeductions(n, g, em, line, ds);
      if (!ds.length && level === "full") {
        for (const line of L) if (!patternDeductions(n, g, em, line, ds)) return { grid: g, solved: false, contradiction: true };
      }
      if (!ds.length) break;
      for (const d of ds) {
        if (g[d.cell] && g[d.cell] !== d.value) return { grid: g, solved: false, contradiction: true };
        g[d.cell] = d.value;
      }
    }
    return { grid: g, solved: !g.includes(0), contradiction: false };
  }

  // Une seule déduction pour l'indice (règles simples d'abord).
  function nextDeduction(n, g, edges) {
    const em = edgeMap(edges), L = lines(n);
    const order = ["eq", "x", "count", "pair", "gap"];
    const ds = [];
    for (const line of L) simpleDeductions(n, g, em, line, ds);
    if (ds.length) {
      ds.sort((a, b) => order.indexOf(a.rule) - order.indexOf(b.rule));
      return ds[0];
    }
    for (const line of L) patternDeductions(n, g, em, line, ds);
    return ds[0] || null;
  }

  // Règles enfreintes par la grille du joueur (sans regarder la solution).
  function violations(n, g, edges) {
    const cells = new Set(), bad = new Set(), half = n / 2;
    for (const line of lines(n)) {
      const c = line.cells;
      for (const s of [1, 2]) {
        const idx = c.filter(i => g[i] === s);
        if (idx.length > half) idx.forEach(i => cells.add(i));
      }
      for (let k = 0; k < n - 2; k++) {
        if (g[c[k]] && g[c[k]] === g[c[k + 1]] && g[c[k]] === g[c[k + 2]]) {
          cells.add(c[k]); cells.add(c[k + 1]); cells.add(c[k + 2]);
        }
      }
    }
    edges.forEach((e, i) => {
      const a = g[e.a], b = g[e.b];
      if (a && b && ((e.t === 1) !== (a === b))) { bad.add(i); cells.add(e.a); cells.add(e.b); }
    });
    return { cells, edges: bad };
  }

  const SETTINGS = {
    easy:   { level: "simple", extra: { 6: 3, 8: 5 }, edgeShare: 0.3 },
    medium: { level: "simple", extra: { 6: 0, 8: 1 }, edgeShare: 0.35},
    hard:   { level: "full",   extra: { 6: 0, 8: 0 }, edgeShare: 0.3 },
  };

  function generate(n, diff, seed) {
    const S = SETTINGS[diff] || SETTINGS.medium;
    for (let attempt = 0; attempt < 30; attempt++) {
      const r = rng(seed + attempt * 7919);
      const sol = genSolution(n, r);
      const all = [];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (x < n - 1) all.push({ a: i, b: i + 1, t: sol[i] === sol[i + 1] ? 1 : 2 });
        if (y < n - 1) all.push({ a: i, b: i + n, t: sol[i] === sol[i + n] ? 1 : 2 });
      }
      const edgesOn = shuffle(all, r).slice(0, Math.round(all.length * S.edgeShare));
      const givens = sol.slice();
      // On essaie surtout d'enlever des cases d'abord : la grille garde davantage de signes, comme dans l'original.
      const items = [
        ...givens.map((_, i) => ({ cell: i, k: r() })),
        ...edgesOn.map(e => ({ edge: e, k: r() + 0.25 })),
      ].sort((p, q) => p.k - q.k);
      let edges = edgesOn.slice();
      for (const it of items) {
        if (it.cell !== undefined) {
          const keep = givens[it.cell]; givens[it.cell] = 0;
          if (!solve(n, givens, edgeMap(edges), S.level).solved) givens[it.cell] = keep;
        } else {
          const trial = edges.filter(e => e !== it.edge);
          if (solve(n, givens, edgeMap(trial), S.level).solved) edges = trial;
        }
      }
      // Un peu d'aide en plus pour le niveau facile.
      const empty = shuffle(givens.map((v, i) => (v ? -1 : i)).filter(i => i >= 0), r);
      for (let k = 0; k < (S.extra[n] || 0) && k < empty.length; k++) givens[empty[k]] = sol[empty[k]];
      // Le niveau difficile doit vraiment demander plus que les règles simples.
      if (diff === "hard" && attempt < 29 && solve(n, givens, edgeMap(edges), "simple").solved) continue;
      edges.sort((p, q) => p.a - q.a || p.b - q.b);
      return { n, diff, seed, sol, givens, edges };
    }
  }

  const api = { rng, hashString, patterns, generate, solve, nextDeduction, violations, edgeMap };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
