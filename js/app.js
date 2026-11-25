// Einstieg: verbindet Karte, Panels, Suche, Standort, Kontextmenü, eigene Orte.
import { state, BASES, OVERLAYS, initMap, initSheet, registerTab, openTab, setBase, setOverlay, setZeitYear, activeOverlayLayerIds, toast, sheetSize } from './core.js';
import { $, esc, store, getJSON, toLV95, debounce } from './util.js';
import { CATS, active as activePois, setCat, initPois, renderNearby } from './poi.js';
import { initRoute, renderPanel as renderRoute, routeTo, startAt } from './route.js';
import { renderNature } from './nature.js';
import { renderFood, renderIdeas } from './content.js';

const map = initMap();
initSheet();
initPois();
initRoute();

// ---------- Panel «Karte» ----------
function renderLayers(body) {
  body.innerHTML = `<h3>Grundkarte</h3><div class="chips">${BASES.map(b => `<button class="chip ${b.id === state.base ? 'on' : ''}" data-base="${b.id}">${b.name}</button>`).join('')}</div>
    <h3>Orte anzeigen</h3>${CATS.map(c => `<label class="opt"><input type="checkbox" data-poi="${c.id}" ${activePois.has(c.id) ? 'checked' : ''}><span class="sw">${c.emoji}</span><span>${c.name}</span></label>`).join('')}
    <p class="mute">Orte stammen aus OpenStreetMap und erscheinen ab Zoomstufe 12.</p>
    ${OVERLAYS.map(o => o.group ? `<h3>${o.group}</h3>` : `<label class="opt"><input type="checkbox" data-ov="${o.id}" ${state.overlays.has(o.id) ? 'checked' : ''}><span class="sw">${o.sw}</span>
      <span class="grow">${o.name}${o.desc ? `<small>${o.desc}</small>` : ''}</span>
      ${o.years ? `<select data-year>${o.years.map(y => `<option ${y === state.zeitYear ? 'selected' : ''}>${y}</option>`).join('')}</select>` : ''}</label>`).join('')}
    <h3>Eigene Orte</h3><p class="mute">Lange auf die Karte drücken → «Ort merken». ${places.length} gespeichert (nur auf diesem Gerät).</p>
    <p class="mute">Tipp: Bei eingeschalteten Ebenen auf die Karte tippen, um Infos zu einem Gebiet oder einer Haltestelle zu sehen.</p>
    <p class="mute">Kartendaten © swisstopo, BAFU, ASTRA, BAV · Orte © OpenStreetMap-Mitwirkende</p>`;
  body.querySelectorAll('[data-base]').forEach(b => b.onclick = () => { setBase(b.dataset.base); renderLayers(body); });
  body.querySelectorAll('[data-poi]').forEach(c => c.onchange = () => setCat(c.dataset.poi, c.checked));
  body.querySelectorAll('[data-ov]').forEach(c => c.onchange = () => setOverlay(c.dataset.ov, c.checked));
  const ys = body.querySelector('[data-year]');
  if (ys) { ys.onclick = e => e.preventDefault(); ys.onchange = () => setZeitYear(+ys.value); }
}

registerTab('layers', 'Karte & Ebenen', renderLayers);
registerTab('route', 'Route & Rundwege', renderRoute);
registerTab('nature', 'Natur entdecken', renderNature);
registerTab('food', 'Sammelkalender', renderFood);
registerTab('ideas', 'Ideen für draussen', renderIdeas);
registerTab('nearby', 'Um mich herum', renderNearby);

// ---------- Standort ----------
let meMarker, meCircle, following = false;
map.on('locationfound', e => {
  state.userPos = [e.latlng.lat, e.latlng.lng];
  meMarker ||= L.marker(e.latlng, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false, zIndexOffset: 1000 }).addTo(map);
  meCircle ||= L.circle(e.latlng, { radius: e.accuracy, weight: 1, color: '#1971c2', fillOpacity: 0.08, interactive: false }).addTo(map);
  meMarker.setLatLng(e.latlng);
  meCircle.setLatLng(e.latlng).setRadius(e.accuracy);
  if (following) { map.setView(e.latlng, Math.max(map.getZoom(), 15)); following = false; }
});
map.on('locationerror', () => { toast('Standort nicht verfügbar – bitte Ortungsfreigabe im Browser erlauben'); $('#btnLocate').classList.remove('on'); });
$('#btnLocate').onclick = () => {
  following = true;
  $('#btnLocate').classList.add('on');
  if (state.userPos) map.setView(state.userPos, Math.max(map.getZoom(), 15));
  map.locate({ watch: true, enableHighAccuracy: true, maximumAge: 10000 });
};
$('#btnNearby').onclick = () => { sheetSize(''); openTab('nearby'); };

