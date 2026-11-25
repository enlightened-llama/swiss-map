// Orte aus OpenStreetMap (Overpass): Spielplätze, Feuerstellen, Brunnen …
import { state, here, toast } from './core.js';
import { esc, store, haversine, fmtDist, debounce } from './util.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const has = (t, k, ...v) => t[k] != null && (v.length === 0 || v.includes(t[k]));

export const CATS = [
  { id: 'playground', emoji: '🛝', name: 'Spielplätze', q: ['nwr[leisure=playground]'], is: t => has(t, 'leisure', 'playground') },
  { id: 'fire', emoji: '🔥', name: 'Feuerstellen', q: ['nwr[leisure=firepit]', 'nwr[amenity=bbq]'], is: t => has(t, 'leisure', 'firepit') || has(t, 'amenity', 'bbq') },
  { id: 'picnic', emoji: '🧺', name: 'Picknickplätze', q: ['nwr[tourism=picnic_site]', 'node[leisure=picnic_table]'], is: t => has(t, 'tourism', 'picnic_site') || has(t, 'leisure', 'picnic_table') },
  { id: 'water', emoji: '🚰', name: 'Trinkwasser', q: ['node[amenity=drinking_water]'], is: t => has(t, 'amenity', 'drinking_water') },
  { id: 'wc', emoji: '🚻', name: 'Toiletten', q: ['nwr[amenity=toilets]'], is: t => has(t, 'amenity', 'toilets') },
  { id: 'view', emoji: '🔭', name: 'Aussichtspunkte & Türme', q: ['node[tourism=viewpoint]', 'nwr[man_made=tower]["tower:type"=observation]'], is: t => has(t, 'tourism', 'viewpoint') || has(t, 'tower:type', 'observation') },
  { id: 'swim', emoji: '🏊', name: 'Badeplätze', q: ['nwr[leisure=bathing_place]', 'nwr[leisure=swimming_area]', 'nwr[amenity=public_bath]', 'nwr[leisure=water_park]'], is: t => has(t, 'leisure', 'bathing_place', 'swimming_area', 'water_park') || has(t, 'amenity', 'public_bath') },
  { id: 'animals', emoji: '🦌', name: 'Tierparks & Zoos', q: ['nwr[tourism=zoo]', 'nwr[attraction=animal]'], is: t => has(t, 'tourism', 'zoo') || has(t, 'attraction', 'animal') },
  { id: 'falls', emoji: '💦', name: 'Wasserfälle & Höhlen', q: ['node[waterway=waterfall]', 'node[natural=cave_entrance]'], is: t => has(t, 'waterway', 'waterfall') || has(t, 'natural', 'cave_entrance') },
  { id: 'castle', emoji: '🏰', name: 'Burgen & Ruinen', q: ['nwr[historic=castle]', 'nwr[historic=ruins]'], is: t => has(t, 'historic', 'castle', 'ruins') },
  { id: 'shelter', emoji: '🛖', name: 'Unterstände & Hütten', q: ['nwr[amenity=shelter][shelter_type!=public_transport]'], is: t => has(t, 'amenity', 'shelter') },
];

export const active = new Set(store.get('pois', ['playground', 'fire']));
let group;
let fetched = null;      // { bounds, key }
let loading = false;
let hinted = false;
const MIN_ZOOM = 12;

export async function overpass(query) {
  let lastErr;
  for (const url of ENDPOINTS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()).elements || [];
    } catch (e) { lastErr = e; } finally { clearTimeout(timer); }
  }
  throw lastErr;
}

function buildQuery(catIds, area) {
  const parts = CATS.filter(c => catIds.includes(c.id)).flatMap(c => c.q).map(q => `${q}(${area});`).join('');
  return `[out:json][timeout:25];(${parts});out center tags 1500;`;
}

export function toPois(elements, catIds) {
  const cats = CATS.filter(c => catIds.includes(c.id));
  const out = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    const t = el.tags || {};
    if (lat == null) continue;
    const cat = cats.find(c => c.is(t));
    if (cat) out.push({ id: `${el.type}/${el.id}`, lat, lon, tags: t, cat });
  }
  return out;
}

// Orte im Umkreis (für «Um mich herum» und den Rundweg-Generator)
export async function poisAround(center, radius, catIds) {
  const els = await overpass(buildQuery(catIds, `around:${Math.round(radius)},${center[0].toFixed(5)},${center[1].toFixed(5)}`));
  return toPois(els, catIds).map(p => ({ ...p, dist: haversine(center, [p.lat, p.lon]) })).sort((a, b) => a.dist - b.dist);
}

const TAG_LABELS = {
  opening_hours: 'Offen', description: 'Info', fee: 'Gebühr', wheelchair: 'Rollstuhl', ele: 'Höhe (m)', height: 'Höhe (m)',
  covered: 'Überdacht', fireplace: 'Feuerstelle', drinking_water: 'Trinkwasser', toilets: 'WC', operator: 'Betreiber', surface: 'Belag',
  changing_table: 'Wickeltisch', access: 'Zugang',
};
const VAL = { yes: 'ja', no: 'nein', limited: 'eingeschränkt', designated: 'ja', private: 'privat', customers: 'nur Gäste' };

