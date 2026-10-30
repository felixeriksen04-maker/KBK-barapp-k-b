import { HOTEL, BARS, CATEGORIES, TEAM_COLORS, FALLBACK_LEGS } from './data.js';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTER_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/';
const STORE_KEY = 'kbh-bar-til-bar:v1';
const ROUTE_KEY = 'kbh-bar-til-bar:route:v1';
const WALK_SPEED = 1.25; // m/s, rolig gruppetempo
const WALK_SPEEDS = [{ label: 'Rolig', v: 6 }, { label: 'Normal', v: 14 }, { label: 'Rask', v: 32 }];
const ARRIVE_RADIUS = 45;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopMQ = matchMedia('(min-width: 900px)');

/* ---------- Ikoner ---------- */
const ICONS = {
  beer: '<path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M6 8a3 3 0 0 1 3-4 3 3 0 0 1 5 1 2.5 2.5 0 0 1 1 3"/>',
  wine: '<path d="M8 3h8l-.5 5a3.5 3.5 0 0 1-7 0z"/><path d="M12 11.5V20"/><path d="M8.5 20h7"/>',
  shot: '<path d="M7 5h10l-1.6 14.2a1 1 0 0 1-1 .8H9.6a1 1 0 0 1-1-.8z"/><path d="M7.6 10h8.8"/>',
  cocktail: '<path d="M5 4h14l-7 8z"/><path d="M12 12v8"/><path d="M8.5 20h7"/><path d="M15 4l3-2"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  pig: '<circle cx="12" cy="13" r="7"/><ellipse cx="12" cy="15" rx="3" ry="2"/><path d="M11 15h.01M13 15h.01M9.5 11h.01M14.5 11h.01"/><path d="M6.6 8.4 5 5l3.6 1.4M17.4 8.4 19 5l-3.6 1.4"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  walk: '<circle cx="13" cy="4" r="1.6"/><path d="M10 21l2-6-2.5-2.5L10 8l3 1 2 3h3"/><path d="M9.5 12.5 7 21"/><path d="M10 8 7 10v3"/>',
  gps: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  overview: '<path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z"/><path d="M9 4v13M15 7v13"/>',
  north: '<path class="north-needle" d="M12 3l4.5 15L12 15l-4.5 3z"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  nav: '<path d="M12 2 19 20l-7-4-7 4z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  shuffle: '<path d="M3 7h3.5c4 0 6 10 10 10H21M3 17h3.5c1.6 0 2.8-1.6 3.9-3.6M14 10.2C15 8.5 15.6 7 17 7h4"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  hotel: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-5h6v5"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.2 3.2 0 0 1 0 6.4M18 14.2A6 6 0 0 1 21 20"/>',
};
const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;

/* ---------- Hjelpere ---------- */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearingBetween(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
function cumulative(coords) {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}
function pointAlong(coords, cum, d) {
  if (d <= 0) return coords[0];
  for (let i = 1; i < coords.length; i++) {
    if (cum[i] >= d) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / seg;
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t];
    }
  }
  return coords[coords.length - 1];
}
function smoothAngle(from, to, k) {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * k + 360) % 360;
}
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);
const fmtMin = (s) => `${Math.max(1, Math.round(s / 60))} min`;
function fmtClock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* privat modus e.l. */ }
}

/* ---------- Tilstand ---------- */
function defaultState() {
  return {
    teams: [
      { id: 't1', name: 'Lag 1', color: TEAM_COLORS[0], members: [] },
      { id: 't2', name: 'Lag 2', color: TEAM_COLORS[1], members: [] },
    ],
    awards: {},
    adjust: {},
    here: -1,
    visited: [],
    selected: 0,
    startTime: '18:00',
    night: null,
    setupDone: false,
  };
}
const state = Object.assign(defaultState(), readJSON(STORE_KEY) || {});
const save = () => writeJSON(STORE_KEY, state);

let tab = state.setupDone ? 'route' : 'teams';
let routeSource = 'fallback';
let legs = FALLBACK_LEGS.map((coords) => makeLeg(coords));
let confirmReset = false;

function makeLeg(coords, distance) {
  const cum = cumulative(coords);
  const dist = distance ?? cum[cum.length - 1];
  return { coords, cum, distance: dist, duration: dist / WALK_SPEED };
}

const nextIndex = () => state.here + 1; // 0..6 = bar, 7 = hjem
const stopCoord = (i) => (i >= BARS.length || i < 0 ? HOTEL.coord : BARS[i].coord);
const stopName = (i) => (i >= BARS.length || i < 0 ? HOTEL.name : BARS[i].name);
const isNight = () => (state.night ?? autoNight());
function autoNight() {
  const h = new Date().getHours();
  return h >= 16 || h < 7;
}

function schedule() {
  const [h, m] = (state.startTime || '18:00').split(':').map(Number);
  let t = h * 60 + m;
  const arrive = [];
  for (let i = 0; i < BARS.length; i++) {
    t += legs[i].duration / 60;
    arrive.push(t);
    t += BARS[i].stay;
  }
  t += legs[BARS.length].duration / 60;
  return { arrive, home: t };
}

function teamScore(teamId) {
  let s = 0;
  for (const bar of BARS) s += barScore(bar, teamId);
  return s;
}
function barScore(bar, teamId) {
  let s = 0;
  const a = state.awards[bar.id] || {};
  for (const task of bar.tasks) if ((a[task.id] || []).includes(teamId)) s += task.points;
  return s + (state.adjust[bar.id]?.[teamId] || 0);
}
function ranking() {
  return state.teams
    .map((t) => ({ ...t, score: teamScore(t.id) }))
    .sort((a, b) => b.score - a.score);
}

/* ---------- Kart ---------- */
let map = null;
let markers = [];
let walker = null;
let meMarker = null;
let orbit = null;

