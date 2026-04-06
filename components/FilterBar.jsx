const CATEGORIES = [
  { label: 'All',    value: 'All',        color: 'bg-slate-700 text-white',   ring: 'ring-slate-700' },
  { label: '🍳 早餐店', value: 'Breakfast',  color: 'bg-amber-400 text-white',   ring: 'ring-amber-400' },
  { label: '☕ 咖啡店', value: 'Cafe',       color: 'bg-stone-500 text-white',   ring: 'ring-stone-500' },
  { label: '🍽️ 餐廳',  value: 'Restaurant', color: 'bg-orange-500 text-white',  ring: 'ring-orange-500' },
  { label: '🗺️ Attraction', value: 'Attraction', color: 'bg-blue-500 text-white', ring: 'ring-blue-500' },
  { label: '🏨 Hotel',      value: 'Hotel',      color: 'bg-violet-500 text-white', ring: 'ring-violet-500' },
  { label: '🍸 Bar',        value: 'Bar',        color: 'bg-rose-500 text-white',   ring: 'ring-rose-500' },
];

export const CATEGORY_COLORS = {
  Breakfast:  '#FBBF24', // amber-400
  Cafe:       '#78716C', // stone-500
  Restaurant: '#F97316', // orange-500
  Attraction: '#3B82F6', // blue-500
  Hotel:      '#8B5CF6', // violet-500
  Bar:        '#F43F5E', // rose-500
  Food:       '#F97316', // backward-compat → same as Restaurant
};

export const CATEGORY_BORDER = {
  Breakfast:  'border-amber-400',
  Cafe:       'border-stone-500',
  Restaurant: 'border-orange-500',
  Attraction: 'border-blue-500',
  Hotel:      'border-violet-500',
  Bar:        'border-rose-500',
  Food:       'border-orange-500', // backward-compat
};

export const CATEGORY_BADGE = {
  Breakfast:  'bg-amber-50 text-amber-700 ring-amber-200',
  Cafe:       'bg-stone-50 text-stone-700 ring-stone-200',
  Restaurant: 'bg-orange-50 text-orange-700 ring-orange-200',
  Attraction: 'bg-blue-50 text-blue-700 ring-blue-200',
  Hotel:      'bg-violet-50 text-violet-700 ring-violet-200',
  Bar:        'bg-rose-50 text-rose-700 ring-rose-200',
  Food:       'bg-orange-50 text-orange-700 ring-orange-200', // backward-compat
};

// mobile prop: renders as a single non-wrapping horizontal-scroll row
export default function FilterBar({ activeCategory, onCategoryChange, counts, mobile = false }) {
  const buttons = CATEGORIES.map(({ label, value, color, ring }) => {
    const isActive = activeCategory === value;
    const count = value === 'All' ? counts.total : (counts[value] ?? 0);
    return (
      <button
        key={value}
        onClick={() => onCategoryChange(value)}
        className={`
          relative flex items-center gap-1.5 rounded-full font-medium
          transition-all duration-200 select-none whitespace-nowrap
          ${mobile ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-1.5 text-sm'}
          ${isActive
            ? `${color} shadow-md ring-2 ${ring} ring-offset-1`
            : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-md'
          }
        `}
      >
        {label}
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      </button>
    );
  });

  if (mobile) {
    return (
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4">
        <div className="flex gap-2 w-max py-0.5">{buttons}</div>
      </div>
    );
  }

  return <div className="flex flex-wrap gap-2">{buttons}</div>;
}
