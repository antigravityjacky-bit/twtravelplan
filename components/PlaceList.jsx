import PlaceCard from './PlaceCard';

export default function PlaceList({ places, selectedPlace, onSelectPlace }) {
  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-slate-500 font-medium">No places found</p>
        <p className="text-slate-400 text-sm mt-1">Try selecting a different category</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}
          isSelected={selectedPlace?.id === place.id}
          onClick={onSelectPlace}
        />
      ))}
    </div>
  );
}