function initMap() {
  if (!window.maplibregl) return showMapFallback('Kartbiblioteket ble ikke lastet. Sjekk nettet og last inn siden på nytt.');
  try {
    map = new maplibregl.Map({
      container: 'map',
      style: STYLE_URL,
      center: [12.5735, 55.678],
      zoom: 13.4,
      pitch: 20,
      bearing: 0,
      maxPitch: 85,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });
  } catch (err) {
    console.error(err);
    return showMapFallback('3D-kartet trenger WebGL. Prøv en annen nettleser. Rute, oppgaver og poeng virker uansett.');
  }

  map.on('style.load', () => {
    if (isNight()) applyNightPalette();
    applyAtmosphere();
    addRouteLayers();
  });
  map.once('load', () => {
    updatePadding();
    flyOverview(true);
  });
  map.on('error', (e) => {
    if (e?.error?.message && /style/i.test(e.error.message)) toast('Fikk ikke lastet kartet. Sjekk nettforbindelsen.');
  });
  const zoomClasses = () => {
    const z = map.getZoom();
    $('#map').classList.toggle('labels-off', z < 13.6);
    $('#map').classList.toggle('labels-few', z < 16.6);
  };
  map.on('zoom', zoomClasses);
  zoomClasses();
  map.on('rotate', () => {
    const n = document.querySelector('#btn-north .north-needle');
    if (n) n.style.transform = `rotate(${-map.getBearing()}deg)`;
  });
  const stopAuto = (e) => {
    if (!e.originalEvent) return;
    stopOrbit();
    if (walk && walk.playing) { walk.playing = false; walk.looking = true; renderWalkHud(); }
    if (live && live.follow) { live.follow = false; renderLiveHud(); }
  };
  for (const ev of ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart']) map.on(ev, stopAuto);

  addMarkers();
}

function showMapFallback(msg) {
  $('#map').innerHTML = `<div class="map-fallback"><p>${esc(msg)}</p></div>`;
}

function firstSymbolId() {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
}

function applyNightPalette() {
  for (const layer of map.getStyle().layers) {
    const { id, type } = layer;
    try {
      if (type === 'background') map.setPaintProperty(id, 'background-color', '#0c1222');
      else if (type === 'fill') {
        let c = '#121a2b';
        if (/water/.test(id)) c = '#08182b';
        else if (/park|wood|grass|forest|landcover|green|cemetery|pitch|garden/.test(id)) c = '#101e19';
        else if (/building/.test(id)) c = '#192136';
        map.setPaintProperty(id, 'fill-color', c);
        if (!/water/.test(id)) map.setPaintProperty(id, 'fill-opacity', 1);
      } else if (type === 'line') {
        let c = '#283250';
        if (/casing/.test(id)) c = '#141b2c';
        else if (/water|river|canal|stream|ditch/.test(id)) c = '#0d2440';
        else if (/rail|transit/.test(id)) c = '#2b3045';
        else if (/boundary|admin/.test(id)) c = '#352f4d';
        else if (/motorway|trunk|primary/.test(id)) c = '#3f4258';
        else if (/path|pedestrian|footway|cycle|steps/.test(id)) c = '#343a52';
        map.setPaintProperty(id, 'line-color', c);
      } else if (type === 'fill-extrusion') {
        map.setPaintProperty(id, 'fill-extrusion-color', [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
          0, '#1a2236', 15, '#212b45', 30, '#283454', 60, '#303e63',
        ]);
        map.setPaintProperty(id, 'fill-extrusion-opacity', 0.97);
      } else if (type === 'symbol') {
        if (layer.layout?.['text-field']) {
          map.setPaintProperty(id, 'text-color', /water/.test(id) ? '#4f7aa8' : '#c3cbe0');
          map.setPaintProperty(id, 'text-halo-color', '#0a0f1d');
          map.setPaintProperty(id, 'text-halo-width', 1.4);
        }
        if (layer.layout?.['icon-image']) map.setPaintProperty(id, 'icon-opacity', 0.55);
      }
    } catch { /* noen lag tåler ikke alle egenskaper */ }
  }
}

function applyAtmosphere() {
  const night = isNight();
  try {
    map.setSky(night
      ? { 'sky-color': '#060a16', 'horizon-color': '#2b2140', 'fog-color': '#0c1222', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.75, 'atmosphere-blend': 0 }
      : { 'sky-color': '#76a9de', 'horizon-color': '#dfe9f4', 'fog-color': '#eef2f6', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0 });
  } catch { /* eldre motor uten himmel */ }
  map.setLight({ anchor: 'map', color: night ? '#ffd8a8' : '#ffffff', intensity: night ? 0.32 : 0.45, position: [1.4, 210, 35] });
}

function routeGeoJSON() {
  const next = nextIndex();
  return {
    type: 'FeatureCollection',
    features: legs.map((leg, i) => {
      const st = i < next ? 'done' : i === next ? 'next' : 'future';
      return {
        type: 'Feature',
        properties: { state: st, color: st === 'next' ? '#ffb547' : st === 'done' ? '#7f93bd' : '#d4daea' },
        geometry: { type: 'LineString', coordinates: leg.coords },
      };
    }),
  };
}

function circle(center, radius, steps = 28) {
  const [lng, lat] = center;
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.cos(toRad(lat)));
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return [ring];
}

function beamsGeoJSON() {
  const next = nextIndex();
  const features = [];
  BARS.forEach((bar, i) => {
    const color = CATEGORIES[bar.cat].color;
    const done = state.visited.includes(bar.id) && i !== state.here;
    const h = i === next ? 120 : i === state.here ? 90 : done ? 26 : 62;
    features.push({ type: 'Feature', properties: { color, base: 0, height: h }, geometry: { type: 'Polygon', coordinates: circle(bar.coord, 2.6) } });
    features.push({ type: 'Feature', properties: { color, base: h - 5, height: h }, geometry: { type: 'Polygon', coordinates: circle(bar.coord, 7.5) } });
  });
  return { type: 'FeatureCollection', features };
}

function glowGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: BARS.map((bar, i) => ({
      type: 'Feature',
      properties: { color: CATEGORIES[bar.cat].color, next: i === nextIndex() ? 1 : 0 },
      geometry: { type: 'Point', coordinates: bar.coord },
    })),
  };
}

function addRouteLayers() {
  const before = firstSymbolId();
  map.addSource('route', { type: 'geojson', data: routeGeoJSON() });
  map.addSource('beams', { type: 'geojson', data: beamsGeoJSON() });
  map.addSource('glow', { type: 'geojson', data: glowGeoJSON() });

  map.addLayer({
    id: 'bar-glow', type: 'circle', source: 'glow',
    paint: {
      'circle-color': ['get', 'color'], 'circle-blur': 1, 'circle-pitch-alignment': 'map',
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 13, ['case', ['==', ['get', 'next'], 1], 10, 6], 19, ['case', ['==', ['get', 'next'], 1], 260, 150]],
      'circle-opacity': ['case', ['==', ['get', 'next'], 1], 0.55, 0.32],
    },
  }, before);
  map.addLayer({
    id: 'route-glow', type: 'line', source: 'route', filter: ['!=', ['get', 'state'], 'future'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 8, 19, 30],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 13, 5, 19, 18],
      'line-opacity': ['case', ['==', ['get', 'state'], 'next'], 0.5, 0.12],
    },
  }, before);
  map.addLayer({
    id: 'route-future', type: 'line', source: 'route', filter: ['==', ['get', 'state'], 'future'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.6, 19, 5], 'line-opacity': 0.6, 'line-dasharray': [1.2, 1.6] },
  }, before);
  map.addLayer({
    id: 'route-line', type: 'line', source: 'route', filter: ['!=', ['get', 'state'], 'future'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2.4, 19, 9],
      'line-opacity': ['case', ['==', ['get', 'state'], 'done'], 0.45, 1],
    },
  }, before);
  map.addLayer({
    id: 'beams', type: 'fill-extrusion', source: 'beams',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-opacity': 0.88,
    },
  }, before);
}

