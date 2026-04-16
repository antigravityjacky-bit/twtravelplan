/**
 * Trip ID utilities and localStorage helpers for multi-trip support.
 */

const CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateTripId(len = 6) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => CHARSET[b % CHARSET.length]).join('');
}

// ── Active trip ──────────────────────────────────────────────────────────────
const ACTIVE_KEY = 'active_trip_id';

export function getActiveTripId() {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}

export function setActiveTripId(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
}

export function clearActiveTripId() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch {}
}

// ── Joined trips list ─────────────────────────────────────────────────────────
// Stored as JSON array of { id, name, destination }
const JOINED_KEY = 'joined_trips';

export function getJoinedTrips() {
  try {
    const raw = localStorage.getItem(JOINED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Upsert: add or refresh a trip in the device's joined list
export function saveJoinedTrip({ id, name, destination }) {
  try {
    const list = getJoinedTrips();
    const idx = list.findIndex((t) => t.id === id);
    const entry = { id, name, destination };
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);
    localStorage.setItem(JOINED_KEY, JSON.stringify(list));
  } catch {}
}

export function removeJoinedTrip(id) {
  try {
    const list = getJoinedTrips().filter((t) => t.id !== id);
    localStorage.setItem(JOINED_KEY, JSON.stringify(list));
  } catch {}
}
