import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CATEGORY_BADGE } from './FilterBar';

const CATEGORY_ICON = {
  Breakfast:  '🍳',
  Cafe:       '☕',
  Restaurant: '🍽️',
  Attraction: '🗺️',
  Hotel:      '🏨',
  Bar:        '🍸',
  Food:       '🍜',
};

export default function ItineraryPlaceItem({ item, place, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!place) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 px-2 rounded-xl bg-white hover:bg-slate-50 group transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none select-none px-0.5"
        aria-label="拖拉排序"
      >
        ☰
      </button>

      {/* Place info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {CATEGORY_ICON[place.category] ?? '📍'} {place.name}
        </p>
        {place.nameEn && (
          <p className="text-xs text-slate-400 truncate">{place.nameEn}</p>
        )}
      </div>

      {/* Category badge */}
      <span
        className={`hidden sm:inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 flex-shrink-0 ${
          CATEGORY_BADGE[place.category] ?? CATEGORY_BADGE.Food
        }`}
      >
        {place.category}
      </span>

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.id)}
        className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0 text-sm px-1"
        aria-label="從行程移除"
      >
        ✕
      </button>
    </div>
  );
}
