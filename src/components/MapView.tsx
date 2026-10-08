import { useEffect, useRef } from "react";
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

    // Geolocation: a "locate me" control that also auto-centres on load.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
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

    // Once the map is ready, try to centre on the user automatically.
    // If they deny permission (or it fails) we silently stay on the city.
    map.on("load", () => {
      if (!userPickedCityRef.current) {
        try {
          geolocate.trigger();
        } catch {
          /* geolocation unavailable — keep the city default */
        }
      }
    });

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

  // draw route — resilient to style-load races and re-planning.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: route
        ? [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: route.coordinates,
              },
              properties: {},
            },
          ]
        : [],
    };

    const draw = () => {
      // (Re)create the source if the style reloaded and dropped it.
      let src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (!src) {
        map.addSource("route", { type: "geojson", data: geojson });
        src = map.getSource("route") as maplibregl.GeoJSONSource;
      } else {
        src.setData(geojson);
      }

      // Make sure the line layer exists (it can be lost on style changes).
      if (!map.getLayer("route-line")) {
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#2563eb",
            "line-width": 6,
            "line-opacity": 0.9,
          },
        });
      }

      if (route && route.coordinates.length > 1) {
        const b = new maplibregl.LngLatBounds();
        route.coordinates.forEach((c) => b.extend(c));
        map.fitBounds(b, { padding: 70, maxZoom: 16 });
      }
    };

    if (map.isStyleLoaded()) {
      draw();
    } else {
      // "load" may have already fired; "idle" always fires once ready.
      map.once("idle", draw);
    }
  }, [route]);

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
