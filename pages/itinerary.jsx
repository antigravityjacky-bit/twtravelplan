import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { usePlaces } from '../hooks/usePlaces';
import { useItinerary } from '../hooks/useItinerary';
import FilterBar, { CATEGORY_BADGE } from '../components/FilterBar';
import ItineraryDay from '../components/ItineraryDay';

const CATEGORY_ICON = {
  Breakfast:  '🍳',
  Cafe:       '☕',
  Restaurant: '🍽️',
  Attraction: '🗺️',
  Hotel:      '🏨',
  Bar:        '🍸',
  Food:       '🍜',
};

export default function Itinerary() {
  const { places, loading: placesLoading } = usePlaces();
  const {
    items, days, loading: itinLoading, isSupabase,
    addItem, removeItem, addDay, removeDay, reorderDay,
  } = useItinerary();

  // Place library state
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState('itinerary'); // 'itinerary' | 'places'

  // Which day's picker is open (null = none)
  const [openPickerDay, setOpenPickerDay] = useState(null);

  const loading = placesLoading || itinLoading;

  // Place library: filtered for left panel
  const filteredPlaces = useMemo(() => {
    let list = places;
    if (activeCategory !== 'All') list = list.filter((p) => p.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameEn ?? '').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [places, activeCategory, search]);

  const counts = useMemo(() => {
    const c = { total: places.length };
    places.forEach((p) => { c[p.category] = (c[p.category] ?? 0) + 1; });
    return c;
  }, [places]);

  // Build placesById lookup for ItineraryDay
  const placesById = useMemo(() => {
    const map = {};
    places.forEach((p) => { map[p.id] = p; });
    return map;
  }, [places]);

  // Items grouped by day
  const itemsByDay = useMemo(() => {
    const map = {};
    days.forEach((d) => { map[d] = []; });
    items
      .filter((i) => i.sort_order >= 0) // exclude sentinels (sort_order = -1)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((item) => {
        if (!map[item.day_number]) map[item.day_number] = [];
        map[item.day_number].push(item);
      });
    return map;
  }, [items, days]);

  // Total real places in itinerary (exclude sentinels)
  const totalItinPlaces = items.filter((i) => i.place_id !== null && i.sort_order >= 0).length;

  // ── Place Library Card ────────────────────────────────────────────────────

  function PlaceLibraryCard({ place }) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 text-sm truncate">
              {CATEGORY_ICON[place.category] ?? '📍'} {place.name}
            </p>
            {place.nameEn && (
              <p className="text-xs text-slate-400 truncate">{place.nameEn}</p>
            )}
          </div>
          <span
            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 flex-shrink-0 ${
              CATEGORY_BADGE[place.category] ?? CATEGORY_BADGE.Food
            }`}
          >
            {place.category}
          </span>
        </div>
        {place.description && (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {place.description}
          </p>
        )}
        {/* Add to day buttons */}
        {days.length === 0 ? (
          <p className="text-xs text-slate-300 text-center py-1">先新增一天再加入地點</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => addItem(d, place.id)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 transition-colors font-medium"
              >
                ＋ Day {d}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Place library panel (shared between desktop sidebar + mobile tab) ─────
  function PlaceLibraryPanel() {
    return (
      <div className="flex flex-col h-full">
        {/* Search */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋地點..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder-slate-300 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 bg-white"
            />
          </div>
        </div>
        {/* Filter bar */}
        <div className="px-4 pb-3 flex-shrink-0 border-b border-slate-100">
          <FilterBar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            counts={counts}
            mobile
          />
        </div>
        {/* Cards */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-3xl mb-2 animate-pulse">🗺️</p>
              <p className="text-slate-400 text-sm">載入中...</p>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm">找不到地點</p>
            </div>
          ) : (
            filteredPlaces.map((place) => (
              <PlaceLibraryCard key={place.id} place={place} />
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Itinerary panel ───────────────────────────────────────────────────────
  function ItineraryPanel() {
    return (
      <div className="flex flex-col h-full">
        {/* Panel header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">📅 行程安排</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {days.length} 天 · {totalItinPlaces} 個地點
                {isSupabase && (
                  <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Real-time 同步
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={addDay}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-medium hover:bg-slate-900 transition-colors shadow-sm"
            >
              ＋ 新增一天
            </button>
          </div>
        </div>

        {/* Days */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-3xl mb-2 animate-pulse">📅</p>
              <p className="text-slate-400 text-sm">載入中...</p>
            </div>
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-4xl mb-3">✈️</p>
              <p className="text-slate-700 font-medium mb-1">行程還是空的</p>
              <p className="text-slate-400 text-sm mb-5">點擊「＋ 新增一天」開始規劃</p>
              <button
                onClick={addDay}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm"
              >
                ＋ 新增第一天
              </button>
            </div>
          ) : (
            <>
              {days.map((day) => (
                <ItineraryDay
                  key={day}
                  dayNumber={day}
                  items={itemsByDay[day] ?? []}
                  placesById={placesById}
                  days={days}
                  onReorder={(newOrderedIds) => reorderDay(day, newOrderedIds)}
                  onRemoveItem={removeItem}
                  onRemoveDay={() => removeDay(day)}
                  onAddItem={(place_id) => addItem(day, place_id)}
                  pickerOpen={openPickerDay === day}
                  onOpenPicker={() => setOpenPickerDay(day)}
                  onClosePicker={() => setOpenPickerDay(null)}
                  placeLibrary={places}
                />
              ))}
              <button
                onClick={addDay}
                className="w-full py-3 text-sm text-slate-400 hover:text-slate-700 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl transition-colors"
              >
                ＋ 新增一天
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>📅 行程規劃 — Taiwan Trip</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="flex flex-col h-[100dvh] md:flex-row md:h-screen bg-slate-50 overflow-hidden font-sans">

        {/* ═══════════════════════════════════════════════
            DESKTOP LAYOUT
        ═══════════════════════════════════════════════ */}

        {/* Left: place library */}
        <aside className="hidden md:flex md:w-80 md:flex-shrink-0 flex-col bg-white shadow-lg z-10">
          {/* Header */}
          <div className="px-5 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇹🇼</span>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Taiwan Trip</h1>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
                >
                  🗺️ 地圖
                </Link>
                <Link
                  href="/admin"
                  className="text-xs text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
                >
                  ✏️ 管理
                </Link>
              </div>
            </div>
            <p className="text-xs text-slate-400 ml-10">🗂️ 地點庫</p>
          </div>
          <PlaceLibraryPanel />
        </aside>

        {/* Right: itinerary */}
        <main className="hidden md:flex md:flex-1 flex-col bg-slate-50">
          <ItineraryPanel />
        </main>

        {/* ═══════════════════════════════════════════════
            MOBILE LAYOUT
        ═══════════════════════════════════════════════ */}

        {/* Mobile top bar */}
        <div className="md:hidden flex-shrink-0 bg-white border-b border-slate-100 shadow-sm z-20">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">← 地圖</Link>
              <span className="text-slate-200 text-sm">|</span>
              <span className="text-base font-bold text-slate-800">📅 行程規劃</span>
            </div>
            <Link
              href="/admin"
              className="text-xs text-slate-400 hover:text-slate-700 transition-colors bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg"
            >
              ✏️ 管理
            </Link>
          </div>
        </div>

        {/* Mobile: tab content */}
        <div className="md:hidden flex-1 overflow-hidden flex flex-col">
          {mobileTab === 'itinerary' ? (
            <ItineraryPanel />
          ) : (
            <PlaceLibraryPanel />
          )}
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden flex-shrink-0 flex bg-white border-t border-slate-200 z-20">
          <button
            onClick={() => setMobileTab('itinerary')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
              mobileTab === 'itinerary' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <span className="text-xl">📅</span>
            <span className="text-xs font-medium flex items-center gap-1">
              行程
              {totalItinPlaces > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  mobileTab === 'itinerary' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {totalItinPlaces}
                </span>
              )}
            </span>
            {mobileTab === 'itinerary' && (
              <span className="absolute bottom-0 w-12 h-0.5 bg-slate-800 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setMobileTab('places')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
              mobileTab === 'places' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <span className="text-xl">🗂️</span>
            <span className="text-xs font-medium">地點庫</span>
            {mobileTab === 'places' && (
              <span className="absolute bottom-0 w-12 h-0.5 bg-slate-800 rounded-full" />
            )}
          </button>
        </nav>

      </div>

      {/* Click-outside overlay to close pickers */}
      {openPickerDay !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenPickerDay(null)}
        />
      )}
    </>
  );
}
