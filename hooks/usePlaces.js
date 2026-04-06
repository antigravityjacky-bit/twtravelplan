import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import defaultPlaces from '../data/places';

const STORAGE_KEY = 'tw_trip_places';

// ─── localStorage fallback (used when Supabase env vars are not set) ──────────

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultPlaces;
  } catch {
    return defaultPlaces;
  }
}

function saveToStorage(places) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export function usePlaces() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSupabase = !!supabase;

  // ── Fetch all places ──────────────────────────────────────────────────────
  const fetchPlaces = useCallback(async () => {
    if (!isSupabase) {
      setPlaces(loadFromStorage());
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('places')
      .select('*')
      .order('id', { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setPlaces(data);
    }
    setLoading(false);
  }, [isSupabase]);

  // ── Initial load + real-time subscription ────────────────────────────────
  useEffect(() => {
    fetchPlaces();

    if (!supabase) return;

    // Real-time: any INSERT / UPDATE / DELETE on the places table
    // automatically refreshes the list for all connected clients
    const channel = supabase
      .channel('places-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places' },
        () => fetchPlaces()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchPlaces]);

  // ── CRUD operations ───────────────────────────────────────────────────────

  async function addPlace(place) {
    if (!isSupabase) {
      const next = [...places, { ...place, id: Date.now() }];
      setPlaces(next);
      saveToStorage(next);
      return { error: null };
    }
    const { error: err } = await supabase.from('places').insert([place]);
    if (err) return { error: err.message };
    // realtime subscription will refresh automatically
    return { error: null };
  }

  async function updatePlace(updated) {
    if (!isSupabase) {
      const next = places.map((p) => (p.id === updated.id ? updated : p));
      setPlaces(next);
      saveToStorage(next);
      return { error: null };
    }
    const { id, ...fields } = updated; // strip id — cannot update a generated identity column
    const { error: err } = await supabase
      .from('places')
      .update(fields)
      .eq('id', id);
    if (err) return { error: err.message };
    return { error: null };
  }

  async function deletePlace(id) {
    if (!isSupabase) {
      const next = places.filter((p) => p.id !== id);
      setPlaces(next);
      saveToStorage(next);
      return { error: null };
    }
    const { error: err } = await supabase.from('places').delete().eq('id', id);
    if (err) return { error: err.message };
    return { error: null };
  }

  async function resetToDefaults() {
    if (!isSupabase) {
      localStorage.removeItem(STORAGE_KEY);
      setPlaces(defaultPlaces);
      return { error: null };
    }
    // Delete all rows then re-insert defaults
    const { error: delErr } = await supabase
      .from('places')
      .delete()
      .neq('id', 0); // matches all rows
    if (delErr) return { error: delErr.message };
    const { error: insErr } = await supabase
      .from('places')
      .insert(defaultPlaces.map(({ id: _id, ...rest }) => rest)); // strip local ids
    if (insErr) return { error: insErr.message };
    return { error: null };
  }

  return {
    places,
    loading,
    error,
    isSupabase,
    addPlace,
    updatePlace,
    deletePlace,
    resetToDefaults,
  };
}
