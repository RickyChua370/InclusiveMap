import { COMFORT_WEIGHTS } from "../config";
import type {
  AmenityCounts,
  HourlyComfort,
  HourWeather,
  LngLat,
  RouteResult,
} from "../types";
import { estimateShadeFraction } from "./shade";

// --- Per-factor sub-scores (each 0-1, higher = more comfortable) -------------

/** Feels-like temperature. Comfy band ~18-26°C; penalise heat and cold. */
function heatScore(apparentTemp: number): number {
  if (apparentTemp >= 18 && apparentTemp <= 26) return 1;
  if (apparentTemp > 26) return clamp01(1 - (apparentTemp - 26) / 16); // 42°C -> 0
  return clamp01(1 - (18 - apparentTemp) / 20); // -2°C -> 0
}

/** UV index. 0-2 fine, 8+ very high. */
function uvScore(uv: number): number {
  return clamp01(1 - uv / 11);
}

/** Rain probability. */
function rainScore(rainProb: number): number {
  return clamp01(1 - rainProb / 100);
}

/** Accessibility: reward benches/water/toilets, penalise steps. */
export function accessibilityScore(a: AmenityCounts): number {
  const positives =
    Math.min(1, a.benches / 6) * 0.4 +
    Math.min(1, a.water / 3) * 0.3 +
    Math.min(1, a.toilets / 2) * 0.3;
  const stepPenalty = Math.min(0.6, a.steps * 0.15);
  return clamp01(positives - stepPenalty);
}

// --- The headline comfort score ---------------------------------------------

/**
 * Blend the five factors into a single 0-100 comfort score for one hour.
 * Shade is recomputed for THAT hour's sun angle, and cloud cover boosts the
 * effective shade (clouds = less direct sun), which is why cloudy afternoons
 * can score better than clear mornings — the core "When to Go" insight.
 */
export function hourlyComfort(
  routeCoords: LngLat[],
  amenities: AmenityCounts,
  w: HourWeather,
  dayDate: Date,
): HourlyComfort {
  const when = new Date(dayDate);
  when.setHours(w.hour, 0, 0, 0);

  const baseShade = estimateShadeFraction(routeCoords, when);
  const cloudBoost = (w.cloud / 100) * 0.5; // overcast adds up to +0.5 shade
  const shade = clamp01(baseShade + cloudBoost);

  const parts = {
    heat: heatScore(w.apparentTemp),
    uv: uvScore(w.uv),
    rain: rainScore(w.rainProb),
    shade,
    accessibility: accessibilityScore(amenities),
  };

  const score01 =
    parts.heat * COMFORT_WEIGHTS.heat +
    parts.uv * COMFORT_WEIGHTS.uv +
    parts.rain * COMFORT_WEIGHTS.rain +
    parts.shade * COMFORT_WEIGHTS.shade +
    parts.accessibility * COMFORT_WEIGHTS.accessibility;

  const score = Math.round(score01 * 100);
  return {
    hour: w.hour,
    time: w.time,
    score,
    band: band(score),
    reason: reason(w, shade),
    weather: w,
  };
}

/** Score every daylight-ish hour so the UI can show the best window. */
export function dailyComfort(
  route: RouteResult,
  weather: HourWeather[],
  dayDate: Date,
): HourlyComfort[] {
  return weather.map((w) =>
    hourlyComfort(route.coordinates, route.amenities, w, dayDate),
  );
}

/** Pick the best hour within a sensible waking window (6:00-21:00). */
export function bestWindow(hours: HourlyComfort[]): HourlyComfort | null {
  const waking = hours.filter((h) => h.hour >= 6 && h.hour <= 21);
  if (waking.length === 0) return null;
  return waking.reduce((best, h) => (h.score > best.score ? h : best));
}

// --- labels ------------------------------------------------------------------

export function band(score: number): HourlyComfort["band"] {
  if (score >= 80) return "good";
  if (score >= 65) return "ok";
  if (score >= 50) return "warm";
  if (score >= 35) return "hot";
  return "severe";
}

export const BAND_COLOR: Record<HourlyComfort["band"], string> = {
  good: "#16a34a",
  ok: "#84cc16",
  warm: "#eab308",
  hot: "#f97316",
  severe: "#dc2626",
};

export const BAND_LABEL: Record<HourlyComfort["band"], string> = {
  good: "Comfortable",
  ok: "OK",
  warm: "Warm",
  hot: "Hot — take care",
  severe: "Severe — avoid",
};

function reason(w: HourWeather, shade: number): string {
  const bits: string[] = [];
  if (w.apparentTemp >= 32) bits.push(`feels ${Math.round(w.apparentTemp)}°C`);
  else if (w.apparentTemp <= 5) bits.push(`cold ${Math.round(w.apparentTemp)}°C`);
  else bits.push(`${Math.round(w.apparentTemp)}°C`);
  if (w.uv >= 6) bits.push(`high UV ${Math.round(w.uv)}`);
  if (w.cloud >= 60) bits.push("cloudy");
  if (w.rainProb >= 40) bits.push(`${w.rainProb}% rain`);
  if (shade >= 0.6) bits.push("mostly shaded");
  return bits.join(" · ");
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
