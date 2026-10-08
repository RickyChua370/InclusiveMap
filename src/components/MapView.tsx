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
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

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
    map.on("click", (e: maplibregl.MapMouseEvent) =>
      clickRef.current([e.lngLat.lng, e.lngLat.lat]),
    );
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // fly to selected city
  useEffect(() => {
    mapRef.current?.flyTo({ center: city.center, zoom: city.zoom });
  }, [city]);

  // draw route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
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
      if (src) {
        src.setData(geojson);
      } else {
        map.addSource("route", { type: "geojson", data: geojson });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#2563eb",
            "line-width": 6,
            "line-opacity": 0.85,
          },
        });
      }
      if (route && route.coordinates.length > 1) {
        const b = new maplibregl.LngLatBounds();
        route.coordinates.forEach((c) => b.extend(c));
        map.fitBounds(b, { padding: 70, maxZoom: 16 });
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
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
