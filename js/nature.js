// Natur: Artenliste mit Verbreitungskarten (GBIF), «Was lebt hier?» (iNaturalist), Tierstimmen, Pilz-Radar.
import { state, toast, setOverlay } from './core.js';
import { $, esc, getJSON, store, monthBar, MONTHS_LONG } from './util.js';

const GROUPS = [
  { id: 'vogel', name: 'Vögel', emoji: '🐦', inat: 'Aves', sound: true },
  { id: 'saeuger', name: 'Säugetiere', emoji: '🦊', inat: 'Mammalia' },
  { id: 'amphib', name: 'Amphibien & Reptilien', emoji: '🐸', inat: 'Amphibia,Reptilia', sound: true },
  { id: 'insekt', name: 'Insekten', emoji: '🦋', inat: 'Insecta' },
  { id: 'pilz', name: 'Pilze', emoji: '🍄', inat: 'Fungi' },
  { id: 'pflanze', name: 'Pflanzen', emoji: '🌸', inat: 'Plantae' },
];
const STYLES = [
  { style: 'classic.poly', label: 'gelb → rot' },
  { style: 'purpleYellow.poly', label: 'violett → gelb' },
  { style: 'green.poly', label: 'grün' },
];

let species = null;
let sub = store.get('natureSub', 'arten');
let group = 'vogel', onlyNow = false, hereGroup = 'vogel', hereNow = true;
const dist = new Map(); // key -> { layer, name, style }
let inatLayer = null, inatName = '';

async function loadSpecies() {
  species ||= await getJSON('data/species.json');
  return species;
}

// ---------- Verbreitung ----------
function toggleDistribution(s) {
  const key = 'g' + s.gbif;
  if (dist.has(key)) { state.map.removeLayer(dist.get(key).layer); dist.delete(key); return false; }
  if (dist.size >= STYLES.length) { toast(`Höchstens ${STYLES.length} Arten gleichzeitig – zuerst eine ausblenden`); return false; }
  const st = STYLES.find(x => ![...dist.values()].some(d => d.style === x));
  const layer = L.tileLayer(`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=${s.gbif}&bin=hex&hexPerTile=28&style=${st.style}&srs=EPSG:3857&year=2000,${new Date().getFullYear()}`, {
    tileSize: 512, zoomOffset: -1, opacity: 0.7, pane: 'nature', maxNativeZoom: 13, maxZoom: 21,
    attribution: 'Beobachtungen: <a href="https://www.gbif.org" target="_blank" rel="noopener">GBIF.org</a>',
  }).addTo(state.map);
  dist.set(key, { layer, name: s.name, style: st });
  if (state.map.getZoom() > 11) toast('Tipp: herauszoomen, um die Verbreitung in der ganzen Schweiz zu sehen');
  return true;
}

function showInatPoints(taxonId, name) {
  if (inatLayer) state.map.removeLayer(inatLayer);
  inatLayer = null;
  if (taxonId == null) return;
  inatName = name;
  inatLayer = L.tileLayer(`https://api.inaturalist.org/v1/points/{z}/{x}/{y}.png?taxon_id=${taxonId}&quality_grade=research`, {
    opacity: 0.9, pane: 'nature', maxZoom: 21, attribution: 'Beobachtungen: <a href="https://www.inaturalist.org" target="_blank" rel="noopener">iNaturalist</a>',
  }).addTo(state.map);
}

function activeLayersHtml() {
  const items = [...dist.entries()].map(([k, d]) => `<button class="chip on" data-rm="${k}">${esc(d.name)} (${d.style.label}) ✕</button>`);
  if (inatLayer) items.push(`<button class="chip on" data-rm="inat">${esc(inatName)} (Punkte) ✕</button>`);
  return items.length ? `<div class="infobox"><b>Auf der Karte:</b><div class="chips">${items.join('')}</div>
    <span class="mute">Farbige Sechsecke = dort wurde die Art seit 2000 gemeldet; kräftiger = mehr Meldungen. Keine Meldung heisst nicht, dass die Art fehlt – oft war nur niemand dort.</span></div>` : '';
}

