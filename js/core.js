// Karte, Kartenebenen, Sheet (Panel) und gemeinsamer Zustand.
import { $, $$, store, toast } from './util.js';

const WMTS = 'https://wmts.geo.admin.ch/1.0.0';
const ATTR = '© <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener">swisstopo</a>';

export const BASES = [
  { id: 'farbe', name: 'Landeskarte', layer: 'ch.swisstopo.pixelkarte-farbe', ext: 'jpeg', maxNative: 19 },
  { id: 'luft', name: 'Luftbild', layer: 'ch.swisstopo.swissimage', ext: 'jpeg', maxNative: 20 },
  { id: 'grau', name: 'Karte grau', layer: 'ch.swisstopo.pixelkarte-grau', ext: 'jpeg', maxNative: 19 },
  { id: 'winter', name: 'Winterkarte', layer: 'ch.swisstopo.pixelkarte-farbe-winter', ext: 'jpeg', maxNative: 19 },
  { id: 'osm', name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxNative: 19, attr: '© OpenStreetMap-Mitwirkende' },
];

export const OVERLAYS = [
  { group: 'Wandern & unterwegs' },
  { id: 'wanderwege', name: 'Wanderwege', desc: 'Gelb = Wanderweg, Rot = Bergwanderweg, Blau = Alpinwanderweg', layer: 'ch.swisstopo.swisstlm3d-wanderwege', sw: '🟡' },
  { id: 'wanderland', name: 'Wanderland-Routen', desc: 'Signalisierte Routen von SchweizMobil', layer: 'ch.astra.wanderland', sw: '🟢' },
  { id: 'oev', name: 'ÖV-Haltestellen', desc: 'Bahn, Bus, Schiff, Seilbahn', layer: 'ch.bav.haltestellen-oev', sw: '🚌' },
  { id: 'hang', name: 'Hangneigung über 30°', desc: 'Steiles Gelände erkennen', layer: 'ch.swisstopo.hangneigung-ueber_30', sw: '⛰️', opacity: 0.5 },
  { id: 'winterwandern', name: 'Winterwanderwege', layer: 'ch.astra.winterwanderwege', sw: '❄️' },
  { id: 'schneeschuh', name: 'Schneeschuhrouten', layer: 'ch.astra.schneeschuhwanderwege', sw: '🎿' },
  { group: 'Seen & Wasser' },
  { id: 'bathy', name: 'Seegrund-Relief', desc: 'Unterwasser-Topografie der grösseren Seen (swissBATHY3D). Tiefenlinien mit Zahlen stehen direkt in der Landeskarte.', layer: 'ch.swisstopo.swissbathy3d-reliefschattierung', sw: '🌊', opacity: 0.9 },
  { id: 'badewasser', name: 'Badewasserqualität', desc: 'Messstellen an Seen und Flüssen', layer: 'ch.bafu.gewaesserschutz-badewasserqualitaet', sw: '🏖️' },
  { group: 'Natur & Schutzgebiete' },
  { id: 'wald', name: 'Waldtyp (Laub/Nadel)', desc: 'Mischungsgrad: wichtig für die Pilzsuche', layer: 'ch.bafu.landesforstinventar-waldmischungsgrad', sw: '🌲', opacity: 0.55 },
  { id: 'wrz', name: 'Wildruhezonen', desc: 'Im Winter Betretungsverbot oder Weggebot', layer: 'ch.bafu.wrz-wildruhezonen_portal', sw: '🦌', opacity: 0.6 },
  { id: 'jagdbann', name: 'Jagdbanngebiete', desc: 'Wildtierschutzgebiete – gute Chancen auf Gämsen, Steinböcke, Hirsche', layer: 'ch.bafu.bundesinventare-jagdbanngebiete', sw: '🐐', opacity: 0.6 },
  { id: 'vogelres', name: 'Wasser- und Zugvogelreservate', desc: 'Beste Orte für Wasservögel, vor allem im Winter', layer: 'ch.bafu.bundesinventare-vogelreservate', sw: '🦆', opacity: 0.6 },
  { id: 'amphibien', name: 'Amphibienlaichgebiete', desc: 'Weiher und Tümpel mit Fröschen, Kröten, Molchen', layer: 'ch.bafu.bundesinventare-amphibien', sw: '🐸', opacity: 0.7 },
  { id: 'flachmoore', name: 'Flachmoore', layer: 'ch.bafu.bundesinventare-flachmoore', sw: '🌾', opacity: 0.6 },
  { id: 'hochmoore', name: 'Hochmoore', layer: 'ch.bafu.bundesinventare-hochmoore', sw: '🟤', opacity: 0.6 },
  { id: 'auen', name: 'Auengebiete', desc: 'Naturnahe Flusslandschaften – Biber, Eisvogel, Morcheln', layer: 'ch.bafu.bundesinventare-auen', sw: '🏞️', opacity: 0.6 },
  { id: 'tww', name: 'Trockenwiesen und -weiden', desc: 'Blumen, Schmetterlinge, Heuschrecken', layer: 'ch.bafu.bundesinventare-trockenwiesen_trockenweiden', sw: '🦋', opacity: 0.6 },
  { id: 'pronatura', name: 'Pro-Natura-Schutzgebiete', layer: 'ch.pronatura.naturschutzgebiete', sw: '🌼', opacity: 0.6 },
  { id: 'waldres', name: 'Waldreservate', desc: 'Urwaldähnliche Wälder mit viel Totholz', layer: 'ch.bafu.waldreservate', sw: '🌳', opacity: 0.6 },
  { id: 'paerke', name: 'Schweizer Pärke', layer: 'ch.bafu.schutzgebiete-paerke_nationaler_bedeutung', sw: '🏕️', opacity: 0.5 },
  { group: 'Zeitreise' },
  { id: 'zeit', name: 'Historische Karte', desc: 'Wie sah es hier früher aus?', layer: 'ch.swisstopo.zeitreihen', sw: '🕰️', opacity: 1, years: [1864, 1880, 1900, 1920, 1940, 1960, 1980, 2000] },
];

