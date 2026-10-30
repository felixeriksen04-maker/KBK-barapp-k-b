import { HOTEL, BARS, CATEGORIES, TEAM_COLORS, FINALE_TASKS, DEFAULT_FINALE, sketchLeg } from './data.js';
import { CONFIG } from './config.js';
import { createStore } from './store.js';
import { planRoutes } from './plan.js';
import {
  icon, $, esc, haversine, bearingBetween, cumulative, pointAlong, smoothAngle,
  fmtDist, fmtMin, fmtClock, uid, readJSON, writeJSON,
} from './util.js';

const ROUTER_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/';
const PREFS_KEY = 'kbh:prefs';
const ROUTE_CACHE_KEY = 'kbh:routes:v2';
const WALK_SPEED = 1.25; // m/s, rolig gruppetempo
const WALK_SPEEDS = [{ label: 'Rolig', v: 6 }, { label: 'Normal', v: 14 }, { label: 'Rask', v: 32 }];
const ARRIVE_RADIUS = 45;
// Rekkefølgen på barene regnes ut fra dette klokkeslettet. Det er et utgangspunkt, ikke starttiden for laget.
const PLAN_START = '18:00';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopMQ = matchMedia('(min-width: 900px)');

/* ---------- Lokale innstillinger (bare denne telefonen) ---------- */
const prefs = Object.assign({ selected: 0, night: null, myTeam: null, cam: 'drone', engine: null, googleKey: '' }, readJSON(PREFS_KEY) || {});
const savePrefs = () => writeJSON(PREFS_KEY, prefs);

/* ---------- Delt tilstand i sanntid ---------- */
const params = new URLSearchParams(location.search);
const room = (params.get('rom') || CONFIG.sync?.room || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
let initialSynced = false;
const store = createStore({
  server: CONFIG.sync?.server,
  room,
  onChange: (_state, remote) => {
    if (remote?.length && initialSynced) announceRemote(remote);
    scheduleRender();
  },
  onStatus: () => {
    if (store.status === 'live' && !initialSynced) {
      initialSynced = true;
      maybeAskTeam();
    }
    renderTop();
    if (tab === 'teams') scheduleRender();
  },
});
const S = () => store.state;

let tab = S().setupDone ? 'route' : 'teams';
let confirmReset = false;
let peekBar = null;
let routeSource = 'sketch';
let legs = [];
let legsKey = '';

/* ---------- Avledet: lagets rute og fremdrift ---------- */
const barIndex = (id) => BARS.findIndex((b) => b.id === id);
const finaleIdx = () => { const i = barIndex(S().finale); return i >= 0 ? i : barIndex(DEFAULT_FINALE); };
const teamById = (id) => S().teams.find((t) => t.id === id);
const myTeam = () => teamById(prefs.myTeam) || null;
const plan = () => planRoutes(S().teams, finaleIdx(), PLAN_START, S().routes);

function ctx() {
  const team = myTeam();
  const p = plan();
  const seq = (team && p[team.id]) || p[S().teams[0]?.id] || BARS.map((_, i) => i);
  const prog = (team && S().progress[team.id]) || { here: -1, visited: [] };
  const herePos = seq.indexOf(prog.here);
  const nextPos = herePos + 1;
  return { team, seq, here: prog.here, visited: new Set(prog.visited), startedAt: prog.startedAt ?? null, herePos, nextPos, nextBar: nextPos < seq.length ? seq[nextPos] : -1 };
}

function teamsAt() {
  const m = new Map();
  for (const t of S().teams) {
    const here = S().progress[t.id]?.here;
    if (Number.isInteger(here) && here >= 0) {
      if (!m.has(here)) m.set(here, []);
      m.get(here).push(t);
    }
  }
  return m;
}

function viewState() {
  const c = ctx();
  return {
    nextPos: c.nextPos, next: c.nextBar, here: c.here, visited: c.visited, focus: peekBar,
    order: new Map(c.seq.map((b, pos) => [b, pos])), finale: finaleIdx(), teamsAt: teamsAt(),
  };
}

// Minutter etter at laget startet. Runden har ingen fast starttid.
function schedule(seq) {
  let t = 0;
  const arrive = [];
  seq.forEach((b, pos) => {
    t += (legs[pos]?.duration ?? 600) / 60;
    arrive.push(t);
    t += BARS[b].stay;
  });
  t += (legs[seq.length]?.duration ?? 600) / 60;
  return { arrive, home: t };
}

function fmtOffset(min) {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} t ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

// Klokkeslett når laget har startet, ellers tiden etter start.
function eta(offset, startedAt) {
  if (!startedAt) return `+${fmtOffset(offset)}`;
  const d = new Date(startedAt);
  return `ca. ${fmtClock(d.getHours() * 60 + d.getMinutes() + offset)}`;
}

function hhmm(ts) {
  const d = new Date(ts);
  return fmtClock(d.getHours() * 60 + d.getMinutes());
}

function teamScore(teamId) {
  return BARS.reduce((s, bar) => s + barScore(bar, teamId), 0);
}
function barScore(bar, teamId) {
  let s = 0;
  const a = S().awards[bar.id] || {};
  for (const task of [...bar.tasks, ...FINALE_TASKS]) if ((a[task.id] || []).includes(teamId)) s += task.points;
  return s + (S().adjust[bar.id]?.[teamId] || 0);
}
function ranking() {
  return S().teams.map((t) => ({ ...t, score: teamScore(t.id) })).sort((a, b) => b.score - a.score);
}

/* ---------- Gangruter ---------- */
function makeLeg(coords, distance) {
  const cum = cumulative(coords);
  const dist = distance ?? cum[cum.length - 1] * 1.15;
  return { coords, cum, distance: dist, duration: dist / WALK_SPEED };
}

function stopsFor(seq) {
  return [{ id: 'hotel', coord: HOTEL.coord }, ...seq.map((b) => BARS[b]), { id: 'hotel', coord: HOTEL.coord }];
}

function ensureLegs() {
  const { seq } = ctx();
  const key = seq.join('-');
  if (key === legsKey) return;
  legsKey = key;
  const stops = stopsFor(seq);
  const cache = readJSON(ROUTE_CACHE_KEY) || {};
  if (cache[key]) {
    legs = cache[key].map((l) => makeLeg(l.coords, l.distance));
    routeSource = 'osm';
  } else {
    legs = stops.slice(1).map((s, k) => makeLeg(sketchLeg(stops[k].id, s.id, stops[k].coord, s.coord)));
    routeSource = 'sketch';
    fetchRoute(key, stops);
  }
  engine?.setLegs(legs);
}

async function fetchRoute(key, stops) {
  const url = `${ROUTER_URL}${stops.map((s) => `${s.coord[0].toFixed(5)},${s.coord[1].toFixed(5)}`).join(';')}?overview=false&steps=true&geometries=geojson`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route || route.legs.length !== stops.length - 1) throw new Error('Ingen rute');
    const out = route.legs.map((leg, k) => {
      const coords = [stops[k].coord];
      for (const step of leg.steps) {
        for (const c of step.geometry.coordinates) {
          const last = coords[coords.length - 1];
          if (last[0] !== c[0] || last[1] !== c[1]) coords.push(c);
        }
      }
      coords.push(stops[k + 1].coord);
      return { coords, distance: leg.distance };
    });
    const cache = readJSON(ROUTE_CACHE_KEY) || {};
    cache[key] = out;
    writeJSON(ROUTE_CACHE_KEY, cache);
    if (key !== legsKey) return;
    legs = out.map((l) => makeLeg(l.coords, l.distance));
    routeSource = 'osm';
    engine?.setLegs(legs);
    scheduleRender();
  } catch (err) {
    console.warn('Bruker omtrentlige ruter:', err);
  }
}

/* ---------- Kartmotor ---------- */
let engine = null;
let engineKind = null;
const googleKey = () => (prefs.googleKey || CONFIG.googleMapsApiKey || '').trim();
const isNight = () => (prefs.night ?? autoNight());
function autoNight() {
  const h = new Date().getHours();
  return h >= 16 || h < 7;
}