// ---------- Tierstimmen ----------
async function playSound(latin, target) {
  target.innerHTML = '<p class="mute">Suche Aufnahme …</p>';
  try {
    const d = await getJSON(`https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(latin)}&sounds=true&quality_grade=research&sound_license=cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nc-sa&order_by=votes&per_page=6`);
    const sounds = d.results.flatMap(o => o.sounds.map(s => ({ ...s, place: o.place_guess }))).filter(s => s.file_url).slice(0, 3);
    if (!sounds.length) { target.innerHTML = '<p class="mute">Keine frei nutzbare Aufnahme gefunden.</p>'; return; }
    target.innerHTML = sounds.map(s => `<audio controls preload="none" src="${esc(s.file_url)}"></audio><div class="mute">${esc(s.attribution || '')}${s.place ? ' · ' + esc(s.place) : ''}</div>`).join('');
    target.querySelector('audio').play().catch(() => {});
  } catch { target.innerHTML = '<p class="mute">Aufnahme konnte nicht geladen werden.</p>'; }
}

// ---------- Arten-Tab ----------
async function renderArten(el) {
  const list = await loadSpecies();
  const month = new Date().getMonth() + 1;
  const g = GROUPS.find(x => x.id === group);
  const items = list.filter(s => s.gruppe === group && (!onlyNow || s.monate.includes(month)));
  el.innerHTML = `${activeLayersHtml()}
    <div class="chips">${GROUPS.map(x => `<button class="chip ${x.id === group ? 'on' : ''}" data-g="${x.id}">${x.emoji} ${x.name}</button>`).join('')}</div>
    <label class="row"><input type="checkbox" id="onlyNow" ${onlyNow ? 'checked' : ''}> nur was im ${MONTHS_LONG[month - 1]} gut zu beobachten ist</label>
    ${items.map(s => `<details class="card" data-key="${s.gbif}">
      <summary>${s.foto ? `<img class="ph" loading="lazy" src="${esc(s.foto.replace('medium', 'square'))}" alt="">` : `<span class="em">${g.emoji}</span>`}
        <span class="ti"><b>${esc(s.name)}</b><small><i>${esc(s.latin)}</i></small></span>
        ${dist.has('g' + s.gbif) ? '<span class="badge r-niedrig">auf Karte</span>' : ''}</summary>
      <p>${esc(s.tipp)}</p>${monthBar(s.monate)}
      <div class="row" style="margin-top:8px">
        <button class="btn pri" data-dist>${dist.has('g' + s.gbif) ? 'Verbreitung ausblenden' : '🗺️ Verbreitung zeigen'}</button>
        ${g.sound ? '<button class="btn" data-sound>🔊 Stimme</button>' : ''}
        <a class="btn" target="_blank" rel="noopener" href="https://de.wikipedia.org/wiki/${encodeURIComponent(s.latin.replace(/ /g, '_'))}">Wikipedia</a>
      </div><div data-audio></div>
      ${s.foto ? `<img class="big" loading="lazy" src="${esc(s.foto)}" alt="${esc(s.name)}"><div class="mute">Foto: ${esc(s.fotoCredit)} · iNaturalist</div>` : ''}
    </details>`).join('') || '<p class="mute">In diesem Monat ist aus dieser Gruppe nichts Besonderes eingetragen.</p>'}
    <p class="mute">Verbreitungsdaten: GBIF.org (Meldungen von eBird, iNaturalist, Museen, Info-Zentren u. a.).</p>`;
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { group = b.dataset.g; renderArten(el); });
  $('#onlyNow', el).onchange = e => { onlyNow = e.target.checked; renderArten(el); };
  bindRemove(el, () => renderArten(el));
  el.querySelectorAll('details.card').forEach(card => {
    const s = list.find(x => String(x.gbif) === card.dataset.key);
    card.querySelector('[data-dist]').onclick = async () => { toggleDistribution(s); const open = card.dataset.key; await renderArten(el); el.querySelector(`details[data-key="${open}"]`).open = true; };
    const sb = card.querySelector('[data-sound]');
    if (sb) sb.onclick = () => playSound(s.latin, card.querySelector('[data-audio]'));
  });
}

function bindRemove(el, rerender) {
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    if (b.dataset.rm === 'inat') showInatPoints(null);
    else { state.map.removeLayer(dist.get(b.dataset.rm).layer); dist.delete(b.dataset.rm); }
    rerender();
  });
}

