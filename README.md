# Entdeckerkarte Schweiz

Eine Familien- und Naturkarte der Schweiz fürs Handy: Wanderwege, Rundweg-Vorschläge, Spielplätze,
Tiere und Pflanzen, Sammelkalender und Ideen für draussen.

Reine Web-App ohne Build-Schritt und ohne Server – `index.html` genügt.

## Starten

```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

Für die Nutzung auf dem Handy eignet sich jedes statische Hosting (z. B. GitHub Pages).
Die Seite lässt sich über «Zum Home-Bildschirm» wie eine App installieren.

## Funktionen

| Bereich | Was | Datenquelle |
|---|---|---|
| Karte | Landeskarte, Luftbild, Winterkarte, historische Karten | swisstopo (WMTS) |
| Ebenen | Wanderwege, ÖV-Haltestellen, Seegrund-Relief, Schutzgebiete, Waldtyp … | swisstopo, BAFU, ASTRA, BAV |
| Orte | Spielplätze, Feuerstellen, Trinkwasser, WC, Badeplätze … | OpenStreetMap (Overpass) |
| Route | Zeichnen entlang der Wege, Höhenprofil, Gehzeit, GPX, Rundweg-Generator, Kinderwagen-Check | BRouter (OSM), swisstopo-Höhenprofil |
| Natur | 74 Arten mit Verbreitungskarte, «Was lebt hier?», Tierstimmen | GBIF, iNaturalist |
| Pilz-Radar | Schätzung aus Saison, Regen und Temperatur der letzten 14 Tage | Open-Meteo |
| Sammeln | Saisonkalender mit 43 Steckbriefen essbarer Wildpflanzen und Pilze | `data/wildfood.json` |
| Ideen | 30 Spielideen, 25 Draussen-/Notfall-Tipps | `data/games.json`, `data/survival.json` |

## Aufbau

- `js/core.js` – Karte, Ebenen-Definitionen, Panel
- `js/poi.js` – Orte aus OpenStreetMap, «Um mich herum»
- `js/route.js` – Routing, Höhenprofil, Rundwege, GPX
- `js/nature.js` – Arten, Verbreitung, Stimmen, Pilz-Radar
- `js/content.js` – Sammelkalender, Spielideen, Draussen-Wissen
- `tools/build_species.py` – baut `data/species.json` (GBIF-Schlüssel, Fotos) neu

## Hinweis zu den Inhalten

Die Steckbriefe und Tipps in `data/` sind redaktionelle Texte und nicht von Fachleuten geprüft.
Sie ersetzen kein Bestimmungsbuch, keinen Kurs und keine amtliche Pilzkontrolle.