async function startEngine(kind) {
  stopModes();
  try { engine?.destroy(); } catch { /* allerede borte */ }
  engine = null;
  engineKind = null;
  const container = $('#map');
  container.innerHTML = '';
  ensureLegs();
  const common = {
    legs, view: viewState(), night: isNight(),
    onUser: onUserMove, onBar: focusBar, onHotel: () => engine?.flyTo(HOTEL.coord),
    onRotate: (b) => { const n = document.querySelector('#btn-north .north-needle'); if (n) n.style.transform = `rotate(${-b}deg)`; },
    onError: (msg) => toast(msg),
  };
  try {
    if (kind === 'earth') {
      const { createEarthEngine } = await import('./engine-earth.js');
      engine = await createEarthEngine(container, { ...common, key: googleKey() });
    } else {
      const { createMapEngine } = await import('./engine-maplibre.js');
      engine = await createMapEngine(container, common);
    }
    engineKind = kind;
  } catch (err) {
    console.error(err);
    if (kind === 'earth') {
      toast('Google 3D virket ikke. Sjekk at nøkkelen er riktig og har Map Tiles API. Viser vanlig 3D-kart.');
      return startEngine('map');
    }
    container.innerHTML = '<div class="map-fallback"><p>3D-kartet trenger WebGL og nett. Rute, oppgaver og poeng virker uansett.</p></div>';
    return;
  }
  updatePadding();
  engine.overview({ intro: true, onDone: setControlState });
  renderControls();
}

function preferredEngine() {
  if (prefs.engine === 'map') return 'map';
  return googleKey() ? 'earth' : 'map';
}

function onUserMove() {
  if (walk && walk.playing) { walk.playing = false; walk.looking = true; renderWalkHud(); }
  if (live && live.follow) { live.follow = false; renderLiveHud(); }
  setControlState();
}

function updatePadding() {
  if (!engine) return;
  if (desktopMQ.matches) engine.setPadding({ top: 70, bottom: 30, left: $('#sheet').offsetWidth + 32, right: 70 });
  else {
    const peekH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 200;
    engine.setPadding({ top: 70, bottom: peekH + 10, left: 10, right: 60 });
  }
}

/* ---------- Gåtur i 3D ---------- */
let walk = null;
let speedIdx = 1;

function startWalk(pos) {
  if (!engine) return toast('3D-kartet er ikke klart ennå.');
  stopModes();
  peekBar = null;
  const leg = legs[pos];
  if (!leg) return;
  walk = {
    pos, coords: leg.coords, cum: leg.cum, total: leg.cum[leg.cum.length - 1],
    d: 0, playing: true, looking: false, last: performance.now(),
    bearing: bearingBetween(leg.coords[0], pointAlong(leg.coords, leg.cum, 40)),
  };
  engine.setWalker(leg.coords[0]);
  setSheet('peek');
  $('#sheet').dataset.mode = 'walk';
  $('#peek').hidden = true;
  $('#tabs').hidden = true;
  $('#walk-hud').hidden = false;
  renderWalkHud();
  measurePeek();
  engine.walkBegin(leg.coords[0], walk.bearing, prefs.cam).then(() => {
    if (!walk) return;
    walk.last = performance.now();
    walk.raf = requestAnimationFrame(walkFrame);
  });
  setControlState();
}

function walkFrame(now) {
  if (!walk) return;
  const dt = Math.min(0.1, (now - walk.last) / 1000);
  walk.last = now;
  if (walk.playing) {
    walk.d = Math.min(walk.total, walk.d + dt * WALK_SPEEDS[speedIdx].v);
    const p = pointAlong(walk.coords, walk.cum, walk.d);
    const ahead = pointAlong(walk.coords, walk.cum, Math.min(walk.total, walk.d + 30));
    if (walk.total - walk.d > 4) walk.bearing = smoothAngle(walk.bearing, bearingBetween(p, ahead), 1 - Math.exp(-dt * 2.6));
    engine.walkCamera(p, walk.bearing, prefs.cam);
    engine.setWalker(p);
    if (Math.floor(now / 120) !== walk.hudTick) { walk.hudTick = Math.floor(now / 120); renderWalkHud(); }
    if (walk.d >= walk.total) return finishWalk();
  }
  walk.raf = requestAnimationFrame(walkFrame);
}

function finishWalk() {
  const { pos, bearing } = walk;
  exitWalk(false);
  const { seq } = ctx();
  if (pos >= seq.length) {
    engine.flyTo(HOTEL.coord, { bearing: bearing + 70, close: true, slow: true });
    toast('Fremme ved Imperial Hotel. God natt!');
    return;
  }
  const b = seq[pos];
  engine.flyTo(BARS[b].coord, { bearing: bearing + 80, close: true, slow: true });
  prefs.selected = b;
  savePrefs();
  render();
  const team = myTeam();
  const here = team && S().progress[team.id]?.here === b;
  toast(`Fremme ved ${BARS[b].name}`, here || !team ? null : { label: 'Sjekk inn', action: 'checkin', i: b });
}

function exitWalk(relax = true) {
  if (!walk) return;
  cancelAnimationFrame(walk.raf);
  walk = null;
  engine?.setWalker(null);
  delete $('#walk-hud').dataset.leg;
  delete $('#walk-hud').dataset.mode;
  delete $('#sheet').dataset.mode;
  $('#peek').hidden = false;
  $('#tabs').hidden = false;
  $('#walk-hud').hidden = true;
  measurePeek();
  if (relax) engine?.relax();
  setControlState();
}

// HUD-ene bygges én gang og oppdateres på stedet, så knappene ikke byttes ut midt i et trykk.
function renderWalkHud() {
  if (!walk) return;
  const hud = $('#walk-hud');
  if (hud.dataset.leg !== String(walk.pos)) {
    const { seq } = ctx();
    const to = walk.pos >= seq.length ? HOTEL.name : BARS[seq[walk.pos]].name;
    hud.dataset.leg = walk.pos;
    hud.innerHTML = `
      <div class="walk-top">
        <span class="walk-title">Gåtur til ${esc(to)}</span>
        <span class="walk-left" id="walk-left"></span>
      </div>
      <div class="walk-bar" aria-hidden="true"><span id="walk-progress"></span></div>
      <div class="walk-controls">
        <button class="btn btn-primary" type="button" data-action="walk-toggle" id="walk-toggle"></button>
        <button class="btn" type="button" data-action="walk-speed" id="walk-speed"></button>
        <button class="btn" type="button" data-action="cam-toggle" id="walk-cam"></button>
        <button class="btn btn-ghost" type="button" data-action="walk-exit" aria-label="Avslutt gåturen">${icon('close')}</button>
      </div>
      <div class="walk-hint" id="walk-hint"></div>`;
  }
  const left = walk.total - walk.d;
  $('#walk-left').textContent = `${fmtDist(left)} · ${fmtMin(left / WALK_SPEED)}`;
  $('#walk-progress').style.width = `${(walk.total ? (walk.d / walk.total) * 100 : 100).toFixed(1)}%`;
  const mode = `${walk.playing}|${walk.looking}|${speedIdx}|${prefs.cam}`;
  if (hud.dataset.mode !== mode) {
    hud.dataset.mode = mode;
    $('#walk-toggle').innerHTML = walk.playing ? `${icon('pause')} Pause` : `${icon('play')} ${walk.looking ? 'Gå videre' : 'Fortsett'}`;
    $('#walk-speed').innerHTML = `${icon('walk')} ${WALK_SPEEDS[speedIdx].label}`;
    $('#walk-cam').innerHTML = prefs.cam === 'gate' ? `${icon('person')} Gate` : `${icon('drone')} Drone`;
    $('#walk-hint').textContent = walk.looking ? 'Du ser deg rundt. Dra, vri og vipp med to fingre.' : 'Dra i bildet for å stoppe og se deg rundt.';
  }
}

/* ---------- Live: GPS og kompass ---------- */
let live = null;

async function startLive() {
  if (!engine) return toast('3D-kartet er ikke klart ennå.');
  if (!('geolocation' in navigator)) return toast('Nettleseren støtter ikke posisjon.');
  stopModes();
  live = { follow: true, pos: null, acc: null, compass: null, course: null, cam: null, bearing: engine.bearing(), arrived: new Set(), last: performance.now() };
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch { /* kompass avslått, GPS-kurs brukes */ }
  }
  if (!live) return;
  window.addEventListener('deviceorientationabsolute', onOrient, true);
  window.addEventListener('deviceorientation', onOrient, true);
  live.watch = navigator.geolocation.watchPosition(onPos, onPosError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  try { live.wake = await navigator.wakeLock?.request('screen'); } catch { /* valgfritt */ }
  $('#live-hud').hidden = false;
  renderLiveHud();
  live.raf = requestAnimationFrame(liveFrame);
  setControlState();
}

function onOrient(e) {
  if (!live) return;
  let h = null;
  if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
  else if ((e.absolute || e.type === 'deviceorientationabsolute') && typeof e.alpha === 'number') h = 360 - e.alpha;
  if (h == null || Number.isNaN(h)) return;
  const so = screen.orientation?.angle ?? window.orientation ?? 0;
  live.compass = (h + so + 360) % 360;
}