// ---------- «Was lebt hier?» ----------
function renderHere(el) {
  const month = new Date().getMonth() + 1;
  el.innerHTML = `${activeLayersHtml()}
    <p class="mute">Zeigt, welche Arten im aktuellen Kartenausschnitt am häufigsten gemeldet wurden (iNaturalist, bestätigte Beobachtungen).</p>
    <div class="chips">${GROUPS.map(x => `<button class="chip ${x.id === hereGroup ? 'on' : ''}" data-g="${x.id}">${x.emoji} ${x.name}</button>`).join('')}</div>
    <label class="row"><input type="checkbox" id="hereNow" ${hereNow ? 'checked' : ''}> nur Beobachtungen aus dem ${MONTHS_LONG[month - 1]}</label>
    <p><button class="btn pri" id="hereGo">🔎 Im Kartenausschnitt suchen</button></p><div id="hereList"></div>`;
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { hereGroup = b.dataset.g; renderHere(el); });
  $('#hereNow', el).onchange = e => { hereNow = e.target.checked; };
  bindRemove(el, () => renderHere(el));
  $('#hereGo', el).onclick = async () => {
    const out = $('#hereList', el), g = GROUPS.find(x => x.id === hereGroup), b = state.map.getBounds();
    out.innerHTML = '<p class="mute">Suche …</p>';
    try {
      const d = await getJSON(`https://api.inaturalist.org/v1/observations/species_counts?nelat=${b.getNorth().toFixed(4)}&nelng=${b.getEast().toFixed(4)}&swlat=${b.getSouth().toFixed(4)}&swlng=${b.getWest().toFixed(4)}&iconic_taxa=${g.inat}&locale=de&per_page=40&quality_grade=research${hereNow ? '&month=' + month : ''}`);
      if (!d.results.length) { out.innerHTML = '<p class="mute">Keine Meldungen in diesem Ausschnitt. Probiere einen grösseren Ausschnitt oder ohne Monatsfilter.</p>'; return; }
      out.innerHTML = `<p class="mute">${d.total_results} Arten gemeldet – die häufigsten:</p>` + d.results.map((r, i) => {
        const t = r.taxon, ph = t.default_photo;
        return `<details class="card" data-i="${i}"><summary>${ph?.square_url ? `<img class="ph" loading="lazy" src="${esc(ph.square_url)}" alt="">` : `<span class="em">${g.emoji}</span>`}
          <span class="ti"><b>${esc(t.preferred_common_name || t.name)}</b><small><i>${esc(t.name)}</i></small></span><span class="badge">${r.count}×</span></summary>
          <div class="row" style="margin-top:8px"><button class="btn pri" data-pts>📍 Fundpunkte zeigen</button>
          ${g.sound ? '<button class="btn" data-sound>🔊 Stimme</button>' : ''}
          <a class="btn" target="_blank" rel="noopener" href="https://www.inaturalist.org/taxa/${t.id}">Mehr</a></div><div data-audio></div>
          ${ph?.attribution ? `<div class="mute">Foto: ${esc(ph.attribution)}</div>` : ''}</details>`;
      }).join('');
      out.querySelectorAll('details.card').forEach(card => {
        const t = d.results[+card.dataset.i].taxon;
        card.querySelector('[data-pts]').onclick = () => { showInatPoints(t.id, t.preferred_common_name || t.name); toast('Fundpunkte werden auf der Karte angezeigt'); };
        const sb = card.querySelector('[data-sound]');
        if (sb) sb.onclick = () => playSound(t.name, card.querySelector('[data-audio]'));
      });
    } catch { out.innerHTML = '<p class="mute">Abfrage fehlgeschlagen. Bitte später nochmals versuchen.</p>'; }
  };
}

