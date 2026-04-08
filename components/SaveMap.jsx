import { useEffect } from 'react';
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

// Click handler + fly-to when lat/lng changes
function MapController({ lat, lng, onMapClick }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return null;
}

export default function SaveMap({ lat, lng, category, onMapClick }) {
  // Default center: Taipei
  const center = lat != null && lng != null ? [lat, lng] : [25.0478, 121.5319];

  return (
    <MapContainer
      center={center}
      zoom={lat != null ? 15 : 12}
      style={{ height: '260px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <MapController lat={lat} lng={lng} onMapClick={onMapClick} />
      {lat != null && lng != null && (
        <Marker position={[lat, lng]} icon={createPin(category)} />
      )}
    </MapContainer>
  );
}
