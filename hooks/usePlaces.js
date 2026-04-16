import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTrip } from '../context/TripContext';
import defaultPlaces from '../data/places';

const STORAGE_KEY = 'tw_trip_places';

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

export function usePlaces() {
  const { tripId, loading: tripLoading } = useTrip();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSupabase = !!supabase;
  // Gate: don't query until TripContext has resolved localStorage
  const ready = !tripLoading && !!tripId;

  const fetchPlaces = useCallback(async () => {
    if (!isSupabase) {
      setPlaces(loadFromStorage());
      setLoading(false);
      return;
    }
    if (!ready) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId)
      .order('id', { ascending: true });
    if (err) { setError(err.message); } else { setPlaces(data); }
    setLoading(false);
  }, [isSupabase, ready, tripId]);

  const refreshPlaces = useCallback(async () => {
    if (!isSupabase || !ready) return;
    const { data } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId)
      .order('id', { ascending: true });
    if (data) setPlaces(data);
  }, [isSupabase, ready, tripId]);

  useEffect(() => {
    fetchPlaces();

    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshPlaces();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    if (!supabase || !tripId) return () => document.removeEventListener('visibilitychange', handleVisibility);

    const channel = supabase
      .channel(`places-changes-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
        () => refreshPlaces()
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [fetchPlaces, refreshPlaces, tripId]);

  async function addPlace(place) {
    if (!isSupabase) {
      const next = [...places, { ...place, id: Date.now() }];
      setPlaces(next);
      saveToStorage(next);
      return { error: null };
    }
    const { error: err } = await supabase.from('places').insert([{ ...place, trip_id: tripId }]);
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
    const { id, ...fields } = updated;
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    const { error: err } = await supabase.from('places').update(fields).eq('id', id);
    if (err) { await refreshPlaces(); return { error: err.message }; }
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
    setPlaces((prev) => prev.filter((p) => p.id !== id));
    const { error: err } = await supabase.from('places').delete().eq('id', id);
    if (err) { await refreshPlaces(); return { error: err.message }; }
    return { error: null };
  }

  async function resetToDefaults() {
    if (!isSupabase) {
      localStorage.removeItem(STORAGE_KEY);
      setPlaces(defaultPlaces);
      return { error: null };
    }
    const { error: delErr } = await supabase
      .from('places')
      .delete()
      .eq('trip_id', tripId);
    if (delErr) return { error: delErr.message };
    const { error: insErr } = await supabase
      .from('places')
      .insert(defaultPlaces.map(({ id: _id, ...rest }) => ({ ...rest, trip_id: tripId })));
    if (insErr) return { error: insErr.message };
    return { error: null };
  }

  return { places, loading, error, isSupabase, addPlace, updatePlace, deletePlace, resetToDefaults };
}