function refreshMapData() {
  if (!map || !map.getSource('route')) return;
  map.getSource('route').setData(routeGeoJSON());
  map.getSource('beams').setData(beamsGeoJSON());
  map.getSource('glow').setData(glowGeoJSON());
}

function addMarkers() {
  markers.forEach((m) => m.remove());
  markers = [];
  const hotelEl = document.createElement('button');
  hotelEl.type = 'button';
  hotelEl.className = 'pin pin-hotel';
  hotelEl.setAttribute('aria-label', 'Imperial Hotel, start og slutt');
  hotelEl.innerHTML = `<span class="pin-head">${icon('hotel')}</span><span class="pin-label">${esc(HOTEL.name)}</span>`;
  hotelEl.addEventListener('click', (e) => { e.stopPropagation(); flyTo(HOTEL.coord); });
  markers.push(new maplibregl.Marker({ element: hotelEl, anchor: 'bottom' }).setLngLat(HOTEL.coord).addTo(map));

  BARS.forEach((bar, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.dataset.i = i;
    el.style.setProperty('--c', CATEGORIES[bar.cat].color);
    el.setAttribute('aria-label', `${i + 1}. ${bar.name}, ${CATEGORIES[bar.cat].label}`);
    el.innerHTML = `<span class="pin-head"><span class="pin-num">${i + 1}</span></span><span class="pin-label">${esc(bar.name)}</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); focusBar(i); });
    markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(bar.coord).addTo(map));
  });
  updateMarkers();
}

function updateMarkers() {
  document.querySelectorAll('.pin[data-i]').forEach((el) => {
    const i = Number(el.dataset.i);
    el.classList.toggle('is-next', i === nextIndex());
    el.classList.toggle('is-here', i === state.here);
    el.classList.toggle('is-done', state.visited.includes(BARS[i].id) && i !== state.here);
    el.classList.toggle('is-focus', i === peekBar);
  });
}

function updatePadding() {
  if (!map) return;
  const sheet = $('#sheet');
  if (desktopMQ.matches) {
    map.setPadding({ top: 70, bottom: 30, left: sheet.offsetWidth + 32, right: 70 });
  } else {
    const peekH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek-h')) || 200;
    map.setPadding({ top: 70, bottom: peekH + 10, left: 10, right: 60 });
  }
}

function allBounds() {
  const b = new maplibregl.LngLatBounds(HOTEL.coord, HOTEL.coord);
  BARS.forEach((bar) => b.extend(bar.coord));
  legs.forEach((l) => l.coords.forEach((c) => b.extend(c)));
  return b;
}

function flyOverview(intro = false) {
  if (!map) return;
  stopModes();
  // Ruta går øst–vest, så på en stående mobilskjerm snus kartet slik at den fyller høyden.
  // Zoomen velges slik at hele ruta holder seg i bildet mens kameraet sirkler rundt.
  const portrait = map.getContainer().clientHeight > map.getContainer().clientWidth * 1.2;
  const bearing = portrait ? -72 : -24;
  const bounds = allBounds();
  const cams = [bearing, bearing + 90].map((b) => map.cameraForBounds(bounds, { padding: 24, bearing: b })).filter(Boolean);
  if (!cams.length) return;
  const zoom = Math.min(...cams.map((c) => c.zoom)) + 0.35;
  map.stop();
  if (!reduceMotion) map.once('moveend', () => { startOrbit(); setControlState(); });
  map.flyTo({ center: bounds.getCenter(), zoom, pitch: 56, bearing, duration: reduceMotion ? 0 : intro ? 2600 : 1500, essential: true });
  setControlState();
}

function startOrbit() {
  stopOrbit();
  let last = performance.now();
  const step = (now) => {
    if (!orbit) return;
    const dt = (now - last) / 1000;
    last = now;
    map.setBearing(map.getBearing() + dt * 3);
    orbit = requestAnimationFrame(step);
  };
  orbit = requestAnimationFrame(step);
}
function stopOrbit() {
  if (orbit) cancelAnimationFrame(orbit);
  orbit = null;
}

function flyTo(coord, opts = {}) {
  if (!map) return;
  stopOrbit();
  map.flyTo({ center: coord, zoom: 17.6, pitch: 62, bearing: map.getBearing(), duration: reduceMotion ? 0 : 1600, essential: true, ...opts });
}

/* ---------- Gangruter fra OpenStreetMap ---------- */
async function loadRoutes() {
  const cached = readJSON(ROUTE_KEY);
  if (cached?.legs?.length === BARS.length + 1) {
    applyLegs(cached.legs);
    return;
  }
  const pts = [HOTEL.coord, ...BARS.map((b) => b.coord), HOTEL.coord];
  const url = `${ROUTER_URL}${pts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';')}?overview=false&steps=true&geometries=geojson`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route || route.legs.length !== pts.length - 1) throw new Error('Ingen rute');
    const out = route.legs.map((leg, i) => {
      const coords = [pts[i]];
      for (const step of leg.steps) {
        for (const c of step.geometry.coordinates) {
          const last = coords[coords.length - 1];
          if (last[0] !== c[0] || last[1] !== c[1]) coords.push(c);
        }
      }
      coords.push(pts[i + 1]);
      return { coords, distance: leg.distance };
    });
    writeJSON(ROUTE_KEY, { legs: out, at: Date.now() });
    applyLegs(out);
  } catch (err) {
    console.warn('Bruker omtrentlige ruter:', err);
  }
}
function applyLegs(raw) {
  legs = raw.map((l) => makeLeg(l.coords, l.distance));
  routeSource = 'osm';
  refreshMapData();
  render();
}

/* ---------- Gåtur i 3D ---------- */
let walk = null;
let speedIdx = 1;

function startWalk(legIndex) {
  if (!map) return toast('3D-kartet er ikke tilgjengelig her.');
  stopModes();
  peekBar = null;
  const leg = legs[legIndex];
  walk = {
    legIndex, coords: leg.coords, cum: leg.cum, total: leg.cum[leg.cum.length - 1],
    d: 0, playing: true, looking: false, last: performance.now(),
    bearing: bearingBetween(leg.coords[0], pointAlong(leg.coords, leg.cum, 40)),
  };
  if (!walker) {
    const el = document.createElement('div');
    el.className = 'walker';
    walker = new maplibregl.Marker({ element: el });
  }
  walker.setLngLat(leg.coords[0]).addTo(map);
  setSheet('peek');
  $('#sheet').dataset.mode = 'walk';
  $('#peek').hidden = true;
  $('#tabs').hidden = true;
  $('#walk-hud').hidden = false;
  renderWalkHud();
  measurePeek();
  map.stop();
  map.once('moveend', () => {
    if (!walk) return;
    walk.last = performance.now();
    walk.raf = requestAnimationFrame(walkFrame);
  });
  map.flyTo({ center: leg.coords[0], zoom: 18.3, pitch: 74, bearing: walk.bearing, duration: reduceMotion ? 0 : 1800, essential: true });
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
    map.jumpTo({ center: p, bearing: walk.bearing, pitch: 74, zoom: 18.3 });
    walker.setLngLat(p);
    if (Math.floor(now / 120) !== walk.hudTick) { walk.hudTick = Math.floor(now / 120); renderWalkHud(); }
    if (walk.d >= walk.total) return finishWalk();
  }
  walk.raf = requestAnimationFrame(walkFrame);
}

function finishWalk() {
  const target = walk.legIndex;
  const bearing = walk.bearing;
  exitWalk(false);
  if (target >= BARS.length) {
    flyTo(HOTEL.coord, { bearing: bearing + 70, zoom: 17.8, pitch: 64, duration: reduceMotion ? 0 : 3500 });
    toast('Fremme ved Imperial Hotel. God natt!');
    return;
  }
  const bar = BARS[target];
  flyTo(bar.coord, { bearing: bearing + 80, zoom: 17.9, pitch: 64, duration: reduceMotion ? 0 : 3800 });
  state.selected = target;
  save();
  render();
  toast(`Fremme ved ${bar.name}`, state.here === target ? null : { label: 'Sjekk inn', action: 'checkin', i: target });
}

function exitWalk(reset = true) {
  if (!walk) return;
  cancelAnimationFrame(walk.raf);
  walk = null;
  walker?.remove();
  delete $('#walk-hud').dataset.leg;
  delete $('#walk-hud').dataset.mode;
  delete $('#sheet').dataset.mode;
  $('#peek').hidden = false;
  $('#tabs').hidden = false;
  $('#walk-hud').hidden = true;
  measurePeek();
  if (reset) map.easeTo({ pitch: 60, zoom: 17, duration: 800 });
  setControlState();
}

// HUD-ene bygges én gang og oppdateres på stedet, så knappene ikke byttes ut midt i et trykk.
function renderWalkHud() {
  if (!walk) return;
  const hud = $('#walk-hud');
  if (hud.dataset.leg !== String(walk.legIndex)) {
    const to = walk.legIndex >= BARS.length ? HOTEL.name : BARS[walk.legIndex].name;
    hud.dataset.leg = walk.legIndex;
    hud.innerHTML = `
      <div class="walk-top">
        <span class="walk-title">Gåtur til ${esc(to)}</span>
        <span class="walk-left" id="walk-left"></span>
      </div>
      <div class="walk-bar" aria-hidden="true"><span id="walk-progress"></span></div>
      <div class="walk-controls">
        <button class="btn btn-primary" type="button" data-action="walk-toggle" id="walk-toggle"></button>
        <button class="btn" type="button" data-action="walk-speed" id="walk-speed"></button>
        <button class="btn btn-ghost" type="button" data-action="walk-exit" aria-label="Avslutt gåturen">${icon('close')}</button>
      </div>
      <div class="walk-hint" id="walk-hint"></div>`;
  }
  const left = walk.total - walk.d;
  $('#walk-left').textContent = `${fmtDist(left)} · ${fmtMin(left / WALK_SPEED)}`;
  $('#walk-progress').style.width = `${(walk.total ? (walk.d / walk.total) * 100 : 100).toFixed(1)}%`;
  const mode = `${walk.playing}|${walk.looking}|${speedIdx}`;
  if (hud.dataset.mode !== mode) {
    hud.dataset.mode = mode;
    $('#walk-toggle').innerHTML = walk.playing ? `${icon('pause')} Pause` : `${icon('play')} ${walk.looking ? 'Gå videre' : 'Fortsett'}`;
    $('#walk-speed').innerHTML = `${icon('walk')} ${WALK_SPEEDS[speedIdx].label}`;
    $('#walk-hint').textContent = walk.looking ? 'Du ser deg rundt. Dra, vri og vipp kartet med to fingre.' : 'Dra i kartet for å stoppe og se deg rundt.';
  }
}

/* ---------- Live: GPS og kompass ---------- */
let live = null;

async function startLive() {
  if (!map) return toast('3D-kartet er ikke tilgjengelig her.');
  if (!('geolocation' in navigator)) return toast('Nettleseren støtter ikke posisjon.');
  stopModes();
  live = { follow: true, pos: null, acc: null, compass: null, course: null, cam: null, bearing: map.getBearing(), arrived: new Set(), last: performance.now() };

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch { /* kompass avslått, GPS-kurs brukes */ }
  }
  if (!live) return;
  window.addEventListener('deviceorientationabsolute', onOrient, true);
  window.addEventListener('deviceorientation', onOrient, true);
  live.watch = navigator.geolocation.watchPosition(onPos, onPosError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
  try { live.wake = await navigator.wakeLock?.request('screen'); } catch { /* valgfritt */ }

  if (!meMarker) {
    const el = document.createElement('div');
    el.className = 'me no-heading';
    el.innerHTML = '<div class="me-cone"></div><div class="me-dot"></div>';
    meMarker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' });
  }
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
  meMarker.setLngLat(live.pos);
  if (first) {
    meMarker.addTo(map);
    live.cam = live.pos;
    if (haversine(live.pos, HOTEL.coord) > 15000) toast('Du er ikke i nærheten av ruta, men live-visningen følger deg likevel.');
  }
  const ni = nextIndex();
  if (ni < BARS.length && !live.arrived.has(ni) && haversine(live.pos, BARS[ni].coord) < ARRIVE_RADIUS) {
    live.arrived.add(ni);
    toast(`Dere er ved ${BARS[ni].name}!`, { label: 'Sjekk inn', action: 'checkin', i: ni });
  }
  renderLiveHud();
}

function onPosError(err) {
  const msg = err.code === 1
    ? 'Posisjon er blokkert. Gi nettleseren tilgang til posisjon i innstillingene.'
    : 'Fant ikke posisjonen din ennå. Gå gjerne ut under åpen himmel.';
  toast(msg);
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
    map.jumpTo({ center: live.cam, bearing: live.bearing, pitch: 68, zoom: 18.1 });
  }
  if (meMarker) {
    meMarker.getElement().classList.toggle('no-heading', heading == null);
    if (heading != null) meMarker.setRotation(heading);
  }
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
      <button class="icon-btn" type="button" data-action="live-exit" aria-label="Avslutt live-visning">${icon('close')}</button>`;
  }
  const ni = nextIndex();
  const target = stopCoord(ni);
  let dist = '–';
  let arrow = 0;
  let meta = 'Venter på GPS …';
  if (live.pos) {
    dist = fmtDist(haversine(live.pos, target));
    arrow = bearingBetween(live.pos, target) - (map ? map.getBearing() : 0);
    meta = `±${Math.round(live.acc || 0)} m · ${live.compass != null ? 'kompass på' : live.course != null ? 'retning fra GPS' : 'uten kompass'}`;
  }
  $('#live-to').textContent = `Til ${stopName(ni)}`;
  $('#live-dist').textContent = dist;
  $('#live-meta').textContent = meta;
  $('#live-follow').hidden = live.follow;
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
  meMarker?.remove();
  $('#live-hud').hidden = true;
  delete $('#live-hud').dataset.built;
  setControlState();
}

