// Fotorealistisk 3D av København med Googles 3D-fliser (samme data som Google Earth), vist med CesiumJS.
// Krever en nøkkel til Google Map Tiles API. Uten nøkkel bruker appen MapLibre-kartet i stedet.

import { HOTEL, BARS, CATEGORIES } from './data.js';
import { toRad, toDeg, haversine, offsetPoint } from './util.js';

const CESIUM_VERSION = '1.145.0';
const BASE = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Kameraet følger etter turgåeren: «drone» er skrått ovenfra, «gate» er omtrent i andre etasjes høyde.
const PRESETS = { drone: { up: 45, back: 70, ahead: 60 }, gate: { up: 6, back: 4, ahead: 40 } };
const DEFAULT_GROUND = 42; // ellipsoidehøyde for gatenivå i indre København (geoide ca. 37 m + terreng)

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Cesium) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Fikk ikke lastet CesiumJS'));
    document.head.appendChild(s);
  });
}
function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

function pinCanvas(color, text, { ring = false, dim = false } = {}) {
  const s = 2;
  const c = document.createElement('canvas');
  c.width = 44 * s;
  c.height = 56 * s;
  const g = c.getContext('2d');
  g.scale(s, s);
  g.globalAlpha = dim ? 0.6 : 1;
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.beginPath();
  g.moveTo(22, 54);
  g.bezierCurveTo(22, 54, 4, 34, 4, 22);
  g.arc(22, 22, 18, Math.PI, 0);
  g.bezierCurveTo(40, 34, 22, 54, 22, 54);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 3;
  g.strokeStyle = ring ? '#ffffff' : 'rgba(10,15,29,0.9)';
  g.stroke();
  g.fillStyle = '#0a0f1d';
  g.font = '600 17px "IBM Plex Mono", ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 22, 23);
  return c;
}

function arrowCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.translate(48, 48);
  g.fillStyle = 'rgba(255,181,71,0.28)';
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, 46, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, 0, 12, 0, Math.PI * 2);
  g.fillStyle = '#ffb547';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#fff';
  g.stroke();
  return c;
}

