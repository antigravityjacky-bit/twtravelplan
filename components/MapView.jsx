import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORY_COLORS, CATEGORY_BADGE } from './FilterBar';

// Fix Leaflet default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CATEGORY_EMOJI = {
  Breakfast:  '🍳',
  Cafe:       '☕',
  Restaurant: '🍽️',
  Attraction: '🏛️',
  Hotel:      '🏨',
  Bar:        '🍸',
  Food:       '🍜', // backward-compat
};

function createEmojiPin(category, color, selected = false) {
  const emoji = CATEGORY_EMOJI[category] ?? '📍';
  const size  = selected ? 44 : 36;
  const font  = selected ? 22 : 18;
  const border = selected ? `3px solid ${color}` : `2px solid ${color}`;
  const shadow = selected
    ? `0 0 0 3px ${color}33, 0 4px 14px rgba(0,0,0,0.28)`
    : '0 2px 8px rgba(0,0,0,0.22)';

  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px; height:${size}px;
      background:white;
      border-radius:50%;
      border:${border};
      box-shadow:${shadow};
      display:flex; align-items:center; justify-content:center;
      font-size:${font}px; line-height:1;
      transition: transform 0.15s ease;
    ">${emoji}</div>`,
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size / 2],
    popupAnchor:  [0, -(size / 2) - 6],
  });
}

// Inner component that can access the map instance
function FlyToSelected({ selectedPlace }) {
  const map = useMap();
  const prevIdRef = useRef(null);

  useEffect(() => {
    if (selectedPlace && selectedPlace.id !== prevIdRef.current) {
      prevIdRef.current = selectedPlace.id;
      map.flyTo([selectedPlace.lat, selectedPlace.lng], 16, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    }
  }, [selectedPlace, map]);

  return null;
}

export default function MapView({ places, selectedPlace, onSelectPlace, center: centerProp }) {
  const center = centerProp ?? [25.0478, 121.5319];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {places.map((place) => {
        const isSelected = selectedPlace?.id === place.id;
        return (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={createEmojiPin(
              place.category,
              CATEGORY_COLORS[place.category] ?? CATEGORY_COLORS.Food,
              isSelected,
            )}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{ click: () => onSelectPlace(place) }}
          >
            <Popup className="custom-popup" maxWidth={220}>
              <div className="p-1">
                <p className="font-semibold text-slate-800 text-sm leading-snug">{place.name}</p>
                {place.description && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{place.description}</p>
                )}
                <span className={`mt-1.5 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${CATEGORY_BADGE[place.category] ?? CATEGORY_BADGE.Food}`}>
                  {CATEGORY_EMOJI[place.category] ?? '📍'} {place.category}
                </span>
                <p className="mt-1.5 text-xs text-slate-500">{place.address}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <FlyToSelected selectedPlace={selectedPlace} />
    </MapContainer>
  );
}
