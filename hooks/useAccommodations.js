import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTrip } from '../context/TripContext';

const STORAGE_KEY = 'tw_trip_accommodations';

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useAccommodations() {
  const { tripId, loading: tripLoading } = useTrip();
  const [accommodations, setAccommodations] = useState([]);
  const [loading, setLoading] = useState(true);

  const isSupabase = !!supabase;
  const ready = !tripLoading && !!tripId;

  const fetchAccommodations = useCallback(async () => {
    if (!isSupabase) {
      setAccommodations(loadFromStorage());
      setLoading(false);
      return;
    }
    if (!ready) {
      setAccommodations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('accommodations')
      .select('*')
      .eq('trip_id', tripId)
      .order('id', { ascending: true });
    if (data) setAccommodations(data);
    setLoading(false);
  }, [isSupabase, ready, tripId]);

  const refreshAccommodations = useCallback(async () => {
    if (!isSupabase || !ready) return;
    const { data } = await supabase
      .from('accommodations')
      .select('*')
      .eq('trip_id', tripId)
      .order('id', { ascending: true });
    if (data) setAccommodations(data);
  }, [isSupabase, ready, tripId]);

  useEffect(() => {
    fetchAccommodations();

    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshAccommodations();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    if (!supabase || !tripId) return () => document.removeEventListener('visibilitychange', handleVisibility);

    const channel = supabase
      .channel(`accommodations-changes-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accommodations', filter: `trip_id=eq.${tripId}` }, () =>
        refreshAccommodations()
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [fetchAccommodations, refreshAccommodations, tripId]);

  async function addAccommodation(data) {
    if (!isSupabase) {
      const next = [...accommodations, { ...data, id: Date.now() }];
      setAccommodations(next);
      saveToStorage(next);
      return { error: null };
    }
    const tempId = Date.now();
    setAccommodations((prev) => [...prev, { ...data, id: tempId }]);
    const { error: err } = await supabase.from('accommodations').insert([{ ...data, trip_id: tripId }]);
    if (err) { await refreshAccommodations(); return { error: err.message }; }
    await refreshAccommodations();
    return { error: null };
  }

  async function updateAccommodation(updated) {
    if (!isSupabase) {
      const next = accommodations.map((a) => (a.id === updated.id ? updated : a));
      setAccommodations(next);
      saveToStorage(next);
      return { error: null };
    }
    const { id, ...fields } = updated;
    setAccommodations((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)));
    const { error: err } = await supabase.from('accommodations').update(fields).eq('id', id);
    if (err) { await refreshAccommodations(); return { error: err.message }; }
    await refreshAccommodations();
    return { error: null };
  }

  async function deleteAccommodation(id) {
    if (!isSupabase) {
      const next = accommodations.filter((a) => a.id !== id);
      setAccommodations(next);
      saveToStorage(next);
      return { error: null };
    }
    setAccommodations((prev) => prev.filter((a) => a.id !== id));
    const { error: err } = await supabase.from('accommodations').delete().eq('id', id);
    if (err) { await refreshAccommodations(); return { error: err.message }; }
    return { error: null };
  }

  return {
    accommodations,
    loading,
    isSupabase,
    addAccommodation,
    updateAccommodation,
    deleteAccommodation,
  };
}
