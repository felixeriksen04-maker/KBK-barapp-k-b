// 3D-kart med MapLibre og OpenFreeMap (bygninger fra OpenStreetMap). Brukes når appen ikke har Google-nøkkel.

import { HOTEL, BARS, CATEGORIES } from './data.js';
import { icon, esc, toRad } from './util.js';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PRESETS = { drone: { zoom: 18.1, pitch: 72 }, gate: { zoom: 19.3, pitch: 82 } };

export async function createMapEngine(container, opts) {
  if (!window.maplibregl) throw new Error('MapLibre mangler');
  let legs = opts.legs;
  let view = opts.view;
  let night = opts.night;
  let orbit = null;
  let walker = null;
  let me = null;

  const map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [12.5735, 55.678],
    zoom: 13.4,
    pitch: 20,
    maxPitch: 85,
    attributionControl: { compact: true },
    canvasContextAttributes: { antialias: true },
  });

  map.on('style.load', () => {
    if (night) applyNightPalette();
    applyAtmosphere();
    addRouteLayers();
  });
  map.on('error', (e) => {
    if (e?.error?.message && /style/i.test(e.error.message)) opts.onError?.('Fikk ikke lastet kartet. Sjekk nettforbindelsen.');
  });
  const zoomClasses = () => {
    const z = map.getZoom();
    container.classList.toggle('labels-off', z < 13.6);
    container.classList.toggle('labels-few', z < 16.6);
  };
  map.on('zoom', zoomClasses);
  zoomClasses();
  map.on('rotate', () => opts.onRotate?.(map.getBearing()));
  for (const ev of ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart']) {
    map.on(ev, (e) => {
      if (!e.originalEvent) return;
      stopOrbit();
      opts.onUser?.();
    });
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
    try {
      map.setSky(night
        ? { 'sky-color': '#060a16', 'horizon-color': '#2b2140', 'fog-color': '#0c1222', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.75, 'atmosphere-blend': 0 }
        : { 'sky-color': '#76a9de', 'horizon-color': '#dfe9f4', 'fog-color': '#eef2f6', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.8, 'atmosphere-blend': 0 });
    } catch { /* eldre motor uten himmel */ }
    map.setLight({ anchor: 'map', color: night ? '#ffd8a8' : '#ffffff', intensity: night ? 0.32 : 0.45, position: [1.4, 210, 35] });
  }

  function routeGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: legs.map((leg, i) => {
        const st = i < view.nextPos ? 'done' : i === view.nextPos ? 'next' : 'future';
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
    const features = [];
    BARS.forEach((bar, i) => {
      const color = CATEGORIES[bar.cat].color;
      const done = view.visited.has(bar.id) && i !== view.here;
      const h = i === view.next ? 120 : i === view.here ? 90 : done ? 26 : 62;
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
        properties: { color: CATEGORIES[bar.cat].color, next: i === view.next ? 1 : 0 },
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

  function refreshData() {
    if (!map.getSource('route')) return;
    map.getSource('route').setData(routeGeoJSON());
    map.getSource('beams').setData(beamsGeoJSON());
    map.getSource('glow').setData(glowGeoJSON());
  }

  // HTML-nåler for hotellet og barene
  const markers = [];
  const hotelEl = document.createElement('button');
  hotelEl.type = 'button';
  hotelEl.className = 'pin pin-hotel';
  hotelEl.setAttribute('aria-label', 'Imperial Hotel, start og slutt');
  hotelEl.innerHTML = `<span class="pin-head">${icon('hotel')}</span><span class="pin-label">${esc(HOTEL.name)}</span>`;
  hotelEl.addEventListener('click', (e) => { e.stopPropagation(); opts.onHotel?.(); });
  markers.push(new maplibregl.Marker({ element: hotelEl, anchor: 'bottom' }).setLngLat(HOTEL.coord).addTo(map));
  BARS.forEach((bar, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pin';
    el.dataset.i = i;
    el.style.setProperty('--c', CATEGORIES[bar.cat].color);
    el.setAttribute('aria-label', `${i + 1}. ${bar.name}, ${CATEGORIES[bar.cat].label}`);
    el.innerHTML = `<span class="pin-head"><span class="pin-num">${i + 1}</span></span><span class="pin-label">${esc(bar.name)}</span><span class="pin-teams"></span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); opts.onBar?.(i); });
    markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(bar.coord).addTo(map));
  });
  function updateMarkers() {
    container.querySelectorAll('.pin[data-i]').forEach((el) => {
      const i = Number(el.dataset.i);
      el.classList.toggle('is-next', i === view.next);
      el.classList.toggle('is-here', i === view.here);
      el.classList.toggle('is-done', view.visited.has(BARS[i].id) && i !== view.here);
      el.classList.toggle('is-focus', i === view.focus);
      el.classList.toggle('is-finale', i === view.finale);
      el.querySelector('.pin-num').textContent = (view.order.get(i) ?? i) + 1;
      const teams = view.teamsAt.get(i) || [];
      el.querySelector('.pin-teams').innerHTML = teams.map((t) => `<span class="team-dot" style="--team:${t.color}" title="${esc(t.name)}"></span>`).join('');
    });
  }
  updateMarkers();

  function allBounds() {
    const b = new maplibregl.LngLatBounds(HOTEL.coord, HOTEL.coord);
    BARS.forEach((bar) => b.extend(bar.coord));
    legs.forEach((l) => l.coords.forEach((c) => b.extend(c)));
    return b;
  }

  function startOrbit() {
    stopOrbit();
    let last = performance.now();
    const step = (now) => {
      if (!orbit) return;
      map.setBearing(map.getBearing() + ((now - last) / 1000) * 3);
      last = now;
      orbit = requestAnimationFrame(step);
    };
    orbit = requestAnimationFrame(step);
  }
  function stopOrbit() {
    if (orbit) cancelAnimationFrame(orbit);
    orbit = null;
  }

  await new Promise((resolve) => {
    if (map.loaded()) return resolve();
    map.once('load', resolve);
    setTimeout(resolve, 8000);
  });

  return {
    kind: 'map',
    get orbiting() { return !!orbit; },
    setLegs(l) { legs = l; refreshData(); },
    setView(v) { view = v; refreshData(); updateMarkers(); },
    setNight(n) {
      if (n === night) return;
      night = n;
      map.setStyle(STYLE_URL, { diff: false });
    },
    setPadding(p) { map.setPadding(p); },
    overview({ intro = false, onDone } = {}) {
      // Ruta går øst–vest, så på en stående mobilskjerm snus kartet slik at den fyller høyden.
      // Zoomen velges slik at hele ruta holder seg i bildet mens kameraet sirkler rundt.
      stopOrbit();
      const portrait = container.clientHeight > container.clientWidth * 1.2;
      const bearing = portrait ? -72 : -24;
      const bounds = allBounds();
      const cams = [bearing, bearing + 90].map((b) => map.cameraForBounds(bounds, { padding: 24, bearing: b })).filter(Boolean);
      if (!cams.length) return;
      map.stop();
      map.once('moveend', () => { if (!reduceMotion) startOrbit(); onDone?.(); });
      map.flyTo({ center: bounds.getCenter(), zoom: Math.min(...cams.map((c) => c.zoom)) + 0.35, pitch: 56, bearing, duration: reduceMotion ? 0 : intro ? 2600 : 1500, essential: true });
    },
    stopOrbit,
    flyTo(coord, { bearing, close = false, slow = false } = {}) {
      stopOrbit();
      map.flyTo({ center: coord, zoom: close ? 17.9 : 17.6, pitch: close ? 64 : 62, bearing: bearing ?? map.getBearing(), duration: reduceMotion ? 0 : slow ? 3600 : 1600, essential: true });
    },
    relax() { map.easeTo({ pitch: 60, zoom: 17, duration: 800 }); },
    resetNorth() { stopOrbit(); map.easeTo({ bearing: 0, duration: 600 }); },
    bearing() { return map.getBearing(); },
    walkBegin(coord, bearing, preset) {
      stopOrbit();
      map.stop();
      const P = PRESETS[preset] || PRESETS.drone;
      return new Promise((resolve) => {
        map.once('moveend', resolve);
        map.flyTo({ center: coord, zoom: P.zoom, pitch: P.pitch, bearing, duration: reduceMotion ? 0 : 1800, essential: true });
      });
    },
    walkCamera(p, bearing, preset) {
      const P = PRESETS[preset] || PRESETS.drone;
      map.jumpTo({ center: p, bearing, pitch: P.pitch, zoom: P.zoom });
    },
    liveCamera(p, bearing, preset) {
      const P = PRESETS[preset] || PRESETS.drone;
      map.jumpTo({ center: p, bearing, pitch: P.pitch - 4, zoom: P.zoom });
    },
    setWalker(p) {
      if (!p) { walker?.remove(); walker = null; return; }
      if (!walker) {
        const el = document.createElement('div');
        el.className = 'walker';
        walker = new maplibregl.Marker({ element: el }).setLngLat(p).addTo(map);
      } else walker.setLngLat(p);
    },
    setMe(pos, heading) {
      if (!pos) { me?.remove(); me = null; return; }
      if (!me) {
        const el = document.createElement('div');
        el.className = 'me no-heading';
        el.innerHTML = '<div class="me-cone"></div><div class="me-dot"></div>';
        me = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(pos).addTo(map);
      }
      me.setLngLat(pos);
      me.getElement().classList.toggle('no-heading', heading == null);
      if (heading != null) me.setRotation(heading);
    },
    destroy() {
      stopOrbit();
      markers.forEach((m) => m.remove());
      walker?.remove();
      me?.remove();
      map.remove();
      container.classList.remove('labels-off', 'labels-few');
    },
  };
}
