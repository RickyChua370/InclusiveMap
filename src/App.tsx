import { useEffect, useMemo, useState } from "react";
import { CITIES, PROFILES, type ProfileId } from "./config";
import type { HourWeather, LngLat, RouteResult, Venue } from "./types";
import { getRoute } from "./api/routing";
import { fetchHourlyWeather, syntheticWeather } from "./api/weather";
import { dailyComfort } from "./engine/comfort";
import MapView from "./components/MapView";
import RoutePanel from "./components/RoutePanel";
import WhenToGo from "./components/WhenToGo";
import BusinessPanel from "./components/BusinessPanel";
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
  const [weather, setWeather] = useState<HourWeather[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [pendingPoint, setPendingPoint] = useState<LngLat | null>(null);

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
        setRoute(r);
        setWeather(w.length ? w : syntheticWeather());
      } catch (e) {
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
    if (!route || weather.length === 0) return [];
    return dailyComfort(route, weather, new Date());
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
              <input
                type="range"
                min={6}
                max={21}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
              />
            </label>

            <p className="howto">
              {!start
                ? "① Click the map to set your start."
                : !end
                  ? "② Click again to set your destination."
                  : "Drag endpoints by clicking elsewhere to re-plan."}
            </p>

            {loading && <p className="muted">Planning your comfort route…</p>}
            {error && <p className="error">Error: {error}</p>}

            {route && (
              <>
                <RoutePanel route={route} now={nowComfort} />
                <WhenToGo hours={comfortHours} />
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
        />
      </main>
    </div>
  );
}

function hourLabel(h: number): string {
  return `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
}
