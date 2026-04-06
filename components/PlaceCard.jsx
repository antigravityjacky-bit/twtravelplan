import { CATEGORY_BORDER, CATEGORY_BADGE } from './FilterBar';

const CATEGORY_ICON = {
  Food: '🍜',
  Attraction: '🗺️',
  Hotel: '🏨',
  Bar: '🍸',
};

export default function PlaceCard({ place, isSelected, onClick }) {
  return (
    <div
      onClick={() => onClick(place)}
      className={`
        place-card cursor-pointer rounded-2xl bg-white border-l-4 p-3.5 md:p-4
        shadow-sm hover:shadow-md
        ${CATEGORY_BORDER[place.category]}
        ${isSelected ? 'ring-2 ring-offset-1 ring-slate-300 shadow-md' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 text-sm md:text-base leading-snug truncate">
            {place.name}
          </h3>
          {place.nameEn && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{place.nameEn}</p>
          )}
        </div>
        <span
          className={`
            shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1
            rounded-full ring-1 ${CATEGORY_BADGE[place.category]}
          `}
        >
          {CATEGORY_ICON[place.category]} {place.category}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-1">
        📍 {place.address}
      </p>

      {place.description && (
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed line-clamp-2">
          {place.description}
        </p>
      )}
    </div>
  );
}