function onPos(p) {
  if (!live) return;
  const first = !live.pos;
  live.pos = [p.coords.longitude, p.coords.latitude];
  live.acc = p.coords.accuracy;
  if (typeof p.coords.heading === 'number' && !Number.isNaN(p.coords.heading) && (p.coords.speed || 0) > 0.6) live.course = p.coords.heading;
  if (first) {
    live.cam = live.pos;
    if (haversine(live.pos, HOTEL.coord) > 15000) toast('Du er ikke i nærheten av ruta, men live-visningen følger deg likevel.');
  }
  const { nextBar } = ctx();
  if (nextBar >= 0 && myTeam() && !live.arrived.has(nextBar) && haversine(live.pos, BARS[nextBar].coord) < ARRIVE_RADIUS) {
    live.arrived.add(nextBar);
    toast(`Dere er ved ${BARS[nextBar].name}!`, { label: 'Sjekk inn', action: 'checkin', i: nextBar });
  }
  renderLiveHud();
}

function onPosError(err) {
  toast(err.code === 1
    ? 'Posisjon er blokkert. Gi nettleseren tilgang til posisjon i innstillingene.'
    : 'Fant ikke posisjonen din ennå. Gå gjerne ut under åpen himmel.');
  if (err.code === 1) exitLive();
}

function liveFrame(now) {
  if (!live) return;
  const dt = Math.min(0.1, (now - live.last) / 1000);
  live.last = now;
  const heading = live.compass ?? live.course;
  if (live.pos && live.follow) {
    const k = 1 - Math.exp(-dt * 4);
    live.cam = [live.cam[0] + (live.pos[0] - live.cam[0]) * k, live.cam[1] + (live.pos[1] - live.cam[1]) * k];
    if (heading != null) live.bearing = smoothAngle(live.bearing, heading, 1 - Math.exp(-dt * 5));
    engine.liveCamera(live.cam, live.bearing, prefs.cam);
  }
  if (live.pos) engine.setMe(live.pos, heading);
  if (Math.floor(now / 250) !== live.tick) { live.tick = Math.floor(now / 250); renderLiveHud(); }
  live.raf = requestAnimationFrame(liveFrame);
}

function renderLiveHud() {
  if (!live) return;
  const hud = $('#live-hud');
  if (!hud.dataset.built) {
    hud.dataset.built = '1';
    hud.innerHTML = `
      <div class="live-arrow" id="live-arrow">${icon('nav')}</div>
      <div class="live-info">
        <span class="live-to" id="live-to"></span>
        <span class="live-dist" id="live-dist"></span>
        <span class="live-meta" id="live-meta"></span>
      </div>
      <button class="btn btn-sm btn-primary" type="button" data-action="live-follow" id="live-follow" hidden>${icon('gps')} Følg meg</button>
      <button class="icon-btn" type="button" data-action="cam-toggle" id="live-cam" aria-label="Bytt kamerahøyde"></button>
      <button class="icon-btn" type="button" data-action="live-exit" aria-label="Avslutt live-visning">${icon('close')}</button>`;
  }
  const { nextBar } = ctx();
  const target = nextBar >= 0 ? BARS[nextBar].coord : HOTEL.coord;
  let dist = '–';
  let arrow = 0;
  let meta = 'Venter på GPS …';
  if (live.pos) {
    dist = fmtDist(haversine(live.pos, target));
    arrow = bearingBetween(live.pos, target) - (engine ? engine.bearing() : 0);
    meta = `±${Math.round(live.acc || 0)} m · ${live.compass != null ? 'kompass på' : live.course != null ? 'retning fra GPS' : 'uten kompass'}`;
  }
  $('#live-to').textContent = `Til ${nextBar >= 0 ? BARS[nextBar].name : HOTEL.name}`;
  $('#live-dist').textContent = dist;
  $('#live-meta').textContent = meta;
  $('#live-follow').hidden = live.follow;
  $('#live-cam').innerHTML = icon(prefs.cam === 'gate' ? 'person' : 'drone');
  $('#live-arrow .ic').style.transform = `rotate(${arrow}deg)`;
}

function exitLive() {
  if (!live) return;
  cancelAnimationFrame(live.raf);
  if (live.watch != null) navigator.geolocation.clearWatch(live.watch);
  window.removeEventListener('deviceorientationabsolute', onOrient, true);
  window.removeEventListener('deviceorientation', onOrient, true);
  live.wake?.release?.().catch(() => {});
  live = null;
  engine?.setMe(null);
  $('#live-hud').hidden = true;
  delete $('#live-hud').dataset.built;
  setControlState();
}

function stopModes() {
  engine?.stopOrbit();
  exitWalk(false);
  exitLive();
}

/* ---------- Handlinger ---------- */
const by = () => myTeam()?.id;

function selectBar(i) {
  prefs.selected = i;
  peekBar = null;
  savePrefs();
  tab = 'bar';
  render(true);
  setSheet('open');
}

function focusBar(i) {
  if (walk || live) return selectBar(i);
  prefs.selected = i;
  peekBar = i === ctx().nextBar ? null : i;
  savePrefs();
  tab = 'bar';
  render(true);
  setSheet('peek');
  stopModes();
  engine?.flyTo(BARS[i].coord);
}

function checkIn(i) {
  const team = myTeam();
  if (!team) return askTeam();
  peekBar = null;
  store.dispatch([{ o: 'here', tm: team.id, v: i }, { o: 'vis', tm: team.id, bar: BARS[i].id, on: true }], team.id);
  prefs.selected = i;
  savePrefs();
  tab = 'bar';
  render(true);
  toast(i === finaleIdx() ? `${team.name} er fremme på finalen. Skål!` : `${team.name} sjekket inn på ${BARS[i].name}. Skål!`);
}

function toggleAward(barId, taskId, teamId) {
  const on = (S().awards[barId]?.[taskId] || []).includes(teamId);
  store.dispatch([{ o: 'aw', bar: barId, tk: taskId, tm: teamId, on: !on }], by());
}

function teamEvent(t, changes = {}) {
  const x = { ...t, ...changes };
  return { o: 'tm', id: x.id, n: x.name, col: x.color, x: x.x, ...(x.del ? { del: true } : {}) };
}
function memberEvent(m, teamId, changes = {}) {
  return { o: 'mb', id: m.id, n: m.name, tm: teamId, c0: m.created, ...changes };
}

function lockRoutes(finaleId = S().finale) {
  const fresh = planRoutes(S().teams, barIndex(finaleId), PLAN_START, {});
  return S().teams.map((t) => ({ o: 'rt', tm: t.id, ord: fresh[t.id] }));
}

function allParticipants() {
  const people = [];
  S().teams.forEach((t) => t.members.forEach((m) => people.push({ name: m.name, team: t })));
  return people;
}

function pickRandom() {
  const people = allParticipants();
  const pool = people.length ? people : S().teams.map((t) => ({ name: t.name, team: t }));
  if (!pool.length) return;
  const modal = $('#modal');
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="pick-title">
      <p class="eyebrow" id="pick-title">${people.length ? 'Hvem må?' : 'Hvilket lag må?'}</p>
      <div class="pick-name" id="pick-name"></div>
      <div class="pick-team" id="pick-team"></div>
      <div class="modal-actions">
        <button class="btn" type="button" data-action="pick">${icon('dice')} Trekk igjen</button>
        <button class="btn btn-primary" type="button" data-action="modal-close">Ferdig</button>
      </div>
    </div>`;
  const final = pool[Math.floor(Math.random() * pool.length)];
  let n = 0;
  const total = reduceMotion ? 0 : 14;
  const tick = () => {
    const p = n < total ? pool[Math.floor(Math.random() * pool.length)] : final;
    $('#pick-name').textContent = p.name;
    $('#pick-team').innerHTML = people.length ? `<span class="swatch" style="--team:${p.team.color}"></span>${esc(p.team.name)}` : '';
    if (n++ < total) setTimeout(tick, 50 + n * 9);
  };
  tick();
}

function askTeam() {
  if (!S().teams.length) return;
  const modal = $('#modal');
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="team-q">
      <p class="eyebrow">Denne telefonen</p>
      <h2 class="h-display" id="team-q">Hvilket lag er du på?</h2>
      <p class="muted small" style="margin:0">Laget bestemmer hvilken rute du ser. Poengene ser alle.</p>
      <div class="team-pick">
        ${S().teams.map((t) => `<button class="btn team-pick-btn" type="button" style="--team:${t.color}" data-action="set-my-team" data-team="${t.id}"><span class="swatch" style="--team:${t.color}"></span><span>${esc(t.name)}</span><span class="muted small">${t.members.map((m) => esc(m.name)).join(', ')}</span></button>`).join('')}
      </div>
      <button class="btn btn-ghost" type="button" data-action="modal-close">Bare se på</button>
    </div>`;
}

