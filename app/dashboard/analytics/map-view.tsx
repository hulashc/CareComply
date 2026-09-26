"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type MapPoint = {
  lat: number;
  lng: number;
  name: string;
  type: "carer" | "client";
};

export default function MapView({ locations }: { locations: MapPoint[] }) {
  if (locations.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No locations to display.</div>;
  }

  const center: [number, number] =
    locations.length === 1
      ? [locations[0].lat, locations[0].lng]
      : [
          locations.reduce((s, l) => s + l.lat, 0) / locations.length,
          locations.reduce((s, l) => s + l.lng, 0) / locations.length,
        ];

  const carerIcon = new L.DivIcon({
    className: "custom-marker",
    html: `<div style="background:#3b82f6;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">C</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  const clientIcon = new L.DivIcon({
    className: "custom-marker",
    html: `<div style="background:#f43f5e;color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">P</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  return (
    <MapContainer center={center} zoom={12} className="h-full w-full rounded-xl" style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc, i) => (
        <Marker key={i} position={[loc.lat, loc.lng]} icon={loc.type === "carer" ? carerIcon : clientIcon}>
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">{loc.name}</p>
              <p className="text-muted-foreground capitalize">{loc.type}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
