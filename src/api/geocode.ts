import type { City } from "../config";
import type { LngLat } from "../types";

export interface GeoResult {
  label: string;
  lngLat: LngLat;
}

/**
 * Geocode a free-text query using Nominatim (OpenStreetMap, free, no key).
 * Biased towards the selected pilot city's area via a viewbox so local
 * searches (e.g. "Setia City Mall") resolve correctly.
 *
 * Nominatim usage policy: keep volume low and send an identifying UA/Referer
 * (the browser sends Referer automatically). Fine for an interactive demo.
 */
export async function geocode(
  query: string,
  city: City,
  limit = 5,
): Promise<GeoResult[]> {
  if (!query.trim()) return [];
  const [lng, lat] = city.center;
  // viewbox is left,top,right,bottom (lng/lat) — a rough box around the city.
  const d = 0.5;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: String(limit),
    viewbox: `${lng - d},${lat + d},${lng + d},${lat - d}`,
    bounded: "0",
    addressdetails: "0",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Geocoder error ${res.status}`);
  const data = (await res.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return data.map((r) => ({
    label: r.display_name,
    lngLat: [parseFloat(r.lon), parseFloat(r.lat)] as LngLat,
  }));
}
