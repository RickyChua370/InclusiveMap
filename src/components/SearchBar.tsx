import { useState } from "react";
import type { City } from "../config";
import { geocode, type GeoResult } from "../api/geocode";
import type { LngLat } from "../types";

interface Props {
  city: City;
  userLocation: LngLat | null;
  onRoute: (start: LngLat, end: LngLat) => void;
  /** Set only the start (e.g. "use my location"); user then picks the end. */
  onSetStart: (start: LngLat) => void;
}

/**
 * From/To text search using free Nominatim geocoding. An alternative to
 * clicking the map — type place names and hit "Find comfort route".
 */
export default function SearchBar({
  city,
  userLocation,
  onRoute,
  onSetStart,
}: Props) {
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromResults, setFromResults] = useState<GeoResult[]>([]);
  const [toResults, setToResults] = useState<GeoResult[]>([]);
  const [fromSel, setFromSel] = useState<LngLat | null>(null);
  const [toSel, setToSel] = useState<LngLat | null>(null);
  const [busy, setBusy] = useState<"from" | "to" | "route" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function search(which: "from" | "to", text: string) {
    setErr(null);
    if (!text.trim()) return;
    setBusy(which);
    try {
      const r = await geocode(text, city);
      if (which === "from") {
        setFromResults(r);
        if (r[0]) setFromSel(r[0].lngLat);
      } else {
        setToResults(r);
        if (r[0]) setToSel(r[0].lngLat);
      }
      if (r.length === 0) setErr(`No match for "${text}" near ${city.name}.`);
    } catch {
      setErr("Search failed — try again or click the map instead.");
    } finally {
      setBusy(null);
    }
  }

  function useMyLocation() {
    if (!userLocation) return;
    setFromSel(userLocation);
    setFromText("📍 My location");
    setFromResults([]);
    // Push to App as the start so the next MAP CLICK sets the destination.
    onSetStart(userLocation);
  }

  function go() {
    if (fromSel && toSel) onRoute(fromSel, toSel);
  }

  return (
    <section className="search">
      <div className="search__row">
        <input
          placeholder="From (type a place)…"
          value={fromText}
          onChange={(e) => {
            setFromText(e.target.value);
            setFromSel(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && search("from", fromText)}
        />
        <button
          className="search__btn"
          disabled={busy === "from"}
          onClick={() => search("from", fromText)}
        >
          {busy === "from" ? "…" : "🔍"}
        </button>
      </div>
      {userLocation && (
        <button className="search__loc" onClick={useMyLocation}>
          📍 Use my location as start
        </button>
      )}
      <ResultList
        results={fromResults}
        selected={fromSel}
        onPick={(r) => {
          setFromSel(r.lngLat);
          setFromText(r.label.split(",")[0]);
          setFromResults([]);
        }}
      />

      <div className="search__row">
        <input
          placeholder="To (type a destination)…"
          value={toText}
          onChange={(e) => {
            setToText(e.target.value);
            setToSel(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && search("to", toText)}
        />
        <button
          className="search__btn"
          disabled={busy === "to"}
          onClick={() => search("to", toText)}
        >
          {busy === "to" ? "…" : "🔍"}
        </button>
      </div>
      <ResultList
        results={toResults}
        selected={toSel}
        onPick={(r) => {
          setToSel(r.lngLat);
          setToText(r.label.split(",")[0]);
          setToResults([]);
        }}
      />

      {err && <p className="search__err">{err}</p>}

      <button className="search__go" disabled={!fromSel || !toSel} onClick={go}>
        Find comfort route
      </button>
      <p className="search__hint">
        …or just click the map: once for start, again for destination.
      </p>
    </section>
  );
}

function ResultList({
  results,
  selected,
  onPick,
}: {
  results: GeoResult[];
  selected: LngLat | null;
  onPick: (r: GeoResult) => void;
}) {
  if (results.length <= 1) return null;
  return (
    <ul className="search__results">
      {results.map((r, i) => (
        <li key={i}>
          <button
            className={
              selected && selected[0] === r.lngLat[0] ? "picked" : ""
            }
            onClick={() => onPick(r)}
          >
            {r.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