function stopModes() {
  stopOrbit();
  exitWalk(false);
  exitLive();
}

/* ---------- Handlinger ---------- */
let peekBar = null;

function selectBar(i) {
  state.selected = i;
  peekBar = null;
  save();
  tab = 'bar';
  render();
  setSheet('open');
}

function focusBar(i) {
  if (walk || live) return selectBar(i);
  state.selected = i;
  peekBar = i === nextIndex() ? null : i;
  save();
  tab = 'bar';
  render();
  setSheet('peek');
  stopModes();
  flyTo(BARS[i].coord);
}

function checkIn(i) {
  peekBar = null;
  state.here = i;
  if (!state.visited.includes(BARS[i].id)) state.visited.push(BARS[i].id);
  state.selected = i;
  save();
  tab = 'bar';
  refreshMapData();
  render();
  toast(i === BARS.length - 1 ? `Sjekket inn på ${BARS[i].name}, siste stopp!` : `Sjekket inn på ${BARS[i].name}. Skål!`);
}

function toggleAward(barId, taskId, teamId) {
  const a = (state.awards[barId] ||= {});
  const list = (a[taskId] ||= []);
  const idx = list.indexOf(teamId);
  if (idx >= 0) list.splice(idx, 1); else list.push(teamId);
  save();
  render();
}