export async function createEarthEngine(container, opts) {
  window.CESIUM_BASE_URL = BASE;
  loadCss(`${BASE}Widgets/widgets.css`);
  await loadScript(`${BASE}Cesium.js`);
  const C = window.Cesium;
  const credits = document.getElementById('earth-credits');

  const viewer = new C.Viewer(container, {
    globe: false,
    baseLayer: false,
    skyAtmosphere: new C.SkyAtmosphere(),
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    creditContainer: credits,
  });
  credits.hidden = false;
  viewer.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  const scene = viewer.scene;
  const camera = viewer.camera;

  let tileset;
  try {
    tileset = await C.createGooglePhotorealistic3DTileset({ key: opts.key, onlyUsingWithGoogleGeocoder: true });
  } catch (err) {
    viewer.destroy();
    credits.hidden = true;
    throw err;
  }
  scene.primitives.add(tileset);

  const brightness = scene.postProcessStages.add(C.PostProcessStageLibrary.createBrightnessStage());
  brightness.uniforms.brightness = 0.55;

  let legs = opts.legs;
  let view = opts.view;
  let night = opts.night;
  let ground = DEFAULT_GROUND;
  let orbit = null;
  let routeEntities = [];
  let walker = null;
  let me = null;

  function setNightLook() {
    brightness.enabled = night;
    scene.skyAtmosphere.brightnessShift = night ? -0.7 : 0;
  }
  setNightLook();

  // Barnåler, navn og lyssøyler
  const pins = BARS.map((bar, i) => viewer.entities.add({
    position: C.Cartesian3.fromDegrees(bar.coord[0], bar.coord[1], ground + 24),
    billboard: {
      image: pinCanvas(CATEGORIES[bar.cat].color, String(i + 1)),
      verticalOrigin: C.VerticalOrigin.BOTTOM,
      scale: 0.5,
      scaleByDistance: new C.NearFarScalar(200, 1.15, 5000, 0.6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: bar.name,
      font: '700 13px Manrope, system-ui, sans-serif',
      fillColor: C.Color.WHITE,
      showBackground: true,
      backgroundColor: new C.Color(0.04, 0.06, 0.11, 0.86),
      backgroundPadding: new C.Cartesian2(8, 5),
      verticalOrigin: C.VerticalOrigin.TOP,
      pixelOffset: new C.Cartesian2(0, 6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      distanceDisplayCondition: new C.DistanceDisplayCondition(0, 1600),
    },
    properties: { barIndex: i },
  }));
  const beams = BARS.map((bar) => viewer.entities.add({
    polyline: {
      positions: C.Cartesian3.fromDegreesArrayHeights([bar.coord[0], bar.coord[1], ground, bar.coord[0], bar.coord[1], ground + 60]),
      width: 14,
      material: new C.PolylineGlowMaterialProperty({ glowPower: 0.3, color: C.Color.fromCssColorString(CATEGORIES[bar.cat].color) }),
    },
  }));
  const hotelPin = viewer.entities.add({
    position: C.Cartesian3.fromDegrees(HOTEL.coord[0], HOTEL.coord[1], ground + 24),
    billboard: { image: pinCanvas('#edf0f7', 'H'), verticalOrigin: C.VerticalOrigin.BOTTOM, scale: 0.5, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    label: {
      text: HOTEL.name, font: '700 13px Manrope, system-ui, sans-serif', fillColor: C.Color.WHITE, showBackground: true,
      backgroundColor: new C.Color(0.04, 0.06, 0.11, 0.86), verticalOrigin: C.VerticalOrigin.TOP, pixelOffset: new C.Cartesian2(0, 6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 1600),
    },
    properties: { hotel: true },
  });

  function updatePins() {
    BARS.forEach((bar, i) => {
      const pos = view.order.get(i);
      const done = view.visited.has(bar.id) && i !== view.here;
      pins[i].billboard.image = pinCanvas(CATEGORIES[bar.cat].color, String((pos ?? i) + 1), { ring: i === view.here || i === view.next, dim: done });
      const teams = view.teamsAt.get(i) || [];
      pins[i].label.text = teams.length ? `${bar.name} · ${teams.map((t) => t.name).join(', ')}` : bar.name;
      pins[i].position = C.Cartesian3.fromDegrees(bar.coord[0], bar.coord[1], ground + 24);
      const h = i === view.next ? 120 : i === view.here ? 90 : done ? 26 : 62;
      beams[i].polyline.positions = C.Cartesian3.fromDegreesArrayHeights([bar.coord[0], bar.coord[1], ground, bar.coord[0], bar.coord[1], ground + h]);
    });
    hotelPin.position = C.Cartesian3.fromDegrees(HOTEL.coord[0], HOTEL.coord[1], ground + 24);
  }

  function updateRoute() {
    routeEntities.forEach((e) => viewer.entities.remove(e));
    routeEntities = legs.map((leg, i) => {
      const st = i < view.nextPos ? 'done' : i === view.nextPos ? 'next' : 'future';
      const color = st === 'next' ? C.Color.fromCssColorString('#ffb547') : st === 'done' ? C.Color.fromCssColorString('#7f93bd').withAlpha(0.8) : C.Color.WHITE.withAlpha(0.55);
      return viewer.entities.add({
        polyline: {
          positions: C.Cartesian3.fromDegreesArray(leg.coords.flat()),
          width: st === 'next' ? 9 : 5,
          clampToGround: true,
          classificationType: C.ClassificationType.CESIUM_3D_TILE,
          material: color,
        },
      });
    });
  }

  updatePins();
  updateRoute();

  // Trykk på nåler og brukerens egne kamerabevegelser
  const handler = new C.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((click) => {
    const picked = scene.pick(click.position);
    const props = picked?.id?.properties;
    if (!props) return;
    if (props.hotel) opts.onHotel?.();
    else if (props.barIndex) opts.onBar?.(props.barIndex.getValue());
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  const userMoved = () => { stopOrbit(); opts.onUser?.(); };
  for (const type of ['LEFT_DOWN', 'RIGHT_DOWN', 'MIDDLE_DOWN', 'WHEEL', 'PINCH_START']) handler.setInputAction(userMoved, C.ScreenSpaceEventType[type]);
  camera.changed.addEventListener(() => opts.onRotate?.(toDeg(camera.heading)));

  function pose(p, bearing, preset) {
    const P = PRESETS[preset] || PRESETS.drone;
    const cam = offsetPoint(p, bearing + 180, P.back);
    return {
      destination: C.Cartesian3.fromDegrees(cam[0], cam[1], ground + P.up),
      orientation: { heading: toRad(bearing), pitch: -Math.atan2(P.up - 1.5, P.back + P.ahead), roll: 0 },
    };
  }

  function routeCenter() {
    const pts = [HOTEL.coord, ...BARS.map((b) => b.coord)];
    const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    const radius = Math.max(...pts.map((p) => haversine(c, p)));
    return { c, radius };
  }

  function startOrbit(target, heading, pitch, range) {
    stopOrbit();
    let h = heading;
    let last = performance.now();
    const step = (now) => {
      if (!orbit) return;
      h += ((now - last) / 1000) * 3;
      last = now;
      camera.lookAt(target, new C.HeadingPitchRange(toRad(h), toRad(pitch), range));
      orbit = requestAnimationFrame(step);
    };
    orbit = requestAnimationFrame(step);
  }
  function stopOrbit() {
    if (!orbit) return;
    cancelAnimationFrame(orbit);
    orbit = null;
    camera.lookAtTransform(C.Matrix4.IDENTITY);
  }

  // Finner gatenivået ved å måle høyden på 3D-modellen langs ruta.
  async function calibrateGround() {
    const samples = [];
    for (const leg of legs) {
      for (let k = 1; k < leg.coords.length; k++) {
        const [a, b] = [leg.coords[k - 1], leg.coords[k]];
        samples.push(C.Cartographic.fromDegrees((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
      }
    }
    const pick = samples.filter((_, k) => k % Math.max(1, Math.floor(samples.length / 40)) === 0);
    viewer.entities.show = false;
    try {
      const res = await Promise.race([scene.sampleHeightMostDetailed(pick), new Promise((r) => setTimeout(() => r(null), 12000))]);
      const heights = (res || []).map((c) => c?.height).filter((h) => Number.isFinite(h) && h > 20 && h < 90).sort((x, y) => x - y);
      if (heights.length >= 5) ground = heights[Math.floor(heights.length * 0.2)];
    } catch { /* beholder standardhøyden */ }
    viewer.entities.show = true;
    updatePins();
  }

  const api = {
    kind: 'earth',
    get orbiting() { return !!orbit; },
    setLegs(l) { legs = l; updateRoute(); },
    setView(v) { view = v; updatePins(); updateRoute(); },
    setNight(n) { night = n; setNightLook(); },
    setPadding() { /* Cesium har ingen kamerapolstring; målet holdes midt i bildet */ },
    overview({ intro = false, onDone } = {}) {
      stopOrbit();
      const { c, radius } = routeCenter();
      const target = C.Cartesian3.fromDegrees(c[0], c[1], ground);
      const aspect = scene.canvas.clientWidth / Math.max(1, scene.canvas.clientHeight);
      const fov = camera.frustum.fov || toRad(60);
      const hfov = aspect >= 1 ? fov : 2 * Math.atan(Math.tan(fov / 2) * aspect);
      const range = (radius / Math.tan(hfov / 2)) * 1.1 + 150;
      const heading = aspect < 0.85 ? -72 : -24;
      const pitch = -35;
      camera.flyToBoundingSphere(new C.BoundingSphere(target, 1), {
        offset: new C.HeadingPitchRange(toRad(heading), toRad(pitch), range),
        duration: reduceMotion ? 0 : intro ? 3.2 : 1.8,
        complete: () => { if (!reduceMotion) startOrbit(target, heading, pitch, range); onDone?.(); },
      });
    },
    stopOrbit,
    flyTo(coord, { bearing, close = false, slow = false } = {}) {
      stopOrbit();
      camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(coord[0], coord[1], ground + 10), 1), {
        offset: new C.HeadingPitchRange(toRad(bearing ?? toDeg(camera.heading)), toRad(-28), close ? 170 : 240),
        duration: reduceMotion ? 0 : slow ? 3.6 : 1.8,
      });
    },
    relax() {},
    resetNorth() {
      stopOrbit();
      camera.flyTo({ destination: camera.positionWC.clone(), orientation: { heading: 0, pitch: camera.pitch, roll: 0 }, duration: 0.6 });
    },
    bearing() { return toDeg(camera.heading); },
    walkBegin(coord, bearing, preset) {
      stopOrbit();
      return new Promise((resolve) => camera.flyTo({ ...pose(coord, bearing, preset), duration: reduceMotion ? 0 : 2.2, complete: resolve, cancel: resolve }));
    },
    walkCamera(p, bearing, preset) { camera.setView(pose(p, bearing, preset)); },
    liveCamera(p, bearing, preset) { camera.setView(pose(p, bearing, preset)); },
    setWalker(p) {
      if (!p) { if (walker) viewer.entities.remove(walker); walker = null; return; }
      const pos = C.Cartesian3.fromDegrees(p[0], p[1], ground + 2);
      if (!walker) {
        walker = viewer.entities.add({ position: pos, point: { pixelSize: 16, color: C.Color.fromCssColorString('#ffb547'), outlineColor: C.Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
      } else walker.position = pos;
    },
    setMe(pos, heading) {
      if (!pos) { if (me) viewer.entities.remove(me); me = null; return; }
      const p = C.Cartesian3.fromDegrees(pos[0], pos[1], ground + 2);
      if (!me) {
        me = viewer.entities.add({ position: p, billboard: { image: arrowCanvas(), scale: 0.6, alignedAxis: C.Cartesian3.UNIT_Z, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
      }
      me.position = p;
      me.billboard.rotation = heading == null ? 0 : -toRad(heading);
    },
    destroy() {
      stopOrbit();
      handler.destroy();
      viewer.destroy();
      credits.hidden = true;
      credits.innerHTML = '';
    },
  };

  calibrateGround();
  return api;
}
