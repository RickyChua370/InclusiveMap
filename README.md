# InclusiveMap

> The coolest, flattest, step-free path — at the safest time to walk.

InclusiveMap routes vulnerable pedestrians (elderly, wheelchair/mobility-aid
users, parents with strollers) along a **comfort-optimised** path instead of the
fastest one, and tells them the **safest time of day** to make the trip. It then
sells small inclusive businesses (pharmacies, cafés, certified green buildings)
a way to appear as trusted rest/refuge stops on those routes.

Built for the SDG hackathon. **100% free & open data — no paid APIs, no LLM.**

---

## Why it's different

| Existing tool | What it does | What it's missing |
|---|---|---|
| ShadeMap / Shadowmap | Visualises shade for any time | **No routing** — sells to realtors/solar |
| AccessMap | Wheelchair pedestrian routing | **Washington State only**, academic, **no heat** |
| Wheelmap | Rates venues red/yellow/green | **No routing**, no heat |

**InclusiveMap is the first to fuse heat + accessibility into a single route
score, add a "when to go" time dimension, and sell it to the small businesses
that benefit from inclusive footfall.**

## The comfort score

A single 0–100 score blends five factors (weights in `src/config.ts`):

- **Heat** (apparent/feels-like temperature) — 30%
- **UV** (direct-sun exposure risk) — 20%
- **Shade** (sun angle via SunCalc + cloud cover + street cover) — 20%
- **Rain** probability — 15%
- **Accessibility** (benches, water, toilets vs. steps along the way) — 15%

Because shade and weather are recomputed per hour, a **cloudy, cooler afternoon
can beat a clear, hot morning** — the core "go at 12, not 11" insight.

## Data sources (all free)

- **OpenRouteService** — walking + wheelchair routing (free tier, 2k req/day)
- **Open-Meteo** — hourly temp / feels-like / UV / cloud / rain (no key)
- **OpenStreetMap via Overpass** — benches, drinking water, toilets, steps (no key)
- **SunCalc** — sun position for shade estimation (client-side)
- **MapLibre + CARTO basemap** — map rendering (no key)

## Run it

```bash
npm install
cp .env.example .env   # optional: add a free OpenRouteService key for real streets
npm run dev            # local dev
npm run build          # production build -> dist/
```

Without an ORS key the app runs in **demo mode** (estimated path) so it never
breaks on stage. Open-Meteo and Overpass work with no key.

## How to demo

1. Pick a pilot city (**Selangor** or **Vilnius**).
2. **Traveller** tab → choose a persona → click a start, click a destination.
3. Read the comfort score + the **When to Go** strip (best departure window).
4. Drag the hour slider to show the score change through the day.
5. **Inclusive Business** tab → drop a pharmacy/café → it becomes a refuge stop.

## Pitch mapping (case brief)

- **Problem/User** — vulnerable pedestrians get only "fastest" routes; heat is an
  accessibility barrier. Users: elderly, disabled, pregnant, carers.
- **Solution/Innovation** — first comfort+time-aware inclusive router.
- **Impact/SDG** — SDG 3 (health), 10 (inequality), 11 (cities), 13 (climate
  adaptation).
- **Marketing** — we don't charge the vulnerable user; we charge inclusive
  businesses who gain verified footfall + a trust badge.
- **Finance** — SaaS tiers + "Inclusive Stop" listings + city audit reports;
  near-zero build cost → ~85%+ software margins; replicable city-by-city.
- **Build** — static web app on free data; deployable as-is.

## Tech

Vite + React + TypeScript, MapLibre GL, SunCalc. No backend required.
```
src/
  config.ts            cities, endpoints, scoring weights
  types.ts             shared types
  api/                 weather, overpass, routing (+ offline fallbacks)
  engine/              shade estimation + comfort scoring
  components/          MapView, RoutePanel, WhenToGo, BusinessPanel
  App.tsx              wiring + state
```