function adjust(barId, teamId, delta) {
  const a = (state.adjust[barId] ||= {});
  a[teamId] = (a[teamId] || 0) + delta;
  save();
  render();
}

function allParticipants() {
  const people = [];
  state.teams.forEach((t) => t.members.forEach((m) => people.push({ name: m, team: t })));
  return people;
}

function pickRandom() {
  const people = allParticipants();
  const pool = people.length ? people : state.teams.map((t) => ({ name: t.name, team: t }));
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
  const nameEl = $('#pick-name');
  const teamEl = $('#pick-team');
  const final = pool[Math.floor(Math.random() * pool.length)];
  let n = 0;
  const total = reduceMotion ? 0 : 14;
  const tick = () => {
    const p = n < total ? pool[Math.floor(Math.random() * pool.length)] : final;
    nameEl.textContent = p.name;
    teamEl.innerHTML = people.length ? `<span class="swatch" style="--team:${p.team.color}"></span>${esc(p.team.name)}` : '';
    if (n++ < total) setTimeout(tick, 50 + n * 9);
  };
  tick();
}

function scoreText() {
  const done = state.visited.length;
  const lines = ranking().map((t, i) => `${i + 1}. ${t.name}: ${t.score} p`);
  const ni = nextIndex();
  const next = ni < BARS.length ? `Neste: ${BARS[ni].name} (${CATEGORIES[BARS[ni].cat].label})` : 'Runden er ferdig. Hjem til Imperial Hotel!';
  return `Kbh Bar til bar: stilling etter ${done} av ${BARS.length} barer\n${lines.join('\n')}\n${next}`;
}

async function shareScore() {
  const text = scoreText();
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Kbh Bar til bar', text });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Stillingen er kopiert. Lim den inn i gruppechatten.');
  } catch {
    showTextModal('Kopier stillingen', text);
  }
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
  const ta = $('#share-text');
  ta.focus();
  ta.select();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Adressen er kopiert');
  } catch {
    showTextModal('Adresse', text);
  }
}

function shuffleTeams() {
  const people = allParticipants().map((p) => p.name);
  if (people.length < 2) return toast('Legg til deltakere først.');
  for (let i = people.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [people[i], people[j]] = [people[j], people[i]];
  }
  state.teams.forEach((t) => { t.members = []; });
  people.forEach((p, i) => state.teams[i % state.teams.length].members.push(p));
  save();
  render();
  toast('Lagene er blandet');
}

