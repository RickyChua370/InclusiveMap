import { ORS_BASE, ORS_KEY, PROFILES, type ProfileId } from "../config";
import type { LngLat, RouteResult } from "../types";
import { fetchAmenities, syntheticAmenities } from "./overpass";
import { estimateShadeFraction } from "../engine/shade";

/**
 * Request a walking/wheelchair route from OpenRouteService (free tier).
 * Falls back to a smoothed straight-line path if no key is set or the call
 * fails — so the demo is resilient on stage.
 */
export async function getRoute(
  start: LngLat,
  end: LngLat,
  profile: ProfileId,
  when: Date,
): Promise<RouteResult> {
  const orsProfile = PROFILES[profile].orsProfile;

  let coordinates: LngLat[] | null = null;
  let distanceM = 0;
  let durationS = 0;
  let isFallback = false;

  if (ORS_KEY) {
    try {
      const res = await fetch(`${ORS_BASE}/${orsProfile}/geojson`, {
        method: "POST",
        headers: {
          Authorization: ORS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: [start, end] }),
      });
      if (res.ok) {
        const data = await res.json();
        const feat = data.features?.[0];
        if (feat) {
          coordinates = feat.geometry.coordinates as LngLat[];
          distanceM = feat.properties.summary.distance;
          durationS = feat.properties.summary.duration;
        }
      }
    } catch {
      // fall through to fallback
    }
  }

  if (!coordinates) {
    isFallback = true;
    coordinates = interpolate(start, end, 60);
    distanceM = haversine(start, end);
    // Elderly/stroller walk ~1.1 m/s; wheelchair ~0.9 m/s.
    durationS = distanceM / (profile === "wheelchair" ? 0.9 : 1.1);
  }

  // Enrich with the data nobody else surfaces: shade + accessibility amenities.
  let amenities;
  try {
    amenities = await fetchAmenities(coordinates);
  } catch {
    amenities = syntheticAmenities(coordinates);
  }

  const shadeFraction = estimateShadeFraction(coordinates, when);

  return { coordinates, distanceM, durationS, shadeFraction, amenities, isFallback };
}

// --- geometry helpers --------------------------------------------------------

function interpolate(a: LngLat, b: LngLat, n: number): LngLat[] {
  const pts: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // slight sinusoidal wobble so the fallback path looks like a street walk
    const wob = Math.sin(t * Math.PI * 3) * 0.0006;
    pts.push([
      a[0] + (b[0] - a[0]) * t + wob,
      a[1] + (b[1] - a[1]) * t + wob * 0.5,
    ]);
  }
  return pts;
}

export function haversine(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