function maybeAskTeam() {
  if (S().setupDone && !myTeam() && $('#modal').hidden) askTeam();
}

function scoreText() {
  const lines = ranking().map((t, i) => `${i + 1}. ${t.name}: ${t.score} p`);
  const where = S().teams.map((t) => {
    const h = S().progress[t.id]?.here;
    return `${t.name}: ${Number.isInteger(h) && h >= 0 ? BARS[h].name : 'ikke startet'}`;
  });
  return `Kbh Bar til bar: stillingen nå\n${lines.join('\n')}\n\nHvor er lagene?\n${where.join('\n')}\nFinale: ${BARS[finaleIdx()].name}`;
}

async function shareText(title, text, fallbackTitle) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Kopiert. Lim det inn i gruppechatten.');
  } catch {
    showTextModal(fallbackTitle, text);
  }
}

function inviteLink() {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  if (room && room !== CONFIG.sync?.room) u.searchParams.set('rom', room);
  return u.toString();
}

function showTextModal(title, text) {
  const modal = $('#modal');
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <p class="eyebrow">${esc(title)}</p>
      <textarea class="input" id="share-text" readonly>${esc(text)}</textarea>
      <div class="modal-actions"><button class="btn btn-primary" type="button" data-action="modal-close">Lukk</button></div>
    </div>`;
  $('#share-text').focus();
  $('#share-text').select();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Kopiert');
  } catch {
    showTextModal('Kopier', text);
  }
}

function shuffleTeams() {
  const people = [];
  S().teams.forEach((t) => t.members.forEach((m) => people.push(m)));
  if (people.length < 2) return toast('Legg til deltakere først.');
  for (let i = people.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [people[i], people[j]] = [people[j], people[i]];
  }
  store.dispatch(people.map((m, i) => memberEvent(m, S().teams[i % S().teams.length].id)), by());
  toast('Lagene er blandet');
}

function addMember(teamId) {
  const input = document.getElementById(`member-${teamId}`);
  const name = input?.value.trim();
  if (!name) return;
  store.dispatch([{ o: 'mb', id: uid('m'), n: name.slice(0, 40), tm: teamId, c0: Date.now() }], by());
  render(true);
  document.getElementById(`member-${teamId}`)?.focus();
}

/* ---------- Sanntidsvarsler ---------- */
function describe(e) {
  const team = teamById(e.tm)?.name || 'Et lag';
  const bar = BARS.find((b) => b.id === e.bar);
  switch (e.o) {
    case 'aw': {
      const task = bar && [...bar.tasks, ...FINALE_TASKS].find((t) => t.id === e.tk);
      if (!task) return null;
      return e.on ? `${team} fikk ${task.points} p for «${task.title}»` : `${team} mistet ${task.points} p for «${task.title}»`;
    }
    case 'adj': return `${team} ${e.d > 0 ? 'fikk' : 'mistet'} ${Math.abs(e.d)} dommerpoeng${bar ? ` på ${bar.name}` : ''}`;
    case 'here': return Number.isInteger(e.v) && BARS[e.v] ? `${team} sjekket inn på ${BARS[e.v].name}` : null;
    case 'stt': return e.v ? `${team} startet runden` : null;
    case 'go': return e.v ? 'Kvelden er i gang!' : null;
    case 'fin': return `Finalen er flyttet til ${BARS.find((b) => b.id === e.v)?.name || 'en ny bar'}`;
    case 'rst': return 'Kvelden ble nullstilt';
    default: return null;
  }
}

function announceRemote(list) {
  const msgs = list.map(describe).filter(Boolean);
  if (!msgs.length) return;
  toast(msgs.length === 1 ? msgs[0] : `${msgs[msgs.length - 1]} (+${msgs.length - 1} til)`);
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, action = null) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="btn btn-sm" type="button" data-action="${action.action}" data-i="${action.i ?? ''}">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 9000 : 4200);
}

/* ---------- Bunnark ---------- */
function setSheet(s) {
  $('#sheet').dataset.state = s;
}
function measurePeek() {
  if (desktopMQ.matches) return updatePadding();
  const grab = $('#sheet-grab').offsetHeight;
  const peek = $('#walk-hud').hidden ? $('#peek').offsetHeight + $('#tabs').offsetHeight + 10 : $('#walk-hud').offsetHeight;
  const safe = parseFloat(getComputedStyle($('#sheet')).paddingBottom) || 0;
  document.documentElement.style.setProperty('--peek-h', `${Math.round(grab + peek + safe)}px`);
  updatePadding();
}

function initSheetDrag() {
  const sheet = $('#sheet');
  let startY = null;
  let startT = 0;
  let moved = false;
  const onDown = (e) => {
    if (desktopMQ.matches || e.target.closest('button, a, input, select')) return;
    startY = e.clientY;
    moved = false;
    const tr = getComputedStyle(sheet).transform;
    startT = tr && tr !== 'none' ? new DOMMatrixReadOnly(tr).m42 : 0;
    sheet.classList.add('dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    const max = sheet.offsetHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 200);
    sheet.style.transform = `translateY(${Math.min(max, Math.max(0, startT + dy))}px)`;
  };
  const onUp = (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    if (!moved) setSheet(sheet.dataset.state === 'open' ? 'peek' : 'open');
    else if (dy < -50) setSheet('open');
    else if (dy > 50) setSheet('peek');
    startY = null;
  };
  [$('#sheet-grab'), $('#peek'), $('#walk-hud')].forEach((h) => {
    h.addEventListener('pointerdown', onDown);
    h.addEventListener('pointermove', onMove);
    h.addEventListener('pointerup', onUp);
    h.addEventListener('pointercancel', onUp);
  });
  $('#sheet-grab').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSheet(sheet.dataset.state === 'open' ? 'peek' : 'open');
    }
  });
}

/* ---------- Visning ---------- */
function catChip(cat) {
  const c = CATEGORIES[cat];
  return `<span class="chip" style="--c:${c.color}">${icon(c.icon)}${esc(c.label)}</span>`;
}
function barStatus(i, c = ctx()) {
  if (i === c.here) return '<span class="status is-here">Her nå</span>';
  if (c.visited.has(BARS[i].id)) return '<span class="status is-done">Besøkt</span>';
  if (i === c.nextBar) return '<span class="status is-next">Neste</span>';
  if (i === finaleIdx()) return '<span class="status is-finale">Finale</span>';
  return '';
}
const streetViewUrl = (c) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c[1]},${c[0]}`;
const directionsUrl = (bar) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${bar.name}, ${bar.address}`)}&travelmode=walking`;
const SYNC_TEXT = { live: 'Sanntid', connecting: 'Kobler til', reconnecting: 'Kobler til igjen', offline: 'Frakoblet', local: 'Bare denne telefonen' };
const shortName = (name) => name.replace(/^Den /, '').replace(/ Vinstue$/, '').replace(/ 10$/, '');

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

let bodyDirty = false;
function render(force = false) {
  ensureLegs();
  renderTop();
  renderControls();
  renderPeek();
  renderTabs();
  // Ikke tegn om skjemaet mens noen skriver i det; det tegnes når feltet mister fokus.
  const active = document.activeElement;
  const typing = active?.closest?.('#sheet-body') && active.matches('input, textarea, select');
  if (typing && !force) bodyDirty = true;
  else { bodyDirty = false; renderBody(); }
  engine?.setView(viewState());
  requestAnimationFrame(measurePeek);
}

function renderTop() {
  const c = ctx();
  const status = store.status;
  $('#progress').innerHTML = `<span class="sync-dot is-${status}"></span>${c.visited.size}/${BARS.length}`;
  $('#progress').setAttribute('aria-label', `${SYNC_TEXT[status]}. ${c.visited.size} av ${BARS.length} barer besøkt`);
  $('#progress').title = SYNC_TEXT[status] || '';
  const ranked = ranking();
  const lead = ranked[0];
  const anyPoints = ranked.some((t) => t.score !== 0);
  $('#leader-chip').innerHTML = `${icon('trophy')}<span class="leader-name">${anyPoints && lead ? esc(lead.name) : 'Poeng'}</span><span class="leader-pts">${anyPoints && lead ? lead.score : 0}</span>`;
}

function renderControls() {
  const hasKey = !!googleKey();
  $('#map-controls').innerHTML = `
    <button id="btn-overview" class="ctl" type="button" data-action="overview" aria-label="Se hele ruta i 3D" title="Hele ruta i 3D">${icon('overview')}</button>
    <button id="btn-live" class="ctl" type="button" data-action="live" aria-label="Live-posisjon med kompass" title="Live: GPS og kompass">${icon('gps')}</button>
    ${hasKey ? `<button id="btn-engine" class="ctl" type="button" data-action="engine-toggle" aria-label="${engineKind === 'earth' ? 'Bytt til kart' : 'Bytt til Google 3D'}" title="Google 3D eller kart" aria-pressed="${engineKind === 'earth'}">${icon('globe')}</button>` : ''}
    <button id="btn-daynight" class="ctl" type="button" data-action="daynight" aria-label="${isNight() ? 'Bytt til dag' : 'Bytt til natt'}" title="Dag/natt">${icon(isNight() ? 'sun' : 'moon')}</button>
    <button id="btn-north" class="ctl" type="button" data-action="north" aria-label="Snu kartet med nord opp" title="Nord opp">${icon('north')}</button>`;
  const n = document.querySelector('#btn-north .north-needle');
  if (n) { n.style.transformOrigin = '12px 12px'; n.style.transform = `rotate(${-(engine?.bearing() || 0)}deg)`; }
  setControlState();
}
function setControlState() {
  $('#btn-overview')?.setAttribute('aria-pressed', engine?.orbiting ? 'true' : 'false');
  $('#btn-live')?.setAttribute('aria-pressed', live ? 'true' : 'false');
}

function renderPeek() {
  const c = ctx();
  const sched = schedule(c.seq);
  let html;
  if (S().setupDone && !c.team) {
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:var(--sodium)">${icon('users')}</div>
        <div class="peek-text">
          <div class="eyebrow">${S().teams.length} lag er med</div>
          <h2 class="peek-title">Hvilket lag er du på?</h2>
          <div class="peek-meta">Velg laget ditt for å se ruta deres</div>
        </div>
        <div class="peek-actions"><button class="btn btn-primary" type="button" data-action="ask-team">${icon('users')} Velg lag</button></div>
      </div>`;
  } else if (peekBar != null) {
    const bar = BARS[peekBar];
    const cat = CATEGORIES[bar.cat];
    const pos = c.seq.indexOf(peekBar);
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:${cat.color}">${icon(cat.icon)}<span class="badge-num">${pos + 1}</span></div>
        <div class="peek-text">
          <div class="eyebrow">Stopp ${pos + 1} · ${eta(sched.arrive[pos], c.startedAt)}</div>
          <h2 class="peek-title">${esc(bar.name)}</h2>
          <div class="peek-meta">${esc(cat.label)} · ${esc(bar.address)}</div>
        </div>
        <div class="peek-actions">
          <button class="btn btn-primary" type="button" data-action="select-bar" data-i="${peekBar}">Se baren</button>
          <button class="btn" type="button" data-action="walk" data-leg="${pos}">${icon('walk')} Gåtur hit</button>
          <button class="btn btn-ghost" type="button" data-action="peek-clear" aria-label="Tilbake til neste stopp">${icon('close')}</button>
        </div>
      </div>`;
  } else if (c.nextBar < 0) {
    const lead = ranking()[0];
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:var(--sodium)">${icon('trophy')}</div>
        <div class="peek-text">
          <div class="eyebrow">Runden er ferdig</div>
          <h2 class="peek-title">${lead ? `${esc(lead.name)} leder!` : 'Godt jobba!'}</h2>
          <div class="peek-meta">Hjem til ${esc(HOTEL.name)} · ${fmtDist(legs[c.seq.length]?.distance || 0)}</div>
        </div>
        <div class="peek-actions">
          <button class="btn btn-primary" type="button" data-action="walk" data-leg="${c.seq.length}">${icon('walk')} Gåtur hjem</button>
          <button class="btn" type="button" data-action="tab" data-tab="score">${icon('trophy')} Poeng</button>
        </div>
      </div>`;
  } else {
    const bar = BARS[c.nextBar];
    const cat = CATEGORIES[bar.cat];
    const leg = legs[c.nextPos];
    const isFinale = c.nextBar === finaleIdx();
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:${cat.color}">${icon(cat.icon)}<span class="badge-num">${c.nextPos + 1}</span></div>
        <div class="peek-text">
          <div class="eyebrow">${c.team ? `${esc(c.team.name)} · ` : ''}${isFinale ? 'Finale' : 'Neste'} · <b>${eta(sched.arrive[c.nextPos], c.startedAt)}</b></div>
          <h2 class="peek-title">${esc(bar.name)}</h2>
          <div class="peek-meta">${esc(cat.label)} · ${fmtDist(leg?.distance || 0)} · ${fmtMin(leg?.duration || 60)} å gå</div>
        </div>
        <div class="peek-actions">
          ${c.team && !c.startedAt
            ? `<button class="btn btn-primary" type="button" data-action="team-start">${icon('walk')} Vi starter nå</button>`
            : `<button class="btn btn-primary" type="button" data-action="walk" data-leg="${c.nextPos}">${icon('walk')} 3D-gåtur</button>`}
          <button class="btn" type="button" data-action="live">${icon('gps')} Gå live</button>
          <button class="btn" type="button" data-action="select-bar" data-i="${c.nextBar}">Oppgaver</button>
        </div>
      </div>`;
  }
  $('#peek').innerHTML = html;
}

function renderTabs() {
  document.querySelectorAll('#tabs [data-tab]').forEach((b) => {
    b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
    b.tabIndex = b.dataset.tab === tab ? 0 : -1;
  });
  $('#sheet-body').setAttribute('aria-labelledby', `tab-${tab}`);
}

let renderedTab = null;
function renderBody() {
  const body = $('#sheet-body');
  const scroll = renderedTab === tab ? body.scrollTop : 0;
  body.innerHTML = { route: viewRoute, bar: viewBar, score: viewScore, teams: viewTeams }[tab]();
  body.scrollTop = scroll;
  renderedTab = tab;
}

function viewRoute() {
  const c = ctx();
  const sched = schedule(c.seq);
  const totalDist = legs.reduce((s, l) => s + l.distance, 0);
  const fi = finaleIdx();
  const at = teamsAt();
  const legRow = (pos) => {
    const st = pos < c.nextPos ? 'is-done' : pos === c.nextPos ? 'is-next' : '';
    return `
      <li class="tl-leg">
        <span class="tl-leg-line ${st}"></span>
        <span class="tl-leg-info">${fmtDist(legs[pos]?.distance || 0)} · ${fmtMin(legs[pos]?.duration || 60)} gange
          <button type="button" data-action="walk" data-leg="${pos}">${icon('walk')} Gå i 3D</button>
        </span>
      </li>`;
  };
  const stops = c.seq.map((b, pos) => {
    const bar = BARS[b];
    const cat = CATEGORIES[bar.cat];
    const others = (at.get(b) || []).filter((t) => t.id !== c.team?.id);
    const status = barStatus(b, c);
    return `
      ${legRow(pos)}
      <li class="tl-stop">
        <span class="tl-dot ${c.visited.has(bar.id) ? 'is-done' : ''}" style="--c:${cat.color}">${pos + 1}</span>
        <button class="tl-main" type="button" data-action="select-bar" data-i="${b}">
          <span class="tl-name">${esc(bar.name)}</span>
          <span class="tl-sub">${esc(cat.label)} · ${others.length ? `${others.map((t) => esc(t.name)).join(', ')} er her nå` : esc(bar.tagline)}</span>
        </button>
        <span class="tl-time">${status || eta(sched.arrive[pos], c.startedAt)}</span>
      </li>`;
  }).join('');
  const allRoutes = S().teams.map((t) => {
    const seq = plan()[t.id] || [];
    const prog = S().progress[t.id] || { here: -1, visited: [] };
    return `
      <li class="${t.id === c.team?.id ? 'is-mine' : ''}">
        <span class="routes-team"><span class="swatch" style="--team:${t.color}"></span>${esc(t.name)}</span>
        <span class="routes-chips">${seq.map((b, k) => `<span class="route-chip ${prog.visited.includes(BARS[b].id) ? 'is-done' : ''} ${prog.here === b ? 'is-here' : ''}" style="--c:${CATEGORIES[BARS[b].cat].color}" title="${esc(BARS[b].name)}">${k + 1}. ${esc(shortName(BARS[b].name))}</span>`).join('')}</span>
      </li>`;
  }).join('');
  return `
    <div class="section">
      <h2 class="h-display">${c.team ? `Ruta til ${esc(c.team.name)}` : 'Sju barer, én kveld'}</h2>
      <p class="lede">Hvert lag har sin egen rekkefølge, men alle starter ved Imperial Hotel og møtes til finale på <b>${esc(BARS[fi].name)}</b>. Trykk på en bar for oppgaver, eller «Gå i 3D» for å se veien før dere går.</p>
    </div>
    <div class="stats">
      <div class="stat"><b>${fmtDist(totalDist)}</b><span>gange totalt</span></div>
      <div class="stat"><b>${eta(sched.arrive[c.seq.length - 1] || 0, c.startedAt)}</b><span>til finale</span></div>
      <div class="stat"><b>${BARS.length}</b><span>barer</span></div>
    </div>
    <ol class="timeline" aria-label="Ruta">
      <li class="tl-stop">
        <span class="tl-dot" style="--c:var(--text)">${icon('hotel')}</span>
        <button class="tl-main" type="button" data-action="fly-hotel">
          <span class="tl-name">${esc(HOTEL.name)}</span>
          <span class="tl-sub">Start · ${esc(HOTEL.address)}</span>
        </button>
        <span class="tl-time">${c.startedAt ? hhmm(c.startedAt) : 'Ikke startet'}</span>
      </li>
      ${stops}
      ${legRow(c.seq.length)}
      <li class="tl-stop">
        <span class="tl-dot" style="--c:var(--text)">${icon('hotel')}</span>
        <button class="tl-main" type="button" data-action="fly-hotel">
          <span class="tl-name">Hjem til hotellet</span>
          <span class="tl-sub">${esc(HOTEL.address)}</span>
        </button>
        <span class="tl-time">${eta(sched.home, c.startedAt)}</span>
      </li>
    </ol>
    ${c.team && !c.startedAt ? `<button class="btn btn-primary btn-block" type="button" data-action="team-start">${icon('walk')} Vi starter nå</button>` : ''}
    <button class="btn btn-block" type="button" data-action="overview">${icon('overview')} Se hele ruta i 3D</button>
    <section class="section">
      <h3 class="section-title">Alle lagenes ruter</h3>
      <ul class="routes-list">${allRoutes}</ul>
    </section>
    <p class="note">${routeSource === 'osm'
      ? 'Gangrutene følger ekte gater fra OpenStreetMap.'
      : 'Rutene er omtrentlige til appen får kontakt med rutetjenesten.'}
      Tidene regnes ut fra når hvert lag trykker «Vi starter nå», og tiden på hver bar. Finalen velger du under <b>Lag</b>.</p>`;
}

function viewBar() {
  const c = ctx();
  const i = prefs.selected ?? 0;
  const bar = BARS[i];
  const pos = c.seq.indexOf(i);
  const sched = schedule(c.seq);
  const teams = S().teams;
  const awards = S().awards[bar.id] || {};
  const isFinale = i === finaleIdx();
  const taskList = (list) => list.map((task) => {
    const won = awards[task.id] || [];
    return `
      <li class="task">
        <div class="task-head"><h4>${esc(task.title)}</h4><span class="pts">${task.points} p</span></div>
        <p>${esc(task.text)}</p>
        <div class="award" role="group" aria-label="Gi ${task.points} poeng til">
          <span class="award-label">Trykk på laget som klarte det:</span>
          ${teams.map((t) => `<button class="team-toggle" type="button" style="--team:${t.color}" aria-pressed="${won.includes(t.id)}" data-action="award" data-bar="${bar.id}" data-task="${task.id}" data-team="${t.id}">${esc(t.name)}</button>`).join('')}
        </div>
      </li>`;
  }).join('');
  const adj = S().adjust[bar.id] || {};
  const nextB = c.seq[pos + 1];
  let primary;
  if (!c.team) primary = `<button class="btn btn-primary btn-block" type="button" data-action="ask-team">${icon('users')} Velg laget ditt</button>`;
  else if (c.here === i) {
    primary = nextB != null
      ? `<button class="btn btn-primary btn-block" type="button" data-action="walk" data-leg="${pos + 1}">${icon('walk')} Videre til ${esc(BARS[nextB].name)}</button>`
      : `<button class="btn btn-primary btn-block" type="button" data-action="tab" data-tab="score">${icon('trophy')} Se poengtavla</button>`;
  } else primary = `<button class="btn ${i === c.nextBar ? 'btn-primary' : ''} btn-block" type="button" data-action="checkin" data-i="${i}">${icon('check')} Sjekk inn ${esc(c.team.name)} her</button>`;
  const here = teamsAt().get(i) || [];

  return `
    <div class="bar-head">
      <div class="bar-head-row">${catChip(bar.cat)} ${barStatus(i, c)} <span class="eyebrow">Stopp ${pos + 1} av ${BARS.length} · ${eta(sched.arrive[pos], c.startedAt)}</span></div>
      <h2 class="h-display">${esc(bar.name)}</h2>
      <div class="address">${icon('map')}<span>${esc(bar.address)}</span>
        <button class="icon-btn" type="button" data-action="copy" data-text="${esc(`${bar.name}, ${bar.address}`)}" aria-label="Kopier adressen">${icon('copy')}</button>
      </div>
      ${here.length ? `<div class="row-wrap">${here.map((t) => `<span class="chip" style="--c:${t.color}"><span class="swatch" style="--team:${t.color}"></span>${esc(t.name)} er her</span>`).join('')}</div>` : ''}
      <p class="lede">${esc(bar.about)}</p>
    </div>
    ${primary}
    <div class="action-grid">
      <button class="btn" type="button" data-action="walk" data-leg="${pos}">${icon('walk')} 3D-gåtur hit</button>
      <button class="btn" type="button" data-action="fly-bar" data-i="${i}">${icon('overview')} Vis i 3D</button>
      <a class="btn" href="${streetViewUrl(bar.coord)}" target="_blank" rel="noopener">${icon('eye')} Street View</a>
      <a class="btn" href="${directionsUrl(bar)}" target="_blank" rel="noopener">${icon('nav')} Google Maps</a>
    </div>
    <section class="section">
      <h3 class="section-title">Hva vi drikker</h3>
      <ul class="drinks">${bar.drinks.map((d) => `<li class="drink"><span class="drink-kind">${esc(d.kind)}</span><p>${esc(d.text)}</p></li>`).join('')}</ul>
    </section>
    <section class="section">
      <h3 class="section-title">Oppgaver <button class="btn btn-sm" type="button" data-action="pick">${icon('dice')} Hvem må?</button></h3>
      <ul class="tasks">${taskList(bar.tasks)}</ul>
    </section>
    ${isFinale ? `
    <section class="section">
      <h3 class="section-title">Finalen: lag mot lag</h3>
      <p class="muted small" style="margin:0">Når alle lagene er på plass.</p>
      <ul class="tasks">${taskList(FINALE_TASKS)}</ul>
    </section>` : ''}
    <section class="section">
      <h3 class="section-title">Dommerpoeng</h3>
      <p class="muted small" style="margin:0">Bonus eller straff, for eksempel for beste antrekk eller juks.</p>
      <div class="adjust-list">
        ${teams.map((t) => `
          <div class="adjust-row">
            <span class="team-name"><span class="swatch" style="--team:${t.color}"></span><span>${esc(t.name)}</span></span>
            <button class="icon-btn" type="button" data-action="adjust" data-bar="${bar.id}" data-team="${t.id}" data-delta="-1" aria-label="Trekk ett poeng fra ${esc(t.name)}">${icon('minus')}</button>
            <span class="adjust-val">${adj[t.id] > 0 ? '+' : ''}${adj[t.id] || 0}</span>
            <button class="icon-btn" type="button" data-action="adjust" data-bar="${bar.id}" data-team="${t.id}" data-delta="1" aria-label="Gi ett poeng til ${esc(t.name)}">${icon('plus')}</button>
          </div>`).join('')}
      </div>
    </section>
    <p class="note"><b>Godt å vite:</b> ${esc(bar.goodToKnow)}</p>`;
}

function viewScore() {
  const ranked = ranking();
  const max = Math.max(1, ...ranked.map((t) => t.score));
  const fi = finaleIdx();
  const allAtFinale = S().teams.length > 0 && S().teams.every((t) => S().progress[t.id]?.here === fi);
  const lead = ranked[0];
  const tie = ranked.length > 1 && ranked[0].score === ranked[1].score;
  let prevScore = null;
  let rank = 0;
  const rows = ranked.map((t, idx) => {
    if (t.score !== prevScore) { rank = idx + 1; prevScore = t.score; }
    const h = S().progress[t.id]?.here;
    const where = Number.isInteger(h) && h >= 0 ? `På ${BARS[h].name} · ${(S().progress[t.id]?.visited || []).length}/${BARS.length}` : 'Ikke startet';
    return `
      <li class="board-row ${rank === 1 && t.score > 0 ? 'is-lead' : ''}" style="--team:${t.color};--w:${Math.max(0, (t.score / max) * 100).toFixed(1)}%">
        <span class="board-rank">${rank}</span>
        <span class="board-team">
          <span class="board-name"><span class="swatch" style="--team:${t.color}"></span><span>${esc(t.name)}</span></span>
          <span class="board-members">${esc(where)}${t.members.length ? ` · ${t.members.map((m) => esc(m.name)).join(', ')}` : ''}</span>
        </span>
        <span class="board-pts">${t.score}<small>p</small></span>
      </li>`;
  }).join('');
  const table = `
    <div class="table-wrap">
      <table class="breakdown">
        <thead><tr><th scope="col">Lag</th>${BARS.map((b) => `<th scope="col" title="${esc(b.name)}">${esc(shortName(b.name))}</th>`).join('')}<th scope="col">Sum</th></tr></thead>
        <tbody>${ranked.map((t) => `<tr><td>${esc(t.name)}</td>${BARS.map((b) => `<td>${barScore(b, t.id) || '·'}</td>`).join('')}<td class="tot">${t.score}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  const feed = store.activity(80).map((e) => ({ e, text: describe(e) })).filter((x) => x.text).slice(0, 15);
  return `
    ${allAtFinale && lead ? `
      <div class="winner">
        ${icon('trophy')}
        <span class="eyebrow">Alle er på finalen</span>
        <h2 class="h-display">${tie ? 'Uavgjort!' : `${esc(lead.name)} leder`}</h2>
        <span class="muted">${tie ? 'Avgjør det i finaleoppgavene.' : `${lead.score} poeng. Finaleoppgavene kan fortsatt snu alt.`}</span>
      </div>` : `
      <div class="section">
        <h2 class="h-display">Poengtavle</h2>
        <p class="lede">Oppdateres i sanntid på alle telefoner. Alle lag kan føre poeng under oppgavene på hver bar.</p>
      </div>`}
    <ol class="board" aria-label="Stilling">${rows}</ol>
    <div class="action-grid">
      <button class="btn btn-primary" type="button" data-action="share">${icon('share')} Del stillingen</button>
      <button class="btn" type="button" data-action="pick">${icon('dice')} Hvem må?</button>
    </div>
    <section class="section">
      <h3 class="section-title">Siste hendelser <span class="sync-label"><span class="sync-dot is-${store.status}"></span>${esc(SYNC_TEXT[store.status])}</span></h3>
      ${feed.length ? `<ul class="feed">${feed.map(({ e, text }) => {
        const t = teamById(e.b);
        return `<li><span class="feed-time mono">${new Date(e.t).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}</span><span>${esc(text)}${t ? ` <span class="muted">· ført av ${esc(t.name)}</span>` : ''}</span></li>`;
      }).join('')}</ul>` : '<p class="muted small" style="margin:0">Ingen poeng ennå. Første oppgave venter.</p>'}
    </section>
    <section class="section">
      <h3 class="section-title">Poeng per bar</h3>
      ${table}
    </section>`;
}

function viewTeams() {
  const me = myTeam();
  const cards = S().teams.map((t) => `
    <div class="team-card" style="--team:${t.color}">
      <div class="team-card-head">
        <input class="input input-team" id="team-name-${t.id}" data-team-name="${t.id}" value="${esc(t.name)}" maxlength="30" aria-label="Lagnavn" autocomplete="off">
        ${S().teams.length > 1 ? `<button class="icon-btn" type="button" data-action="remove-team" data-team="${t.id}" aria-label="Fjern ${esc(t.name)}">${icon('close')}</button>` : ''}
      </div>
      <div class="color-row" role="group" aria-label="Lagfarge">
        ${TEAM_COLORS.map((col) => `<button class="color-dot" type="button" style="--team:${col}" aria-pressed="${col === t.color}" aria-label="Farge ${col}" data-action="team-color" data-team="${t.id}" data-color="${col}"></button>`).join('')}
      </div>
      <div class="members">
        ${t.members.length ? t.members.map((m) => `<span class="member">${esc(m.name)}<button type="button" data-action="remove-member" data-team="${t.id}" data-member="${m.id}" aria-label="Fjern ${esc(m.name)}">${icon('close')}</button></span>`).join('') : '<span class="muted small">Ingen deltakere ennå</span>'}
      </div>
      <form class="add-row" data-add-member="${t.id}">
        <input class="input" id="member-${t.id}" placeholder="Navn på deltaker" maxlength="40" autocomplete="off" aria-label="Ny deltaker på ${esc(t.name)}">
        <button class="btn" type="submit">${icon('plus')} Legg til</button>
      </form>
      <button class="btn btn-sm ${me?.id === t.id ? 'btn-primary' : ''}" type="button" data-action="set-my-team" data-team="${t.id}">${me?.id === t.id ? `${icon('check')} Denne telefonen er på ${esc(t.name)}` : 'Jeg er på dette laget'}</button>
    </div>`).join('');
  const people = allParticipants().length;
  const status = store.status;
  return `
    <div class="section">
      <h2 class="h-display">${S().setupDone ? 'Lag og deltakere' : 'Velkommen til kvelden'}</h2>
      <p class="lede">${S().setupDone
        ? `${S().teams.length} lag og ${people} deltakere. Endringer vises med en gang på alle telefoner.`
        : 'Del gjengen inn i lag og legg til deltakerne. Hvert lag får sin egen rute, og alle møtes til finale. Alt dere gjør her vises med en gang på alle som åpner appen.'}</p>
    </div>
    <div class="sync-card">
      <span class="sync-dot is-${status}"></span>
      <div class="sync-text"><b>${esc(SYNC_TEXT[status])}</b><span class="muted small">${status === 'local' ? 'Poengene lagres bare på denne telefonen.' : `Rom: ${esc(room)}${store.pending ? ` · ${store.pending} endring(er) venter på nett` : ''}`}</span></div>
      <button class="btn btn-sm" type="button" data-action="invite">${icon('share')} Inviter</button>
    </div>
    ${cards}
    <div class="row-wrap">
      ${S().teams.length < TEAM_COLORS.length ? `<button class="btn" type="button" data-action="add-team">${icon('plus')} Legg til lag</button>` : ''}
      <button class="btn" type="button" data-action="shuffle-teams">${icon('shuffle')} Bland lagene</button>
    </div>
    <div class="field">
      <label for="finale">Finale, der alle lagene møtes</label>
      <select class="input" id="finale">${BARS.map((b) => `<option value="${b.id}" ${b.id === S().finale ? 'selected' : ''}>${esc(b.name)} (${esc(CATEGORIES[b.cat].label)})</option>`).join('')}</select>
    </div>
    ${S().setupDone
      ? `<button class="btn" type="button" data-action="replan">${icon('shuffle')} Lag nye ruter for alle lag</button>`
      : `<button class="btn btn-primary btn-block" type="button" data-action="start-night">${icon('walk')} Start kvelden</button>`}
    <section class="section">
      <h3 class="section-title">Google Earth-visning</h3>
      <p class="muted small" style="margin:0">${engineKind === 'earth'
        ? 'Fotorealistisk 3D fra Google er på.'
        : googleKey()
          ? 'Nøkkelen er lagt inn. Trykk på jordkloden ved kartet for å bytte visning.'
          : 'Lim inn en nøkkel til Google Map Tiles API for å se byen fotorealistisk, som i Google Earth. En nøkkel lagt inn her gjelder bare denne telefonen.'}</p>
      <form class="add-row" data-google-key>
        <input class="input" id="google-key" placeholder="Google API-nøkkel" autocomplete="off" spellcheck="false" value="${esc(prefs.googleKey)}" aria-label="Google API-nøkkel">
        <button class="btn" type="submit">Bruk</button>
      </form>
    </section>
    <section class="section">
      <h3 class="section-title">Nullstill</h3>
      ${confirmReset
        ? `<div class="row-wrap"><span class="small">Slette alle poeng, lag og innsjekkinger for alle?</span>
            <button class="btn btn-danger btn-sm" type="button" data-action="reset-confirm">Ja, nullstill</button>
            <button class="btn btn-sm" type="button" data-action="reset-cancel">Avbryt</button></div>`
        : '<button class="btn btn-danger" type="button" data-action="reset">Nullstill kvelden</button>'}
    </section>
    <p class="note">Pass på hverandre. Nødnummer i Danmark: <b>112</b>.</p>
    <p class="credits">Kart: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bidragsytere</a>. Fotorealistisk 3D: Google. Gangruter: FOSSGIS OSRM. Sanntid: ntfy.sh. Åpningstider kan endre seg, så sjekk før dere går.</p>`;
}

/* ---------- Hendelser ---------- */
function onClick(e) {
  const el = e.target.closest('[data-action], #tabs [data-tab]');
  if (!el) return;
  if (el.matches('#tabs [data-tab]') && !el.dataset.action) {
    tab = el.dataset.tab;
    render(true);
    if (!desktopMQ.matches) setSheet('open');
    return;
  }
  const d = el.dataset;
  const i = d.i !== undefined && d.i !== '' ? Number(d.i) : null;
  const team = d.team ? teamById(d.team) : null;
  switch (d.action) {
    case 'tab':
      tab = d.tab;
      render(true);
      setSheet('open');
      break;
    case 'select-bar':
      selectBar(i);
      break;
    case 'peek-clear':
      peekBar = null;
      render();
      break;
    case 'fly-bar':
      setSheet('peek');
      stopModes();
      engine?.flyTo(BARS[i].coord, { close: true });
      break;
    case 'fly-hotel':
      setSheet('peek');
      stopModes();
      engine?.flyTo(HOTEL.coord);
      break;
    case 'walk':
      startWalk(Number(d.leg));
      break;
    case 'walk-toggle':
      if (!walk) break;
      walk.playing = !walk.playing;
      walk.looking = false;
      walk.last = performance.now();
      renderWalkHud();
      break;
    case 'walk-speed':
      speedIdx = (speedIdx + 1) % WALK_SPEEDS.length;
      renderWalkHud();
      break;
    case 'cam-toggle':
      prefs.cam = prefs.cam === 'gate' ? 'drone' : 'gate';
      savePrefs();
      renderWalkHud();
      renderLiveHud();
      break;
    case 'walk-exit':
      exitWalk();
      break;
    case 'live':
      if (live) exitLive(); else { setSheet('peek'); startLive(); }
      break;
    case 'live-follow':
      if (live) { live.follow = true; renderLiveHud(); }
      break;
    case 'live-exit':
      exitLive();
      break;
    case 'overview':
      if (engine?.orbiting) engine.stopOrbit();
      else { setSheet('peek'); stopModes(); engine?.overview({ onDone: setControlState }); }
      setControlState();
      break;
    case 'engine-toggle':
      prefs.engine = engineKind === 'earth' ? 'map' : null;
      savePrefs();
      startEngine(preferredEngine());
      break;
    case 'daynight':
      prefs.night = !isNight();
      savePrefs();
      engine?.setNight(isNight());
      renderControls();
      break;
    case 'north':
      engine?.resetNorth();
      break;
    case 'checkin':
      $('#toast').hidden = true;
      checkIn(i);
      setSheet('open');
      break;
    case 'award':
      toggleAward(d.bar, d.task, d.team);
      break;
    case 'adjust':
      store.dispatch([{ o: 'adj', bar: d.bar, tm: d.team, d: Number(d.delta) }], by());
      break;
    case 'pick':
      pickRandom();
      break;
    case 'ask-team':
      askTeam();
      break;
    case 'set-my-team':
      prefs.myTeam = d.team;
      savePrefs();
      $('#modal').hidden = true;
      render(true);
      toast(`Denne telefonen følger ${team?.name || 'laget'}.`);
      break;
    case 'modal-close':
      $('#modal').hidden = true;
      break;
    case 'share':
      shareText('Kbh Bar til bar', scoreText(), 'Kopier stillingen');
      break;
    case 'invite':
      shareText('Bli med på Kbh Bar til bar', `Bli med på bar-til-bar i København! Åpne appen og velg laget ditt:\n${inviteLink()}`, 'Kopier lenken');
      break;
    case 'copy':
      copyText(d.text);
      break;
    case 'add-team': {
      const used = new Set(S().teams.map((t) => t.color));
      const color = TEAM_COLORS.find((col) => !used.has(col)) || TEAM_COLORS[0];
      store.dispatch([{ o: 'tm', id: uid('t'), n: `Lag ${S().teams.length + 1}`, col: color, x: Date.now() }], by());
      break;
    }
    case 'remove-team':
      if (team) store.dispatch([teamEvent(team, { del: true })], by());
      if (prefs.myTeam === d.team) { prefs.myTeam = null; savePrefs(); }
      break;
    case 'team-color':
      if (team) store.dispatch([teamEvent(team, { color: d.color })], by());
      break;
    case 'remove-member': {
      const m = team?.members.find((x) => x.id === d.member);
      if (m) store.dispatch([memberEvent(m, team.id, { del: true })], by());
      break;
    }
    case 'shuffle-teams':
      shuffleTeams();
      break;
    case 'team-start': {
      const team = myTeam();
      if (!team) return askTeam();
      store.dispatch([{ o: 'stt', tm: team.id, v: Date.now() }], team.id);
      toast(`${team.name} er i gang. Lykke til!`);
      break;
    }
    case 'start-night':
      store.dispatch([{ o: 'go', v: true }, ...lockRoutes()], by());
      tab = 'route';
      render(true);
      setSheet('peek');
      if (!myTeam()) askTeam();
      else toast('God tur! Hvert lag har fått sin egen rute.');
      break;
    case 'replan':
      store.dispatch(lockRoutes(), by());
      toast('Nye ruter er laget for alle lag');
      break;
    case 'reset':
      confirmReset = true;
      render(true);
      break;
    case 'reset-cancel':
      confirmReset = false;
      render(true);
      break;
    case 'reset-confirm':
      confirmReset = false;
      store.dispatch([{ o: 'rst' }], by());
      tab = 'teams';
      render(true);
      toast('Kvelden er nullstilt for alle');
      break;
    default:
      break;
  }
}

const nameTimers = {};
function onInput(e) {
  const t = e.target;
  if (!t.dataset.teamName) return;
  const id = t.dataset.teamName;
  clearTimeout(nameTimers[id]);
  nameTimers[id] = setTimeout(() => {
    const team = teamById(id);
    const name = t.value.trim();
    if (team && name && name !== team.name) store.dispatch([teamEvent(team, { name })], by());
  }, 700);
}

function onChangeField(e) {
  const t = e.target;
  if (t.id === 'finale' && t.value !== S().finale) {
    const list = [{ o: 'fin', v: t.value }];
    if (S().setupDone) list.push(...lockRoutes(t.value));
    store.dispatch(list, by());
    toast(`Finalen er nå på ${BARS.find((b) => b.id === t.value)?.name}`);
  }
}

function onSubmit(e) {
  const form = e.target.closest('[data-add-member], [data-google-key]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.addMember) {
    addMember(form.dataset.addMember);
    return;
  }
  prefs.googleKey = $('#google-key').value.trim();
  prefs.engine = null;
  savePrefs();
  if (prefs.googleKey) toast('Laster Google 3D …');
  $('#google-key').blur();
  startEngine(preferredEngine()).then(() => render(true));
}

function onKeydown(e) {
  if (e.key === 'Escape' && !$('#modal').hidden) $('#modal').hidden = true;
  if (e.target.closest('#tabs') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const tabs = ['route', 'bar', 'score', 'teams'];
    tab = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    render(true);
    document.getElementById(`tab-${tab}`)?.focus();
  }
}

/* ---------- Oppstart ---------- */
document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('change', onChangeField);
document.addEventListener('submit', onSubmit);
document.addEventListener('keydown', onKeydown);
document.addEventListener('focusout', () => {
  setTimeout(() => {
    if (bodyDirty && !document.activeElement?.closest?.('#sheet-body')) render(true);
  }, 0);
});
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });
desktopMQ.addEventListener('change', measurePeek);
window.addEventListener('resize', () => requestAnimationFrame(measurePeek));
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && live && !live.wake) {
    try { live.wake = await navigator.wakeLock?.request('screen'); } catch { /* valgfritt */ }
  }
});

initSheetDrag();
render(true);
if (!S().setupDone && !desktopMQ.matches) setSheet('open');
startEngine(preferredEngine());
store.connect();
if (store.status === 'local') maybeAskTeam();
document.fonts?.ready.then(measurePeek);