// ---------- Pilz-Radar ----------
// Einfaches Schätzmodell: Saison × Niederschlag der letzten zwei Wochen × Temperatur × Frost.
const FUNGI = {
  alle: { name: 'Speisepilze allgemein', season: [0, 0, 0.1, 0.3, 0.4, 0.5, 0.7, 0.9, 1, 1, 0.6, 0.15], topt: [9, 19] },
  steinpilz: { name: 'Steinpilz', season: [0, 0, 0, 0, 0.1, 0.4, 0.7, 0.9, 1, 0.9, 0.3, 0], topt: [10, 19] },
  eierschwamm: { name: 'Eierschwamm', season: [0, 0, 0, 0, 0.1, 0.6, 0.9, 1, 1, 0.8, 0.3, 0], topt: [12, 21] },
  morchel: { name: 'Morchel', season: [0, 0, 0.3, 1, 0.9, 0.2, 0, 0, 0, 0, 0, 0], topt: [8, 16], frostOk: true },
  herbst: { name: 'Spätherbstpilze (Hallimasch, Trompeten)', season: [0, 0, 0, 0, 0, 0, 0, 0.2, 0.6, 1, 1, 0.4], topt: [4, 13], frostOk: true },
};
let fungus = 'alle', fungiLayer = null;
const clamp = v => Math.max(0, Math.min(1, v));
const sum = a => a.reduce((x, y) => x + (y || 0), 0);

export function fungiScore(daily, kind, month) {
  const f = FUNGI[kind], n = daily.precipitation_sum.length - 1; // letzter Eintrag = heute (Prognose)
  const pr = daily.precipitation_sum.slice(0, n + 1), tm = daily.temperature_2m_mean.slice(0, n + 1), tn = daily.temperature_2m_min.slice(0, n + 1);
  const rain14 = sum(pr.slice(-14)), rainCore = sum(pr.slice(-11, -2)); // Regen vor 3–10 Tagen zählt am meisten
  const rain = clamp(rainCore / 35) * 0.7 + clamp(rain14 / 70) * 0.3;
  const t7 = sum(tm.slice(-7)) / 7;
  const temp = t7 < f.topt[0] ? clamp(1 - (f.topt[0] - t7) / 7) : t7 > f.topt[1] ? clamp(1 - (t7 - f.topt[1]) / 7) : 1;
  const tmin = Math.min(...tn.slice(-5).filter(v => v != null));
  const frost = tmin < -4 ? 0.15 : tmin < -1 ? (f.frostOk ? 0.8 : 0.4) : 1;
  const season = f.season[month - 1];
  return { score: Math.round(100 * season * rain * temp * frost), rain14, t7, tmin, season, rainF: rain, tempF: temp };
}

const scoreColor = s => s >= 65 ? '#d9480f' : s >= 45 ? '#f08a24' : s >= 25 ? '#f6d743' : '#9e9e9e';
const scoreWord = s => s >= 65 ? 'sehr gut' : s >= 45 ? 'gut' : s >= 25 ? 'mässig' : s >= 8 ? 'schwach' : 'kaum Chancen';

