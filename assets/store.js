// Delt tilstand i sanntid for alle som åpner appen.
//
// Hver endring er en liten hendelse ({i, t, o, ...}) som publiseres til et ntfy-emne.
// Alle telefoner leser de samme hendelsene og regner ut den samme tilstanden:
// hendelsene sorteres på tid, og siste verdi vinner per nøkkel. Dommerpoeng (+1/−1)
// legges sammen, og hver hendelse telles bare én gang (dedup på id).
// ntfy.sh holder på meldinger i 12 timer, så appen sender en komprimert kopi
// av alle hendelsene på nytt hver fjerde time.

import { TEAM_COLORS, DEFAULT_FINALE } from './data.js';
import { readJSON, writeJSON, uid } from './util.js';

const KIND = 'kbh1';
const MAX_BODY = 3500;          // ntfy gjør meldinger over 4096 byte om til vedlegg
const SNAPSHOT_AFTER = 4 * 3600; // sekunder
const CLIENT_KEY = 'kbh:client';

function getClientId() {
  let id = readJSON(CLIENT_KEY);
  if (!id) {
    id = uid('c');
    writeJSON(CLIENT_KEY, id);
  }
  return id;
}

function blank() {
  return {
    teams: new Map([
      ['t1', { id: 't1', name: 'Lag 1', color: TEAM_COLORS[0], x: 0, del: false }],
      ['t2', { id: 't2', name: 'Lag 2', color: TEAM_COLORS[1], x: 1, del: false }],
    ]),
    members: new Map(),
    awards: new Map(),
    adjust: {},
    progress: new Map(), // lagId -> { here, visited:Set }
    routes: {},          // lagId -> [barindekser]
    finale: DEFAULT_FINALE,
    setupDone: false,
  };
}

function progressOf(s, team) {
  if (!s.progress.has(team)) s.progress.set(team, { here: -1, visited: new Set() });
  return s.progress.get(team);
}

const order = (a, b) => a.t - b.t || (a.i < b.i ? -1 : a.i > b.i ? 1 : 0);

// Nøkkelen bestemmer hvilke hendelser som overskriver hverandre. null = summeres.
function keyOf(e) {
  switch (e.o) {
    case 'tm': return `tm|${e.id}`;
    case 'mb': return `mb|${e.id}`;
    case 'aw': return `aw|${e.bar}|${e.tk}|${e.tm}`;
    case 'vis': return `vis|${e.tm}|${e.bar}`;
    case 'here': return `here|${e.tm}`;
    case 'rt': return `rt|${e.tm}`;
    case 'stt': return `stt|${e.tm}`;
    case 'fin': case 'go': case 'rst': return e.o;
    default: return null;
  }
}

function apply(s, e) {
  switch (e.o) {
    case 'rst':
      return blank();
    case 'tm':
      s.teams.set(e.id, { id: e.id, name: e.n || 'Lag', color: e.col || TEAM_COLORS[0], x: e.x ?? e.t, del: !!e.del });
      break;
    case 'mb':
      s.members.set(e.id, { id: e.id, name: e.n || '?', team: e.tm, del: !!e.del, created: e.c0 ?? e.t });
      break;
    case 'aw':
      s.awards.set(`${e.bar}|${e.tk}|${e.tm}`, !!e.on);
      break;
    case 'adj': {
      const bar = (s.adjust[e.bar] ||= {});
      bar[e.tm] = (bar[e.tm] || 0) + (Number(e.d) || 0);
      break;
    }
    case 'here':
      progressOf(s, e.tm).here = Number.isInteger(e.v) ? e.v : -1;
      break;
    case 'vis':
      if (e.on) progressOf(s, e.tm).visited.add(e.bar); else progressOf(s, e.tm).visited.delete(e.bar);
      break;
    case 'rt':
      if (Array.isArray(e.ord)) s.routes[e.tm] = e.ord.map(Number);
      break;
    case 'fin':
      if (typeof e.v === 'string') s.finale = e.v;
      break;
    case 'stt':
      progressOf(s, e.tm).startedAt = typeof e.v === 'number' ? e.v : null;
      break;
    case 'go':
      s.setupDone = !!e.v;
      break;
    default:
      break;
  }
  return s;
}

function derive(s) {
  const members = [...s.members.values()].filter((m) => !m.del).sort((a, b) => a.created - b.created);
  const teams = [...s.teams.values()]
    .filter((t) => !t.del)
    .sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : 1))
    .map((t) => ({ id: t.id, name: t.name, color: t.color, x: t.x, members: members.filter((m) => m.team === t.id).map((m) => ({ id: m.id, name: m.name, created: m.created })) }));
  const awards = {};
  for (const [key, on] of s.awards) {
    if (!on) continue;
    const [bar, task, team] = key.split('|');
    ((awards[bar] ||= {})[task] ||= []).push(team);
  }
  const progress = {};
  for (const [team, p] of s.progress) progress[team] = { here: p.here, visited: [...p.visited], startedAt: p.startedAt ?? null };
  return { teams, awards, adjust: s.adjust, progress, routes: s.routes, finale: s.finale, setupDone: s.setupDone };
}