export const state = {
  map: null,
  base: store.get('base', 'farbe'),
  overlays: new Set(store.get('overlays', ['wanderwege'])),
  zeitYear: store.get('zeitYear', 1900),
  userPos: null,       // [lat, lon] sobald geortet
  mapClickHandlers: [], // Module, die Kartenklicks abfangen (z. B. Routenzeichnen)
};

const baseLayers = {};
const overlayLayers = {};

function swisstopoUrl(layer, ext, time = 'current') {
  return `${WMTS}/${layer}/default/${time}/3857/{z}/{x}/{y}.${ext}`;
}

function makeBase(b) {
  return L.tileLayer(b.url || swisstopoUrl(b.layer, b.ext), {
    maxNativeZoom: b.maxNative, maxZoom: 21, minZoom: 7, attribution: b.attr || ATTR,
    bounds: b.url ? undefined : [[45.3, 5.1], [48.3, 11.4]],
  });
}

function makeOverlay(o) {
  const time = o.years ? `${state.zeitYear}1231` : 'current';
  return L.tileLayer(swisstopoUrl(o.layer, 'png', time), {
    maxNativeZoom: 18, maxZoom: 21, minZoom: 7, opacity: o.opacity ?? 0.85, attribution: ATTR, pane: 'overlays',
    bounds: [[45.3, 5.1], [48.3, 11.4]],
  });
}

export function setBase(id) {
  const map = state.map;
  Object.values(baseLayers).forEach(l => map.removeLayer(l));
  const b = BASES.find(x => x.id === id) || BASES[0];
  baseLayers[b.id] ||= makeBase(b);
  baseLayers[b.id].addTo(map);
  state.base = b.id;
  store.set('base', b.id);
}

export function setOverlay(id, on) {
  const o = OVERLAYS.find(x => x.id === id);
  if (!o) return;
  if (overlayLayers[id]) { state.map.removeLayer(overlayLayers[id]); delete overlayLayers[id]; }
  if (on) { overlayLayers[id] = makeOverlay(o).addTo(state.map); state.overlays.add(id); }
  else state.overlays.delete(id);
  store.set('overlays', [...state.overlays]);
}

export function setZeitYear(y) {
  state.zeitYear = y;
  store.set('zeitYear', y);
  if (state.overlays.has('zeit')) setOverlay('zeit', true);
}

export function activeOverlayLayerIds() {
  return OVERLAYS.filter(o => o.id && state.overlays.has(o.id) && !o.years).map(o => o.layer);
}

export function initMap() {
  const view = store.get('view', { c: [47.27, 8.5], z: 13 });
  const map = L.map('map', {
    center: view.c, zoom: view.z, minZoom: 7, maxZoom: 21, zoomControl: false,
    maxBounds: [[44.8, 4.0], [48.8, 12.5]], maxBoundsViscosity: 0.8,
  });
  state.map = map;
  map.createPane('overlays').style.zIndex = 250;
  map.createPane('nature').style.zIndex = 300;
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  map.attributionControl.setPrefix(false);
  setBase(state.base);
  [...state.overlays].forEach(id => setOverlay(id, true));
  map.on('moveend', () => {
    const c = map.getCenter();
    store.set('view', { c: [c.lat, c.lng], z: map.getZoom() });
  });
  return map;
}

// Standort, falls bekannt – sonst Kartenmitte.
export function here() {
  if (state.userPos) return state.userPos;
  const c = state.map.getCenter();
  return [c.lat, c.lng];
}

// ---------- Sheet / Tabs ----------
const tabs = {}; // id -> { title, render(body) }
let currentTab = null;

export function registerTab(id, title, render) { tabs[id] = { title, render }; }

export function openTab(id, arg) {
  const t = tabs[id];
  if (!t) return;
  currentTab = id;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  $('#sheetTitle').textContent = t.title;
  const body = $('#sheetBody');
  body.innerHTML = '';
  body.scrollTop = 0;
  $('#sheet').hidden = false;
  t.render(body, arg);
  setTimeout(() => state.map.invalidateSize(), 50);
}

export function closeSheet() {
  currentTab = null;
  $('#sheet').hidden = true;
  $$('#tabs button').forEach(b => b.classList.remove('on'));
}

export function sheetSize(size) { // 'small' | '' | 'big'
  const s = $('#sheet');
  s.classList.remove('small', 'big');
  if (size) s.classList.add(size);
}

export function initSheet() {
  $$('#tabs button').forEach(b => b.addEventListener('click', () => {
    if (currentTab === b.dataset.tab && !$('#sheet').hidden) closeSheet();
    else { sheetSize(''); openTab(b.dataset.tab); }
  }));
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetSize').addEventListener('click', () => {
    const s = $('#sheet');
    sheetSize(s.classList.contains('big') ? 'small' : s.classList.contains('small') ? '' : 'big');
  });
}

export function currentTabId() { return currentTab; }
export { toast };