export function popupHtml(p) {
  const t = p.tags;
  const rows = Object.entries(TAG_LABELS).filter(([k]) => t[k]).map(([k, l]) => `<br><small>${l}: ${esc(VAL[t[k]] || t[k])}</small>`).join('');
  const playEquip = Object.keys(t).filter(k => k.startsWith('playground:') && t[k] === 'yes').map(k => k.slice(11)).join(', ');
  const web = t.website || t['contact:website'];
  return `<b>${p.cat.emoji} ${esc(t.name || p.cat.name)}</b>${t.name ? `<br><small>${p.cat.name}</small>` : ''}${rows}`
    + (playEquip ? `<br><small>Geräte: ${esc(playEquip)}</small>` : '')
    + `<div><button class="btn" data-act="routeTo" data-lat="${p.lat}" data-lon="${p.lon}">🥾 Route hierhin</button>`
    + `<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}">🚗 Google Maps</a>`
    + (web && /^https?:\/\//.test(web) ? `<a class="btn" target="_blank" rel="noopener" href="${esc(web)}">🌐 Web</a>` : '') + '</div>';
}

export function marker(p) {
  return L.marker([p.lat, p.lon], {
    icon: L.divIcon({ className: '', html: `<div class="poi">${p.cat.emoji}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
    title: p.tags.name || p.cat.name,
  }).bindPopup(popupHtml(p));
}

async function refresh() {
  const map = state.map;
  if (!active.size) { group.clearLayers(); fetched = null; return; }
  if (map.getZoom() < MIN_ZOOM) {
    if (!hinted) { toast('Näher heranzoomen, um Spielplätze & Co. zu laden'); hinted = true; }
    return;
  }
  const key = [...active].sort().join(',');
  if (loading || (fetched && fetched.key === key && fetched.bounds.contains(map.getBounds()))) return;
  loading = true;
  const b = map.getBounds().pad(0.35);
  try {
    const els = await overpass(buildQuery([...active], `${b.getSouth().toFixed(4)},${b.getWest().toFixed(4)},${b.getNorth().toFixed(4)},${b.getEast().toFixed(4)}`));
    group.clearLayers();
    toPois(els, [...active]).forEach(p => marker(p).addTo(group));
    fetched = { bounds: b, key };
  } catch (e) {
    toast('Orte konnten nicht geladen werden (OpenStreetMap-Server überlastet?) – später nochmals versuchen');
  } finally { loading = false; }
}

export function setCat(id, on) {
  on ? active.add(id) : active.delete(id);
  store.set('pois', [...active]);
  hinted = false;
  refresh();
}

export function initPois() {
  group = L.layerGroup().addTo(state.map);
  state.map.on('moveend', debounce(refresh, 500));
  refresh();
}

// ---------- «Um mich herum» ----------
export function renderNearby(body) {
  const center = here();
  body.innerHTML = `<p class="mute">${state.userPos ? 'Rund um deinen Standort' : 'Rund um die Kartenmitte (Standort noch nicht bekannt – ◎ antippen)'} · Umkreis 2,5 km</p>
    <div class="chips" id="nbChips"></div><div id="nbList"><p class="mute">Suche …</p></div>`;
  const list = body.querySelector('#nbList'), chips = body.querySelector('#nbChips');
  let all = [], filter = null;
  const draw = () => {
    const items = all.filter(p => !filter || p.cat.id === filter).slice(0, 80);
    list.innerHTML = items.length ? '' : '<p class="mute">Nichts gefunden.</p>';
    for (const p of items) {
      const el = document.createElement('div');
      el.className = 'list-item';
      el.innerHTML = `<span class="em">${p.cat.emoji}</span><span class="grow">${esc(p.tags.name || p.cat.name)}</span><span class="dist">${fmtDist(p.dist)}</span>`;
      el.onclick = () => {
        state.map.setView([p.lat, p.lon], Math.max(state.map.getZoom(), 16));
        L.popup().setLatLng([p.lat, p.lon]).setContent(popupHtml(p)).openOn(state.map);
      };
      list.append(el);
    }
  };
  poisAround(center, 2500, CATS.map(c => c.id)).then(res => {
    all = res;
    const counts = {};
    res.forEach(p => { counts[p.cat.id] = (counts[p.cat.id] || 0) + 1; });
    chips.innerHTML = CATS.filter(c => counts[c.id]).map(c => `<button class="chip" data-id="${c.id}">${c.emoji} ${counts[c.id]}</button>`).join('');
    chips.onclick = e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filter = filter === b.dataset.id ? null : b.dataset.id;
      [...chips.children].forEach(c => c.classList.toggle('on', c.dataset.id === filter));
      draw();
    };
    draw();
  }).catch(() => { list.innerHTML = '<p class="mute">Die Suche hat nicht geklappt (OpenStreetMap-Server nicht erreichbar). Bitte später nochmals versuchen.</p>'; });
}
