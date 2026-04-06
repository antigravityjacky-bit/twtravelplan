import { useState, useEffect } from 'react';
import defaultPlaces from '../data/places';

const STORAGE_KEY = 'tw_trip_places';

export function usePlaces() {
  const [places, setPlaces] = useState(defaultPlaces);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPlaces(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors, fall back to defaults
    }
    setLoaded(true);
  }, []);

  function persist(next) {
    setPlaces(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addPlace(place) {
    const next = [...places, { ...place, id: Date.now() }];
    persist(next);
  }

  function updatePlace(updated) {
    const next = places.map((p) => (p.id === updated.id ? updated : p));
    persist(next);
  }

  function deletePlace(id) {
    const next = places.filter((p) => p.id !== id);
    persist(next);
  }

  function resetToDefaults() {
    localStorage.removeItem(STORAGE_KEY);
    setPlaces(defaultPlaces);
  }

  return { places, loaded, addPlace, updatePlace, deletePlace, resetToDefaults };
}
