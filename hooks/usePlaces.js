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

  // Full fetch: shows loading spinner (initial load only)
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

  // Silent refresh: updates data without flashing the loading spinner
  const refreshPlaces = useCallback(async () => {
    if (!isSupabase) return;
    const { data } = await supabase
      .from('places')
      .select('*')
      .order('id', { ascending: true });
    if (data) setPlaces(data);
  }, [isSupabase]);

  // ── Initial load + real-time subscription + visibility refetch ───────────
  useEffect(() => {
    fetchPlaces();

    // Refetch when user switches back to this tab (cross-tab sync)
    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshPlaces();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    if (!supabase) return () => document.removeEventListener('visibilitychange', handleVisibility);

    const channel = supabase
      .channel('places-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places' },
        () => refreshPlaces()
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [fetchPlaces, refreshPlaces]);

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
    await refreshPlaces();
    return { error: null };
  }

  async function updatePlace(updated) {
    if (!isSupabase) {
      const next = places.map((p) => (p.id === updated.id ? updated : p));
      setPlaces(next);
      saveToStorage(next);
      return { error: null };
    }
    // Optimistic update: reflect change immediately before server confirms
    const { id, ...fields } = updated;
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    const { error: err } = await supabase.from('places').update(fields).eq('id', id);
    if (err) {
      await refreshPlaces(); // revert on error
      return { error: err.message };
    }
    await refreshPlaces();
    return { error: null };
  }

  async function deletePlace(id) {
    if (!isSupabase) {
      const next = places.filter((p) => p.id !== id);
      setPlaces(next);
      saveToStorage(next);
      return { error: null };
    }
    // Optimistic update
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    const { error: err } = await supabase.from('places').delete().eq('id', id);
    if (err) {
      await refreshPlaces(); // revert on error
      return { error: err.message };
    }
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
