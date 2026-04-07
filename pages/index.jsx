import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { usePlaces } from '../hooks/usePlaces';
import FilterBar, { CATEGORY_BORDER, CATEGORY_BADGE } from '../components/FilterBar';
import PlaceList from '../components/PlaceList';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

const CATEGORY_ICON = {
  Breakfast:  '🍳',
  Cafe:       '☕',
  Restaurant: '🍽️',
  Attraction: '🗺️',
  Hotel:      '🏨',
  Bar:        '🍸',
  Food:       '🍜', // backward-compat
};

export default function Home() {
  const { places, loading } = usePlaces();
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'list'

  const filteredPlaces = useMemo(() => {
    if (activeCategory === 'All') return places;
    return places.filter((p) => p.category === activeCategory);
  }, [activeCategory, places]);

  const counts = useMemo(() => {
    const c = { total: places.length };
    places.forEach((p) => { c[p.category] = (c[p.category] ?? 0) + 1; });
    return c;
  }, [places]);

  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSelectedPlace(null);
  }

  // Desktop: clicking a card flies the map to it
  function handleSelectPlaceDesktop(place) {
    setSelectedPlace(place);
  }

  // Mobile: clicking a list card flies to map AND switches to map tab
  function handleSelectPlaceMobile(place) {
    setSelectedPlace(place);
    setMobileTab('map');
  }

  // Mobile: clicking a map pin selects it and shows the float card
  function handleMapPin(place) {
    setSelectedPlace(place);
  }

  return (
    <>
      <Head>
        <title>🇹🇼 Taiwan Trip Planner</title>
        <meta name="description" content="Plan your Taiwan trip with an interactive map" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Root: column on mobile, row on desktop */}
      <div className="flex flex-col h-[100dvh] md:flex-row md:h-screen bg-slate-50 overflow-hidden font-sans">

        {/* ═══════════════════════════════════════════════
            DESKTOP LEFT PANEL (hidden on mobile)
        ═══════════════════════════════════════════════ */}
        <aside className="hidden md:flex md:w-96 md:flex-shrink-0 flex-col bg-white shadow-lg z-10">
          {/* Header */}
          <div className="px-5 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇹🇼</span>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Taiwan Trip</h1>
              </div>
              <Link
                href="/itinerary"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-100"
              >
                📅 行程
              </Link>
              <Link
                href="/admin"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors px-2.5 py-1 rounded-lg hover:bg-slate-100"
              >
                ✏️ 管理地點
              </Link>
            </div>
            <p className="text-xs text-slate-400 ml-10">
              {filteredPlaces.length} place{filteredPlaces.length !== 1 ? 's' : ''} · Taipei
            </p>
          </div>

          {/* Filter Bar */}
          <div className="px-4 py-4 border-b border-slate-100">
            <FilterBar
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              counts={counts}
            />
          </div>

          {/* Place List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-3xl mb-2 animate-pulse">🗺️</p>
                <p className="text-slate-400 text-sm">載入中...</p>
              </div>
            ) : (
              <PlaceList
                places={filteredPlaces}
                selectedPlace={selectedPlace}
                onSelectPlace={handleSelectPlaceDesktop}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-300">Data based on real Taipei locations</p>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════════
            MOBILE TOP BAR (hidden on desktop)
        ═══════════════════════════════════════════════ */}
        <div className="md:hidden flex-shrink-0 bg-white border-b border-slate-100 shadow-sm z-20">
          {/* Header row */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🇹🇼</span>
              <h1 className="text-base font-bold text-slate-800 tracking-tight">Taiwan Trip</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/itinerary"
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg"
              >
                📅 行程
              </Link>
              <Link
                href="/admin"
                className="text-xs text-slate-400 hover:text-slate-700 transition-colors bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg"
              >
                ✏️ 管理
              </Link>
            </div>
          </div>
          {/* Horizontal scrollable filter */}
          <div className="px-4 pb-3">
            <FilterBar
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              counts={counts}
              mobile
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            MAP PANEL
            Desktop: always visible (flex-1)
            Mobile: visible when mobileTab === 'map'
        ═══════════════════════════════════════════════ */}
        <main
          className={`relative flex-1 ${
            mobileTab === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full bg-slate-100">
              <p className="text-slate-400 animate-pulse text-sm">地圖載入中...</p>
            </div>
          ) : (
            <MapView
              places={filteredPlaces}
              selectedPlace={selectedPlace}
              onSelectPlace={handleMapPin}
            />
          )}

          {/* Desktop floating legend */}
          <div className="hidden md:block absolute bottom-6 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-3 text-xs space-y-1.5">
            <p className="font-semibold text-slate-600 mb-2">Legend</p>
            {[
              { label: '🍳 早餐店',   color: '#FBBF24' },
              { label: '☕ 咖啡店',   color: '#78716C' },
              { label: '🍽️ 餐廳',    color: '#F97316' },
              { label: '🗺️ Attraction', color: '#3B82F6' },
              { label: '🏨 Hotel',    color: '#8B5CF6' },
              { label: '🍸 Bar',      color: '#F43F5E' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-slate-600">{label}</span>
              </div>
            ))}
          </div>

          {/* ── Mobile selected-place float card ── */}
          {selectedPlace && mobileTab === 'map' && (
            <div className="md:hidden absolute bottom-2 left-3 right-3 z-[1000]">
              <div
                className={`
                  bg-white rounded-2xl shadow-2xl border-l-4 p-3.5
                  ${CATEGORY_BORDER[selectedPlace.category]}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-snug truncate">
                      {selectedPlace.name}
                    </p>
                    {selectedPlace.nameEn && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{selectedPlace.nameEn}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      📍 {selectedPlace.address}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setSelectedPlace(null)}
                      className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                    >
                      ✕
                    </button>
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${CATEGORY_BADGE[selectedPlace.category]}`}
                    >
                      {CATEGORY_ICON[selectedPlace.category]} {selectedPlace.category}
                    </span>
                  </div>
                </div>
                {selectedPlace.description && (
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {selectedPlace.description}
                  </p>
                )}
                {/* Tap to view in list */}
                <button
                  onClick={() => setMobileTab('list')}
                  className="mt-2.5 w-full text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  查看完整列表 →
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ═══════════════════════════════════════════════
            MOBILE LIST PANEL (hidden on desktop & when mobileTab==='map')
        ═══════════════════════════════════════════════ */}
        <div
          className={`md:hidden flex-1 overflow-y-auto bg-slate-50 px-4 py-4 scrollbar-thin ${
            mobileTab === 'map' ? 'hidden' : 'block'
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-3xl mb-2 animate-pulse">🗺️</p>
              <p className="text-slate-400 text-sm">載入中...</p>
            </div>
          ) : (
            <PlaceList
              places={filteredPlaces}
              selectedPlace={selectedPlace}
              onSelectPlace={handleSelectPlaceMobile}
            />
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            MOBILE BOTTOM TAB BAR (hidden on desktop)
        ═══════════════════════════════════════════════ */}
        <nav className="md:hidden flex-shrink-0 flex bg-white border-t border-slate-200 pb-safe z-20">
          <button
            onClick={() => setMobileTab('map')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
              mobileTab === 'map' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <span className="text-xl">🗺️</span>
            <span className="text-xs font-medium">地圖</span>
            {mobileTab === 'map' && (
              <span className="absolute bottom-0 w-12 h-0.5 bg-slate-800 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setMobileTab('list')}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative ${
              mobileTab === 'list' ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            <span className="text-xl">📋</span>
            <span className="text-xs font-medium flex items-center gap-1">
              列表
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                mobileTab === 'list'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {filteredPlaces.length}
              </span>
            </span>
            {mobileTab === 'list' && (
              <span className="absolute bottom-0 w-12 h-0.5 bg-slate-800 rounded-full" />
            )}
          </button>
        </nav>

      </div>
    </>
  );
}
