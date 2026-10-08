import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { City } from "../config";
import type { LngLat, RouteResult, Venue } from "../types";

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
  const routeLineRef = useRef<L.Polyline | null>(null);
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

  // draw the route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (route && route.coordinates.length > 1) {
      // Leaflet uses [lat, lng]; our coords are [lng, lat].
      const latlngs = route.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      const line = L.polyline(latlngs, {
        color: "#2563eb",
        weight: 7,
        opacity: 0.9,
      }).addTo(map);
      routeLineRef.current = line;
      map.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 16 });
    }
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
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      aria-label="Map"
    />
  );
}
