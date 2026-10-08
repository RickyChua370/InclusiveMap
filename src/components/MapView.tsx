import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { City } from "../config";
import type { AmenityKind, LngLat, RouteResult, Venue } from "../types";

interface Props {
  city: City;
  route: RouteResult | null;
  start: LngLat | null;
  end: LngLat | null;
  venues: Venue[];
  onMapClick: (lngLat: LngLat) => void;
  /** Called when the browser geolocates the user. */
  onLocate?: (lngLat: LngLat) => void;
}

/** Small colored circle marker (no external icon assets needed). */
function dot(color: string, title: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div title="${title}" style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/** Emoji badge icon for amenities along the route. */
const AMENITY_META: Record<
  AmenityKind,
  { emoji: string; label: string; bg: string }
> = {
  bench: { emoji: "🪑", label: "Bench / rest seat", bg: "#ecfdf5" },
  water: { emoji: "🚰", label: "Drinking water", bg: "#eff6ff" },
  toilets: { emoji: "🚻", label: "Toilets", bg: "#f5f3ff" },
  steps: { emoji: "⚠️", label: "Steps / stairs (obstacle)", bg: "#fef2f2" },
};

function amenityIcon(kind: AmenityKind): L.DivIcon {
  const m = AMENITY_META[kind];
  return L.divIcon({
    className: "",
    html: `<div title="${m.label}" style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:13px;background:${m.bg};border:1.5px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.35)">${m.emoji}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Comfort value (0-1) -> color for the route segment. */
function comfortColor(v: number): string {
  if (v >= 0.75) return "#16a34a"; // shaded / cool
  if (v >= 0.55) return "#84cc16";
  if (v >= 0.4) return "#eab308";
  if (v >= 0.25) return "#f97316";
  return "#dc2626"; // exposed / hot
}

/**
 * Leaflet map. Click once to set start, again to set destination.
 * Draws the comfort route as an SVG polyline (renders reliably — this replaced
 * MapLibre, whose raster-only style never reached a "loaded" state and so never
 * painted vector line layers).
 */
export default function MapView({
  city,
  route,
  start,
  end,
  venues,
  onMapClick,
  onLocate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const amenityLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userPickedCityRef = useRef(false);
  const firstCityRender = useRef(true);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const locateRef = useRef(onLocate);
  locateRef.current = onLocate;

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const [lng, lat] = city.center;
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: city.zoom,
      zoomControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      clickRef.current([e.latlng.lng, e.latlng.lat]);
    });

    // A simple "locate me" control.
    const LocateCtl = L.Control.extend({
      options: { position: "topright" as L.ControlPosition },
      onAdd: () => {
        const btn = L.DomUtil.create("button", "locate-ctl");
        btn.innerHTML = "📍";
        btn.title = "Center on my location";
        btn.style.cssText =
          "width:34px;height:34px;font-size:16px;cursor:pointer;background:#fff;border:2px solid rgba(0,0,0,.2);border-radius:4px;";
        L.DomEvent.on(btn, "click", (ev) => {
          L.DomEvent.stop(ev);
          map.locate({ setView: true, maxZoom: 15 });
        });
        return btn;
      },
    });
    map.addControl(new LocateCtl());

    map.on("locationfound", (e: L.LocationEvent) => {
      locateRef.current?.([e.latlng.lng, e.latlng.lat]);
    });

    mapRef.current = map;
    (window as unknown as { __map?: L.Map }).__map = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // fly to selected city (skip the first render)
  useEffect(() => {
    if (firstCityRender.current) {
      firstCityRender.current = false;
      return;
    }
    userPickedCityRef.current = true;
    const [lng, lat] = city.center;
    mapRef.current?.flyTo([lat, lng], city.zoom);
  }, [city]);

  // draw the route as comfort-colored segments
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (route && route.coordinates.length > 1) {
      const group = L.layerGroup().addTo(map);
      const coords = route.coordinates;
      const comfort = route.segmentComfort;

      for (let i = 1; i < coords.length; i++) {
        const a = coords[i - 1];
        const b = coords[i];
        const v = comfort[i - 1] ?? 0.5;
        // white casing underneath for contrast, then the colored segment
        L.polyline(
          [
            [a[1], a[0]],
            [b[1], b[0]],
          ],
          { color: "#ffffff", weight: 10, opacity: 0.9 },
        ).addTo(group);
        L.polyline(
          [
            [a[1], a[0]],
            [b[1], b[0]],
          ],
          { color: comfortColor(v), weight: 6, opacity: 0.95 },
        ).addTo(group);
      }

      routeLayerRef.current = group;

      const bounds = L.latLngBounds(
        coords.map(([lng, lat]) => [lat, lng] as [number, number]),
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, [route]);

  // amenity pins along the route (benches, water, toilets, steps)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (amenityLayerRef.current) {
      amenityLayerRef.current.remove();
      amenityLayerRef.current = null;
    }

    const pts = route?.amenityPoints ?? [];
    if (pts.length === 0) return;

    const group = L.layerGroup().addTo(map);
    pts.forEach((p) => {
      const [lng, lat] = p.lngLat;
      L.marker([lat, lng], { icon: amenityIcon(p.kind as AmenityKind) }).addTo(
        group,
      );
    });
    amenityLayerRef.current = group;
  }, [route]);

  // markers for start / end / venues
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const add = (lngLat: LngLat, color: string, title: string) => {
      const [lng, lat] = lngLat;
      const m = L.marker([lat, lng], { icon: dot(color, title) }).addTo(map);
      markersRef.current.push(m);
    };

    if (start) add(start, "#16a34a", "Start");
    if (end) add(end, "#dc2626", "Destination");
    venues.forEach((v) =>
      add(v.lngLat, "#7c3aed", `Inclusive venue: ${v.name}`),
    );
  }, [start, end, venues]);

  return (
    <>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0 }}
        aria-label="Map"
      />
      {route && (
        <div className="map-legend">
          <div className="map-legend__row">
            <strong>Route comfort</strong>
            <span className="swatch" style={{ background: "#16a34a" }} /> cool/shaded
            <span className="swatch" style={{ background: "#eab308" }} /> warm
            <span className="swatch" style={{ background: "#dc2626" }} /> hot/exposed
          </div>
          <div className="map-legend__row">
            🪑 bench · 🚰 water · 🚻 toilet · ⚠️ steps
          </div>
        </div>
      )}
    </>
  );
}
