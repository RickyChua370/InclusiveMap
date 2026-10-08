// ---------------------------------------------------------------------------
// InclusiveMap configuration: pilot cities, free API endpoints, scoring weights.
// Everything here uses FREE, keyless-or-free-tier services only.
// ---------------------------------------------------------------------------

export interface City {
  id: string;
  name: string;
  country: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  blurb: string;
}

/** Two pilot cities for the hackathon demo. */
export const CITIES: City[] = [
  {
    id: "selangor",
    name: "Selangor",
    country: "Malaysia",
    center: [101.5869, 3.0738], // Shah Alam area
    zoom: 13,
    blurb: "Tropical heat & high UV — the heat-safety case is strongest here.",
  },
  {
    id: "vilnius",
    name: "Vilnius",
    country: "Lithuania",
    center: [25.2797, 54.6872],
    zoom: 13,
    blurb: "Competition host city — cold snaps, slopes & cobbled old-town streets.",
  },
];

/**
 * OpenRouteService public API.
 * Free tier: 2,000 requests/day. A key is free to create at openrouteservice.org.
 * For the hackathon, drop a key into VITE_ORS_KEY (.env). If absent, the app
 * falls back to a straight-line "demo route" so the UI still works offline.
 */
export const ORS_BASE = "https://api.openrouteservice.org/v2/directions";
export const ORS_KEY: string = import.meta.env.VITE_ORS_KEY ?? "";

/** Open-Meteo — free, no API key. Hourly forecast for the "When to Go" feature. */
export const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

/** Overpass API — free, no key. Pulls accessibility amenities from OpenStreetMap. */
export const OVERPASS = "https://overpass-api.de/api/interpreter";

/**
 * Free raster basemap, defined INLINE so we don't depend on any hosted vector
 * style (CARTO's public vector tiles now 404 without a token). These raster
 * tiles need no key and no registration. CARTO "light_all" gives a clean,
 * low-ink look that keeps the route and markers readable.
 */
export const MAP_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "basemap",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

// --- Comfort scoring weights -------------------------------------------------
// The comfort score (0-100, higher = more comfortable/safe) blends five factors.
// These weights are tunable and are a key talking point in the pitch.
export const COMFORT_WEIGHTS = {
  heat: 0.3, // apparent temperature (feels-like)
  uv: 0.2, // UV index — direct-sun exposure risk
  rain: 0.15, // precipitation probability
  shade: 0.2, // how shaded the route is at that hour (sun angle + cover)
  accessibility: 0.15, // step-free, benches, water, toilets along the way
} as const;

/** Mobility profiles map to ORS routing profiles. */
export const PROFILES = {
  wheelchair: {
    id: "wheelchair",
    label: "Wheelchair / mobility aid",
    orsProfile: "wheelchair",
  },
  elderly: {
    id: "elderly",
    label: "Elderly / slow walker",
    orsProfile: "foot-walking",
  },
  stroller: {
    id: "stroller",
    label: "Parent with stroller",
    orsProfile: "foot-walking",
  },
} as const;

export type ProfileId = keyof typeof PROFILES;
