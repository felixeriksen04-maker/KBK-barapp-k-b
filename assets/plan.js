// Gir hvert lag sin egen rekkefølge på barene. Alle starter ved hotellet og ender på finalebaren.
//
// Hver mulig rekkefølge får en kostnad: minutter gange, straff for å komme før en bar åpner
// eller etter siste fornuftige ankomst, og straff for å være på samme bar samtidig som et lag
// som allerede har fått rute. Lagene planlegges ett og ett i fast rekkefølge, så alle telefoner
// regner ut nøyaktig de samme rutene.

import { BARS, HOTEL } from './data.js';
import { haversine } from './util.js';

const WALK_SPEED = 1.25; // m/s
const DETOUR = 1.3;      // gater er lengre enn luftlinje
const walkMin = (a, b) => (haversine(a, b) * DETOUR) / WALK_SPEED / 60;

function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((x, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

export function startMinutes(startTime) {
  const [h, m] = String(startTime || '18:00').split(':').map(Number);
  return h * 60 + m;
}

function evaluate(order, finaleIdx, start) {
  let t = start;
  let pos = HOTEL.coord;
  let walk = 0;
  let penalty = 0;
  const windows = [];
  for (const i of [...order, finaleIdx]) {
    const bar = BARS[i];
    const w = walkMin(pos, bar.coord);
    walk += w;
    t += w;
    if (bar.opens && t < bar.opens) penalty += (bar.opens - t) * 4;
    if (bar.lastIn && t > bar.lastIn) penalty += (t - bar.lastIn) * 10;
    if (i !== finaleIdx) windows.push({ bar: i, from: t, to: t + bar.stay });
    t += bar.stay;
    pos = bar.coord;
  }
  return { order, cost: walk + penalty, windows };
}

function windowsFor(seq, start) {
  return evaluate(seq.slice(0, -1), seq[seq.length - 1], start).windows;
}

const cache = new Map();

// fixed: ruter som allerede er låst for lag ({lagId: [barindekser]}).
export function planRoutes(teams, finaleIdx, startTime, fixed = {}) {
  const key = JSON.stringify([teams.map((t) => t.id), finaleIdx, startTime, fixed]);
  if (cache.has(key)) return cache.get(key);
  const start = startMinutes(startTime);
  const pool = BARS.map((_, i) => i).filter((i) => i !== finaleIdx);
  const evals = permutations(pool).map((p) => evaluate(p, finaleIdx, start));
  const occupied = [];
  const out = {};
  const valid = (seq) => Array.isArray(seq) && seq.length === BARS.length && seq[seq.length - 1] === finaleIdx && new Set(seq).size === BARS.length;

  for (const t of teams) {
    if (valid(fixed[t.id])) {
      out[t.id] = fixed[t.id];
      occupied.push(...windowsFor(fixed[t.id], start));
    }
  }
  for (const t of teams) {
    if (out[t.id]) continue;
    let best = null;
    for (const ev of evals) {
      let overlap = 0;
      for (const w of ev.windows) {
        for (const o of occupied) {
          if (o.bar === w.bar) overlap += Math.max(0, Math.min(w.to, o.to) - Math.max(w.from, o.from));
        }
      }
      const cost = ev.cost + overlap * 3;
      if (!best || cost < best.cost - 1e-9) best = { cost, ev };
    }
    out[t.id] = [...best.ev.order, finaleIdx];
    occupied.push(...best.ev.windows);
  }
  if (cache.size > 50) cache.clear();
  cache.set(key, out);
  return out;
}
