// Route zeichnen, Höhenprofil, Rundweg-Generator, Kinderwagen-Check, GPX-Export.
import { state, here, toast, openTab, sheetSize } from './core.js';
import { $, esc, store, toLV95, fromLV95, haversine, destination, bearing, lineLength, fmtDist, fmtTime, hikingMinutes } from './util.js';
import { poisAround } from './poi.js';

const MODES = {
  foot: { name: 'Zu Fuss', emoji: '🥾', profile: 'hiking-beta' },
  stroller: { name: 'Kinderwagen', emoji: '👶', profile: 'trekking' },
  line: { name: 'Luftlinie', emoji: '📏', profile: null },
};
const COLORS = ['#d9480f', '#1971c2', '#9c36b5'];

const R = {
  drawing: false,
  mode: store.get('routeMode', 'foot'),
  kmh: store.get('routeKmh', 3.5),
  points: [],   // [lat, lon]
  legs: [],     // legs[i]: { coords: [[lat,lon],…], surf: {good,rough,unknown,steps} } von points[i] nach points[i+1]
  profile: null, // [{d, h, lat, lon}]
  stats: null,
  variants: [],
};
let lineLayer, markerLayer, variantLayer, cursor, profileToken = 0, body = null;

// ---------- Routing (BRouter, Daten: OpenStreetMap) ----------
const GOOD_SURF = ['asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones', 'sett', 'compacted', 'fine_gravel', 'wood', 'metal'];
const BAD_SURF = ['ground', 'dirt', 'earth', 'grass', 'mud', 'sand', 'rock', 'roots', 'pebblestone', 'cobblestone', 'woodchips', 'snow'];
const ROADS = ['residential', 'living_street', 'pedestrian', 'service', 'unclassified', 'tertiary', 'secondary', 'primary', 'cycleway', 'footway'];

function classifyWay(tagStr) {
  const t = Object.fromEntries(tagStr.split(' ').map(s => s.split('=')));
  if (t.highway === 'steps') return 'steps';
  if (t.sac_scale && t.sac_scale !== 'hiking') return 'rough';
  if (GOOD_SURF.includes(t.surface) || ['grade1', 'grade2'].includes(t.tracktype)) return 'good';
  if (BAD_SURF.includes(t.surface) || ['grade4', 'grade5'].includes(t.tracktype) || ['very_bad', 'horrible', 'very_horrible', 'impassable'].includes(t.smoothness)) return 'rough';
  if (!t.surface && !t.tracktype && ROADS.includes(t.highway)) return 'good';
  return 'unknown'; // Kies, «unpaved», Pfade ohne Angabe
}

async function brouter(pts, mode) {
  const lonlats = pts.map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join('|');
  const r = await fetch(`https://brouter.de/brouter?lonlats=${lonlats}&profile=${MODES[mode].profile}&alternativeidx=0&format=geojson`);
  if (!r.ok) throw new Error((await r.text()).slice(0, 120));
  const f = (await r.json()).features[0];
  const surf = { good: 0, rough: 0, unknown: 0, steps: 0 };
  const msgs = f.properties.messages || [];
  const iDist = msgs[0]?.indexOf('Distance'), iTags = msgs[0]?.indexOf('WayTags');
  for (const row of msgs.slice(1)) surf[classifyWay(row[iTags] || '')] += +row[iDist] || 0;
  return { coords: f.geometry.coordinates.map(c => [c[1], c[0]]), surf, length: +f.properties['track-length'] };
}

async function makeLeg(a, b) {
  if (R.mode !== 'line') {
    try { return await brouter([a, b], R.mode); }
    catch (e) { toast('Kein Weg gefunden – Abschnitt als Luftlinie'); }
  }
  return { coords: [a, b], surf: null };
}

// ---------- Zustand ändern ----------
export async function addPoint(latlng) {
  const p = [latlng.lat ?? latlng[0], latlng.lng ?? latlng[1]];
  R.variants = [];
  R.points.push(p);
  if (R.points.length > 1) {
    redraw(true);
    R.legs.push(await makeLeg(R.points[R.points.length - 2], p));
  }
  redraw();
}

function undo() {
  if (!R.points.length) return;
  R.points.pop();
  R.legs.pop();
  redraw();
}

export function clearRoute() {
  R.points = []; R.legs = []; R.profile = null; R.stats = null; R.variants = [];
  redraw();
}

