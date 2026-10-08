import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE, type City } from "../config";
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

/** Idempotently (re)create the route source + line layer on a map. */
function ensureRouteLayer(map: maplibregl.Map) {
  if (!map.getSource("route")) {
    map.addSource("route", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer("route-line")) {
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#2563eb",
        "line-width": 7,
        "line-opacity": 0.9,
      },
    });
  }
}

/** Set the route line's data (or clear it) on an already-ready map. */
function redrawRoute(map: maplibregl.Map, route: RouteResult | null) {
  ensureRouteLayer(map);
  const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features:
      route && route.coordinates.length > 1
        ? [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: route.coordinates },
              properties: {},
            },
          ]
        : [],
  });
}

/**
 * MapLibre map. Click once to set start, twice to set destination.
 * Draws the comfort route and any registered inclusive venues.
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const locateRef = useRef(onLocate);
  locateRef.current = onLocate;
  // Tracks whether the user has manually chosen a city, so a late-arriving
  // geolocation fix doesn't yank the map away from their choice.
  const userPickedCityRef = useRef(false);
  const firstCityRender = useRef(true);
  const routeRef = useRef<RouteResult | null>(null);
  routeRef.current = route;
  const [styleReady, setStyleReady] = useState(false);

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: city.center,
      zoom: city.zoom,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // Geolocation: a "locate me" control that centres on load. We do NOT
    // track continuously (that re-centres the map and interferes with the
    // click-to-set-destination flow) — one fix is enough.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: true,
    });
    map.addControl(geolocate, "top-right");

    geolocate.on("geolocate", (e) => {
      const coords = (e as { coords: GeolocationCoordinates }).coords;
      locateRef.current?.([coords.longitude, coords.latitude]);
    });

    map.on("click", (e: maplibregl.MapMouseEvent) =>
      clickRef.current([e.lngLat.lng, e.lngLat.lat]),
    );

    const onReady = () => {
      ensureRouteLayer(map);
      redrawRoute(map, routeRef.current); // paint any route we already have
      setStyleReady(true);
      // NOTE: we intentionally do NOT auto-trigger geolocation here. The map
      // stays on the selected pilot city; the user taps the locate control
      // or "Use my location as start" when they want their position.
    };

    // Cover every case: style may already be loaded, or load later.
    if (map.isStyleLoaded()) onReady();
    else map.on("load", onReady);

    // Expose for diagnostics (harmless; helps verify the route line in-browser).
    (window as unknown as { __map?: maplibregl.Map }).__map = map;

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // fly to selected city — but ignore the very first render so we don't
  // override the auto-geolocation attempt on load.
  useEffect(() => {
    if (firstCityRender.current) {
      firstCityRender.current = false;
      return;
    }
    userPickedCityRef.current = true;
    mapRef.current?.flyTo({ center: city.center, zoom: city.zoom });
  }, [city]);

  // draw route whenever it changes (and once the style becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    redrawRoute(map, route);
    if (route && route.coordinates.length > 1) {
      const b = new maplibregl.LngLatBounds();
      route.coordinates.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 600 });
    }
  }, [route, styleReady]);

  // markers for start / end / venues
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const add = (lngLat: LngLat, color: string, label: string) => {
      const el = document.createElement("div");
      el.title = label;
      el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
      const m = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(map);
      markersRef.current.push(m);
    };

    if (start) add(start, "#16a34a", "Start");
    if (end) add(end, "#dc2626", "Destination");
    venues.forEach((v) => add(v.lngLat, "#7c3aed", `Inclusive venue: ${v.name}`));
  }, [start, end, venues]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      aria-label="Map"
    />
  );
}