async function runFungi(el) {
  const out = $('#fungiOut', el), map = state.map, N = 5;
  let b = map.getBounds();
  if (b.getNorth() - b.getSouth() < 0.12) { // Wetterdaten sind nur auf einige Kilometer genau -> Ausschnitt vergrössern
    const c = map.getCenter();
    b = L.latLngBounds([c.lat - 0.07, c.lng - 0.1], [c.lat + 0.07, c.lng + 0.1]);
    map.fitBounds(b);
  }
  out.innerHTML = '<p class="mute">Lade Wetterdaten der letzten 14 Tage …</p>';
  const lats = [], lons = [], cells = [];
  const dLat = (b.getNorth() - b.getSouth()) / N, dLon = (b.getEast() - b.getWest()) / N;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const s = b.getSouth() + i * dLat, w = b.getWest() + j * dLon;
    cells.push([[s, w], [s + dLat, w + dLon]]);
    lats.push((s + dLat / 2).toFixed(4)); lons.push((w + dLon / 2).toFixed(4));
  }
  try {
    let d = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=precipitation_sum,temperature_2m_mean,temperature_2m_min&past_days=14&forecast_days=1&timezone=Europe%2FZurich`);
    if (!Array.isArray(d)) d = [d];
    const month = new Date().getMonth() + 1;
    if (fungiLayer) map.removeLayer(fungiLayer);
    fungiLayer = L.layerGroup().addTo(map);
    const res = d.map(x => ({ ...fungiScore(x.daily, fungus, month), ele: x.elevation }));
    res.forEach((r, k) => {
      L.rectangle(cells[k], { stroke: true, color: '#fff', weight: 1, fillColor: scoreColor(r.score), fillOpacity: 0.45, pane: 'nature' })
        .bindPopup(`<b>🍄 ${FUNGI[fungus].name}: ${r.score}/100 (${scoreWord(r.score)})</b><br>Regen 14 Tage: ${Math.round(r.rain14)} mm<br>Ø-Temperatur 7 Tage: ${r.t7.toFixed(1)} °C<br>Tiefstwert 5 Tage: ${r.tmin.toFixed(1)} °C<br>Höhe ca. ${Math.round(r.ele)} m`)
        .addTo(fungiLayer);
      L.marker(L.latLngBounds(cells[k]).getCenter(), { interactive: false, icon: L.divIcon({ className: 'cell-label', html: r.score, iconSize: [30, 14] }) }).addTo(fungiLayer);
    });
    const best = res.reduce((a, c) => c.score > a.score ? c : a), mid = res[Math.floor(res.length / 2)];
    const why = [];
    if (mid.season < 0.2) why.push(`${MONTHS_LONG[month - 1]} ist ausserhalb der Hauptsaison`);
    if (mid.rainF < 0.4) why.push('es war in den letzten zwei Wochen zu trocken');
    if (mid.tempF < 0.5) why.push(`die Temperaturen (Ø ${mid.t7.toFixed(0)} °C) passen schlecht`);
    if (mid.tmin < -1) why.push('es gab Frost');
    out.innerHTML = `<div class="infobox"><b>Bester Wert im Ausschnitt: ${best.score}/100 – ${scoreWord(best.score)}</b>
      ${why.length ? `<br>In der Kartenmitte bremst: ${why.join(', ')}.` : '<br>Saison, Feuchtigkeit und Temperatur passen in der Kartenmitte gut zusammen.'}</div>
      <div class="legend">kaum<span class="bar"></span>sehr gut</div>
      <p><button class="btn" id="fungiClear">Raster ausblenden</button> <button class="btn" id="fungiWald">🌲 Waldtyp einblenden</button></p>`;
    $('#fungiClear', el).onclick = () => { map.removeLayer(fungiLayer); fungiLayer = null; out.innerHTML = ''; };
    $('#fungiWald', el).onclick = () => { setOverlay('wald', true); toast('Waldtyp-Ebene eingeblendet (Karte → Natur)'); };
  } catch (e) {
    out.innerHTML = '<p class="mute">Wetterdaten konnten nicht geladen werden. Bitte später nochmals versuchen.</p>';
  }
}

function renderFungi(el) {
  el.innerHTML = `<p>Schätzt, wie günstig die Bedingungen für Pilze im Kartenausschnitt gerade sind – aus <b>Saison, Regen und Temperatur der letzten 14 Tage</b> (Open-Meteo).</p>
    <div class="row"><select id="fungus">${Object.entries(FUNGI).map(([k, f]) => `<option value="${k}" ${k === fungus ? 'selected' : ''}>${f.name}</option>`).join('')}</select>
    <button class="btn pri" id="fungiGo">Berechnen</button></div>
    <div id="fungiOut"></div>
    <div class="warnbox"><b>Wichtig:</b> Das ist ein grobes Wettermodell, keine Fundortkarte – es weiss nichts über Boden und Baumarten. Für die Suche zählt der richtige Wald (Ebene «Waldtyp»). Jeden Fund zur <a href="https://www.vapko.ch" target="_blank" rel="noopener">amtlichen Pilzkontrolle (VAPKO)</a> bringen, kantonale Schontage und Sammelmengen beachten, in Schutzgebieten nicht sammeln.</div>`;
  $('#fungus', el).onchange = e => { fungus = e.target.value; };
  $('#fungiGo', el).onclick = () => runFungi(el);
}

// ---------- Panel ----------
export function renderNature(body) {
  body.innerHTML = `<div class="subtabs">
    <button data-s="arten">Arten & Verbreitung</button><button data-s="hier">Was lebt hier?</button><button data-s="pilz">Pilz-Radar</button></div><div id="natBody"></div>`;
  const nb = $('#natBody', body);
  const show = s => {
    sub = s; store.set('natureSub', s);
    body.querySelectorAll('.subtabs button').forEach(b => b.classList.toggle('on', b.dataset.s === s));
    ({ arten: renderArten, hier: renderHere, pilz: renderFungi })[s](nb);
  };
  body.querySelectorAll('.subtabs button').forEach(b => b.onclick = () => show(b.dataset.s));
  show(sub);
}
