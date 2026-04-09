import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CATEGORY_COLORS = {
  Breakfast: '#FBBF24', Cafe: '#78716C', Restaurant: '#F97316',
  Attraction: '#3B82F6', Hotel: '#8B5CF6', Bar: '#F43F5E',
};
const CATEGORY_EMOJI = {
  Breakfast: '🍳', Cafe: '☕', Restaurant: '🍽️', Attraction: '🗺️', Hotel: '🏨', Bar: '🍸',
};

function createPin(category) {
  const color = CATEGORY_COLORS[category] ?? '#64748B';
  const emoji = CATEGORY_EMOJI[category] ?? '📍';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:20px;cursor:pointer;
    ">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// Handles click events AND fly-to when lat/lng change
function MapController({ lat, lng, onMapClick }) {
  const map = useMap();
  const prevCoords = useRef({ lat, lng });

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (lat == null || lng == null) return;
    // Only fly if coordinates actually changed
    if (prevCoords.current.lat === lat && prevCoords.current.lng === lng) return;
    prevCoords.current = { lat, lng };
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { animate: true, duration: 0.8 });
  });

  return null;
}

export default function SaveMap({ lat, lng, category, onMapClick }) {
  const hasCoords = lat != null && lng != null;
  const center = hasCoords ? [lat, lng] : [25.0478, 121.5319]; // Default: Taipei

  // When coordinates are set for the first time, remount the MapContainer so
  // Leaflet re-initialises with the correct center (Leaflet ignores prop changes
  // to `center` after the first render).
  const mapKey = hasCoords ? 'with-pin' : 'no-pin';

  return (
    <MapContainer
      key={mapKey}
      center={center}
      zoom={hasCoords ? 15 : 12}
      style={{ height: '260px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapController lat={lat} lng={lng} onMapClick={onMapClick} />
      {hasCoords && (
        <Marker position={[lat, lng]} icon={createPin(category)} />
      )}
    </MapContainer>
  );
}
