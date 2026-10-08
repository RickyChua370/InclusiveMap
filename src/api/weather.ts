import { OPEN_METEO } from "../config";
import type { HourWeather, LngLat } from "../types";

/**
 * Fetch today's hourly forecast from Open-Meteo (free, no API key).
 * Returns the 24 hours of the current local day.
 */
export async function fetchHourlyWeather(point: LngLat): Promise<HourWeather[]> {
  const [lng, lat] = point;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly:
      "temperature_2m,apparent_temperature,uv_index,cloud_cover,precipitation_probability",
    timezone: "auto",
    forecast_days: "1",
  });

  const res = await fetch(`${OPEN_METEO}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const data = await res.json();

  const h = data.hourly;
  const times: string[] = h.time;

  return times.map((time, i) => {
    const hour = new Date(time).getHours();
    return {
      time,
      hour,
      temp: h.temperature_2m[i],
      apparentTemp: h.apparent_temperature[i],
      uv: h.uv_index[i],
      cloud: h.cloud_cover[i],
      rainProb: h.precipitation_probability?.[i] ?? 0,
    } satisfies HourWeather;
  });
}

/**
 * Offline fallback forecast so the demo never breaks if the network is down.
 * Produces a believable hot-afternoon / cloudy-later curve.
 */
export function syntheticWeather(): HourWeather[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const peak = 13; // hottest around 1pm
    const temp = 24 + 10 * Math.exp(-((hour - peak) ** 2) / 18);
    const uv =
      hour < 7 || hour > 19
        ? 0
        : Math.max(0, 9 * Math.exp(-((hour - 12) ** 2) / 10));
    const cloud = hour >= 14 ? 70 : 20; // clouds roll in during the afternoon
    const rainProb = hour >= 16 && hour <= 18 ? 40 : 10;
    return {
      time: `2026-01-01T${String(hour).padStart(2, "0")}:00`,
      hour,
      temp: Math.round(temp * 10) / 10,
      apparentTemp: Math.round((temp + 2) * 10) / 10,
      uv: Math.round(uv * 10) / 10,
      cloud,
      rainProb,
    };
  });
}