async function closeLoop() {
  if (R.points.length < 2) return;
  await addPoint(R.points[0]);
}

async function reroute() {
  const pts = R.points;
  R.legs = [];
  for (let i = 1; i < pts.length; i++) R.legs.push(await makeLeg(pts[i - 1], pts[i]));
  redraw();
}

export function setDrawing(on) {
  R.drawing = on;
  state.map.getContainer().style.cursor = on ? 'crosshair' : '';
  if (on) toast('Tippe auf die Karte, um Punkte zu setzen');
  renderPanel();
}

export async function routeTo(dest) {
  clearRoute();
  await addPoint(here());
  await addPoint(dest);
  openTab('route');
  state.map.fitBounds(lineLayer.getBounds().pad(0.2));
}

export function startAt(latlng) {
  clearRoute();
  addPoint(latlng);
  setDrawing(true);
  openTab('route');
}

const allCoords = () => R.legs.flatMap((l, i) => i ? l.coords.slice(1) : l.coords);

function redraw(pending = false) {
  const coords = allCoords();
  lineLayer.setLatLngs(pending ? [...coords, R.points[R.points.length - 1]] : coords);
  markerLayer.clearLayers();
  R.points.forEach((p, i) => L.marker(p, {
    icon: L.divIcon({ className: '', html: `<div class="wp ${i ? '' : 'start'}"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false,
  }).addTo(markerLayer));
  variantLayer.clearLayers();
  lineLayer.setStyle({ color: COLORS[Math.max(0, R.variants.findIndex(v => v.on))] });
  R.variants.forEach((v, i) => { if (!v.on) L.polyline(v.coords, { color: COLORS[i], weight: 5, opacity: 0.6, dashArray: '6 8' }).on('click', () => selectVariant(i)).addTo(variantLayer); });
  if (pending) return;
  if (coords.length > 1) loadProfile(coords); else { R.profile = null; R.stats = null; }
  renderPanel();
}

// ---------- Höhenprofil (swisstopo) ----------
async function loadProfile(coords) {
  const token = ++profileToken;
  const step = Math.max(1, Math.ceil(coords.length / 400));
  const pts = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
  const dist = lineLength(coords);
  R.stats = { dist };
  renderPanel();
  try {
    const r = await fetch('https://api3.geo.admin.ch/rest/services/profile.json?sr=2056&nb_points=200&distinct_points=true', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'LineString', coordinates: pts.map(p => toLV95(p[0], p[1])) }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (token !== profileToken) return;
    const scale = dist / (data[data.length - 1].dist || 1); // Profil-Distanz auf echte Weglänge skalieren
    R.profile = data.filter(d => d.alts?.COMB != null).map(d => {
      const [lat, lon] = fromLV95(d.easting, d.northing);
      return { d: d.dist * scale, h: d.alts.COMB, lat, lon };
    });
    let up = 0, down = 0, ref = R.profile[0].h, maxSlope = 0;
    for (const p of R.profile) { // 3-m-Schwelle gegen Rauschen
      if (p.h - ref > 3) { up += p.h - ref; ref = p.h; } else if (ref - p.h > 3) { down += ref - p.h; ref = p.h; }
    }
    for (let i = 4; i < R.profile.length; i++) {
      const dd = R.profile[i].d - R.profile[i - 4].d;
      if (dd > 30) maxSlope = Math.max(maxSlope, Math.abs(R.profile[i].h - R.profile[i - 4].h) / dd * 100);
    }
    const hs = R.profile.map(p => p.h);
    R.stats = { dist, up, down, min: Math.min(...hs), max: Math.max(...hs), maxSlope };
  } catch (e) {
    if (token === profileToken) R.profile = null;
  }
  if (token === profileToken) renderPanel();
}

function profileSvg() {
  const P = R.profile;
  if (!P || P.length < 2) return '';
  const W = 600, H = 150, l = 38, b = 18, t = 8;
  const total = P[P.length - 1].d;
  let lo = Math.min(...P.map(p => p.h)), hi = Math.max(...P.map(p => p.h));
  const pad = Math.max(10, (hi - lo) * 0.1); lo -= pad; hi += pad;
  const x = d => l + d / total * (W - l - 4), y = h => t + (hi - h) / (hi - lo) * (H - t - b);
  const path = `M${x(0)},${H - b} ` + P.map(p => `L${x(p.d).toFixed(1)},${y(p.h).toFixed(1)}`).join(' ') + ` L${x(total)},${H - b} Z`;
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad].map(v => `<line class="grid" x1="${l}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="2" y="${y(v) + 3}">${Math.round(v)} m</text>`).join('');
  const xt = [0, 0.5, 1].map(f => `<text x="${x(total * f)}" y="${H - 4}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${fmtDist(total * f)}</text>`).join('');
  return `<svg id="profile" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${ticks}<path class="area" d="${path}"/>${xt}<line class="cur" id="profCur" y1="${t}" y2="${H - b}" x1="-10" x2="-10"/></svg><p class="mute" id="profInfo">Über das Profil fahren, um die Stelle auf der Karte zu sehen.</p>`;
}

function bindProfile(root) {
  const svg = $('#profile', root);
  if (!svg) return;
  const P = R.profile, total = P[P.length - 1].d;
  const move = ev => {
    const rect = svg.getBoundingClientRect();
    const fx = ((ev.touches?.[0] || ev).clientX - rect.left) / rect.width * 600;
    const d = Math.min(total, Math.max(0, (fx - 38) / (600 - 42) * total));
    const p = P.reduce((a, c) => Math.abs(c.d - d) < Math.abs(a.d - d) ? c : a);
    $('#profCur', root).setAttribute('x1', fx); $('#profCur', root).setAttribute('x2', fx);
    $('#profInfo', root).textContent = `${fmtDist(p.d)} · ${Math.round(p.h)} m ü. M.`;
    cursor.setLatLng([p.lat, p.lon]).addTo(state.map);
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => cursor.remove());
}

// ---------- Kinderwagen-Check ----------
function surfaceTotals(legs) {
  const s = { good: 0, rough: 0, unknown: 0, steps: 0 };
  let any = false;
  for (const l of legs) if (l.surf) { any = true; for (const k in s) s[k] += l.surf[k]; }
  return any ? s : null;
}

function strollerHtml(s, maxSlope) {
  if (!s) return '';
  const tot = s.good + s.rough + s.unknown + s.steps || 1;
  const pc = v => Math.round(v / tot * 100);
  const issues = [];
  if (s.steps > 0) issues.push('Treppen');
  if (pc(s.rough) > 10) issues.push('längere Naturwegstücke');
  if (maxSlope > 12) issues.push(`steil (bis ca. ${Math.round(maxSlope)} %)`);
  const verdict = issues.length === 0 && pc(s.good) >= 70 ? ['niedrig', '👍 Gut machbar'] : issues.length <= 1 && s.steps === 0 && pc(s.good) >= 45 ? ['mittel', '🤔 Mit geländegängigem Wagen'] : ['hoch', '⚠️ Eher nicht'];
  return `<div class="infobox"><b>👶 Kinderwagen-Check</b> <span class="badge r-${verdict[0]}">${verdict[1]}</span><br>
    ${pc(s.good)} % fester Belag · ${pc(s.rough)} % Naturweg · ${pc(s.unknown)} % Kies/unbekannt${issues.length ? `<br>Achtung: ${issues.join(', ')}` : ''}
    <br><span class="mute">Schätzung aus OpenStreetMap-Angaben – vor Ort kann es abweichen.</span></div>`;
}

// ---------- Rundweg-Generator ----------
async function generateLoops(minutes, viaPlayground) {
  const start = here();
  const mode = R.mode === 'line' ? 'foot' : R.mode;
  const target = R.kmh * 1000 * minutes / 60;
  const side0 = target / (3 * 1.35);
  const status = msg => { const el = $('#loopStatus'); if (el) el.textContent = msg; };
  let anchors = [];
  if (viaPlayground) {
    status('Suche Spielplätze …');
    try {
      const pgs = await poisAround(start, Math.min(side0 * 1.4, 4000), ['playground']);
      const far = pgs.filter(p => p.dist > side0 * 0.4);
      anchors = (far.length ? far : pgs).sort((a, b) => Math.abs(a.dist - side0) - Math.abs(b.dist - side0));
      const picked = []; // möglichst verschiedene Richtungen
      for (const p of anchors) if (picked.every(q => haversine([p.lat, p.lon], [q.lat, q.lon]) > side0 * 0.5)) picked.push(p);
      anchors = picked.slice(0, 3);
      if (!anchors.length) toast('Kein Spielplatz in Reichweite – Rundwege ohne Spielplatz');
    } catch { toast('Spielplatz-Suche nicht möglich – Rundwege ohne Spielplatz'); }
  }
  const base = Math.random() * 360;
  const out = [];
  for (let i = 0; i < 3; i++) {
    status(`Berechne Rundweg ${i + 1} von 3 …`);
    const a = anchors[i];
    let side = a ? Math.max(a.dist, side0 * 0.6) : side0;
    const dir = a ? bearing(start, [a.lat, a.lon]) : base + i * 120;
    let best = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const w1 = a ? [a.lat, a.lon] : destination(start, dir, side);
      const w2 = destination(start, dir + (i % 2 ? -65 : 65), a ? Math.max(200, side0 * (attempt ? 0.6 : 1)) : side);
      try {
        const r = await brouter([start, w1, w2, start], mode);
        if (!best || Math.abs(r.length - target) < Math.abs(best.length - target)) best = { ...r, via: [w1, w2], playground: a?.tags?.name || (a ? 'Spielplatz' : null) };
        const ratio = r.length / target;
        if (ratio > 0.8 && ratio < 1.25) break;
        side = Math.max(150, side / ratio);
        if (a && ratio < 1.25) break;
      } catch { /* andere Richtung probieren */ break; }
    }
    if (best) out.push(best);
  }
  if (!out.length) { status('Hier wurde kein Rundweg gefunden. Verschiebe die Karte an einen Ort mit Wegen.'); return; }
  out.sort((a, b) => Math.abs(a.length - target) - Math.abs(b.length - target));
  const fits = out.filter(v => v.length > target * 0.6 && v.length < target * 1.5);
  if (fits.length) out.splice(0, out.length, ...fits);
  R.points = []; R.legs = [];
  R.variants = out;
  selectVariant(0);
  state.map.fitBounds(L.latLngBounds(out.flatMap(v => v.coords)).pad(0.15));
}

function selectVariant(i) {
  R.variants.forEach((v, k) => { v.on = k === i; });
  const v = R.variants[i];
  R.points = [v.coords[0], ...v.via, v.coords[0]];
  R.legs = [{ coords: v.coords, surf: v.surf }, { coords: [v.coords[v.coords.length - 1]], surf: null }, { coords: [v.coords[v.coords.length - 1]], surf: null }];
  redraw();
}

// ---------- GPX ----------
function exportGpx() {
  const pts = allCoords();
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Entdeckerkarte" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Entdeckerkarte ${new Date().toISOString().slice(0, 10)}</name><trkseg>\n`
    + pts.map(p => `<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"/>`).join('\n') + '\n</trkseg></trk></gpx>';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }));
  a.download = 'route.gpx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Panel ----------
export function renderPanel(el) {
  if (el) body = el;
  if (!body || !body.isConnected) return;
  const s = R.stats, hasRoute = R.legs.length > 0 && allCoords().length > 1;
  const time = s?.up != null ? hikingMinutes(s.dist, s.up, s.down, R.kmh) : s ? s.dist / 1000 / R.kmh * 60 : 0;
  const surf = surfaceTotals(R.legs);
  body.innerHTML = `
    <div class="chips">${Object.entries(MODES).map(([k, m]) => `<button class="chip ${R.mode === k ? 'on' : ''}" data-mode="${k}">${m.emoji} ${m.name}</button>`).join('')}</div>
    <div class="row"><span class="mute">Tempo</span>
      <select id="kmh">${[[2.5, 'Kleinkind zu Fuss (2,5 km/h)'], [3.5, 'Mit Kindern (3,5 km/h)'], [4.2, 'Wandertempo (4,2 km/h)'], [5, 'Zügig (5 km/h)']].map(([v, n]) => `<option value="${v}" ${R.kmh === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>

    <h3>Rundweg vorschlagen</h3>
    <div class="row">
      <select id="loopMin">${[20, 30, 45, 60, 90, 120, 180].map(m => `<option value="${m}" ${m === store.get('loopMin', 45) ? 'selected' : ''}>${fmtTime(m)}</option>`).join('')}</select>
      <label class="row"><input type="checkbox" id="loopPg" ${store.get('loopPg', true) ? 'checked' : ''}> via Spielplatz</label>
      <button class="btn pri" id="loopGo">Los</button>
    </div>
    <p class="mute" id="loopStatus">Start ist ${state.userPos ? 'dein Standort' : 'die Kartenmitte'}.</p>
    ${R.variants.map((v, i) => `<div class="variant ${v.on ? 'on' : ''}" data-var="${i}"><span class="dot" style="background:${COLORS[i]}"></span>
      <span class="grow"><b>${fmtDist(v.length)}</b> · ca. ${fmtTime(v.length / 1000 / R.kmh * 60)}${v.playground ? `<br><small>🛝 ${esc(v.playground)}</small>` : ''}</span></div>`).join('')}

    <h3>Eigene Route</h3>
    <div class="row">
      <button class="btn ${R.drawing ? 'on' : ''}" id="draw">${R.drawing ? '✓ Zeichnen aktiv' : '✏️ Zeichnen'}</button>
      <button class="btn" id="undo" ${R.points.length ? '' : 'disabled'}>↩︎ Zurück</button>
      <button class="btn" id="loop" ${R.points.length > 1 ? '' : 'disabled'}>⟲ Zum Start</button>
      <button class="btn" id="clear" ${R.points.length ? '' : 'disabled'}>🗑</button>
    </div>
    ${hasRoute && s ? `
      <div class="stats">
        <div><b>${fmtDist(s.dist)}</b><small>Distanz</small></div>
        <div><b>${fmtTime(time)}</b><small>Gehzeit</small></div>
        <div><b>${s.up != null ? '↑ ' + Math.round(s.up) + ' m' : '…'}</b><small>Aufstieg</small></div>
        <div><b>${s.down != null ? '↓ ' + Math.round(s.down) + ' m' : '…'}</b><small>Abstieg</small></div>
      </div>
      ${profileSvg() || '<p class="mute">Höhenprofil wird geladen …</p>'}
      ${s.min != null ? `<p class="mute">Tiefster Punkt ${Math.round(s.min)} m · höchster Punkt ${Math.round(s.max)} m</p>` : ''}
      ${R.mode === 'stroller' || surf?.steps ? strollerHtml(surf, s.maxSlope || 0) : ''}
      <div class="row"><button class="btn" id="gpx">⬇︎ GPX speichern</button><button class="btn" id="fit">🔍 Ganze Route</button></div>`
    : '<p class="mute">«Zeichnen» antippen und Punkte auf die Karte setzen – die Route folgt automatisch den Wegen. Oder lange auf die Karte drücken → «Route ab hier».</p>'}
    <p class="mute">Wege: OpenStreetMap via BRouter · Höhen: swisstopo. Gehzeiten sind Richtwerte ohne Pausen.</p>`;

  body.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { R.mode = b.dataset.mode; store.set('routeMode', R.mode); R.points.length > 1 && !R.variants.length ? reroute() : renderPanel(); });
  $('#kmh', body).onchange = e => { R.kmh = +e.target.value; store.set('routeKmh', R.kmh); renderPanel(); };
  $('#draw', body).onclick = () => { setDrawing(!R.drawing); if (R.drawing) sheetSize('small'); };
  $('#undo', body).onclick = undo;
  $('#loop', body).onclick = closeLoop;
  $('#clear', body).onclick = clearRoute;
  $('#loopGo', body).onclick = async e => {
    const min = +$('#loopMin', body).value, pg = $('#loopPg', body).checked;
    store.set('loopMin', min); store.set('loopPg', pg);
    e.target.disabled = true;
    try { await generateLoops(min, pg); } finally { const b = $('#loopGo', body); if (b) b.disabled = false; }
  };
  body.querySelectorAll('[data-var]').forEach(d => d.onclick = () => selectVariant(+d.dataset.var));
  if ($('#gpx', body)) {
    $('#gpx', body).onclick = exportGpx;
    $('#fit', body).onclick = () => state.map.fitBounds(lineLayer.getBounds().pad(0.15));
  }
  bindProfile(body);
}

export function initRoute() {
  const map = state.map;
  variantLayer = L.layerGroup().addTo(map);
  lineLayer = L.polyline([], { color: '#d9480f', weight: 5, opacity: 0.9 }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  cursor = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 2, fillColor: '#d9480f', fillOpacity: 1, interactive: false });
  state.mapClickHandlers.push(e => { if (R.drawing) { addPoint(e.latlng); return true; } return false; });
}
