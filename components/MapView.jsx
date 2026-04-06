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

function createColorPin(color) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 28px;
      ">
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 50% 50% 50% 0;
          background: ${color};
          transform: rotate(-45deg);
          border: 2.5px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.25);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(0deg);
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
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

export default function MapView({ places, selectedPlace, onSelectPlace }) {
  // Centre of Taipei
  const center = [25.0478, 121.5319];

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

      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          icon={createColorPin(CATEGORY_COLORS[place.category])}
          eventHandlers={{
            click: () => onSelectPlace(place),
          }}
        >
          <Popup className="custom-popup" maxWidth={220}>
            <div className="p-1">
              <p className="font-semibold text-slate-800 text-sm leading-snug">{place.name}</p>
              {place.nameEn && (
                <p className="text-xs text-slate-400 mt-0.5">{place.nameEn}</p>
              )}
              <span
                className={`
                  mt-1.5 inline-flex items-center text-xs font-medium px-2 py-0.5
                  rounded-full ring-1 ${CATEGORY_BADGE[place.category]}
                `}
              >
                {place.category}
              </span>
              <p className="mt-1.5 text-xs text-slate-500">{place.address}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      <FlyToSelected selectedPlace={selectedPlace} />
    </MapContainer>
  );
}
