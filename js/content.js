// Sammelkalender (essbare Wildpflanzen), Spielideen, Survival-Tipps.
import { $, esc, getJSON, monthBar, MONTHS, MONTHS_LONG } from './util.js';

const cache = {};
const load = async name => (cache[name] ||= await getJSON(`data/${name}.json`));

const KAT = { kraut: '🌿 Kräuter', 'blüte': '🌼 Blüten', beere: '🫐 Beeren', nuss: '🌰 Nüsse', baum: '🌳 Bäume', pilz: '🍄 Pilze' };
const RISK = { niedrig: 'leicht zu erkennen', mittel: 'genau hinschauen', hoch: 'Verwechslungsgefahr!' };
let month = new Date().getMonth() + 1, kat = null;

export async function renderFood(body) {
  const all = await load('wildfood');
  const items = all.filter(f => f.monate.includes(month) && (!kat || f.kategorie === kat))
    .sort((a, b) => ['niedrig', 'mittel', 'hoch'].indexOf(a.risiko) - ['niedrig', 'mittel', 'hoch'].indexOf(b.risiko));
  body.innerHTML = `
    <div class="warnbox"><b>Nur essen, was du zu 100 % sicher erkennst.</b> Die Steckbriefe sind eine Lernhilfe und ersetzen kein Bestimmungsbuch und keinen Kurs. Pilze immer zur <a href="https://www.vapko.ch" target="_blank" rel="noopener">Pilzkontrolle</a>. Bei Vergiftungsverdacht: <a href="tel:145"><b>Tox Info Suisse 145</b></a>.</div>
    <div class="chips scrollx">${MONTHS.map((m, i) => `<button class="chip ${i + 1 === month ? 'on' : ''}" data-m="${i + 1}">${m}</button>`).join('')}</div>
    <div class="chips">${Object.entries(KAT).map(([k, n]) => `<button class="chip ${k === kat ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div>
    <p class="mute">${items.length} Arten im ${MONTHS_LONG[month - 1]} (Richtwerte fürs Mittelland; in höheren Lagen 2–4 Wochen später)</p>
    ${items.map(f => `<details class="card"><summary><span class="em">${f.emoji}</span>
      <span class="ti"><b>${esc(f.name)}</b><small><i>${esc(f.latin)}</i> · ${esc(f.teile)}</small></span>
      <span class="badge r-${f.risiko}">${RISK[f.risiko]}</span></summary>
      ${monthBar(f.monate)}
      <dl><dt>Wo</dt><dd>${esc(f.lebensraum)}</dd>
      <dt>Sicher erkennen</dt><dd><ul>${f.erkennen.map(e => `<li>${esc(e)}</li>`).join('')}</ul></dd>
      ${f.verwechslung.length ? `<dt>Nicht verwechseln mit</dt><dd><ul>${f.verwechslung.map(v => `<li><b>${esc(v.art)}</b>${v.giftig ? ' ☠️ giftig' : ''} – ${esc(v.unterschied)}</li>`).join('')}</ul></dd>` : ''}
      <dt>Verwendung</dt><dd>${esc(f.verwendung)}</dd>
      <dt>Mit Kindern</dt><dd>${esc(f.kinder)}</dd></dl>
      ${f.hinweis ? `<div class="warnbox">${esc(f.hinweis)}</div>` : ''}
      <div class="row"><a class="btn" target="_blank" rel="noopener" href="https://www.infoflora.ch/de/flora/${encodeURIComponent(f.latin.toLowerCase().replace(/ /g, '-'))}.html">Info Flora</a>
      <a class="btn" target="_blank" rel="noopener" href="https://de.wikipedia.org/wiki/${encodeURIComponent(f.latin.replace(/ /g, '_'))}">Wikipedia</a></div>
    </details>`).join('') || '<p class="mute">In diesem Monat gibt es aus dieser Kategorie nichts zu sammeln.</p>'}
    <p class="mute">Sammelregeln: nur so viel, wie ihr braucht; nichts aus Schutzgebieten; nicht an Strassenrändern und Hundewegen; bodennah Gesammeltes gut waschen oder erhitzen.</p>`;
  body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { month = +b.dataset.m; renderFood(body); });
  body.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kat = kat === b.dataset.k ? null : b.dataset.k; renderFood(body); });
  body.querySelector('.chip.on[data-m]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---------- Ideen ----------
const SEASONS = ['winter', 'winter', 'frühling', 'frühling', 'frühling', 'sommer', 'sommer', 'sommer', 'herbst', 'herbst', 'herbst', 'winter'];
const ORT = { wald: '🌲 Wald', wiese: '🌼 Wiese', wasser: '💧 Wasser', 'überall': '📍 Überall', schnee: '❄️ Schnee' };
const SKAT = { orientierung: '🧭 Orientierung', feuer: '🔥 Feuer', wasser: '💧 Wasser', wetter: '⛈️ Wetter', notfall: '🚑 Notfall', unterschlupf: '⛺ Unterschlupf', knoten: '🪢 Knoten', tiere: '🐄 Tiere' };
let ideaSub = 'spiele', ort = null, seasonOnly = true, skat = null;

async function renderGames(el) {
  const all = await load('games');
  const season = SEASONS[new Date().getMonth()];
  const items = all.filter(g => (!ort || g.ort === ort) && (!seasonOnly || g.jahreszeit.includes(season)));
  el.innerHTML = `<div class="chips">${Object.entries(ORT).map(([k, n]) => `<button class="chip ${k === ort ? 'on' : ''}" data-o="${k}">${n}</button>`).join('')}</div>
    <div class="row"><label class="row grow"><input type="checkbox" id="seasonOnly" ${seasonOnly ? 'checked' : ''}> passend zur Jahreszeit (${season})</label>
    <button class="btn" id="dice">🎲 Zufall</button></div>
    ${items.map(g => `<details class="card" data-id="${g.id}"><summary><span class="em">${g.emoji}</span>
      <span class="ti"><b>${esc(g.titel)}</b><small>${esc(g.alter)} · ${esc(g.dauer)} · ${ORT[g.ort] || esc(g.ort)}</small></span></summary>
      <p>${esc(g.anleitung)}</p><p class="mute">Material: ${esc(g.material)}</p></details>`).join('') || '<p class="mute">Nichts gefunden – Filter lockern.</p>'}`;
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { ort = ort === b.dataset.o ? null : b.dataset.o; renderGames(el); });
  $('#seasonOnly', el).onchange = e => { seasonOnly = e.target.checked; renderGames(el); };
  $('#dice', el).onclick = () => {
    const cards = [...el.querySelectorAll('details.card')];
    if (!cards.length) return;
    cards.forEach(c => { c.open = false; });
    const c = cards[Math.floor(Math.random() * cards.length)];
    c.open = true;
    c.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
}

async function renderSurvival(el) {
  const all = await load('survival');
  const items = all.filter(s => !skat || s.kategorie === skat);
  el.innerHTML = `<div class="infobox"><b>Notfall:</b> <a href="tel:144">144 Sanität</a> · <a href="tel:1414">1414 Rega</a> · <a href="tel:112">112</a> · <a href="tel:145">145 Vergiftung</a></div>
    <div class="chips">${Object.entries(SKAT).map(([k, n]) => `<button class="chip ${k === skat ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div>
    ${items.map(s => `<details class="card"><summary><span class="em">${s.emoji}</span><span class="ti"><b>${esc(s.titel)}</b><small>${SKAT[s.kategorie] || ''}</small></span></summary>
      <p>${esc(s.text)}</p><p class="mute">👧 ${esc(s.kinder)}</p></details>`).join('')}`;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { skat = skat === b.dataset.k ? null : b.dataset.k; renderSurvival(el); });
}

export function renderIdeas(body) {
  body.innerHTML = '<div class="subtabs"><button data-s="spiele">🎲 Spielideen</button><button data-s="survival">🧭 Draussen-Wissen</button></div><div id="ideaBody"></div>';
  const ib = $('#ideaBody', body);
  const show = s => {
    ideaSub = s;
    body.querySelectorAll('.subtabs button').forEach(b => b.classList.toggle('on', b.dataset.s === s));
    (s === 'spiele' ? renderGames : renderSurvival)(ib);
  };
  body.querySelectorAll('.subtabs button').forEach(b => b.onclick = () => show(b.dataset.s));
  show(ideaSub);
}
