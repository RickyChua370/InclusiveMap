// Shared domain types for InclusiveMap.

export type LngLat = [number, number];

/** One hour of weather from Open-Meteo, trimmed to what we need. */
export interface HourWeather {
  time: string; // ISO local time
  hour: number; // 0-23
  temp: number; // °C
  apparentTemp: number; // feels-like °C
  uv: number; // UV index
  cloud: number; // cloud cover %
  rainProb: number; // precipitation probability %
  precip: number; // actual precipitation mm
  code: number; // WMO weather code
}

/** Forecast bundle: hourly series + live "now" conditions + local clock. */
export interface WeatherData {
  hours: HourWeather[];
  localHour: number; // the location's current hour (0-23)
  nowPrecip: number; // current precipitation mm
  nowCode: number; // current WMO weather code
  nowRaining: boolean; // is it raining right now?
}

/** A routed path returned by the routing engine. */
export interface RouteResult {
  coordinates: LngLat[]; // [lng, lat][]
  distanceM: number;
  durationS: number;
  /** Fraction (0-1) of the route estimated to be in shade at a given sun angle. */
  shadeFraction: number;
  /** Accessibility amenity counts found near the route. */
  amenities: AmenityCounts;
  /** Individual amenities (with coords) close to the route, for map pins. */
  amenityPoints: AmenityPoint[];
  /** Per-segment comfort for coloring the route line (one value per gap between
   *  consecutive coordinates; 0 = exposed/hot, 1 = shaded/comfortable). */
  segmentComfort: number[];
  /** Whether this came from the real routing API or the offline fallback. */
  isFallback: boolean;
}

export interface AmenityCounts {
  benches: number;
  water: number;
  toilets: number;
  steps: number; // obstacles — steps/stairs near the path (lower is better)
}

export type AmenityKind = "bench" | "water" | "toilets" | "steps";

/** A single mapped amenity along the route. */
export interface AmenityPoint {
  kind: AmenityKind;
  lngLat: LngLat;
}

/** A comfort score for one hour, used by the "When to Go" strip. */
export interface HourlyComfort {
  hour: number;
  time: string;
  score: number; // 0-100
  band: "good" | "ok" | "warm" | "hot" | "severe";
  reason: string; // short human explanation
  weather: HourWeather;
}

/** A business/venue registered on the "Inclusive Business" side. */
export interface Venue {
  id: string;
  name: string;
  category: "pharmacy" | "cafe" | "green_building" | "clinic" | "other";
  lngLat: LngLat;
  stepFree: boolean;
  hasRestSeating: boolean;
  hasAccessibleToilet: boolean;
  airConditioned: boolean;
}