function addMember(teamId) {
  const input = document.getElementById(`member-${teamId}`);
  const name = input?.value.trim();
  if (!name) return;
  const team = state.teams.find((t) => t.id === teamId);
  team.members.push(name.slice(0, 40));
  save();
  render();
  document.getElementById(`member-${teamId}`)?.focus();
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, action = null) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="btn btn-sm" type="button" data-action="${action.action}" data-i="${action.i ?? ''}">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 9000 : 3800);
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
  const handles = [$('#sheet-grab'), $('#peek'), $('#walk-hud')];
  const onDown = (e) => {
    if (desktopMQ.matches || e.target.closest('button, a, input')) return;
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
  handles.forEach((h) => {
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
function barStatus(i) {
  if (i === state.here) return '<span class="status is-here">Her nå</span>';
  if (state.visited.includes(BARS[i].id)) return '<span class="status is-done">Besøkt</span>';
  if (i === nextIndex()) return '<span class="status is-next">Neste</span>';
  return '';
}
const streetViewUrl = (c) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c[1]},${c[0]}`;
const directionsUrl = (bar) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${bar.name}, ${bar.address}`)}&travelmode=walking`;

function render() {
  renderTop();
  renderControls();
  renderPeek();
  renderTabs();
  renderBody();
  updateMarkers();
  requestAnimationFrame(measurePeek);
}

function renderTop() {
  $('#progress').textContent = `${state.visited.length}/${BARS.length}`;
  $('#progress').setAttribute('aria-label', `${state.visited.length} av ${BARS.length} barer besøkt`);
  const lead = ranking()[0];
  const anyPoints = ranking().some((t) => t.score !== 0);
  $('#leader-chip').innerHTML = lead
    ? `${icon('trophy')}<span class="leader-name">${anyPoints ? esc(lead.name) : 'Poeng'}</span><span class="leader-pts">${anyPoints ? lead.score : '0'}</span>`
    : `${icon('trophy')}<span class="leader-name">Poeng</span>`;
}

function renderControls() {
  $('#map-controls').innerHTML = `
    <button id="btn-overview" class="ctl" type="button" data-action="overview" aria-label="Se hele ruta i 3D" title="Hele ruta i 3D" aria-pressed="${orbit ? 'true' : 'false'}">${icon('overview')}</button>
    <button id="btn-live" class="ctl" type="button" data-action="live" aria-label="Live-posisjon med kompass" title="Live: GPS og kompass" aria-pressed="${live ? 'true' : 'false'}">${icon('gps')}</button>
    <button id="btn-daynight" class="ctl" type="button" data-action="daynight" aria-label="${isNight() ? 'Bytt til dagkart' : 'Bytt til nattkart'}" title="Dag/natt">${icon(isNight() ? 'sun' : 'moon')}</button>
    <button id="btn-north" class="ctl" type="button" data-action="north" aria-label="Snu kartet med nord opp" title="Nord opp">${icon('north')}</button>`;
  const n = document.querySelector('#btn-north .north-needle');
  if (n && map) { n.style.transformOrigin = '12px 12px'; n.style.transform = `rotate(${-map.getBearing()}deg)`; }
}
function setControlState() {
  $('#btn-overview')?.setAttribute('aria-pressed', orbit ? 'true' : 'false');
  $('#btn-live')?.setAttribute('aria-pressed', live ? 'true' : 'false');
}

function renderPeek() {
  const sched = schedule();
  const ni = nextIndex();
  let html;
  if (ni >= BARS.length) {
    const lead = ranking()[0];
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:var(--sodium)">${icon('trophy')}</div>
        <div class="peek-text">
          <div class="eyebrow">Runden er ferdig</div>
          <h2 class="peek-title">${lead ? `${esc(lead.name)} vant!` : 'Godt jobba!'}</h2>
          <div class="peek-meta">Hjem til ${esc(HOTEL.name)} · ${fmtDist(legs[BARS.length].distance)} · ${fmtMin(legs[BARS.length].duration)}</div>
        </div>
        <div class="peek-actions">
          <button class="btn btn-primary" type="button" data-action="walk" data-leg="${BARS.length}">${icon('walk')} Gåtur hjem</button>
          <button class="btn" type="button" data-action="tab" data-tab="score">${icon('trophy')} Poeng</button>
        </div>
      </div>`;
  } else if (peekBar != null) {
    const bar = BARS[peekBar];
    const cat = CATEGORIES[bar.cat];
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:${cat.color}">${icon(cat.icon)}<span class="badge-num">${peekBar + 1}</span></div>
        <div class="peek-text">
          <div class="eyebrow">Stopp ${peekBar + 1} · ca. ${fmtClock(sched.arrive[peekBar])}</div>
          <h2 class="peek-title">${esc(bar.name)}</h2>
          <div class="peek-meta">${esc(cat.label)} · ${esc(bar.address)}</div>
        </div>
        <div class="peek-actions">
          <button class="btn btn-primary" type="button" data-action="select-bar" data-i="${peekBar}">Se baren</button>
          <button class="btn" type="button" data-action="walk" data-leg="${peekBar}">${icon('walk')} Gåtur hit</button>
          <button class="btn btn-ghost" type="button" data-action="peek-clear" aria-label="Tilbake til neste stopp">${icon('close')}</button>
        </div>
      </div>`;
  } else {
    const bar = BARS[ni];
    const cat = CATEGORIES[bar.cat];
    const leg = legs[ni];
    const from = state.here < 0 ? 'Start fra hotellet' : `Fra ${BARS[state.here].name}`;
    html = `
      <div class="peek-card">
        <div class="badge" style="--c:${cat.color}">${icon(cat.icon)}<span class="badge-num">${ni + 1}</span></div>
        <div class="peek-text">
          <div class="eyebrow">Neste stopp · <b>ca. ${fmtClock(sched.arrive[ni])}</b></div>
          <h2 class="peek-title">${esc(bar.name)}</h2>
          <div class="peek-meta">${esc(cat.label)} · ${fmtDist(leg.distance)} · ${fmtMin(leg.duration)} å gå · ${esc(from)}</div>
        </div>
        <div class="peek-actions">
          <button class="btn btn-primary" type="button" data-action="walk" data-leg="${ni}">${icon('walk')} 3D-gåtur</button>
          <button class="btn" type="button" data-action="live">${icon('gps')} Gå live</button>
          <button class="btn" type="button" data-action="select-bar" data-i="${ni}">Oppgaver</button>
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
  const sched = schedule();
  const totalDist = legs.reduce((s, l) => s + l.distance, 0);
  const ni = nextIndex();
  const legRow = (i) => {
    const st = i < ni ? 'is-done' : i === ni ? 'is-next' : '';
    return `
      <li class="tl-leg">
        <span class="tl-leg-line ${st}"></span>
        <span class="tl-leg-info">${fmtDist(legs[i].distance)} · ${fmtMin(legs[i].duration)} gange
          <button type="button" data-action="walk" data-leg="${i}">${icon('walk')} Gå i 3D</button>
        </span>
      </li>`;
  };
  const stops = BARS.map((bar, i) => {
    const c = CATEGORIES[bar.cat];
    const done = state.visited.includes(bar.id);
    return `
      ${legRow(i)}
      <li class="tl-stop">
        <span class="tl-dot ${done ? 'is-done' : ''}" style="--c:${c.color}">${i + 1}</span>
        <button class="tl-main" type="button" data-action="select-bar" data-i="${i}">
          <span class="tl-name">${esc(bar.name)}</span>
          <span class="tl-sub">${esc(c.label)} · ${esc(bar.tagline)}</span>
        </button>
        <span class="tl-time">${barStatus(i) || `ca. ${fmtClock(sched.arrive[i])}`}</span>
      </li>`;
  }).join('');
  return `
    <div class="section">
      <h2 class="h-display">Sju barer, én kveld</h2>
      <p class="lede">Ruta starter og slutter ved Imperial Hotel og går gjennom Indre By og Latinerkvarteret. Trykk på en bar for detaljer, eller «Gå i 3D» for å se veien før dere går.</p>
    </div>
    <div class="stats">
      <div class="stat"><b>${fmtDist(totalDist)}</b><span>gange totalt</span></div>
      <div class="stat"><b>${fmtClock(sched.home)}</b><span>hjemme ca.</span></div>
      <div class="stat"><b>${BARS.length}</b><span>barer</span></div>
    </div>
    <ol class="timeline" aria-label="Ruta">
      <li class="tl-stop">
        <span class="tl-dot" style="--c:var(--text)">${icon('hotel')}</span>
        <button class="tl-main" type="button" data-action="fly-hotel">
          <span class="tl-name">${esc(HOTEL.name)}</span>
          <span class="tl-sub">Start · ${esc(HOTEL.address)}</span>
        </button>
        <span class="tl-time">${esc(state.startTime)}</span>
      </li>
      ${stops}
      ${legRow(BARS.length)}
      <li class="tl-stop">
        <span class="tl-dot" style="--c:var(--text)">${icon('hotel')}</span>
        <button class="tl-main" type="button" data-action="fly-hotel">
          <span class="tl-name">Hjem til hotellet</span>
          <span class="tl-sub">Slutt · ${esc(HOTEL.address)}</span>
        </button>
        <span class="tl-time">ca. ${fmtClock(sched.home)}</span>
      </li>
    </ol>
    <button class="btn btn-block" type="button" data-action="overview">${icon('overview')} Se hele ruta i 3D</button>
    <p class="note">${routeSource === 'osm'
      ? 'Gangrutene er beregnet langs ekte gater fra OpenStreetMap.'
      : 'Rutene er omtrentlige til appen får kontakt med rutetjenesten. Kartet og barene stemmer uansett.'}
      Tidene regnes ut fra starttid og ca. ${BARS.reduce((s, b) => s + b.stay, 0) / BARS.length | 0} min per bar. Endre starttid under <b>Lag</b>.</p>`;
}

