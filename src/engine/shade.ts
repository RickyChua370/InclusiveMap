import * as SunCalc from "suncalc";
import type { LngLat } from "../types";

/**
 * Estimate what fraction of a route is shaded at a given time.
 *
 * A full physical shadow simulation (building footprints + heights) is heavy;
 * for the MVP we use a defensible heuristic driven by SUN ELEVATION:
 *   - Night (sun below horizon)      -> fully "shaded" (no sun exposure).
 *   - Low sun (dawn/dusk)            -> long shadows, high shade.
 *   - High midday sun                -> little shade unless tree/building cover.
 * We modulate by a per-route "cover" proxy (route length & waviness as a stand-in
 * for built-up streets vs. open plazas). This keeps the engine 100% free and
 * client-side, and the hook (shade varies by time of day) is what the pitch needs.
 */
export function estimateShadeFraction(route: LngLat[], when: Date): number {
  if (route.length === 0) return 0.5;
  const mid = route[Math.floor(route.length / 2)];
  const pos = SunCalc.getPosition(when, mid[1], mid[0]);
  const elevationDeg = (pos.altitude * 180) / Math.PI;

  if (elevationDeg <= 0) return 1; // sun down: no direct-sun exposure

  // Shade from sun angle: ~1 at horizon, decreasing as the sun climbs.
  // At 90° (overhead) baseline shade ~0.15; at 10° ~0.8.
  const angleShade = Math.max(0.1, Math.cos((elevationDeg * Math.PI) / 180));

  // Built-environment cover proxy: wavier/denser polylines ~ more street canyon.
  const cover = routeCoverProxy(route);

  // Blend: street cover adds up to +0.25 shade.
  return clamp01(angleShade * 0.8 + cover * 0.25);
}

/** Sun elevation in degrees at the route midpoint (used for labels). */
export function sunElevation(route: LngLat[], when: Date): number {
  if (route.length === 0) return 0;
  const mid = route[Math.floor(route.length / 2)];
  const pos = SunCalc.getPosition(when, mid[1], mid[0]);
  return (pos.altitude * 180) / Math.PI;
}

function routeCoverProxy(route: LngLat[]): number {
  if (route.length < 3) return 0.3;
  let turns = 0;
  for (let i = 2; i < route.length; i++) {
    const a = bearing(route[i - 2], route[i - 1]);
    const b = bearing(route[i - 1], route[i]);
    if (Math.abs(a - b) > 15) turns++;
  }
  return clamp01(turns / route.length + 0.2);
}

function bearing(a: LngLat, b: LngLat): number {
  return (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
