import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import places from '../data/places';
import FilterBar from '../components/FilterBar';
import PlaceList from '../components/PlaceList';

// Disable SSR for the map — Leaflet requires browser APIs
const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPlace, setSelectedPlace] = useState(null);

  const filteredPlaces = useMemo(() => {
    if (activeCategory === 'All') return places;
    return places.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const counts = useMemo(() => {
    const c = { total: places.length };
    places.forEach((p) => {
      c[p.category] = (c[p.category] ?? 0) + 1;
    });
    return c;
  }, []);

  function handleCategoryChange(category) {
    setActiveCategory(category);
    setSelectedPlace(null);
  }

  function handleSelectPlace(place) {
    setSelectedPlace(place);
  }

  return (
    <>
      <Head>
        <title>🇹🇼 Taiwan Trip Planner</title>
        <meta name="description" content="Plan your Taiwan trip with an interactive map" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        {/* ── Left Panel ── */}
        <aside className="w-96 flex-shrink-0 flex flex-col bg-white shadow-lg z-10">
          {/* Header */}
          <div className="px-5 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🇹🇼</span>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                Taiwan Trip
              </h1>
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
            <PlaceList
              places={filteredPlaces}
              selectedPlace={selectedPlace}
              onSelectPlace={handleSelectPlace}
            />
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-300">
              Data based on real Taipei locations
            </p>
          </div>
        </aside>

        {/* ── Right Panel: Map ── */}
        <main className="flex-1 relative">
          <MapView
            places={filteredPlaces}
            selectedPlace={selectedPlace}
            onSelectPlace={handleSelectPlace}
          />

          {/* Floating legend */}
          <div className="absolute bottom-6 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-3 text-xs space-y-1.5">
            <p className="font-semibold text-slate-600 mb-2">Legend</p>
            {[
              { label: 'Food', color: '#F59E0B' },
              { label: 'Attraction', color: '#3B82F6' },
              { label: 'Hotel', color: '#8B5CF6' },
              { label: 'Bar', color: '#F43F5E' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
