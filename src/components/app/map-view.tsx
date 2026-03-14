
'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import React, { useEffect, useMemo } from 'react';

const eventTypeColors = {
  visit: '#f59e0b',
  meal: '#f43f5e',
  transport: '#0ea5e9',
  accommodation: '#10b981',
  activity: '#a855f7',
  start: '#22c55e', // green-500
  end: '#ef4444',   // red-500
};

type Event = {
  id: string;
  type: 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';
  title: string;
  lat?: number;
  lng?: number;
};

interface MapViewProps {
  events: Event[];
  day?: {
    startLocationName?: string;
    endLocationName?: string;
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
  }
}

const getMarkerIcon = (color: string, index: number | string) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${color};" class="marker-pin"><span>${index}</span></div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });
};

const mapStyle = `
.custom-div-icon .marker-pin {
  width: 24px;
  height: 24px;
  border-radius: 50% 50% 50% 0;
  position: absolute;
  transform: rotate(-45deg);
  left: 50%;
  top: 50%;
  margin: -15px 0 0 -12px;
  border: 2px solid #ffffff;
  box-shadow: 0 0 5px rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.custom-div-icon .marker-pin > span {
  transform: rotate(45deg);
  color: white;
  font-weight: bold;
  font-size: 12px;
  font-family: sans-serif;
}
.leaflet-popup-content-wrapper, .leaflet-popup-tip {
  background: #1e293b;
  color: #f8fafc;
  border-radius: 8px;
}
.leaflet-popup-content-wrapper {
  box-shadow: 0 3px 14px rgba(0,0,0,0.4);
}
`;

function MapBoundsUpdater({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
}

const MapViewComponent = ({ events, day }: MapViewProps) => {
  const position: L.LatLngExpression = [35.6895, 139.6917]; // Default to Tokyo

  // Memoize coordinates to avoid deep equality check on every point object
  const coords = useMemo(() => {
     return [
      ...(events || []).map(e => ({ lat: e.lat, lng: e.lng })),
      { lat: day?.startLat, lng: day?.startLng },
      { lat: day?.endLat, lng: day?.endLng }
    ].filter(p => p.lat != null && p.lng != null);
  }, [events, day?.startLat, day?.startLng, day?.endLat, day?.endLng]);

  const bounds = useMemo(() => {
    if (coords.length === 0) return null;
    const points: L.LatLngTuple[] = coords.map((p: any) => [p.lat, p.lng]);
    return L.latLngBounds(points);
  }, [coords]);

  const validEvents = useMemo(() => events.filter(e => e.lat != null && e.lng != null), [events]);

  return (
    <div className="w-full h-full relative">
       <style>{mapStyle}</style>
      <MapContainer
        center={position}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {validEvents.map((event, index) => (
          <Marker
            key={event.id}
            position={[event.lat!, event.lng!]}
            icon={getMarkerIcon(eventTypeColors[event.type] || eventTypeColors.activity, index + 1)}
          >
            <Popup>{event.title}</Popup>
          </Marker>
        ))}
        {day?.startLat && day.startLng && (
          <Marker
            key="start-marker"
            position={[day.startLat, day.startLng]}
            icon={getMarkerIcon(eventTypeColors.start, "D")}
          >
            <Popup>{day.startLocationName || "Lieu de départ"}</Popup>
          </Marker>
        )}
        {day?.endLat && day.endLng && (
          <Marker
            key="end-marker"
            position={[day.endLat, day.endLng]}
            icon={getMarkerIcon(eventTypeColors.end, "R")}
          >
            <Popup>{day.endLocationName || "Lieu de retour"}</Popup>
          </Marker>
        )}
        <MapBoundsUpdater bounds={bounds} />
      </MapContainer>
    </div>
  );
};

const MapView = React.memo(MapViewComponent, (prev, next) => {
  // Only re-render if events or day locations changed
  return prev.events === next.events && 
         prev.day?.startLat === next.day?.startLat &&
         prev.day?.startLng === next.day?.startLng &&
         prev.day?.endLat === next.day?.endLat &&
         prev.day?.endLng === next.day?.endLng;
});

export default MapView;