// ---------- Suche (swisstopo) ----------
const results = $('#searchResults'), input = $('#searchInput');
const doSearch = debounce(async () => {
  const q = input.value.trim();
  if (q.length < 2) { results.hidden = true; return; }
  try {
    const d = await getJSON(`https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(q)}&type=locations&sr=4326&limit=8&lang=de`);
    results.innerHTML = d.results.map(r => `<li data-lat="${r.attrs.lat}" data-lon="${r.attrs.lon}" data-z="${r.attrs.zoomlevel}">${r.attrs.label.replace(/<(?!\/?[bi]>)[^>]*>/g, '')}</li>`).join('') || '<li><small>Nichts gefunden</small></li>';
    results.hidden = false;
  } catch { results.hidden = true; }
}, 300);
input.addEventListener('input', doSearch);
$('#search').addEventListener('submit', e => { e.preventDefault(); results.querySelector('li[data-lat]')?.click(); });
results.addEventListener('click', e => {
  const li = e.target.closest('li[data-lat]');
  if (!li) return;
  const z = +li.dataset.z;
  map.setView([+li.dataset.lat, +li.dataset.lon], z >= 10 ? 17 : z >= 8 ? 15 : 13);
  results.hidden = true;
  input.blur();
});
map.on('click', () => { results.hidden = true; });

// ---------- Eigene Orte ----------
let places = store.get('places', []);
const placeLayer = L.layerGroup().addTo(map);
const EMOJIS = ['⭐', '🍄', '🫐', '🌿', '🦊', '🦉', '🛝', '🔥', '🏊', '📷'];
function drawPlaces() {
  placeLayer.clearLayers();
  for (const p of places) {
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: `<div class="poi own">${p.emoji}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
      .bindPopup(`<b>${p.emoji} ${esc(p.text || 'Eigener Ort')}</b><br><small>${esc(p.date)}</small><div><button class="btn" data-act="routeTo" data-lat="${p.lat}" data-lon="${p.lon}">🥾 Route hierhin</button><button class="btn" data-act="delPlace" data-id="${p.id}">🗑 Löschen</button></div>`)
      .addTo(placeLayer);
  }
}
drawPlaces();

// ---------- Kartenklick: Info zu aktiven Ebenen ----------
async function identify(latlng) {
  const layers = activeOverlayLayerIds();
  if (!layers.length) return;
  const b = map.getBounds(), s = map.getSize();
  try {
    const d = await getJSON(`https://api3.geo.admin.ch/rest/services/all/MapServer/identify?geometry=${latlng.lng},${latlng.lat}&geometryType=esriGeometryPoint&sr=4326&layers=all:${layers.join(',')}&mapExtent=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&imageDisplay=${s.x},${s.y},96&tolerance=12&returnGeometry=false&lang=de&limit=6`);
    if (!d.results?.length) return;
    const seen = new Set();
    const html = d.results.filter(r => { const k = r.layerBodId + r.attributes.label; return seen.has(k) ? false : seen.add(k); })
      .map(r => `<b>${esc(r.attributes.label ?? r.attributes.name ?? '')}</b><br><small>${esc(r.layerName)}</small>`).join('<hr style="border:0;border-top:1px solid #ddd;margin:6px 0">');
    L.popup().setLatLng(latlng).setContent(html).openOn(map);
  } catch { /* Info ist optional */ }
}
map.on('click', e => {
  for (const hnd of state.mapClickHandlers) if (hnd(e)) return;
  identify(e.latlng);
});

// ---------- Langes Drücken / Rechtsklick ----------
map.on('contextmenu', async e => {
  const { lat, lng } = e.latlng;
  const [E, N] = toLV95(lat, lng);
  const popup = L.popup().setLatLng(e.latlng).setContent(`<b>Hier</b> <small id="ctxH"></small><br><small>${lat.toFixed(5)}, ${lng.toFixed(5)} · LV95 ${Math.round(E)} / ${Math.round(N)}</small>
    <div><button class="btn" data-act="startAt" data-lat="${lat}" data-lon="${lng}">✏️ Route ab hier</button><button class="btn" data-act="routeTo" data-lat="${lat}" data-lon="${lng}">🥾 Route hierhin</button></div>
    <div style="margin-top:6px">${EMOJIS.map(em => `<button class="btn" data-act="addPlace" data-em="${em}" data-lat="${lat}" data-lon="${lng}">${em}</button>`).join('')}</div><small>Symbol antippen, um den Ort zu merken</small>`).openOn(map);
  try {
    const d = await getJSON(`https://api3.geo.admin.ch/rest/services/height?easting=${E}&northing=${N}&sr=2056`);
    const el = popup.getElement()?.querySelector('#ctxH');
    if (el) el.textContent = `· ${Math.round(+d.height)} m ü. M.`;
  } catch { /* Höhe ist optional */ }
});

// Knöpfe in Popups
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const ll = [+b.dataset.lat, +b.dataset.lon];
  map.closePopup();
  if (b.dataset.act === 'routeTo') routeTo(ll);
  else if (b.dataset.act === 'startAt') startAt(ll);
  else if (b.dataset.act === 'addPlace') {
    const text = prompt('Notiz zu diesem Ort (z. B. «Steinpilze gefunden»):', '');
    if (text === null) return;
    places.push({ id: Date.now(), lat: ll[0], lon: ll[1], emoji: b.dataset.em, text, date: new Date().toLocaleDateString('de-CH') });
    store.set('places', places); drawPlaces(); toast('Ort gespeichert');
  } else if (b.dataset.act === 'delPlace') {
    places = places.filter(p => String(p.id) !== b.dataset.id);
    store.set('places', places); drawPlaces();
  }
});

if (!store.get('welcomed', false)) {
  store.set('welcomed', true);
  setTimeout(() => toast('Willkommen! ◎ zeigt deinen Standort, ✨ was es rundherum gibt.', 6000), 800);
}