export function createStore({ server, room, onChange, onStatus }) {
  const clientId = getClientId();
  const LS = `kbh:ev:${room || 'lokal'}`;
  const base = server && room ? `${server.replace(/\/$/, '')}/${room}` : null;
  const saved = readJSON(LS) || {};
  const events = new Map((saved.events || []).map((e) => [e.i, e]));
  let outbox = saved.outbox || [];
  let lastId = null;
  let status = base ? 'connecting' : 'local';
  let source = null;
  let retryTimer = null;
  let flushTimer = null;
  let flushing = false;
  let backoff = 0;
  let initialDone = false;
  let oldestMsg = Infinity;
  let lastSnap = 0;
  let state = derive(fold());

  function fold() {
    let s = blank();
    for (const e of [...events.values()].sort(order)) s = apply(s, e);
    return s;
  }
  function persist() {
    writeJSON(LS, { events: [...events.values()], outbox });
  }
  function recompute(remote) {
    state = derive(fold());
    onChange?.(state, remote);
  }
  function setStatus(s) {
    if (s === status) return;
    status = s;
    onStatus?.(status);
  }

  function dispatch(list, by) {
    const now = Date.now();
    const made = list.map(({ o, ...fields }, k) => {
      const e = { i: uid('e'), t: now + k, c: clientId, o, ...fields };
      if (by) e.b = by;
      return e;
    });
    for (const e of made) events.set(e.i, e);
    outbox.push(...made);
    persist();
    recompute([]);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 500);
  }

  function ingest(list, isRemote) {
    const fresh = [];
    for (const e of list) {
      if (!e || typeof e.i !== 'string' || typeof e.t !== 'number' || typeof e.o !== 'string' || events.has(e.i)) continue;
      events.set(e.i, e);
      fresh.push(e);
    }
    if (fresh.length) recompute(isRemote ? fresh.filter((e) => e.c !== clientId) : []);
  }

  function handleMessage(m) {
    if (!m || m.event !== 'message') return;
    lastId = m.id;
    oldestMsg = Math.min(oldestMsg, m.time);
    let payload;
    try { payload = JSON.parse(m.message); } catch { return; }
    if (!payload || payload.k !== KIND || !Array.isArray(payload.e)) return;
    if (payload.snap) lastSnap = Math.max(lastSnap, m.time);
    ingest(payload.e, initialDone);
  }

  async function poll(since) {
    const res = await fetch(`${base}/json?poll=1&since=${encodeURIComponent(since)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { handleMessage(JSON.parse(line)); } catch { /* ugyldig linje */ }
    }
    persist();
  }

  function openStream() {
    source?.close();
    source = new EventSource(`${base}/sse?since=${encodeURIComponent(lastId || 'all')}`);
    source.onopen = () => setStatus('live');
    source.onmessage = (ev) => {
      try { handleMessage(JSON.parse(ev.data)); persist(); } catch { /* ugyldig melding */ }
    };
    source.onerror = () => {
      source?.close();
      source = null;
      setStatus('reconnecting');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, 4000);
    };
  }

  async function connect() {
    if (!base) return setStatus('local');
    clearTimeout(retryTimer);
    if (status !== 'live') setStatus(initialDone ? 'reconnecting' : 'connecting');
    try {
      await poll(initialDone && lastId ? lastId : 'all');
    } catch {
      setStatus('offline');
      retryTimer = setTimeout(connect, 6000);
      return;
    }
    initialDone = true;
    openStream();
    flush();
    maybeSnapshot();
  }

  function batches(list, extra = {}) {
    const out = [];
    let cur = [];
    for (const e of list) {
      const next = [...cur, e];
      if (cur.length && JSON.stringify({ k: KIND, ...extra, e: next }).length > MAX_BODY) {
        out.push(cur);
        cur = [e];
      } else cur = next;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  async function post(list, extra = {}) {
    const res = await fetch(base, { method: 'POST', body: JSON.stringify({ k: KIND, ...extra, e: list }) });
    if (res.status === 429) throw Object.assign(new Error('rate'), { wait: 15000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  async function flush() {
    if (!base || !initialDone || flushing || !outbox.length) return;
    flushing = true;
    try {
      for (const batch of batches(outbox)) {
        await post(batch);
        const sent = new Set(batch.map((e) => e.i));
        outbox = outbox.filter((e) => !sent.has(e.i));
        persist();
      }
      backoff = 0;
      onStatus?.(status);
    } catch (err) {
      backoff = err.wait || Math.min(30000, (backoff || 2000) * 2);
      setTimeout(flush, backoff);
      onStatus?.(status);
    } finally {
      flushing = false;
    }
  }

  // Komprimert kopi: siste hendelse per nøkkel + alle summerbare hendelser etter siste nullstilling.
  function compacted() {
    const sorted = [...events.values()].sort(order);
    let start = 0;
    sorted.forEach((e, idx) => { if (e.o === 'rst') start = idx; });
    const latest = new Map();
    const sums = [];
    for (const e of sorted.slice(start)) {
      const key = keyOf(e);
      if (key) latest.set(key, e); else sums.push(e);
    }
    return [...latest.values(), ...sums].sort(order);
  }

  function maybeSnapshot() {
    if (!Number.isFinite(oldestMsg)) return;
    const due = () => Date.now() / 1000 - Math.max(lastSnap, oldestMsg) >= SNAPSHOT_AFTER;
    if (!due()) return;
    setTimeout(async () => {
      if (!due()) return;
      try {
        for (const batch of batches(compacted(), { snap: 1 })) await post(batch, { snap: 1 });
        lastSnap = Date.now() / 1000;
      } catch { /* prøver igjen ved neste sjekk */ }
    }, 5000 + Math.random() * 40000);
  }

  function activity(limit = 30) {
    return [...events.values()].sort(order).reverse().slice(0, limit);
  }

  if (base) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') connect();
    });
    window.addEventListener('online', connect);
    setInterval(maybeSnapshot, 15 * 60 * 1000);
  }

  return {
    get state() { return state; },
    get status() { return status; },
    get pending() { return outbox.length; },
    get room() { return room; },
    get clientId() { return clientId; },
    dispatch,
    connect,
    activity,
  };
}
