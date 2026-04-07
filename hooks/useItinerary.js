import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── localStorage fallback (when Supabase env vars are not set) ───────────────

const STORAGE_KEY = 'tw_trip_itinerary';

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

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useItinerary() {
  const [items, setItems] = useState([]); // [{ id, day_number, place_id, sort_order }]
  const [loading, setLoading] = useState(true);

  const isSupabase = !!supabase;

  // ── Fetch all itinerary items ─────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    if (!isSupabase) {
      setItems(loadFromStorage());
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('itinerary_items')
      .select('*')
      .order('day_number', { ascending: true })
      .order('sort_order', { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  }, [isSupabase]);

  // ── Initial load + real-time subscription ─────────────────────────────────
  useEffect(() => {
    fetchItems();
    if (!supabase) return;

    const channel = supabase
      .channel('itinerary-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itinerary_items' },
        () => fetchItems()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchItems]);

  // ── Derived: unique sorted day numbers ────────────────────────────────────
  const days = [...new Set(items.map((i) => i.day_number))].sort((a, b) => a - b);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function addItem(day_number, place_id) {
    const dayItems = items.filter((i) => i.day_number === day_number);
    const sort_order = dayItems.length > 0
      ? Math.max(...dayItems.map((i) => i.sort_order)) + 1
      : 0;

    if (!isSupabase) {
      const newItem = { id: Date.now(), day_number, place_id, sort_order };
      const next = [...items, newItem];
      setItems(next);
      saveToStorage(next);
      return;
    }
    await supabase.from('itinerary_items').insert([{ day_number, place_id, sort_order }]);
    // realtime subscription will refresh
  }

  async function removeItem(id) {
    if (!isSupabase) {
      const next = items.filter((i) => i.id !== id);
      setItems(next);
      saveToStorage(next);
      return;
    }
    await supabase.from('itinerary_items').delete().eq('id', id);
  }

  // Adds a new day (next number after current max)
  async function addDay() {
    const nextDay = days.length > 0 ? Math.max(...days) + 1 : 1;
    if (!isSupabase) {
      // No items yet, just track the day number via a placeholder approach:
      // We store a sentinel item with place_id = null to reserve the day slot.
      const sentinel = { id: Date.now(), day_number: nextDay, place_id: null, sort_order: -1 };
      const next = [...items, sentinel];
      setItems(next);
      saveToStorage(next);
      return;
    }
    await supabase.from('itinerary_items').insert([{ day_number: nextDay, place_id: null, sort_order: -1 }]);
  }

  // Remove all items for a day
  async function removeDay(day_number) {
    if (!isSupabase) {
      const next = items.filter((i) => i.day_number !== day_number);
      setItems(next);
      saveToStorage(next);
      return;
    }
    await supabase.from('itinerary_items').delete().eq('day_number', day_number);
  }

  // After drag-end: newOrderedIds = item ids in the new order for that day
  async function reorderDay(day_number, newOrderedIds) {
    // Optimistic update
    const updated = items.map((item) => {
      const idx = newOrderedIds.indexOf(item.id);
      if (idx === -1) return item;
      return { ...item, sort_order: idx };
    });
    setItems(updated);
    if (!isSupabase) {
      saveToStorage(updated);
      return;
    }
    // Batch update sort_order
    await Promise.all(
      newOrderedIds.map((id, idx) =>
        supabase.from('itinerary_items').update({ sort_order: idx }).eq('id', id)
      )
    );
  }

  return {
    items,
    days,
    loading,
    isSupabase,
    addItem,
    removeItem,
    addDay,
    removeDay,
    reorderDay,
  };
}
