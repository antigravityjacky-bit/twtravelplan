import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  getActiveTripId, setActiveTripId, clearActiveTripId, saveJoinedTrip,
} from '../lib/tripUtils';

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [tripId,  setTripIdState] = useState(null);
  const [trip,    setTrip]        = useState(null);
  // loading: true while we're reading localStorage (SSR-safe: false on server)
  const [loading, setLoading]     = useState(true);

  // Read active trip from localStorage on mount (client-only)
  useEffect(() => {
    const id = getActiveTripId();
    setTripIdState(id);
    setLoading(false);
  }, []);

  // Whenever tripId changes, fetch the full trip row
  useEffect(() => {
    if (!tripId || !supabase) { setTrip(null); return; }
    supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single()
      .then(({ data }) => {
        if (data) {
          setTrip(data);
          saveJoinedTrip({ id: data.id, name: data.name, destination: data.destination });
        } else {
          // Trip was deleted or never existed — clear it
          setTrip(null);
        }
      });
  }, [tripId]);

  const activateTrip = useCallback((id) => {
    setActiveTripId(id);
    setTripIdState(id);
  }, []);

  const deactivateTrip = useCallback(() => {
    clearActiveTripId();
    setTripIdState(null);
    setTrip(null);
  }, []);

  return (
    <TripContext.Provider value={{ tripId, trip, loading, activateTrip, deactivateTrip }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}
