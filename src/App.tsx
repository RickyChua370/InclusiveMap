import { useEffect, useMemo, useState } from "react";
import { CITIES, PROFILES, type ProfileId } from "./config";
import type { LngLat, RouteResult, Venue, WeatherData } from "./types";
import { getRoute } from "./api/routing";
import { fetchHourlyWeather, syntheticWeather } from "./api/weather";
import { dailyComfort } from "./engine/comfort";
import MapView from "./components/MapView";
import RoutePanel from "./components/RoutePanel";
import WhenToGo from "./components/WhenToGo";
import BusinessPanel from "./components/BusinessPanel";
import SearchBar from "./components/SearchBar";
import "./App.css";

type Mode = "traveller" | "business";

export default function App() {
  const [cityId, setCityId] = useState(CITIES[0].id);
  const city = useMemo(() => CITIES.find((c) => c.id === cityId)!, [cityId]);

  const [mode, setMode] = useState<Mode>("traveller");
  const [profile, setProfile] = useState<ProfileId>("elderly");

  const [start, setStart] = useState<LngLat | null>(null);
  const [end, setEnd] = useState<LngLat | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [pendingPoint, setPendingPoint] = useState<LngLat | null>(null);
  const [userLocation, setUserLocation] = useState<LngLat | null>(null);

  const [selectedHour, setSelectedHour] = useState<number>(
    new Date().getHours(),
  );

  // Reset points when city changes.
  useEffect(() => {
    setStart(null);
    setEnd(null);
    setRoute(null);
    setPendingPoint(null);
  }, [cityId]);

  // Set both endpoints at once (from the search bar).
  function routeBetween(s: LngLat, e: LngLat) {
    setStart(s);
    setEnd(e);
    setRoute(null);
  }

  function handleMapClick(lngLat: LngLat) {
    if (mode === "business") {
      setPendingPoint(lngLat);
      return;
    }
    if (!start || (start && end)) {
      setStart(lngLat);
      setEnd(null);
      setRoute(null);
    } else {
      setEnd(lngLat);
    }
  }

  // Compute route + weather whenever we have both endpoints.
  useEffect(() => {
    (window as unknown as { __fetchDbg?: unknown }).__fetchDbg = {
      mode,
      hasStart: !!start,
      hasEnd: !!end,
      t: Date.now(),
    };
    if (mode !== "traveller" || !start || !end) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const when = new Date();
        when.setHours(selectedHour, 0, 0, 0);
        const [r, w] = await Promise.all([
          getRoute(start, end, profile, when),
          fetchHourlyWeather(start).catch(() => syntheticWeather()),
        ]);
        if (cancelled) return;
        const wd = w.hours.length ? w : syntheticWeather();
        setRoute(r);
        setWeather(wd);
        // Default the "planning for" hour to the destination's real local time.
        setSelectedHour(wd.localHour);
      } catch (e) {
        (window as unknown as { __fetchErr?: string }).__fetchErr = String(e);
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end, profile, mode]); // selectedHour handled below (no refetch needed)

  // Comfort for every hour (recomputes locally when inputs change — no API call).
  const comfortHours = useMemo(() => {
    if (!route || !weather) return [];
    return dailyComfort(route, weather.hours, new Date());
  }, [route, weather]);

  const nowComfort = useMemo(
    () => comfortHours.find((h) => h.hour === selectedHour) ?? null,
    [comfortHours, selectedHour],
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <header className="brand">
          <h1>
            Inclusive<span>Map</span>
          </h1>
          <p className="tagline">
            The coolest, flattest, step-free path — at the safest time to walk.
          </p>
        </header>

        <div className="tabs">
          <button
            className={mode === "traveller" ? "active" : ""}
            onClick={() => setMode("traveller")}
          >
            Traveller
          </button>
          <button
            className={mode === "business" ? "active" : ""}
            onClick={() => setMode("business")}
          >
            Inclusive Business
          </button>
        </div>

        <label className="field">
          Pilot city
          <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">{city.blurb}</p>

        {mode === "traveller" && (
          <>
            <label className="field">
              Who's walking?
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value as ProfileId)}
              >
                {Object.values(PROFILES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              Planning for hour: {hourLabel(selectedHour)}
              {weather && selectedHour === weather.localHour && (
                <span className="now-tag"> (now)</span>
              )}
              <input
                type="range"
                min={weather ? Math.min(weather.localHour, 21) : 6}
                max={21}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
              />
            </label>

            <SearchBar
              city={city}
              userLocation={userLocation}
              onRoute={routeBetween}
              onSetStart={(s) => {
                setStart(s);
                setEnd(null);
                setRoute(null);
              }}
            />

            <p className="howto">
              {!start
                ? "① Set a start (search, 📍, or click the map)."
                : !end
                  ? "② Now click the map (or search) to set your destination."
                  : "✓ Route set. Click the map to start a new one."}
            </p>

            {loading && <p className="muted">Planning your comfort route…</p>}
            {error && <p className="error">Error: {error}</p>}

            {route && weather && (
              <>
                {weather.nowRaining && (
                  <p className="rain-now">
                    🌧 It's raining now ({weather.nowPrecip.toFixed(1)} mm) —
                    consider waiting for the suggested window below.
                  </p>
                )}
                <RoutePanel route={route} now={nowComfort} />
                <WhenToGo hours={comfortHours} nowHour={weather.localHour} />
              </>
            )}
          </>
        )}

        {mode === "business" && (
          <BusinessPanel
            pendingPoint={pendingPoint}
            venues={venues}
            onAdd={(v) => {
              setVenues((vs) => [...vs, v]);
              setPendingPoint(null);
            }}
            onRemove={(id) =>
              setVenues((vs) => vs.filter((v) => v.id !== id))
            }
          />
        )}

        <footer className="sidebar__foot">
          <span>Free &amp; open data: OpenStreetMap · Open-Meteo · OpenRouteService</span>
          <span>SDG 3 · 10 · 11 · 13</span>
        </footer>
      </aside>

      <main className="map-wrap">
        <MapView
          city={city}
          route={route}
          start={start}
          end={end}
          venues={venues}
          onMapClick={handleMapClick}
          onLocate={(p) => setUserLocation(p)}
        />
      </main>
    </div>
  );
}

function hourLabel(h: number): string {
  return `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
}
