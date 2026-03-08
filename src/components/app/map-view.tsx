'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

const eventTypeColors = {
  visit: '#f59e0b',
  meal: '#f43f5e',
  transport: '#0ea5e9',
  accommodation: '#10b981',
  activity: '#a855f7',
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
}

const getMarkerIcon = (color: string) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color:${color};" class="marker-pin"></div>`,
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

const MapView = ({ events }: MapViewProps) => {
  const position: L.LatLngExpression = [35.6895, 139.6917]; // Default to Tokyo
  const validEvents = events.filter(e => e.lat != null && e.lng != null);

  const bounds = validEvents.length > 0 
    ? L.latLngBounds(validEvents.map(e => [e.lat!, e.lng!])) 
    : null;

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
        {validEvents.map((event) => (
          <Marker
            key={event.id}
            position={[event.lat!, event.lng!]}
            icon={getMarkerIcon(eventTypeColors[event.type])}
          >
            <Popup>{event.title}</Popup>
          </Marker>
        ))}
        <MapBoundsUpdater bounds={bounds} />
      </MapContainer>
    </div>
  );
};

export default MapView;