function viewBar() {
  const i = state.selected ?? 0;
  const bar = BARS[i];
  const cat = CATEGORIES[bar.cat];
  const sched = schedule();
  const teams = state.teams;
  const awards = state.awards[bar.id] || {};
  const tasks = bar.tasks.map((task) => {
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
  const adj = state.adjust[bar.id] || {};
  const isHere = state.here === i;
  const isNext = nextIndex() === i;
  const nextBar = BARS[i + 1];
  const primary = isHere
    ? (nextBar
      ? `<button class="btn btn-primary btn-block" type="button" data-action="walk" data-leg="${i + 1}">${icon('walk')} Videre til ${esc(nextBar.name)}</button>`
      : `<button class="btn btn-primary btn-block" type="button" data-action="tab" data-tab="score">${icon('trophy')} Se kveldens vinner</button>`)
    : `<button class="btn ${isNext ? 'btn-primary' : ''} btn-block" type="button" data-action="checkin" data-i="${i}">${icon('check')} Sjekk inn her</button>`;

  return `
    <div class="bar-head">
      <div class="bar-head-row">${catChip(bar.cat)} ${barStatus(i)} <span class="eyebrow">Stopp ${i + 1} av ${BARS.length} · ca. ${fmtClock(sched.arrive[i])}</span></div>
      <h2 class="h-display">${esc(bar.name)}</h2>
      <div class="address">${icon('map')}<span>${esc(bar.address)}</span>
        <button class="icon-btn" type="button" data-action="copy" data-text="${esc(`${bar.name}, ${bar.address}`)}" aria-label="Kopier adressen">${icon('copy')}</button>
      </div>
      <p class="lede">${esc(bar.about)}</p>
    </div>
    ${primary}
    <div class="action-grid">
      <button class="btn" type="button" data-action="walk" data-leg="${i}">${icon('walk')} 3D-gåtur hit</button>
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
      <ul class="tasks">${tasks}</ul>
    </section>
    <section class="section">
      <h3 class="section-title">Dommerpoeng</h3>
      <p class="muted small" style="margin:0">Bonus eller straff fra dommeren, for eksempel for beste antrekk eller juks.</p>
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
  const finished = nextIndex() >= BARS.length;
  const lead = ranked[0];
  const tie = ranked.length > 1 && ranked[0].score === ranked[1].score;
  let prevScore = null;
  let rank = 0;
  const rows = ranked.map((t, idx) => {
    if (t.score !== prevScore) { rank = idx + 1; prevScore = t.score; }
    return `
      <li class="board-row ${rank === 1 && t.score > 0 ? 'is-lead' : ''}" style="--team:${t.color};--w:${Math.max(0, (t.score / max) * 100).toFixed(1)}%">
        <span class="board-rank">${rank}</span>
        <span class="board-team">
          <span class="board-name"><span class="swatch" style="--team:${t.color}"></span><span>${esc(t.name)}</span></span>
          <span class="board-members">${t.members.length ? esc(t.members.join(', ')) : 'Ingen deltakere lagt til'}</span>
        </span>
        <span class="board-pts">${t.score}<small>p</small></span>
      </li>`;
  }).join('');
  const table = `
    <div class="table-wrap">
      <table class="breakdown">
        <thead><tr><th scope="col">Lag</th>${BARS.map((b, i) => `<th scope="col" title="${esc(b.name)}">${i + 1}</th>`).join('')}<th scope="col">Sum</th></tr></thead>
        <tbody>${ranked.map((t) => `<tr><td>${esc(t.name)}</td>${BARS.map((b) => `<td>${barScore(b, t.id) || '·'}</td>`).join('')}<td class="tot">${t.score}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  return `
    ${finished && lead ? `
      <div class="winner">
        ${icon('trophy')}
        <span class="eyebrow">Kveldens vinner</span>
        <h2 class="h-display">${tie ? 'Uavgjort!' : esc(lead.name)}</h2>
        <span class="muted">${tie ? 'Avgjør det med en siste skål.' : `${lead.score} poeng etter ${BARS.length} barer`}</span>
      </div>` : `
      <div class="section">
        <h2 class="h-display">Poengtavle</h2>
        <p class="lede">Etter ${state.visited.length} av ${BARS.length} barer. Poeng deles ut under oppgavene på hver bar.</p>
      </div>`}
    <ol class="board" aria-label="Stilling">${rows}</ol>
    <div class="action-grid">
      <button class="btn btn-primary" type="button" data-action="share">${icon('share')} Del stillingen</button>
      <button class="btn" type="button" data-action="pick">${icon('dice')} Hvem må?</button>
    </div>
    <section class="section">
      <h3 class="section-title">Poeng per bar</h3>
      ${table}
    </section>
    <p class="note">Poengene lagres på denne telefonen. La én person være dommer og dele stillingen i gruppechatten.</p>`;
}

function viewTeams() {
  const cards = state.teams.map((t) => `
    <div class="team-card" style="--team:${t.color}">
      <div class="team-card-head">
        <input class="input input-team" id="team-name-${t.id}" data-team-name="${t.id}" value="${esc(t.name)}" maxlength="30" aria-label="Lagnavn" autocomplete="off">
        ${state.teams.length > 1 ? `<button class="icon-btn" type="button" data-action="remove-team" data-team="${t.id}" aria-label="Fjern ${esc(t.name)}">${icon('close')}</button>` : ''}
      </div>
      <div class="color-row" role="group" aria-label="Lagfarge">
        ${TEAM_COLORS.map((c) => `<button class="color-dot" type="button" style="--team:${c}" aria-pressed="${c === t.color}" aria-label="Farge ${c}" data-action="team-color" data-team="${t.id}" data-color="${c}"></button>`).join('')}
      </div>
      <div class="members">
        ${t.members.length ? t.members.map((m, idx) => `<span class="member">${esc(m)}<button type="button" data-action="remove-member" data-team="${t.id}" data-idx="${idx}" aria-label="Fjern ${esc(m)}">${icon('close')}</button></span>`).join('') : '<span class="muted small">Ingen deltakere ennå</span>'}
      </div>
      <form class="add-row" data-add-member="${t.id}">
        <input class="input" id="member-${t.id}" placeholder="Navn på deltaker" maxlength="40" autocomplete="off" aria-label="Ny deltaker på ${esc(t.name)}">
        <button class="btn" type="submit">${icon('plus')} Legg til</button>
      </form>
    </div>`).join('');
  const people = allParticipants().length;
  return `
    <div class="section">
      <h2 class="h-display">${state.setupDone ? 'Lag og deltakere' : 'Velkommen til kvelden'}</h2>
      <p class="lede">${state.setupDone
        ? `${state.teams.length} lag og ${people} deltakere. Du kan endre lagene underveis, og poengene blir stående.`
        : 'Del gjengen inn i lag og legg til deltakerne. Hver bar har oppgaver som gir poeng, og poengtavla viser hvem som leder.'}</p>
    </div>
    ${cards}
    <div class="row-wrap">
      ${state.teams.length < TEAM_COLORS.length ? `<button class="btn" type="button" data-action="add-team">${icon('plus')} Legg til lag</button>` : ''}
      <button class="btn" type="button" data-action="shuffle-teams">${icon('shuffle')} Bland lagene</button>
    </div>
    <div class="field">
      <label for="start-time">Starttid fra hotellet</label>
      <input class="input input-time" type="time" id="start-time" value="${esc(state.startTime)}">
    </div>
    ${state.setupDone ? '' : `<button class="btn btn-primary btn-block" type="button" data-action="start-night">${icon('walk')} Start kvelden</button>`}
    <section class="section">
      <h3 class="section-title">Nullstill</h3>
      ${confirmReset
        ? `<div class="row-wrap"><span class="small">Slette alle poeng, lag og innsjekkinger?</span>
            <button class="btn btn-danger btn-sm" type="button" data-action="reset-confirm">Ja, nullstill</button>
            <button class="btn btn-sm" type="button" data-action="reset-cancel">Avbryt</button></div>`
        : `<button class="btn btn-danger" type="button" data-action="reset">Nullstill kvelden</button>`}
    </section>
    <p class="note">Pass på hverandre. Nødnummer i Danmark: <b>112</b>.</p>
    <p class="credits">Kart: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bidragsytere</a>. Gangruter: FOSSGIS OSRM. 3D: MapLibre GL JS. Åpningstider kan endre seg, så sjekk før dere går.</p>`;
}

/* ---------- Hendelser ---------- */
function onClick(e) {
  const el = e.target.closest('[data-action], #tabs [data-tab]');
  if (!el) return;
  if (el.matches('#tabs [data-tab]') && !el.dataset.action) {
    tab = el.dataset.tab;
    render();
    if (!desktopMQ.matches) setSheet('open');
    return;
  }
  const d = el.dataset;
  const i = d.i !== undefined && d.i !== '' ? Number(d.i) : null;
  switch (d.action) {
    case 'tab':
      tab = d.tab;
      render();
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
      flyTo(BARS[i].coord, { zoom: 18, pitch: 66 });
      break;
    case 'fly-hotel':
      setSheet('peek');
      stopModes();
      flyTo(HOTEL.coord);
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
      if (orbit) stopOrbit(); else { setSheet('peek'); flyOverview(); }
      setControlState();
      break;
    case 'daynight':
      state.night = !isNight();
      save();
      if (map) map.setStyle(STYLE_URL, { diff: false });
      renderControls();
      setControlState();
      break;
    case 'north':
      stopOrbit();
      map?.easeTo({ bearing: 0, duration: 600 });
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
      adjust(d.bar, d.team, Number(d.delta));
      break;
    case 'pick':
      pickRandom();
      break;
    case 'modal-close':
      $('#modal').hidden = true;
      break;
    case 'share':
      shareScore();
      break;
    case 'copy':
      copyText(d.text);
      break;
    case 'add-team': {
      const used = new Set(state.teams.map((t) => t.color));
      const color = TEAM_COLORS.find((c) => !used.has(c)) || TEAM_COLORS[0];
      state.teams.push({ id: uid(), name: `Lag ${state.teams.length + 1}`, color, members: [] });
      save();
      render();
      break;
    }
    case 'remove-team':
      state.teams = state.teams.filter((t) => t.id !== d.team);
      save();
      render();
      break;
    case 'team-color':
      state.teams.find((t) => t.id === d.team).color = d.color;
      save();
      render();
      break;
    case 'remove-member': {
      const t = state.teams.find((x) => x.id === d.team);
      t.members.splice(Number(d.idx), 1);
      save();
      render();
      break;
    }
    case 'shuffle-teams':
      shuffleTeams();
      break;
    case 'start-night':
      state.setupDone = true;
      save();
      tab = 'route';
      render();
      setSheet('peek');
      toast('God tur! Første stopp er Taphouse.');
      break;
    case 'reset':
      confirmReset = true;
      render();
      break;
    case 'reset-cancel':
      confirmReset = false;
      render();
      break;
    case 'reset-confirm': {
      confirmReset = false;
      const keepNight = state.night;
      Object.assign(state, defaultState(), { night: keepNight });
      save();
      tab = 'teams';
      refreshMapData();
      render();
      toast('Kvelden er nullstilt');
      break;
    }
    default:
      break;
  }
}

function onInput(e) {
  const t = e.target;
  if (t.dataset.teamName) {
    const team = state.teams.find((x) => x.id === t.dataset.teamName);
    team.name = t.value.trim() || 'Lag uten navn';
    save();
    renderTop();
  } else if (t.id === 'start-time' && t.value) {
    state.startTime = t.value;
    save();
    renderPeek();
  }
}

function onSubmit(e) {
  const form = e.target.closest('[data-add-member]');
  if (!form) return;
  e.preventDefault();
  addMember(form.dataset.addMember);
}

function onKeydown(e) {
  if (e.key === 'Escape' && !$('#modal').hidden) $('#modal').hidden = true;
  if (e.target.closest('#tabs') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const order = ['route', 'bar', 'score', 'teams'];
    const idx = order.indexOf(tab);
    tab = order[(idx + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
    render();
    document.getElementById(`tab-${tab}`)?.focus();
  }
}

/* ---------- Oppstart ---------- */
document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('submit', onSubmit);
document.addEventListener('keydown', onKeydown);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });
desktopMQ.addEventListener('change', measurePeek);
window.addEventListener('resize', () => requestAnimationFrame(measurePeek));
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && live && !live.wake) {
    try { live.wake = await navigator.wakeLock?.request('screen'); } catch { /* valgfritt */ }
  }
});

initSheetDrag();
render();
if (!state.setupDone && !desktopMQ.matches) setSheet('open');
initMap();
loadRoutes();
document.fonts?.ready.then(measurePeek);
