import { OVERPASS } from "../config";
import type { AmenityCounts, LngLat } from "../types";

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

/**
 * Query OpenStreetMap (via the free Overpass API) for accessibility amenities
 * near a route: benches, drinking water, toilets, and step/stair obstacles.
 * These tags are rich in OSM but almost no router surfaces them.
 */
export async function fetchAmenities(
  route: LngLat[],
): Promise<AmenityCounts> {
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
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    if (t.amenity === "bench") counts.benches++;
    else if (t.amenity === "drinking_water") counts.water++;
    else if (t.amenity === "toilets") counts.toilets++;
    else if (t.highway === "steps") counts.steps++;
  }
  return counts;
}

/** Offline fallback amenity estimate so the demo always renders. */
export function syntheticAmenities(route: LngLat[]): AmenityCounts {
  const km = route.length / 50;
  return {
    benches: Math.round(2 + km * 3),
    water: Math.round(km * 1.5),
    toilets: Math.max(1, Math.round(km)),
    steps: Math.round(km),
  };
}
