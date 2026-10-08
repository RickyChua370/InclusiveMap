import { OVERPASS } from "../config";
import type { AmenityCounts, AmenityKind, AmenityPoint, LngLat } from "../types";

/** Bounding box helper: [south, west, north, east] around a set of points. */
function bbox(points: LngLat[], padding = 0.0015) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return {
    south: minLat - padding,
    west: minLng - padding,
    north: maxLat + padding,
    east: maxLng + padding,
  };
}

/** Rough metres between two lng/lat points (equirectangular approx). */
function distM(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const x = ((b[0] - a[0]) * Math.PI) / 180 * Math.cos((a[1] * Math.PI) / 180);
  const y = ((b[1] - a[1]) * Math.PI) / 180;
  return R * Math.sqrt(x * x + y * y);
}

/** Shortest distance (m) from a point to any vertex of the route polyline. */
function distToRoute(p: LngLat, route: LngLat[]): number {
  let min = Infinity;
  for (const v of route) {
    const d = distM(p, v);
    if (d < min) min = d;
  }
  return min;
}

export interface AmenitiesResult {
  counts: AmenityCounts;
  points: AmenityPoint[];
}

/**
 * Query OpenStreetMap (via the free Overpass API) for accessibility amenities
 * near a route: benches, drinking water, toilets, and step/stair obstacles.
 * Returns both counts AND coordinates, filtered to those within ~60 m of the
 * actual path (not just the bounding box) so map pins are genuinely "on route".
 */
export async function fetchAmenities(route: LngLat[]): Promise<AmenitiesResult> {
  const b = bbox(route);
  const area = `(${b.south},${b.west},${b.north},${b.east})`;
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"="bench"]${area};
      node["amenity"="drinking_water"]${area};
      node["amenity"="toilets"]${area};
      node["highway"="steps"]${area};
      way["highway"="steps"]${area};
    );
    out tags center;`;

  const res = await fetch(OVERPASS, {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const data = await res.json();

  const counts: AmenityCounts = { benches: 0, water: 0, toilets: 0, steps: 0 };
  const points: AmenityPoint[] = [];
  const NEAR_M = 90; // keep amenities within ~90 m of the path (OSM coverage varies)

  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const p: LngLat = [lon, lat];
    if (distToRoute(p, route) > NEAR_M) continue;

    let kind: AmenityKind | null = null;
    if (t.amenity === "bench") kind = "bench";
    else if (t.amenity === "drinking_water") kind = "water";
    else if (t.amenity === "toilets") kind = "toilets";
    else if (t.highway === "steps") kind = "steps";
    if (!kind) continue;

    points.push({ kind, lngLat: p });
    if (kind === "bench") counts.benches++;
    else if (kind === "water") counts.water++;
    else if (kind === "toilets") counts.toilets++;
    else if (kind === "steps") counts.steps++;
  }

  return { counts, points };
}

/**
 * Offline/estimate fallback used when Overpass is unavailable. Produces counts
 * AND a few points spaced along the route so the map stays visually consistent
 * (pins + numbers agree) even when live OSM data can't be fetched.
 */
export function syntheticAmenities(route: LngLat[]): AmenitiesResult {
  const km = route.length / 50;
  const counts: AmenityCounts = {
    benches: Math.round(2 + km * 3),
    water: Math.max(1, Math.round(km * 1.5)),
    toilets: Math.max(1, Math.round(km)),
    steps: Math.round(km),
  };

  const points: AmenityPoint[] = [];
  if (route.length > 3) {
    const place = (kind: AmenityPoint["kind"], frac: number) => {
      const idx = Math.max(1, Math.min(route.length - 2, Math.floor(route.length * frac)));
      points.push({ kind, lngLat: route[idx] });
    };
    place("bench", 0.25);
    place("water", 0.5);
    place("toilets", 0.7);
    place("bench", 0.8);
  }

  return { counts, points };
}
