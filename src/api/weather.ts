import { OPEN_METEO } from "../config";
import type { HourWeather, LngLat, WeatherData } from "../types";

/** WMO weather codes we treat as "raining right now". */
export function isRainingCode(code: number): boolean {
  // 51-67 drizzle/rain, 80-82 rain showers, 95-99 thunderstorm
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  );
}

/**
 * Fetch the hourly forecast + CURRENT conditions from Open-Meteo (free, no key).
 * `localHour` is the location's current hour, so recommendations start from now.
 */
export async function fetchHourlyWeather(point: LngLat): Promise<WeatherData> {
  const [lng, lat] = point;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,precipitation,weather_code",
    hourly:
      "temperature_2m,apparent_temperature,uv_index,cloud_cover,precipitation_probability,precipitation,weather_code",
    timezone: "auto",
    forecast_days: "1",
  });

  const res = await fetch(`${OPEN_METEO}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const data = await res.json();

  const h = data.hourly;
  const times: string[] = h.time;

  const hours: HourWeather[] = times.map((time, i) => ({
    time,
    hour: new Date(time).getHours(),
    temp: h.temperature_2m[i],
    apparentTemp: h.apparent_temperature[i],
    uv: h.uv_index[i],
    cloud: h.cloud_cover[i],
    rainProb: h.precipitation_probability?.[i] ?? 0,
    precip: h.precipitation?.[i] ?? 0,
    code: h.weather_code?.[i] ?? 0,
  }));

  // The location's current local hour, parsed from the "current.time" string
  // (already in local time thanks to timezone=auto).
  const localHour = new Date(data.current.time).getHours();

  return {
    hours,
    localHour,
    nowPrecip: data.current.precipitation ?? 0,
    nowCode: data.current.weather_code ?? 0,
    nowRaining: isRainingCode(data.current.weather_code ?? 0),
  };
}

/**
 * Offline fallback forecast so the demo never breaks if the network is down.
 * Produces a believable hot-afternoon / rainy-later curve.
 */
export function syntheticWeather(): WeatherData {
  const hours: HourWeather[] = Array.from({ length: 24 }, (_, hour) => {
    const peak = 13;
    const temp = 24 + 10 * Math.exp(-((hour - peak) ** 2) / 18);
    const uv =
      hour < 7 || hour > 19
        ? 0
        : Math.max(0, 9 * Math.exp(-((hour - 12) ** 2) / 10));
    const cloud = hour >= 14 ? 70 : 20;
    const rainProb = hour >= 16 && hour <= 18 ? 60 : 10;
    const precip = hour >= 16 && hour <= 18 ? 0.5 : 0;
    return {
      time: `2026-01-01T${String(hour).padStart(2, "0")}:00`,
      hour,
      temp: Math.round(temp * 10) / 10,
      apparentTemp: Math.round((temp + 2) * 10) / 10,
      uv: Math.round(uv * 10) / 10,
      cloud,
      rainProb,
      precip,
      code: precip > 0 ? 61 : cloud > 50 ? 3 : 1,
    };
  });
  const localHour = new Date().getHours();
  const now = hours[localHour];
  return {
    hours,
    localHour,
    nowPrecip: now.precip,
    nowCode: now.code,
    nowRaining: now.precip > 0,
  };
}
