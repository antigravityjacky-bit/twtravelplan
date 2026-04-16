import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTrip } from '../context/TripContext';

const STORAGE_KEY = 'tw_trip_expenses';

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

export function useExpenses() {
  const { tripId, loading: tripLoading } = useTrip();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const isSupabase = !!supabase;
  const ready = !tripLoading && !!tripId;

  const fetchExpenses = useCallback(async () => {
    if (!isSupabase) {
      setExpenses(loadFromStorage());
      setLoading(false);
      return;
    }
    if (!ready) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (data) setExpenses(data);
    setLoading(false);
  }, [isSupabase, ready, tripId]);

  const refreshExpenses = useCallback(async () => {
    if (!isSupabase || !ready) return;
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (data) setExpenses(data);
  }, [isSupabase, ready, tripId]);

  useEffect(() => {
    fetchExpenses();

    function handleVisibility() {
      if (document.visibilityState === 'visible') refreshExpenses();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    if (!supabase || !tripId) return () => document.removeEventListener('visibilitychange', handleVisibility);

    const channel = supabase
      .channel(`expenses-changes-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` }, () =>
        refreshExpenses()
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses, refreshExpenses, tripId]);

  async function addExpense(data) {
    if (!isSupabase) {
      const next = [{ ...data, id: Date.now(), created_at: new Date().toISOString() }, ...expenses];
      setExpenses(next);
      saveToStorage(next);
      return { error: null };
    }
    const tempId = Date.now();
    setExpenses((prev) => [{ ...data, id: tempId, created_at: new Date().toISOString() }, ...prev]);
    const { error: err } = await supabase.from('expenses').insert([{ ...data, trip_id: tripId }]);
    if (err) { await refreshExpenses(); return { error: err.message }; }
    await refreshExpenses();
    return { error: null };
  }

  async function updateExpense(updated) {
    if (!isSupabase) {
      const next = expenses.map((e) => (e.id === updated.id ? { ...e, ...updated } : e));
      setExpenses(next);
      saveToStorage(next);
      return { error: null };
    }
    const { id, ...fields } = updated;
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...fields } : e)));
    const { error: err } = await supabase.from('expenses').update(fields).eq('id', id);
    if (err) { await refreshExpenses(); return { error: err.message }; }
    await refreshExpenses();
    return { error: null };
  }

  async function deleteExpense(id) {
    if (!isSupabase) {
      const next = expenses.filter((e) => e.id !== id);
      setExpenses(next);
      saveToStorage(next);
      return { error: null };
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    const { error: err } = await supabase.from('expenses').delete().eq('id', id);
    if (err) { await refreshExpenses(); return { error: err.message }; }
    return { error: null };
  }

  return { expenses, loading, isSupabase, addExpense, updateExpense, deleteExpense };
}
