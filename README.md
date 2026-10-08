# RBFAdata — P1 West-Vlaanderen 2025/26

Interactief analyse- en scoutingdashboard voor het volledige seizoen 2025/26.

## Starten

```bash
npm ci
npm run build
npm run preview -- --host 0.0.0.0
```

De preview draait standaard op poort 4173.

## Dashboardstructuur

### Analyst Cockpit
De bovenlaag is bedoeld om snel van data naar een analysevraag te gaan:

- **Ploegdiagnose** — league ranks voor resultaat, aanval, verdediging, ELO, thuis/uit, eerste goal, veerkracht, slotfase, discipline en wisselimpact.
- **Tegenstanderscout** — profielvergelijking met een andere ploeg plus impactspelers en goal threats.
- **League landscape** — aanval (goals voor per match) versus verdediging (goals tegen per match).
- **Competitiebrede spelersscouting** — betrouwbare spelers gerangschikt op MVP-index, RAPM, xPts-impact of productie.
- **Kern & continuïteit** — selectieomvang, structurele kern, Top-11 minutenaandeel, starter- en keepercontinuïteit.

### Wedstrijdpatronen
- thuis/uit-profiel
- wedstrijdverloop en late puntenwinst/-verlies vanaf 60', 75' of 85'
- tijd op voorsprong/gelijk/achter
- goal- en kaarttiming
- wisselmomenten en resultaat na wissels
- eerste goal en resultaat
- rust/eindstandscenario's
- punten- en ELO-evolutie

### Spelersanalyse
- team-impact index
- head-to-head tussen ploeggenoten met gepaarde bootstrap
- basiselftal-heatmap over M1–M30
- minuten versus RAPM/xPts-impact
- RAPM-segmentcontext
- klassieke spelerstatistieken en leaderboards

## Belangrijkste definities

### RAPM / 90
Geregulariseerde modelschatting van invloed op doelpuntensaldo per 90 minuten, met correctie voor spelers op het veld en pre-match ELO-context. Het is een contextuele modelschatting, geen causale individuele rating.

### xPts-impact / 90
Spelersimpact op veranderingen in verwachte wedstrijdpunten, op basis van minuut, score, numerieke situatie en pre-match ploegsterkte. Dit is de spelersmetric.

### ELO-xPts
Teammetric: `3 × P(winst) + P(gelijk)`, afgeleid uit pre-match ELO met een draw-correctie. **ELO-xPts is niet hetzelfde als xPts-impact.**

### Team-impact index
Relatieve 0–100 index **binnen de eigen ploeg**. De score combineert totale, stabiliteitsgecorrigeerde RAPM- en xPts-impact. Gebruik hem niet om 97 bij ploeg A rechtstreeks als "97% beter" te vergelijken met 90 bij ploeg B.

### MVP-index
Competitiebrede shortlist voor spelers met minimaal 40% van de beschikbare speelminuten (1.080 minuten in een seizoen van 30 wedstrijden):

- 45% percentiel van stabiliteitsgecorrigeerde totale RAPM-impact
- 55% percentiel van stabiliteitsgecorrigeerde totale xPts-impact

De index is bedoeld voor kandidaatselectie, niet als definitief spelersoordeel.

## Modelvalidatie 2025/26

- 240 gespeelde wedstrijden
- 240/240 wedstrijdscores gereconstrueerd uit de events
- own goals verwerkt volgens RBFA-semantiek: `event.team` is de begunstigde ploeg
- RAPM regularisatie: alpha 2560
- xPts-impact regularisatie: alpha 12800
- 200 volledige wedstrijd-bootstraps
- betrouwbaarheidsgrens voor de hoofdscoutinglijsten: 1.080 minuten

## Interpretatie voor scouting

Gebruik de data in deze volgorde:

1. zoek ploeg- of spelerssignalen die duidelijk afwijken van de reeks;
2. controleer volume, interval en bootstrapstabiliteit;
3. vergelijk ploeggenoten rechtstreeks wanneer dat relevant is;
4. kijk naar wedstrijd- en line-upcontext;
5. valideer de conclusie met rol, positie en video.

De dataset bevat geen betrouwbare veldposities voor alle spelers. Het dashboard maakt daarom bewust geen positie-gecorrigeerde spelersranking.

## Data opnieuw exporteren

```bash
npm run build:data
```

Dit bouwt de reguliere dashboard-JSONs plus:

- `public/data/match_flow.json`
- `public/data/team_lineup_heatmap.json`

`public/data/team_player_impact.json` bevat de historisch gevalideerde robuuste RAPM/xPts-bootstrapuitkomsten voor het afgesloten seizoen 2025/26.
