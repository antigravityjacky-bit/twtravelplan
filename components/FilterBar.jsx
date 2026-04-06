const CATEGORIES = [
  { label: 'All', value: 'All', color: 'bg-slate-700 text-white', ring: 'ring-slate-700', dot: '#475569' },
  { label: '🍜 Food', value: 'Food', color: 'bg-amber-400 text-white', ring: 'ring-amber-400', dot: '#F59E0B' },
  { label: '🗺️ Attraction', value: 'Attraction', color: 'bg-blue-500 text-white', ring: 'ring-blue-500', dot: '#3B82F6' },
  { label: '🏨 Hotel', value: 'Hotel', color: 'bg-violet-500 text-white', ring: 'ring-violet-500', dot: '#8B5CF6' },
  { label: '🍸 Bar', value: 'Bar', color: 'bg-rose-500 text-white', ring: 'ring-rose-500', dot: '#F43F5E' },
];

export const CATEGORY_COLORS = {
  Food: '#F59E0B',
  Attraction: '#3B82F6',
  Hotel: '#8B5CF6',
  Bar: '#F43F5E',
};

export const CATEGORY_BORDER = {
  Food: 'border-amber-400',
  Attraction: 'border-blue-500',
  Hotel: 'border-violet-500',
  Bar: 'border-rose-500',
};

export const CATEGORY_BADGE = {
  Food: 'bg-amber-50 text-amber-700 ring-amber-200',
  Attraction: 'bg-blue-50 text-blue-700 ring-blue-200',
  Hotel: 'bg-violet-50 text-violet-700 ring-violet-200',
  Bar: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function FilterBar({ activeCategory, onCategoryChange, counts }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(({ label, value, color, ring }) => {
        const isActive = activeCategory === value;
        const count = value === 'All' ? counts.total : (counts[value] ?? 0);
        return (
          <button
            key={value}
            onClick={() => onCategoryChange(value)}
            className={`
              relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200 select-none
              ${isActive
                ? `${color} shadow-md ring-2 ${ring} ring-offset-1`
                : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-md'
              }
            `}
          >
            {label}
            <span
              className={`
                text-xs font-semibold px-1.5 py-0.5 rounded-full
                ${isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}
              `}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
